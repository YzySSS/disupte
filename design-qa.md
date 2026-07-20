# Design QA

- source visual truth paths:
  - `C:\Users\YzyS\AppData\Local\Temp\codex-clipboard-9c54c0dc-ea3f-4737-995c-0747384b7607.png`
  - `C:\Users\YzyS\AppData\Local\Temp\codex-clipboard-ce868f8f-e8a9-4dea-904a-17aa7d653b45.png`
  - `C:\Users\YzyS\AppData\Local\Temp\codex-clipboard-6c849c08-502b-4255-8ac1-a0135765d262.png`
  - `C:\Users\YzyS\AppData\Local\Temp\codex-clipboard-cb34c7f8-0b3b-4479-bac5-88d3c1fe8402.png`
  - `C:\Users\YzyS\AppData\Local\Temp\codex-clipboard-8d70c49c-b1cc-4fd0-820f-6ba0baee0382.jpg`
  - `C:\Users\YzyS\AppData\Local\Temp\codex-clipboard-2e933cad-095c-4d62-b0cb-0d941dd69031.jpg`
- implementation screenshot paths:
  - `D:\CodeX\XY\complaint-mobile-prototype\.playwright-cli\page-2026-07-20T08-21-25-602Z.png`
  - `D:\CodeX\XY\complaint-mobile-prototype\.playwright-cli\page-2026-07-20T08-21-38-088Z.png`
  - `D:\CodeX\XY\complaint-mobile-prototype\.playwright-cli\page-2026-07-20T08-24-16-371Z.png`
  - `D:\CodeX\XY\complaint-mobile-prototype\.playwright-cli\page-2026-07-20T08-24-51-678Z.png`
  - `D:\CodeX\XY\complaint-mobile-prototype\.playwright-cli\page-2026-07-20T08-34-04-238Z.png`
  - `D:\CodeX\XY\complaint-mobile-prototype\.playwright-cli\page-2026-07-20T08-34-49-897Z.png`
- viewport: 390 x 844
- states: primary reason list; eight-item illegal-content subtype list; eleven-item fraud subtype list; direct-to-form branch; empty complaint form; valid form with or without image upload; submission loading; success state
- delivery integration: the selected primary/secondary reason, phone, content, and image files are posted as multipart data to the same-origin Node API. The success state is entered only after the API returns a confirmed result.
- full-view comparison evidence:
  - `D:\CodeX\XY\complaint-mobile-prototype\output\playwright\compare-primary-final.png`
  - `D:\CodeX\XY\complaint-mobile-prototype\output\playwright\compare-illegal-types-final.png`
  - `D:\CodeX\XY\complaint-mobile-prototype\output\playwright\compare-form-final.png`
  - `D:\CodeX\XY\complaint-mobile-prototype\output\playwright\compare-success-final.png`
  - `D:\CodeX\XY\complaint-mobile-prototype\output\playwright\compare-illegal-routing-final.png`
  - `D:\CodeX\XY\complaint-mobile-prototype\output\playwright\compare-fraud-routing-final.png`
- focused region comparison: the normalized full-view pairs keep all text, rows, form controls, counters, success messaging, and CTA dimensions legible. The video-player play overlay and Android status bar in supplied captures were excluded from the product UI comparison.

## Findings

- Fonts and typography: passed. The system Chinese sans-serif stack, hierarchy, weights, line height, and 200-character counter match the reference closely.
- Spacing and layout rhythm: passed after iteration. Header height, gray instruction band, 53px list rows, compact form card, upload tile, CTA placement, success icon, and success copy align with the reference proportions.
- Colors and visual tokens: passed. The light gray webview surface, white rows and form region, muted helper copy, blue links, optional image-evidence heading without a required mark, and bright green submission state match the source.
- Image quality and asset fidelity: passed. Standard controls use the Phosphor icon library; user-selected evidence images render as real previews. The circular play marks in the supplied screenshots belong to the video player and are intentionally not reproduced.
- Copy and content: passed. The primary reasons, all eight illegal-content subtypes, all eleven fraud subtypes, both helper links, form labels, 0/9 image count, 0/200 copy limit, and success message follow the supplied frames.
- Interaction and accessibility: passed. The first primary reason routes to illegal-content types, the second routes to fraud types, and every remaining primary reason routes directly to the form. The image heading has no required star, and a direct-route complaint with valid phone/content submits successfully at `0/9` images. Secondary selections, image selection/removal, phone/content entry, disabled/ready submit states, loading, success, completion, close, notices, and menu feedback work. Controls have accessible names. Final console check reported zero errors.
- Exit behavior: the success-screen “完成” button and the top-left close button share one host/browser exit action. Playwright verified that each invokes the mocked Douyin host `navigateBack({ delta: 1 })`; neither control resets React state or returns to the primary-reason screen.
- Enterprise WeChat handoff: passed in dry-run and contract tests. The backend writes the actual five-column contract through the Smart Sheet “接收外部数据” Webhook: primary/secondary reasons use `single_select`, phone/content use `text`, and evidence uses the native `image` field with in-memory `image_base64` values. Eleven backend tests passed, including route validation, exact schema payloads, optional images, Webhook URL validation, API error handling, and dry-run configuration.
- Live Webhook smoke: passed on 2026-07-20. The browser selected `存在欺诈骗钱行为 → 网络兼职刷单诈骗`, filled the phone/content fields, attached one PNG, and received `201 Created` before rendering `投诉已提交`. Evidence: `output/playwright/live-webhook-form-filled.png` and `output/playwright/live-webhook-submit-success.png`. No Webhook URL or key is stored in this QA file.

## Comparison History

1. Initial pass found two P2 mismatches: the webview header/instruction region was too tall, and the form's white content region was approximately 140px taller than the reference, pushing the disabled submit button too low.
2. Fixes: reduced the header to 52px and instruction band to 40px; compressed the form card to 310px; tightened evidence/content spacing; reduced the content box to 54px; and moved success copy/CTA upward.
3. Post-fix evidence: the four final comparison images show aligned list density, matching form region and CTA placement, and a source-matched success composition. No P0/P1/P2 issues remain.
4. Routing refinement added the missing `自杀自残` and `网络暴力(开盒/侮辱等)` illegal categories plus the complete eleven-item fraud list. Browser checks confirmed first-item secondary routing, second-item secondary routing, secondary-to-form navigation, and direct-to-form navigation for all other primary reasons.

## Implementation Checklist

- [x] Primary, two secondary-category, form, and success screens
- [x] Separate illegal-content and fraud subtype routes
- [x] All remaining primary reasons route directly to the form
- [x] Optional image upload, preview, count, and removal
- [x] 11-digit phone and 200-character complaint input
- [x] Disabled and ready submit states
- [x] Loading and animated success feedback
- [x] Unified top-left close and success-screen completion exit behavior
- [x] 390 x 844 overflow and clipping check
- [x] Console error check
- [x] Production build
- [x] Same-origin Node submission API and server-side revalidation
- [x] Enterprise WeChat Smart Sheet “接收外部数据” Webhook with five mapped fields: two `single_select`, two `text`, and one native `image` field using `image_base64`
- [x] No persistent evidence-image directory on the Tencent Cloud server
- [x] Browser dry-run of fraud subtype → form → image upload → confirmed success
- [x] Browser dry-run of contact + complaint content with no image → confirmed success

## Follow-up Polish

- P3: exact glyph antialiasing may vary slightly between the video capture device and the desktop browser renderer.

final result: passed
