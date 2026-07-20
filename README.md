# 投诉移动端网页

React/Vite 前端与 Node 服务组成同域应用。用户提交后，Node 在内存中校验图片并转为纯 base64，通过企业微信智能表格“接收外部数据”生成的 incoming-data Webhook，把投诉文本和图片直接写入目标工作表。腾讯云服务器不持久化投诉图片。

企业微信连接信息只有一个绑定目标工作表的 Webhook，以及 schema 中的字段 ID。

当前 schema 只使用 5 列：

| 列名 | 字段 ID | 类型 |
| --- | --- | --- |
| 一级原因 | `ftQMc5` | `single_select` |
| 二级原因 | `ftk5Tx` | `single_select` |
| 电话号码 | `ffFwIh` | `text` |
| 投诉内容 | `f04Gwj` | `text` |
| 投诉图片 | `fn8TJd` | `image` |

两个单选字段必须预先添加与网页完全一致的枚举选项。只有前两个一级原因会写入二级原因；其余 6 个直达表单的原因会完全省略 `ftk5Tx`。没有图片时按 Webhook 示例写入 `"fn8TJd": []`。

服务器通过 `.env.example` 所列的 5 个 `WECOM_FIELD_ID_*` 变量读取上述映射；生产值应与目标 Webhook 页面提供的 schema 一致。

## 安全要求

此前已经暴露过的 Webhook 地址必须在智能表格中重置或重新生成，不能继续使用。新 Webhook 只能写入服务器环境变量 `WECOM_SMARTSHEET_WEBHOOK`，不得放入前端代码、Git、聊天、截图、日志或构建产物。

图片字段值使用：

```json
[
  {
    "title": "evidence-1.jpg",
    "image_base64": "PURE_BASE64_WITHOUT_DATA_URL_PREFIX"
  }
]
```

`image_base64` 不能包含 `data:image/...;base64,` 前缀。

## 本地验证

```powershell
$env:NODE_ENV = 'development'
$env:WECOM_DRY_RUN = '1'
$env:PORT = '3001'
pnpm start
```

另开终端运行 `pnpm dev -- --port 4174`。开发代理会把 `/api` 和 `/healthz` 转发到 `127.0.0.1:3001`。`WECOM_DRY_RUN=1` 只在非生产环境生效，不会调用真实企业微信。

## 生产部署

完整步骤见 [DEPLOY_TENCENT_CLOUD.md](./DEPLOY_TENCENT_CLOUD.md)。生产环境先执行 `pnpm test` 和 `pnpm build`，再由 `pnpm start` 同时提供前端和接口。

企业微信官方说明：

- [智能表格接收外部数据](https://developer.work.weixin.qq.com/document/path/101239)
- [通过 Webhook 写入智能表格](https://developer.work.weixin.qq.com/document/path/101240)
