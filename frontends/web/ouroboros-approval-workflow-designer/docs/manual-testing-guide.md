# React Flow 编辑器手动测试指南

## 启动测试环境

```bash
# 在项目根目录执行
cd frontends/web/ouroboros-approval-workflow-designer
PLAYWRIGHT_HARNESS=true npm run dev
```

服务器启动后，访问以下 URL：

## 测试场景

### 1. 新建流程
**URL**: http://localhost:8083/micro-workflow-editor/playwright-harness.html?scenario=new-flow

**验证点**：
- [ ] 三面板布局正确显示（左侧节点列表、中间画布、右侧属性面板）
- [ ] 左侧节点列表包含当前节点目录的可创建类型；含 End，不含仅用于旧定义兼容投影的 Condition
- [ ] 画布中显示初始 Start 节点
- [ ] 可以拖拽节点到画布
- [ ] 可以自由移动节点位置
- [ ] 可以连接节点（拖拽连接点）
- [ ] 选中节点后右侧显示属性面板
- [ ] 可以编辑节点属性
- [ ] 保存按钮可用

### 2. V2 定义
**URL**: http://localhost:8083/micro-workflow-editor/playwright-harness.html?scenario=v2-editable

**验证点**：
- [ ] 正确加载现有流程定义
- [ ] 节点位置正确显示（如果有保存的布局）
- [ ] 可以编辑现有节点
- [ ] 可以添加新节点
- [ ] 可以删除节点
- [ ] 保存后数据正确

### 3. 分支流程
**URL**: http://localhost:8083/micro-workflow-editor/playwright-harness.html?scenario=branch-editable

**验证点**：
- [ ] 正确显示条件分支结构
- [ ] Condition 节点显示为菱形
- [ ] 分支连线正确显示
- [ ] 可以添加新分支
- [ ] End 节点可从面板拖入画布，保存为 V2 EndNode

## 核心功能测试清单

### 节点操作
- [ ] 从左侧面板拖拽节点到画布
- [ ] 移动节点位置（拖拽节点本体）
- [ ] 选中节点（单击节点）
- [ ] 删除节点（选中后按 Delete 键或右键菜单）
- [ ] 复制/粘贴节点（如果实现）

### 连接操作
- [ ] 创建连接（拖拽节点的连接点）
- [ ] 删除连接（选中连接后按 Delete 键）
- [ ] 验证连接规则（不允许的连接会被拒绝）
- [ ] 循环检测（不允许创建循环）

### 属性编辑
- [ ] 选中节点后右侧显示属性表单
- [ ] 修改节点名称
- [ ] 修改节点配置（审批人、抄送人等）
- [ ] 在分支连线的属性面板修改条件表达式；旧 Condition 伪节点仅用于兼容显示
- [ ] 属性变更实时同步到画布

### 画布交互
- [ ] 缩放画布（鼠标滚轮）
- [ ] 平移画布（拖拽空白区域）
- [ ] 框选多个节点（如果实现）
- [ ] 适应画布（Fit View 按钮）

### 数据持久化
- [ ] 点击保存按钮
- [ ] 检查 `data-testid="last-saved-definition"` 区域的数据
- [ ] 验证节点位置保存在 `editorLayout.nodePositions`
- [ ] 验证视口状态保存在 `editorLayout.viewport`
- [ ] 刷新页面后布局保持不变

### 验证引擎
- [ ] 尝试创建不允许的连接（如 End → Approval）
- [ ] 尝试创建循环连接
- [ ] 验证错误提示正确显示
- [ ] 孤立节点检测（如果实现）

## 浏览器控制台检查

打开浏览器开发者工具（F12），检查：

1. **无错误日志**：Console 中不应有红色错误
2. **React Flow 实例**：`window.__APPROVAL_WORKFLOW_HARNESS__` 对象存在
3. **契约快照**：执行 `window.__APPROVAL_WORKFLOW_HARNESS__.reactFlowContractSnapshot()` 查看结构

预期输出：
```javascript
{
  hasThreePanelShell: true,
  shellPanelCount: 3,
  paletteIncludesEnd: true,
  paletteIncludesCondition: false,
  hasConditionPseudoNodeInCanvas: false, // 取决于是否有条件节点
  hasEndNodeInCanvas: false // 取决于是否有结束节点
}
```

## 性能检查

- [ ] 拖拽节点流畅（无明显卡顿）
- [ ] 缩放/平移响应及时
- [ ] 大型流程（10+ 节点）性能正常
- [ ] 内存占用合理（开发者工具 → Performance Monitor）

## 已知限制

1. **End 节点**：可创建、可拖拽，并持久化为 V2 EndNode；不允许向外连接
2. **Condition 节点**：旧定义可能投影出兼容伪节点；当前面板不提供新增入口，不持久化为 V2 节点，分支逻辑在边上
3. **布局算法**：首次加载无布局元数据时使用确定性初始位置（非自动布局）

## 问题报告

如发现问题，请记录：
1. 复现步骤
2. 预期行为 vs 实际行为
3. 浏览器控制台错误日志
4. `data-testid="current-definition"` 区域的数据快照
5. 截图或录屏

## 渲染器约束

审批流设计器和只读流程图均固定使用 React Flow。不要通过 URL 参数、全局变量或环境变量回退到 G6。
