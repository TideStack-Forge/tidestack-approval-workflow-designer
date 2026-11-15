# ouroboros-approval-workflow-designer

审批流设计器微前端使用 webpack + React 开发，并以 Amis 组件库形式接入平台。

## 当前产品主链

- 编辑器入口：`workflow-editor -> ApprovalWorkFlowEditor -> ApprovalWorkflowEditorCore -> ReactFlowDesignerShell -> ReactFlowCanvas`
- 只读流程图入口：`workflow-diagram-viewer -> ReadOnlyFlowCanvas -> ReactFlowCanvas(readonly)`
- React Flow 是当前设计器和只读流程图唯一支持的 renderer。

## 维护说明

- 不要通过 schema、URL 参数、全局变量或环境变量新增 renderer mode switch。
- G6 相关历史资料只作为 compatibility debt / migration reference 保留，不再作为产品主链或新功能接入方式。
- 当前 renderer 约束见 [react-flow-rollout.md](docs/react-flow-rollout.md)，测试基线见 [tests/README.md](tests/README.md)。
