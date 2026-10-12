# myframe8 站点

演示 Qoder Sites 能力的小站：多页静态前端 + 一个站内边缘函数 + 托管数据库，双通道发布（Qoder Sites / GitHub Pages）。无框架、无构建步骤。

## 结构

- `index.html` / `board.html` / `status.html` / `about.html`：页面源文件（唯一真源）
- `styles.css` / `app.js`：共享样式与请求助手（由官方 TS 样例移植为纯 JS）
- `dist/`：发布产物（页面与静态资源从源文件复制；Qoder Sites 发布的 webDirectory，GitHub Pages 服务仓库根目录的同一份内容）
- `functions/`：站点函数（`index.ts` 入口、`handler.mjs` 业务逻辑、`adapter.mjs` 官方适配器，勿改）；仅 Qoder Sites 使用
- `dev/preview-server.mjs`：本地预览（静态文件 + 同源函数代理，内存样例数据）

## 本地预览

```bash
node dev/preview-server.mjs 8902
# 打开 http://127.0.0.1:8902/
```

留言板在本地使用内存样例数据（25 条中文样例）；云端为真实托管数据库。

## 发布通道

- Qoder Sites：静态 + 函数 + 数据库完整能力（经工具 prepare/publish）
- GitHub Pages：静态镜像，无后端；留言板在镜像上自动提示降级
