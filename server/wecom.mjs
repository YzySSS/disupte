import { isValidReasonSelection } from '../shared/complaint-options.mjs';

const WECOM_WEBHOOK_HOST = 'qyapi.weixin.qq.com';
const WECOM_WEBHOOK_PATH = '/cgi-bin/wedoc/smartsheet/webhook';

export const FIELD_ENV_NAMES = Object.freeze({
  primaryReason: 'WECOM_FIELD_ID_PRIMARY_REASON',
  secondaryReason: 'WECOM_FIELD_ID_SECONDARY_REASON',
  phone: 'WECOM_FIELD_ID_PHONE',
  content: 'WECOM_FIELD_ID_CONTENT',
  evidenceImages: 'WECOM_FIELD_ID_EVIDENCE_IMAGES',
});

export class WecomError extends Error {
  constructor(message, { errcode, status, stage } = {}) {
    super(message);
    this.name = 'WecomError';
    this.errcode = errcode;
    this.status = status;
    this.stage = stage;
  }
}

export function loadFieldMap(env = process.env) {
  return Object.fromEntries(
    Object.entries(FIELD_ENV_NAMES).map(([key, envName]) => [key, env[envName]?.trim() || '']),
  );
}

export function validateRuntimeConfig(env = process.env) {
  const dryRun = env.WECOM_DRY_RUN === '1' && env.NODE_ENV !== 'production';
  const fieldMap = loadFieldMap(env);
  const missing = dryRun || env.WECOM_SMARTSHEET_WEBHOOK?.trim()
    ? []
    : ['WECOM_SMARTSHEET_WEBHOOK'];

  for (const [key, envName] of Object.entries(FIELD_ENV_NAMES)) {
    if (!fieldMap[key]) {
      if (dryRun) fieldMap[key] = `dry_run_${key}`;
      else missing.push(envName);
    }
  }

  return {
    dryRun,
    missing,
    fieldMap,
    webhookUrl: env.WECOM_SMARTSHEET_WEBHOOK?.trim() || '',
  };
}

export function validateComplaint({ primaryReason, secondaryReason, phone, content, imageCount }) {
  const normalized = {
    primaryReason: String(primaryReason || '').trim(),
    secondaryReason: String(secondaryReason || '').trim(),
    phone: String(phone || '').trim(),
    content: String(content || '').trim(),
    imageCount: Number(imageCount),
  };

  if (!isValidReasonSelection(normalized.primaryReason, normalized.secondaryReason)) {
    return { ok: false, message: '投诉原因无效，请重新选择' };
  }
  if (!/^1\d{10}$/.test(normalized.phone)) {
    return { ok: false, message: '请填写正确的 11 位手机号' };
  }
  if (normalized.content.length < 5 || normalized.content.length > 200) {
    return { ok: false, message: '投诉内容需为 5 至 200 个字符' };
  }
  if (!Number.isInteger(normalized.imageCount) || normalized.imageCount < 0 || normalized.imageCount > 9) {
    return { ok: false, message: '最多可上传 9 张图片证据' };
  }

  return { ok: true, value: normalized };
}

export function imageCells(files) {
  return files.map((file, index) => ({
    title: `证据-${index + 1}${extensionForMime(file.mimetype)}`,
    image_base64: file.buffer.toString('base64'),
  }));
}

export function buildSmartSheetPayload(record, { fieldMap }) {
  const values = {
    [fieldMap.primaryReason]: [{ text: record.primaryReason }],
    [fieldMap.phone]: record.phone,
    [fieldMap.content]: record.content,
    [fieldMap.evidenceImages]: record.evidenceImages,
  };

  if (record.secondaryReason) {
    values[fieldMap.secondaryReason] = [{ text: record.secondaryReason }];
  }

  return {
    add_records: [{ values }],
  };
}

export function createWecomSmartSheetClient({
  webhookUrl,
  fieldMap,
  fetchImpl = fetch,
  timeoutMs = 30_000,
}) {
  const endpoint = parseWebhookUrl(webhookUrl);

  return {
    async submitComplaint(record, files) {
      const payload = buildSmartSheetPayload({
        ...record,
        evidenceImages: imageCells(files),
      }, { fieldMap });

      return requestJson(endpoint, {
        method: 'POST',
        body: payload,
        fetchImpl,
        timeoutMs,
        stage: 'smartsheet_webhook_add_records',
      });
    },
  };
}

function parseWebhookUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new WecomError('企业微信智能表格 Webhook 配置无效', { stage: 'config' });
  }

  if (
    url.origin !== `https://${WECOM_WEBHOOK_HOST}`
    || url.pathname !== WECOM_WEBHOOK_PATH
    || url.searchParams.size !== 1
    || url.searchParams.getAll('key').length !== 1
    || !url.searchParams.get('key')?.trim()
    || url.hash
    || url.username
    || url.password
  ) {
    throw new WecomError('企业微信智能表格 Webhook 配置无效', { stage: 'config' });
  }

  return url;
}

async function requestJson(url, {
  method = 'GET',
  body,
  fetchImpl,
  timeoutMs,
  stage,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new WecomError('企业微信接口网络请求失败', { status: response.status, stage });
    }

    let result;
    try {
      result = await response.json();
    } catch {
      throw new WecomError('企业微信接口返回了无法解析的响应', { status: response.status, stage });
    }

    if (!Number.isInteger(result.errcode)) {
      throw new WecomError('企业微信接口响应缺少状态码', { status: response.status, stage });
    }
    if (result.errcode !== 0) {
      throw new WecomError(result.errmsg || '企业微信接口处理失败', {
        errcode: result.errcode,
        status: response.status,
        stage,
      });
    }
    return result;
  } catch (error) {
    if (error?.name === 'AbortError') throw new WecomError('企业微信接口请求超时', { stage });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function extensionForMime(mimeType) {
  return ({
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
  })[mimeType.toLowerCase()] || '';
}
