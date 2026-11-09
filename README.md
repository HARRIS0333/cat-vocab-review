# 小咪学生字

统编版小学语文四年级上册每课生字认读与手写复习工具，适配 iPad、iPhone 和触控笔。

这是一个完全静态的浏览器应用：不需要 NAS、Docker、后端服务、账号或数据库。课程数据、判定逻辑和进度都在这台设备上运行。

## 本地运行

要求 Node.js 22 或更新版本。

```bash
npm ci
npm run dev
```

打开终端显示的地址即可开始使用。

## 测试与构建

```bash
npm test -- --run
npx playwright install --with-deps webkit
npm run test:e2e
npm run build
npm run verify:dist
npm run preview
```

- 单元测试使用 Vitest。
- E2E 使用 Playwright WebKit，覆盖 iPhone 竖屏/横屏和 iPad 竖屏/横屏，并验证子路径加载、书写判定与离线流程。
- 构建产物输出到 `dist`；本地预览使用 `npm run preview`。
- `npm run verify:dist` 会校验课程分组、汉字数据、许可文件和 Service Worker 预缓存清单；应在构建后、部署前运行。

## 部署到 GitHub Pages

1. 将仓库推送到 GitHub，并确认默认分支为 `main`。
2. 在仓库的 **Settings → Pages** 中把 **Source** 设为 **GitHub Actions**。
3. 推送到 `main` 后，工作流会先运行单元测试和 WebKit E2E，再以仓库名作为子路径构建，最后上传并部署 `dist`。
4. 等待 Actions 完成后，访问 `https://<你的用户名>.github.io/<仓库名>/`。
5. 构建路径由工作流注入为 `VITE_BASE_PATH=/<仓库名>/`，无需修改源码。

应用使用 Hash 路由，刷新练习页不会触发服务器路径回退，因此不需要 `404.html` fallback。不要在仓库中写入自定义域名、账号信息或明文访问令牌。

## 在 iPad/iPhone 上使用

1. 用 Safari 打开部署地址。
2. 等待页面显示“已可离线使用”。
3. 点击分享按钮，选择“添加到主屏幕”。
4. 后续可以从主屏幕像普通应用一样打开。

进入首页后，先从上、下或侧边课目列表选择一课；练习页顶部的“认读 / 书写”可以随时切换模式。书写时还可以选择“仅写字表”“仅识字表”或“两表都有”。如需清空本机记录，回到首页点击“清除学习进度”，并在确认框中再次确认。

首次联网加载并完成离线缓存后，课程、笔画数据和本地进度可在断网时继续使用。iOS/iPadOS 私密浏览模式可能无法保留网站数据，也可能无法稳定完成离线缓存。

## 数据与隐私

- 手写轨迹只在设备内存中处理，不上传、不保存，也不写入原始笔迹或截图。
- 持久复习进度保存在当前浏览器的 `localStorage` 中；本次练习结果和重练队列只在 `sessionStorage` 中暂存。
- iPad 与 iPhone 的进度互不相同，不跨设备同步。
- 清除进度会同时删除最近练习与错字记录；清除网站数据也会使进度丢失。
- 应用不接入统计、广告、第三方识别服务或账号系统。网络只在首次加载和获取应用更新时需要。
- 若出现“发现新版本”提示，请先完成当前题再点击“更新应用”。更新过程不会自动刷新答题页面，已保存的进度应继续保留。

## 项目资料与许可

`work` 目录是人工核对资料和中间文件的工作区，不参与构建，也不提交到仓库。生产包只包含构建所需的结构化课程和笔画数据。

第三方许可见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。Hanzi Writer 使用 MIT License；字符数据受 Arphic Public License 约束，完整许可文本保留在 `licenses` 目录并由构建复制到产品内。
