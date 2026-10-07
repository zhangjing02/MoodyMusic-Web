// MoodyMusic WebAssembly Guard Module (music_guard.wasm)
// High-performance binary decryption with DOM Host Environment Verification

@external("env", "check_host_probe")
declare function check_host_probe(): i32;

// Moody internal encryption key (32 bytes)
const KEY_BYTES: u8[] = [
  0x4d, 0x6f, 0x6f, 0x64, 0x79, 0x4d, 0x75, 0x73, // MoodyMus
  0x69, 0x63, 0x2d, 0x57, 0x65, 0x62, 0x47, 0x75, // ic-WebGu
  0x61, 0x72, 0x64, 0x2d, 0x53, 0x65, 0x63, 0x72, // ard-Secr
  0x65, 0x74, 0x2d, 0x32, 0x30, 0x32, 0x36, 0x21  // et-2026!
];

// Pre-allocated static buffers (safe against memory re-allocation)
const salt_buf = new Uint8Array(8);
const cipher_buf = new Uint8Array(4096);
const out_buf = new Uint8Array(4096);

export function get_salt_ptr(): usize { return salt_buf.dataStart; }
export function get_cipher_ptr(): usize { return cipher_buf.dataStart; }
export function get_out_ptr(): usize { return out_buf.dataStart; }

// Expected host magic token
const EXPECTED_MAGIC: i32 = 0x4D4F4F44; // 'MOOD'

/**
 * High-speed symmetric decryption of stream URLs
 * @param cipher_len Length of input ciphertext bytes
 * @returns Decrypted length in out_buf, or -1 on unauthorized host
 */
export function decrypt(cipher_len: i32): i32 {
  // 1. Mandatory Host Environment Probe: Verify running in authentic browser DOM
  if (check_host_probe() != EXPECTED_MAGIC) {
    return -1; // Abort on headless crawler / non-whitelisted domain
  }
  if (cipher_len <= 0 || cipher_len > 4096) return -1;

  // 2. KSA: Initialize S-Box with Key + Salt
  const s = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    s[i] = <u8>i;
  }

  const comb = new Uint8Array(40);
  for (let i = 0; i < 32; i++) {
    comb[i] = KEY_BYTES[i];
  }
  for (let i = 0; i < 8; i++) {
    comb[32 + i] = salt_buf[i];
  }

  let j: i32 = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + <i32>s[i] + <i32>comb[i % 40]) & 0xff;
    const tmp = s[i];
    s[i] = s[j];
    s[j] = tmp;
  }

  // 3. Drop first 512 bytes to eliminate state bias
  let si: i32 = 0;
  let sj: i32 = 0;
  for (let d = 0; d < 512; d++) {
    si = (si + 1) & 0xff;
    sj = (sj + <i32>s[si]) & 0xff;
    const tmp = s[si];
    s[si] = s[sj];
    s[sj] = tmp;
  }

  // 4. Stream decrypt
  for (let k = 0; k < cipher_len; k++) {
    si = (si + 1) & 0xff;
    sj = (sj + <i32>s[si]) & 0xff;
    const tmp = s[si];
    s[si] = s[sj];
    s[sj] = tmp;
    const key_byte = s[(<i32>s[si] + <i32>s[sj]) & 0xff];
    out_buf[k] = cipher_buf[k] ^ key_byte;
  }

  return cipher_len;
}
