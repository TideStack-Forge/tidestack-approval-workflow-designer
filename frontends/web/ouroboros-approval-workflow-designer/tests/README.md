# Approval Workflow Designer Testing Standard

`frontends/web/ouroboros-approval-workflow-designer` uses a single `tests/` root. The canonical layers are `unit` and `integration`.

## Layers

- `tests/unit/`
  - Fast unit-side checks for source contracts, config guardrails, and pure runtime behavior.
- `tests/integration/`
  - Designer runtime flows, browser scenarios, harness support, and related fixtures grouped by theme.

## Placement Rules

- Do not keep test files under `src/`.
- Do not keep browser harness assets under `src/` or `public/`.
- Mirror source-oriented unit tests under `tests/unit/src/` when they assert `src/` behavior.
- Put config/layout guard tests under `tests/unit/config/`.
- Keep integration assets grouped by feature/theme under `tests/integration/<theme>/`.
- Put harness entry files and templates under the owning theme, for example `tests/integration/workflow/harness/`.

## Commands

- `npm run test:unit`
- `npm run test:integration`
- `npm run test:all`

## Workflow Editor Regression Baseline

- `tests/integration/workflow/` 是审批流编辑器当前唯一的浏览器回归基线；`designer-smoke.spec.js` 只保留最外层 harness bootstrap smoke，不再承接其他 journey。
- 这条 browser baseline 继续复用同一条 Playwright harness 主链：`playwright.config.js` -> `PLAYWRIGHT_HARNESS=true npm run serve` -> `tests/integration/workflow/harness/playwright-harness.html` -> `tests/integration/workflow/harness/App.js` -> `tests/integration/workflow/helpers/WorkflowHarnessPage`。
- legacy surface trimming 只通过 unit source contract 与现有 browser baseline 守护当前 React Flow 主链；不要新增 G6 harness、旧 renderer smoke、第二套 scenario registry 或 renderer mode browser path。
- journey family、scenario catalog、harness observable surface 和 unit/browser/host companion 的 coverage matrix 见 [tests/integration/workflow/README.md](integration/workflow/README.md)。
