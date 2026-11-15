# tidestack-approval-workflow-designer

TideStack 审批流编辑器与只读流程图，沿用 React Flow、AMIS 和 SDK 宿主接入。

本仓由平台总仓按清单单向导出，源码和测试保持同源；贡献请回到平台主仓评审。默认分支为 `master`。

## 开发与构建

使用 Node.js 22 和 npm：

```bash
npm run install:dependencies
npm run build
npm test
```

构建输出位于 `frontends/web/ouroboros-approval-workflow-designer/dist`；可在该目录执行包内 `npm run package` 生成微前端 ZIP。

宿主需提供 React／ReactDOM、SDK 生命周期及字段／候选人来源，注册入口为 `workflow-editor` 和 `workflow-diagram-viewer`；保存和发布由宿主页面负责。webpack 与单元测试按原路径引用本仓携带的 SDK 源码。

## 授权

本分发采用 Apache License 2.0，见 `LICENSE`。携带的 SDK 保留其 ISC 授权声明，见 [NOTICE](NOTICE)。
