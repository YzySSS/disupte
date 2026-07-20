# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Complaint routing contract

- `发布不适当内容对我造成骚扰` opens the illegal-content subtype list before the contact form.
- `存在欺诈骗钱行为` opens the fraud subtype list before the contact form.
- Every other primary complaint reason goes directly to the contact form.
- Preserve the exact subtype copy supplied in the July 20 reference screenshots unless the user explicitly replaces it.
- The simulated webview header must display `window.location.hostname`; never hardcode a deployment domain.
- The success-screen “完成” button and the top-left close button must invoke the same host/browser exit action. Neither control may reset the React flow or return to the primary-reason screen.

## Complaint delivery contract

- Production is a same-origin Node deployment behind Tencent Cloud Nginx; show success only after the backend confirms delivery.
- Use the Enterprise WeChat Smart Sheet incoming-data Webhook documented at official paths `101239` and `101240` as the sole delivery mechanism.
- Keep complaint images in request memory only and write them directly to the Smart Sheet's native image field as `{ title, image_base64 }` objects. `image_base64` must be raw base64 without a Data URL prefix. Do not persist evidence files or expose an evidence-file route on the Tencent Cloud server.
- Treat the complete incoming-data Webhook URL as a write credential. Any previously disclosed URL must be reset or regenerated before use; the replacement belongs only in the server-side `WECOM_SMARTSHEET_WEBHOOK` environment variable and must never appear in frontend code, build output, logs, screenshots, chat, or committed files.
- The Smart Sheet schema has exactly five writable columns: primary reason `ftQMc5` (`single_select`), secondary reason `ftk5Tx` (`single_select`), phone `ffFwIh` (`text`), complaint content `f04Gwj` (`text`), and complaint images `fn8TJd` (`image`). Do not add extra record fields.
- Pre-create every exact value from `PRIMARY_REASONS` in the `ftQMc5` options, and every exact value from `ILLEGAL_TYPES` plus `FRAUD_TYPES` in the `ftk5Tx` options. Keep punctuation and full-width/half-width characters identical.
- Persist the selected primary reason. Include `ftk5Tx` only for the first two routes after a valid subtype is selected; omit that field entirely for all direct-to-form primary reasons.
- Contact phone and complaint content are required. Evidence images are optional (0-9); when none are supplied, send `fn8TJd` as an empty array exactly as shown by the Webhook example.
