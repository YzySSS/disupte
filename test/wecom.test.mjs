import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSmartSheetPayload,
  createWecomSmartSheetClient,
  imageCells,
  validateComplaint,
  validateRuntimeConfig,
  WecomError,
} from '../server/wecom.mjs';
import { FRAUD_TYPES, PRIMARY_REASONS } from '../shared/complaint-options.mjs';

const fieldMap = {
  primaryReason: 'ftQMc5',
  secondaryReason: 'ftk5Tx',
  phone: 'ffFwIh',
  content: 'f04Gwj',
  evidenceImages: 'fn8TJd',
};

const testWebhook = 'https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/webhook?key=test-only';

test('validates direct and second-level complaint routes', () => {
  assert.equal(validateComplaint({
    primaryReason: PRIMARY_REASONS[2],
    secondaryReason: '',
    phone: '13800138000',
    content: '账号疑似被盗用，请核查',
    imageCount: 0,
  }).ok, true);

  assert.equal(validateComplaint({
    primaryReason: PRIMARY_REASONS[1],
    secondaryReason: FRAUD_TYPES[0],
    phone: '13800138000',
    content: '对方诱导贷款并索要转账',
    imageCount: 2,
  }).ok, true);

  assert.equal(validateComplaint({
    primaryReason: PRIMARY_REASONS[1],
    secondaryReason: '',
    phone: '13800138000',
    content: '缺少二级类型',
    imageCount: 1,
  }).ok, false);
});

test('rejects invalid phone, content and excessive evidence count', () => {
  const base = {
    primaryReason: PRIMARY_REASONS[2],
    secondaryReason: '',
    phone: '13800138000',
    content: '这是有效投诉内容',
    imageCount: 1,
  };
  assert.equal(validateComplaint({ ...base, phone: '123' }).ok, false);
  assert.equal(validateComplaint({ ...base, content: '短' }).ok, false);
  assert.equal(validateComplaint({ ...base, imageCount: 0 }).ok, true);
  assert.equal(validateComplaint({ ...base, imageCount: 10 }).ok, false);
});

test('builds a Webhook add_records payload with a native image cell', () => {
  const evidenceImages = [{
    title: '证据-1.jpg',
    image_base64: 'aW1hZ2U=',
  }];
  const payload = buildSmartSheetPayload({
    primaryReason: PRIMARY_REASONS[1],
    secondaryReason: FRAUD_TYPES[0],
    phone: '13800138000',
    content: '测试投诉内容',
    evidenceImages,
  }, { fieldMap });

  assert.deepEqual(Object.keys(payload), ['add_records']);
  assert.equal(payload.add_records.length, 1);
  assert.deepEqual(payload.add_records[0].values.ftQMc5, [{ text: PRIMARY_REASONS[1] }]);
  assert.deepEqual(payload.add_records[0].values.ftk5Tx, [{ text: FRAUD_TYPES[0] }]);
  assert.equal(payload.add_records[0].values.ffFwIh, '13800138000');
  assert.equal(payload.add_records[0].values.f04Gwj, '测试投诉内容');
  assert.deepEqual(payload.add_records[0].values.fn8TJd, evidenceImages);
});

test('converts uploaded image buffers into Webhook image values', () => {
  assert.deepEqual(imageCells([
    { buffer: Buffer.from('jpeg-bytes'), mimetype: 'image/jpeg' },
    { buffer: Buffer.from('png-bytes'), mimetype: 'image/png' },
  ]), [
    { title: '证据-1.jpg', image_base64: Buffer.from('jpeg-bytes').toString('base64') },
    { title: '证据-2.png', image_base64: Buffer.from('png-bytes').toString('base64') },
  ]);
});

test('writes an empty image array and omits the unused secondary reason', () => {
  const payload = buildSmartSheetPayload({
    primaryReason: PRIMARY_REASONS[2],
    secondaryReason: '',
    phone: '13800138000',
    content: '没有图片也可以提交投诉',
    evidenceImages: [],
  }, { fieldMap });

  assert.deepEqual(payload.add_records[0].values.fn8TJd, []);
  assert.equal(Object.hasOwn(payload.add_records[0].values, 'ftk5Tx'), false);
});

test('dry-run configuration supplies non-secret placeholder field ids', () => {
  const runtime = validateRuntimeConfig({ WECOM_DRY_RUN: '1', NODE_ENV: 'development' });
  assert.deepEqual(runtime.missing, []);
  assert.equal(runtime.dryRun, true);
  assert.match(runtime.fieldMap.primaryReason, /^dry_run_/);
  assert.match(runtime.fieldMap.evidenceImages, /^dry_run_/);
});

test('requires only the Webhook and field ids in production', () => {
  const runtime = validateRuntimeConfig({ NODE_ENV: 'production' });
  assert.equal(runtime.dryRun, false);
  assert.equal(runtime.missing.includes('WECOM_SMARTSHEET_WEBHOOK'), true);
  assert.equal(runtime.missing.includes('WECOM_CORP_ID'), false);
  assert.equal(runtime.missing.includes('WECOM_APP_SECRET'), false);
  assert.equal(runtime.missing.includes('WECOM_FIELD_ID_EVIDENCE_IMAGES'), true);
});

test('writes one record and image directly through the Smart Sheet Webhook', async () => {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const body = JSON.parse(options.body);
    calls.push({ href: String(url), method: options.method, body });
    assert.equal(body.add_records[0].values.fn8TJd[0].title, '证据-1.jpg');
    assert.equal(body.add_records[0].values.fn8TJd[0].image_base64, Buffer.from('fake-image').toString('base64'));
    assert.equal(body.add_records[0].values.f04Gwj, '测试投诉内容');
    return jsonResponse({ errcode: 0, errmsg: 'ok', add_records: [] });
  };

  const client = createWecomSmartSheetClient({
    webhookUrl: testWebhook,
    fieldMap,
    fetchImpl,
  });
  const result = await client.submitComplaint({
    primaryReason: PRIMARY_REASONS[2],
    secondaryReason: '',
    phone: '13800138000',
    content: '测试投诉内容',
  }, [{ buffer: Buffer.from('fake-image'), mimetype: 'image/jpeg' }]);

  assert.equal(result.errcode, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].href, testWebhook);
  assert.equal(calls[0].method, 'POST');
});

test('accepts an empty add_records array in a successful Webhook response', async () => {
  const client = createWecomSmartSheetClient({
    webhookUrl: testWebhook,
    fieldMap,
    fetchImpl: async () => jsonResponse({ errcode: 0, errmsg: 'ok', add_records: [] }),
  });

  const result = await client.submitComplaint({
    primaryReason: PRIMARY_REASONS[2],
    secondaryReason: '',
    phone: '13800138000',
    content: '无图片投诉内容',
  }, []);
  assert.deepEqual(result.add_records, []);
});

test('returns a sanitized typed error when the Webhook rejects a record', async () => {
  const client = createWecomSmartSheetClient({
    webhookUrl: testWebhook,
    fieldMap,
    fetchImpl: async () => jsonResponse({ errcode: 40058, errmsg: 'invalid field' }),
  });

  await assert.rejects(
    client.submitComplaint({
      primaryReason: PRIMARY_REASONS[2],
      secondaryReason: '',
      phone: '13800138000',
      content: '测试投诉内容',
    }, []),
    (error) => error instanceof WecomError
      && error.errcode === 40058
      && error.stage === 'smartsheet_webhook_add_records',
  );
});

test('rejects non-official or incomplete Webhook URLs without echoing the secret', () => {
  for (const webhookUrl of [
    'http://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/webhook?key=secret-value',
    'https://example.com/cgi-bin/wedoc/smartsheet/webhook?key=secret-value',
    'https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/webhook',
    'https://qyapi.weixin.qq.com:444/cgi-bin/wedoc/smartsheet/webhook?key=secret-value',
    'https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/webhook?key=%20',
    'https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/webhook?key=secret-value&extra=1',
    'https://qyapi.weixin.qq.com/cgi-bin/wedoc/smartsheet/webhook?key=secret-value#fragment',
  ]) {
    assert.throws(
      () => createWecomSmartSheetClient({ webhookUrl, fieldMap }),
      (error) => error instanceof WecomError
        && error.stage === 'config'
        && !error.message.includes('secret-value'),
    );
  }
});

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
