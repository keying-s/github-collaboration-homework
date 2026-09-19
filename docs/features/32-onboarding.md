# 上手引导与可重看指南（Onboarding & Re-openable Guide）

## 基本信息

- Issue：#32
- 功能负责人（人 / GitHub）：fredericsetievi
- 开发分支：feat/fredericsetievi/onboarding-guide
- PR：33
- 评审者：（待分配）
- 状态：待评审

## 玩家价值

新玩家进入游戏后常常不知道“该干什么、怎么打、故事是什么”，会浪费前 30 秒在迷路和试错上。
本功能在三个层面解决这个问题：

1. **沉浸式剧情简报**：首次进入自动弹出，用带动画的分章卡片讲清“余烬事件之后 → 沉默的感染 → 你的任务 → 没有退路”，并支持中文 / English 一键切换，让玩家先理解背景与目标再开打。
2. **随时可重看的指南按钮**：顶栏新增“指南 / GUIDE”按钮（书形图标），战斗中也能打开；打开时自动暂停，关闭时恢复，玩家不会再因为“忘了目标/按键”而困惑。
3. **可交互的训练场**：指南内“训练场”进入真实沙盒——玩家无敌、有固定靶子、无波次压力，逐步引导完成“开火 / 切换枪械 / 闪避 / 拾取”四项要点，做完即提示离开。玩家在正式行动前就能亲手试一遍操作。
4. **第 1 关情境提示**：仅在隔离区 01 出现的浮空提示——武器上方“按 E 拾取”气泡、传送门开启时的指向箭头、以及一次性“按住鼠标左键开火”横幅，降低前 30 秒的认知负担。

## 范围

- 这次做：
  - 剧情 + 任务简报浮层（分章动画、中/英切换、跳过）。
  - 顶栏“指南”按钮 + 指南浮层（故事 / 操作 / 训练 三个分页）。
  - 安全训练模式（Simulation 新增 `training` / `trainingDone` / `beginTraining` / `endTraining`，固定靶子会重生）。
  - 训练要点清单（实时勾选，完成后可“结束训练”）。
  - 第 1 关情境提示（武器 E 气泡、传送门箭头、开火横幅）。
  - 首次进入自动弹简报（localStorage 标记 `ember-protocol-onboarded`）。
- 这次不做：
  - 独立的新手独立关卡 / 强制教学关卡流程（训练场已是可选沙盒）。
  - 语音旁白、视频过场。
  - 按键重绑定（沿用现有 WASD / 鼠标 / Space / Shift / R / E / Q / Esc）。
- 依赖的 Issue / PR：无硬依赖；与 #27（击杀手感）、#31（音效+闪避可读性）为同一 90 分体验路线。

## 验收条件

- [ ] 首次加载自动弹出剧情简报；可逐章前进/返回，可中/英切换，可关闭。
- [ ] 顶栏“指南”按钮随时可开；战斗中打开会暂停、关闭会恢复。
- [ ] 指南“训练场”进入真实沙盒：玩家无敌、靶子存在；完成开火/切换/闪避/拾取四项后显示“训练完成”并出现“结束训练”。
- [ ] 第 1 关：武器上方有“按 E 拾取”气泡；传送门开启时有指向箭头；首次进房有一次性“按住左键开火”横幅。
- [ ] 所有玩家可见文案均为中文 + 英文。
- [ ] 相关旧功能（菜单、暂停、战斗、升级、胜负）保持可用。

## 修改计划与协作

- 预计修改的文件：
  - `src/i18n.ts`（新增指南/剧情/操作/训练相关键，zh+en）
  - `src/game/types.ts`（`Enemy` 增加可选 `home` 字段用于靶子重生）
  - `src/game/simulation.ts`（训练模式：`training` / `trainingDone` / `shotsFired` 字段；`beginTraining` / `endTraining` / `spawnTrainingDummies`；tick 与敌人/清理逻辑对训练模式的处理；要点勾选）
  - `src/ui/icons.ts`（新增 `book` 图标）
  - `src/ui/interface.ts`（指南按钮、指南浮层、训练面板、第 1 关 coach 层；首次进入自动弹简报）
  - `src/style.css`（指南浮层、训练面板、coach 提示样式与动画）
  - `tests/combat.test.ts`（新增训练模式单测）
- 新增或变更的公共接口：
  - `Simulation.beginTraining()` / `Simulation.endTraining()` / `Simulation.training` / `Simulation.trainingDone: Set<string>` / `Simulation.shotsFired`
- 与其他任务的重叠及约定：与既有 `Interface` 共用 `#overlay` 之外的独立 `#guide` / `#training` / `#coach` 节点，互不污染菜单/暂停/胜负浮层。
- 合并顺序：独立 PR，先合此功能不影响其他分支。

## 人如何指挥 Agent

- 初始提示词摘要：“lanjutkan ke … perbaiki dan buatkan fitur onboarding serta tombol untuk melihat panduan permainan lagi … ceritakan background dan misi (switch inggris/mandarin) … buatkan animasi bahkan user bisa testing terlebih dahulu cara menggunakan shoot gun, mengganti gun …”
- 后续追加约束 / 修正摘要：仅用中/英双语（repo 规则）；一个功能 = 一个 Issue + 一个分支 + 一个 PR；所有玩家文案 zh+en。
- 人类做出的关键取舍：训练场做成“可选沙盒”而非强制教学关；第 1 关提示限定在隔离区 01（按需求原文）。

## 最终实现

- 剧情简报：4 章分章卡片（淡入上滑动画）+ 进度点 + 上一步/继续；最后一章“继续”跳到“操作”分页。支持中/英实时切换（复用 `I18n.toggle`）。
- 指南浮层三分页：故事 / 操作（带呼吸动画的按键卡）/ 训练（说明 + 进入训练场 + 开始行动）。
- 训练模式：玩家 `invincible=999`、HP 每帧锁定满血、无波次；4 个固定 crawler 靶子（`home` 记录原位，被击杀 0 血即原地重生）；完成 shoot/switch/dash/pickup 四项即显示“训练完成”+“结束训练”。
- 第 1 关 coach 层：武器 `kind==='weapon'` 上方浮动“E”气泡（上下浮动动画）；`phase==='exit'` 时传送门处指向箭头（左右脉冲）；`shotsFired===0` 时居中“按住左键开火”横幅（淡入淡出）。坐标用 `arena-shell` 实测尺寸按 1280×800 映射，适配缩放/全屏。
- 首次进入：`localStorage['ember-protocol-onboarded']` 未设置则自动弹简报，关闭时写入标记。

## 验证和试玩

| 项目           | 命令 / 步骤 | 实际结果与证据 |
| -------------- | ----------- | -------------- |
| 自动测试       | `npm test`  | 22/22 通过（含新增“training mode is a safe sandbox…”单测） |
| 类型检查与构建 | `npx tsc --noEmit` + `npm run build` | 均通过（tsc 0 错误；vite 构建成功） |
| 格式检查       | `npm run format:check` | 通过（仅新增文件经 prettier --write 修正） |
| 实际试玩       | `npm run dev` 打开 5173/5174 | 待人工试玩（沙盒无头环境无法点击验证浮层交互） |
| 与现有功能组合 | 菜单→指南→训练场→结束→正式行动 | 逻辑自洽；指南打开时暂停战斗，关闭恢复 |

- 人类验收者与结果：未进行（待评审）。
- 无法测试的环境及补验方法：无头 CI 不验证 DOM 点击与动画观感，需在浏览器人工确认浮层/动画/训练场手感。

## 已知限制和后续

- 尚未解决的限制：训练场靶子为静止 crawler，不会还击；“结束训练”直接回菜单，未提供连续进阶靶。
- 后续 Issue：可加“进阶靶”（移动/远程靶）、把剧情简报做成可跳过的更长过场、或把第 1 关提示扩展到后续房间。
- 撤销 / 回退此功能时需注意的兼容点：移除 `Enemy.home` 不影响其它逻辑（仅训练使用）；`training`/`trainingDone` 默认 false/空集，对既有存档与战斗无副作用。

## 修复记录（Fix log）

- **Next/Prev/分页按钮点击“无反应”**：初版 `Interface.onClick` 在处理 `guideStep`（上一步/继续）与 `guideTab`（故事/操作/训练 分页）后只调用了 `refresh()`，而 `refresh()` 的刷新循环并不重绘 `#guide` 浮层，导致 `guideStep`/`guideTab` 已变更但面板 DOM 不刷新——表现就是“下一步按了没反应”。已在 `onClick` 末尾对这两类 guide 导航动作补 `renderGuide()` 显式重绘。修复后：逐章前进/返回、最后一章“继续”跳到“操作”分页、三个分页切换均实时生效。本地验证 `npx tsc --noEmit`、`npm test`(22/22)、`npm run build`、`npm run format:check` 均通过。
