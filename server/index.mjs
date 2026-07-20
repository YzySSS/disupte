import crypto from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import multer from 'multer';
import {
  buildSmartSheetPayload,
  createWecomSmartSheetClient,
  imageCells,
  validateComplaint,
  validateRuntimeConfig,
} from './wecom.mjs';

dotenv.config({ quiet: true });

const serverDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(serverDirectory, '..');
const distDirectory = resolve(projectRoot, 'dist');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST?.trim() || '127.0.0.1';
const configuredConcurrency = Number(process.env.MAX_CONCURRENT_SUBMISSIONS || 2);
const maxConcurrentSubmissions = Number.isInteger(configuredConcurrency) && configuredConcurrency > 0
  ? configuredConcurrency
  : 2;
const runtime = validateRuntimeConfig(process.env);

if (runtime.missing.length > 0) {
  throw new Error(`缺少服务端环境变量：${runtime.missing.join(', ')}`);
}

const wecomClient = runtime.dryRun ? null : createWecomSmartSheetClient({
  webhookUrl: runtime.webhookUrl,
  fieldMap: runtime.fieldMap,
});

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 9,
    fileSize: 10 * 1024 * 1024,
    fields: 4,
    fieldSize: 4 * 1024,
    parts: 13,
  },
  fileFilter(_request, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype.toLowerCase())) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'evidence'));
      return;
    }
    callback(null, true);
  },
});

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY || 0));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
}));

app.get('/healthz', (_request, response) => {
  response.json({ ok: true });
});

const complaintLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { ok: false, message: '提交过于频繁，请稍后再试' },
});

let activeSubmissions = 0;
function limitConcurrentSubmissions(_request, response, next) {
  if (activeSubmissions >= maxConcurrentSubmissions) {
    response.status(503).json({ ok: false, message: '当前提交较多，请稍后再试' });
    return;
  }

  activeSubmissions += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    activeSubmissions = Math.max(0, activeSubmissions - 1);
  };
  response.once('finish', release);
  response.once('close', release);
  next();
}

app.post(
  '/api/complaints',
  complaintLimiter,
  limitConcurrentSubmissions,
  upload.array('evidence', 9),
  async (request, response) => {
    const files = Array.isArray(request.files) ? request.files : [];
    const validation = validateComplaint({
      primaryReason: request.body.primaryReason,
      secondaryReason: request.body.secondaryReason,
      phone: request.body.phone,
      content: request.body.content,
      imageCount: files.length,
    });

    if (!validation.ok) {
      response.status(400).json({ ok: false, message: validation.message });
      return;
    }

    try {
      for (const file of files) assertImageSignature(file.buffer, file.mimetype);

      const complaintId = crypto.randomUUID();
      const record = {
        ...validation.value,
      };

      if (runtime.dryRun) {
        buildSmartSheetPayload({
          ...record,
          evidenceImages: imageCells(files),
        }, {
          fieldMap: runtime.fieldMap,
        });
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 180));
      } else {
        await wecomClient.submitComplaint(record, files);
      }

      response.status(201).json({ ok: true, complaintId });
    } catch (error) {
      const safeError = {
        name: error?.name || 'Error',
        errcode: Number.isInteger(error?.errcode) ? error.errcode : undefined,
        status: Number.isInteger(error?.status) ? error.status : undefined,
        stage: typeof error?.stage === 'string' ? error.stage : undefined,
      };
      console.error('Complaint delivery failed', safeError);
      response.status(502).json({ ok: false, message: '提交暂时失败，请稍后重试' });
    }
  },
);

app.use(express.static(distDirectory, { index: false }));
app.use((request, response, next) => {
  if (request.method !== 'GET' || request.path.startsWith('/api/')) {
    next();
    return;
  }
  response.sendFile(resolve(distDirectory, 'index.html'));
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? '单张图片不能超过 10MB'
      : '图片格式或数量不符合要求';
    response.status(400).json({ ok: false, message });
    return;
  }

  console.error('Unhandled request error', { name: error?.name || 'Error' });
  response.status(500).json({ ok: false, message: '服务器暂时不可用' });
});

app.listen(port, host, () => {
  console.log(`Complaint service listening on http://${host}:${port}`);
});

function assertImageSignature(buffer, declaredMimeType) {
  const detectedMimeType = detectImageMimeType(buffer);
  const normalizedDeclared = declaredMimeType.toLowerCase() === 'image/jpg'
    ? 'image/jpeg'
    : declaredMimeType.toLowerCase();

  if (!detectedMimeType || detectedMimeType !== normalizedDeclared) {
    throw new Error('Invalid image signature');
  }
}

function detectImageMimeType(buffer) {
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return '';
}
