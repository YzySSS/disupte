# 腾讯云部署与企业微信智能表格接入

本项目只采用企业微信智能表格“接收外部数据”生成的 incoming-data Webhook。后端把投诉文本和图片直接写入该 Webhook 绑定的工作表。

> 安全提醒：此前已经暴露过的 Webhook 地址必须视为失效密钥。上线前请在智能表格中重置或重新生成 Webhook；如界面没有重置入口，先关闭再重新开启“接收外部数据”。旧地址不得继续使用，新地址只能写入腾讯云服务器环境变量，不能出现在前端代码、Git、聊天、截图、日志或构建产物中。

## 1. 架构

```text
手机浏览器 → HTTPS/Nginx → Node 127.0.0.1:3000
                               ├─ 提供 dist 前端
                               ├─ 在内存中接收并校验图片
                               ├─ 转为纯 base64
                               └─ POST 企业微信智能表格 Webhook
```

图片只在一次请求的内存中短暂存在。服务器不创建上传目录、不提供证据图片 URL，也不把图片持久化到腾讯云磁盘。

官方说明：

- [智能表格接收外部数据](https://developer.work.weixin.qq.com/document/path/101239)
- [通过 Webhook 写入智能表格](https://developer.work.weixin.qq.com/document/path/101240)

## 2. 配置智能表格和 Webhook

1. 在目标智能表格中创建下表所列字段，“图片证据”必须使用图片字段。
2. 打开智能表格的“接收外部数据”，选择实际接收投诉的工作表并启用。
3. 重置或重新生成 Webhook，确保旧的已泄露地址不再有效。
4. 复制新 Webhook 地址及页面给出的 schema/请求示例。schema 中包含每一列对应的字段 ID。
5. 只把新 Webhook 写入服务器的 `WECOM_SMARTSHEET_WEBHOOK`；字段 ID 分别写入对应环境变量。
6. 完成一次测试写入，确认文本、中文内容和图片均进入预期列，再开放正式流量。

Webhook 形如：

```text
https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/webhook?key=REDACTED
```

完整 URL 等同于写入密钥。文档、终端输出和故障截图中只能使用上述脱敏占位符。

## 3. 智能表格字段

当前 Webhook schema 只包含以下 5 列：

| 列名 | 字段 ID | 字段类型 |
| --- | --- | --- |
| 一级原因 | `ftQMc5` | `single_select` |
| 二级原因 | `ftk5Tx` | `single_select` |
| 电话号码 | `ffFwIh` | `text` |
| 投诉内容 | `f04Gwj` | `text` |
| 投诉图片 | `fn8TJd` | `image` |

两个 `single_select` 字段不会自动创建选项，必须先在智能表格中添加与网页完全一致的枚举值。

“一级原因”预设：

- 发布不适当内容对我造成骚扰
- 存在欺诈骗钱行为
- 此账号可能被盗用了
- 存在侵权行为(侵犯知识产权、人身权)
- 发布仿冒品信息
- 冒充他人
- 侵犯未成年人权益
- 粉丝无底线追星行为

“二级原因”预设：

- 色情
- 违法犯罪及违禁品
- 赌博
- 政治谣言
- 暴恐血腥
- 自杀自残
- 网络暴力(开盒/侮辱等)
- 其他违规内容
- 金融诈骗（贷款/提额/代开/套现等）
- 网络兼职刷单诈骗
- 返利诈骗
- 网络交友诈骗
- 虚假投资理财诈骗
- 赌博诈骗
- 收款不发货
- 仿冒他人诈骗
- 免费送诈骗
- 游戏相关诈骗（代练/充值等）
- 其他诈骗行为

单选值必须逐字匹配，包含括号类型及全角/半角字符。修改网页枚举、智能表格选项或字段结构时，三处必须同步更新。

图片字段使用 Webhook 专用格式：

```json
{
  "add_records": [
    {
      "values": {
        "ftQMc5": [{ "text": "发布不适当内容对我造成骚扰" }],
        "ftk5Tx": [{ "text": "色情" }],
        "ffFwIh": "13800138000",
        "f04Gwj": "投诉内容示例",
        "fn8TJd": [
          {
            "title": "evidence-1.jpg",
            "image_base64": "PURE_BASE64_WITHOUT_DATA_URL_PREFIX"
          }
        ]
      }
    }
  ]
}
```

`image_base64` 只能包含纯 base64，不能带 `data:image/jpeg;base64,` 等前缀。没有图片时必须按 Webhook 示例写入 `"fn8TJd": []`。

只有“发布不适当内容对我造成骚扰”和“存在欺诈骗钱行为”会经过二层选择，因此这两类记录必须写入 `ftk5Tx`。其他 6 个一级原因会直达表单，发送时应完全省略 `ftk5Tx`，不能写空字符串、`null` 或伪造的“无”选项。

## 4. 服务器环境变量

服务器只需要代码和受保护的环境变量文件：

```text
/srv/complaint/current/          当前代码
/etc/complaint/complaint.env     生产密钥和字段映射
```

`/etc/complaint/complaint.env` 示例：

```dotenv
NODE_ENV=production
PORT=3000
TRUST_PROXY=1

WECOM_SMARTSHEET_WEBHOOK=https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/webhook?key=REPLACE_ON_SERVER_ONLY
WECOM_FIELD_ID_PRIMARY_REASON=ftQMc5
WECOM_FIELD_ID_SECONDARY_REASON=ftk5Tx
WECOM_FIELD_ID_PHONE=ffFwIh
WECOM_FIELD_ID_CONTENT=f04Gwj
WECOM_FIELD_ID_EVIDENCE_IMAGES=fn8TJd
```

建议该文件归 `root:complaint` 所有并设为 `640`。上述 5 个字段映射必须与当前 schema 保持一致，schema 变化时应同步更新服务器配置、代码测试和文档。

安装、测试和构建：

```bash
cd /srv/complaint/current
corepack enable
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

## 5. systemd

创建 `/etc/systemd/system/complaint.service`：

```ini
[Unit]
Description=Complaint Web Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=complaint
Group=complaint
WorkingDirectory=/srv/complaint/current
EnvironmentFile=/etc/complaint/complaint.env
ExecStart=/usr/bin/node server/index.mjs
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

启动并检查：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now complaint
sudo systemctl status complaint
sudo journalctl -u complaint -n 100 --no-pager
```

日志中不得出现完整 Webhook、手机号、投诉正文或图片 base64。

## 6. Nginx 与 HTTPS

```nginx
server {
    listen 80;
    server_name complaint.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name complaint.example.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/private.key;

    client_max_body_size 95m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 45s;
    }
}
```

执行 `sudo nginx -t` 后再平滑重载。腾讯云安全组只开放必需的 `22`、`80`、`443`；Node 端口只监听 `127.0.0.1`。服务器需要允许出站 HTTPS 访问 `qyapi.weixin.qq.com`。

## 7. 上线验收

- `GET /healthz` 返回 `{ "ok": true }`，且不泄露配置。
- 两个二层路径会写入合法的二级单选值，其他 6 个一级原因的请求中不包含 `ftk5Tx`。
- 没有有效手机号或投诉内容时，服务端拒绝且不写表；图片证据为选填。
- 只接受允许的图片格式，最多 9 张，并同时校验 MIME 和文件头。
- 没有图片时 `fn8TJd` 明确写为空数组。
- 图片直接显示在智能表格图片单元格，腾讯云磁盘中没有证据文件。
- 企业微信明确返回成功后，前端才进入“投诉已提交”。
- 使用旧 Webhook 请求应失败；新 Webhook 不出现在浏览器请求、前端 bundle 或日志中。
- 重启 Node 服务后仍可提交，因为系统不依赖本地上传目录。

## 8. 风险与运维

- Webhook 泄露即意味着目标工作表可被未授权写入。发现泄露后立即重置，不要只删除聊天或日志。
- base64 会增大内存和出站请求体。应限制单图大小、总图片数、并发和请求速率，避免大图并发导致 Node 内存耗尽。
- Webhook 返回非零 `errcode`、超时或网络失败时，前端不得显示成功。当前 5 列 schema 没有幂等键，超时后应先人工核对智能表格再决定是否重试，避免重复记录。
- 图片只存在内存，不代表不受隐私要求约束；日志、错误追踪和 APM 同样不得采集 multipart 内容或请求体。
- 智能表格列调整后，字段 ID 可能失效。上线变更前应使用测试投诉验证 schema。
- 正式上线前应确认企业微信当前文档中的图片大小、请求体和调用频率限制，并让应用限制不高于官方限制。
