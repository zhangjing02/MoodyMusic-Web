/**
 * MoodyMusic WebGuard (音乐资产二进制安全守卫引擎)
 * =========================================================================
 * 1. 方案一：Web 专属字段流密码对称解密 (moody://enc_v1:...)
 * 2. 方案三：WebAssembly (music_guard.wasm) 二进制封装 + 浏览器 DOM 宿主环境防搬砖探针
 * 3. 性能保障：纯同步 (Sync) 秒级解密 (< 0.02ms)，零延迟无感契合音频 Blob 预加载机制
 * =========================================================================
 */

(function () {
  'use strict';

  const MOODY_MAGIC = 0x4D4F4F44; // 'MOOD'
  const FALLBACK_KEY = 'MoodyMusic-WebGuard-Secret-2026!';

  // 白名单域名校验
  function isAllowedHost() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    try {
      const host = window.location.hostname || '';
      return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.ccwu.cc') ||
        host.endsWith('ccwu.cc') ||
        host.endsWith('.netlify.app')
      );
    } catch (_) {
      return false;
    }
  }

  // 宿主环境探针（供 Wasm 回调）
  function hostProbe() {
    if (!isAllowedHost()) return 0;
    // 检查是否存在真实浏览器 DOM 根容器
    if (!document.documentElement || !document.body) return 0;
    return MOODY_MAGIC;
  }

  let wasmInstance = null;
  let wasmMemory = null;
  let wasmSaltPtr = 0;
  let wasmCipherPtr = 0;
  let wasmOutPtr = 0;
  let wasmReady = false;

  // 纯 JS 同步兜底解密器（保障 Wasm 未完成加载或极端环境下的 100% 播放高可用）
  function jsSyncDecrypt(cipherStr) {
    if (!cipherStr || !cipherStr.startsWith('moody://enc_v1:')) return cipherStr;
    if (!isAllowedHost()) {
      console.warn('[MoodyGuard] 宿主环境探针校验未通过，拒绝解密！');
      return '';
    }

    const hex = cipherStr.slice('moody://enc_v1:'.length);
    if (hex.length < 16) return cipherStr;
    const saltHex = hex.slice(0, 16);
    const bodyHex = hex.slice(16);

    const salt = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      salt[i] = parseInt(saltHex.substr(i * 2, 2), 16);
    }

    const bodyLen = bodyHex.length / 2;
    const body = new Uint8Array(bodyLen);
    for (let i = 0; i < bodyLen; i++) {
      body[i] = parseInt(bodyHex.substr(i * 2, 2), 16);
    }

    // KSA
    const keyBytes = new TextEncoder().encode(FALLBACK_KEY);
    const comb = new Uint8Array(keyBytes.length + salt.length);
    comb.set(keyBytes, 0);
    comb.set(salt, keyBytes.length);

    const s = new Uint8Array(256);
    for (let i = 0; i < 256; i++) s[i] = i;
    let j = 0;
    for (let i = 0; i < 256; i++) {
      j = (j + s[i] + comb[i % comb.length]) & 0xff;
      const tmp = s[i]; s[i] = s[j]; s[j] = tmp;
    }

    // Drop 512
    let si = 0, sj = 0;
    for (let d = 0; d < 512; d++) {
      si = (si + 1) & 0xff;
      sj = (sj + s[si]) & 0xff;
      const tmp = s[si]; s[si] = s[sj]; s[sj] = tmp;
    }

    const plain = new Uint8Array(bodyLen);
    for (let k = 0; k < bodyLen; k++) {
      si = (si + 1) & 0xff;
      sj = (sj + s[si]) & 0xff;
      const tmp = s[si]; s[si] = s[sj]; s[sj] = tmp;
      plain[k] = body[k] ^ s[(s[si] + s[sj]) & 0xff];
    }

    return new TextDecoder().decode(plain);
  }

  // Wasm 内存同步解密
  function wasmSyncDecrypt(cipherStr) {
    if (!wasmReady || !wasmInstance) return jsSyncDecrypt(cipherStr);
    if (!cipherStr || !cipherStr.startsWith('moody://enc_v1:')) return cipherStr;

    const hex = cipherStr.slice('moody://enc_v1:'.length);
    if (hex.length < 16) return cipherStr;
    const saltHex = hex.slice(0, 16);
    const bodyHex = hex.slice(16);

    const bodyLen = bodyHex.length / 2;
    if (bodyLen > 4096) return jsSyncDecrypt(cipherStr); // 超出 Wasm 缓冲区时降级

    const mem = new Uint8Array(wasmMemory.buffer);

    // 拷贝 Salt 到 Wasm 内存
    for (let i = 0; i < 8; i++) {
      mem[wasmSaltPtr + i] = parseInt(saltHex.substr(i * 2, 2), 16);
    }

    // 拷贝密文到 Wasm 内存
    for (let i = 0; i < bodyLen; i++) {
      mem[wasmCipherPtr + i] = parseInt(bodyHex.substr(i * 2, 2), 16);
    }

    // 调用 Wasm 核心解密例程
    const outLen = wasmInstance.exports.decrypt(bodyLen);
    if (outLen < 0) {
      console.warn('[MoodyGuard] Wasm 宿主安全阻断 (Probe Mismatch)');
      return '';
    }

    const outBytes = mem.subarray(wasmOutPtr, wasmOutPtr + outLen);
    return new TextDecoder().decode(outBytes);
  }

  // 初始化加载 Wasm 二进制
  async function initWasm() {
    try {
      const wasmUrl = new URL('/src/wasm/music_guard.wasm', window.location.origin).href;
      const response = await fetch(wasmUrl);
      if (!response.ok) {
        console.warn('[MoodyGuard] 无法加载 music_guard.wasm，自动启用 JS 守卫兜底');
        return;
      }
      const bytes = await response.arrayBuffer();
      const { instance } = await WebAssembly.instantiate(bytes, {
        env: {
          check_host_probe: hostProbe,
          abort: () => { console.error('[MoodyGuard] Wasm Aborted'); }
        }
      });

      wasmInstance = instance;
      wasmMemory = instance.exports.memory;
      wasmSaltPtr = instance.exports.get_salt_ptr();
      wasmCipherPtr = instance.exports.get_cipher_ptr();
      wasmOutPtr = instance.exports.get_out_ptr();
      wasmReady = true;
      console.log('[MoodyGuard] 🛡️ 音乐守护引擎就绪 (WebAssembly 硬件级加速 + DOM 防搬砖探针激活)');
    } catch (e) {
      console.warn('[MoodyGuard] WebAssembly 初始化波动，启用原生 JS 守卫:', e.message);
    }
  }

  // 全局暴露 MoodyGuard 接口
  window.MoodyGuard = {
    isReady: () => wasmReady,
    init: initWasm,
    /**
     * 同步解密歌曲音频流路径
     * @param {string} path - 密文路径 (moody://enc_v1:...) 或普通 URL
     * @returns {string} 解密后的真实网关短链
     */
    decryptPath: function (path) {
      if (!path || typeof path !== 'string') return path;
      if (!path.startsWith('moody://enc_v1:')) return path;
      return wasmReady ? wasmSyncDecrypt(path) : jsSyncDecrypt(path);
    }
  };

  // 页面启动时自启动加载 Wasm
  if (typeof window !== 'undefined') {
    initWasm();
  }
})();
