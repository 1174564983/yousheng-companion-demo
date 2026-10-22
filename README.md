# 有生 · 阿岚 Demo

一个验证“AI 有自己的生活轨迹、会拒绝、有可管理记忆”的浏览器交互原型。

## 当前实现

- 重新开始时可选择女性阿岚或男性阿川
- 单角色生活轨迹，7 天结构化事件
- 当前时间与生活事件联动
- 角色状态感知的聊天回复
- 温和反对、时间边界、危机安全提示
- 共同记忆查看与删除
- 用户主动消息示例与“为什么这么说”上下文说明
- 18+ 与 AI 身份披露
- 移动端和桌面端响应式界面

当前版本使用确定性的规则引擎，便于演示和测试核心体验；下一阶段可替换为 LLM 对话层，同时保留生活事件账本和一致性校验。

测试数据只保存在当前浏览器的 `localStorage` 中；点击右上角“重新开始”可清除。启用大模型后，单次对话上下文会发送到你配置的模型服务，浏览器端不会保存或接触 API Key。

## 接入大模型

复制 `.env.example` 为 `.env.local`，任选一种配置：

```dotenv
# OpenAI Responses API
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-6-astra
OPENAI_BASE_URL=https://api.openai.com/v1
```

或使用兼容 Chat Completions 的服务：

```dotenv
LLM_PROVIDER=你的服务名
LLM_API_KEY=your_key_here
LLM_MODEL=你的模型名
LLM_BASE_URL=https://example.com/v1
```

不要把 API Key 发到聊天里，也不要把 `.env.local` 提交到 Git。模型请求由本地 `server/index.mjs` 代理，浏览器不会拿到 Key。

可选配置 `LLM_DEEP_MODEL`：普通闲聊走更快的模型，涉及建议、冲突、关系和高情绪负担的问题走更深的模型。当前本地配置为 `deepseek-flash + deepseek-v4-pro`。

## 世界时钟

世界时间与本地现实时间 1:1 推进，并在浏览器关闭后继续追算。左侧的“暂停世界”和“测试：+1/+8 小时”只用于验证延迟回复和情绪状态。

模型上下文不会随时间无限增长：每次只带最近 12 条对话、相关记忆，以及当前日期前后有限范围的生活事件。长历史后续应通过事件摘要和分层记忆压缩。

## 朋友测试

开发环境默认只监听本机。正式测试推荐使用生产的单服务模式：

```powershell
$pnpm build
$env:NODE_ENV="production"
$env:PORT="8080"
& $pnpm start
```

打开 `http://127.0.0.1:8080` 即可验证静态页面和 API 是否由同一个服务提供。项目带有 `Dockerfile` 和 `render.yaml`，可以在 Render 创建 Web Service 后把 `.env.local` 中的模型变量填入平台环境变量，生成 HTTPS 链接发给朋友。

不要把 `.env.local` 上传到 GitHub。服务端默认对单个 IP 限制每 10 分钟 60 次模型请求，可按需要调整 `CHAT_LIMIT`。

## 测试调参

右上角“测试调参”可以手动调整心情、压力、精力、社交电量，并提供“平稳 / 低落 / 高压力 / 低电量 / 有点生气”五个预设。手动调整后会暂时接管事件驱动的情绪数值；点击“恢复事件驱动”后重新按生活事件计算。日程和睡眠状态不会被手动情绪覆盖。

社交电量低只影响回复长度和主动性，不会单独阻止消息；延迟回复只由睡眠、正在忙或明确被冒犯后的情绪边界触发。

测试面板同时可以调整关系信任。关系信任达到某个决定的门槛后，用户在聊天中给出的建议会改变该决定，并把后果写入后续生活事件。

## 人生底稿与分支

“她的人生”页保存从出生、苏州成长、无锡读大学、上海工作到杭州生活的人生底稿。底稿先于聊天存在，不会被模型临时改写。

当前有成都旧街区项目和陶艺市集两个待决定事件。没有达到关系门槛时，角色只会听见建议；达到门槛后，建议会改变选择，并在生活时间线中生成后续事件。

## 本地运行

```powershell
$pnpm = "C:\Users\admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
& $pnpm install
& $pnpm dev
```

浏览器打开 `http://127.0.0.1:4173`。

## 构建

```powershell
& $pnpm build
```
