# myframe8 首页

myframe8 项目静态首页（单页，无构建步骤）。

- `index.html`：源文件（唯一真源）
- `dist/index.html`：发布产物（从源文件复制；Qoder Sites 发布使用该目录）

本地预览：`python -m http.server 8901 --directory dist`

发布通道：
- Qoder Sites：自动发布（经工具完成）
- GitHub Pages：推送到 GitHub 后由 Pages 服务仓库根目录
