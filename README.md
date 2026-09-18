# MOODY Music Archive (Vercel Edition)

一个高性能、高颜值的音乐存档 Web 应用。本项目已针对 Vercel 部署进行深度优化，移除所有本地 Docker 依赖，实现零配置一键上线。

## 🌟 核心特性
- **极致美学**: 采用玻璃拟态（Glassmorphism）设计，结合现代字族，提供沉浸式视觉体验。
- **动态黑胶播放器**: 1:1 还原黑胶唱片交互逻辑，支持唱臂联动与旋转律动。
- **全边缘计算架构**: 
  - **后端**: Cloudflare Workers (Serverless)
  - **数据库**: Cloudflare D1 (SQL)
  - **存储**: Cloudflare R2 (Object Storage)
- **CI/CD 集成**: 代码推送到 GitHub 后，Vercel 自动触发秒级构建与部署。

## 🚀 快速部署指南
1. **推送代码**: 将本项目目录推送至您的个人 GitHub 仓库。
2. **关联 Vercel**: 
   - 登录 [Vercel 控制台](https://vercel.com/)。
   - 点击 **Add New Project**。
   - 导入对应的代码库。
3. **配置项目**:
   - **Framework Preset**: 选择 `Static Site` 或 `Other`。
   - **Build Command**: 留空。
   - **Output Directory**: `.` (根目录)。
4. **即刻访问**:
   - 官方线上主站（播放器）：[https://moody-music-archiv-vercel.vercel.app/](https://moody-music-archiv-vercel.vercel.app/)
   - 官方管理后台（CMS）：[https://moody-music-archiv-vercel.vercel.app/admin/](https://moody-music-archiv-vercel.vercel.app/admin/)

## 🛠 维护说明
- **API 调整**: 如果您的后端 Worker 域名发生变更，请修改 `src/js/app.js` 中的 `API_CONFIG.apiBase`。
- **数据库同步**: 数据库相关的 D1 SQL 文件存放在 `docs/` 目录下，可用于初始化。
- **更多文档**: 请参阅 `docs/MAINTENANCE_GUIDE.md`。

---
*Created by Antigravity for MOODY Project.*
