import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {
  assessDncrReadiness,
  auditCallLogsCsv,
  buildDncrBriefMarkdown,
  DNCRCHECK_TOOL_VERSION,
  DNCR_CONTROLS,
  DNCR_PRESETS,
  evaluateCallingWindowAndCaps,
  evaluateDncrPenalties,
  exportCallLogsAuditCsv,
  LEGAL_DISCLAIMER_AR,
  LEGAL_DISCLAIMER_EN,
  sanitizeCsvCell,
} from '../src/core/index.ts';
import {
  allocateDossierCodeTx,
  closeDb,
  createDb,
  generatePublicSlug,
  getDbStats,
  withImmediateTransaction,
} from './db.mjs';

const DEFAULT_MAX_BODY_BYTES = 512 * 1024;
const DEFAULT_RATE_LIMIT_MAX = 300;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

const VALID_SECTORS = new Set([
  'real_estate_brokerage',
  'banking_insurance_finance',
  'saas_b2b_services',
  'retail_ecommerce',
  'education_healthcare',
  'other_commercial',
]);

const VALID_CARRIERS = new Set(['etisalat_e_and', 'du', 'other_licensed']);

const VALID_LINE_TYPES = new Set([
  'corporate_licensed_uae',
  'registered_call_center',
  'personal_mobile',
  'unregistered_voip',
]);

const VALID_OFFENSE_TIERS = new Set(['first', 'second', 'third_or_more']);

const VALID_CONTROL_IDS = new Set(DNCR_CONTROLS.map((c) => c.id));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function normalizeBasePath(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let cleaned = raw.trim();
  if (!cleaned || cleaned === '/') return '';
  if (!cleaned.startsWith('/')) cleaned = `/${cleaned}`;
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
}

function stripBasePath(pathname, basePath) {
  if (!basePath) return pathname || '/';
  if (pathname === basePath) return '/';
  if (pathname.startsWith(`${basePath}/`)) {
    return pathname.slice(basePath.length) || '/';
  }
  return pathname || '/';
}

function getSecurityHeaders(extra = {}) {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'",
    ...extra,
  };
}

function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...getSecurityHeaders(extraHeaders),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendText(res, status, contentType, body, extraHeaders = {}, method = 'GET') {
  res.writeHead(status, {
    ...getSecurityHeaders(extraHeaders),
    'Content-Type': contentType,
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  res.end(body);
}

function injectBaseTagHtml(html, basePath) {
  let updated = html;
  if (basePath) {
    updated = updated.replace(/(href|src)="\/(?!\/)/g, `$1="${basePath}/`);
  }
  const safeBase = JSON.stringify(basePath).replace(/</g, '\\u003c');
  const snippet = `<script>window.__DNCRCHECK_BASE__=${safeBase};</script>`;
  if (updated.includes('</head>')) {
    return updated.replace('</head>', `${snippet}\n</head>`);
  }
  if (updated.includes('<body')) {
    return updated.replace('<body', `${snippet}\n<body`);
  }
  return `${snippet}\n${updated}`;
}

function buildFallbackShellHtml(basePath) {
  const apiPrefix = `${basePath}/api`;
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DNCRCheck v${DNCRCHECK_TOOL_VERSION} — مدقق الامتثال للتسويق الهاتفي وسجل عدم الاتصال الإماراتي</title>
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:760px;margin:2.5rem auto;padding:0 1.25rem;line-height:1.6;background:#0a1220;color:#eaf2fc">
  <h1>DNCRCheck v${DNCRCHECK_TOOL_VERSION}</h1>
  <p>UAE Telemarketing &amp; Do-Not-Call Registry (DNCR) Compliance Auditor — Cabinet Resolutions No. 56 &amp; 57 of 2024 (09:00–18:00 GST, 1/day, 2/week, Licensed Corporate Numbers).</p>
  <p><strong>HTTP/SQLite WAL Backend Active</strong> — Base Path: <code>${basePath || '/'}</code> | API Root: <code>${apiPrefix}</code></p>
  <p style="font-size:.9rem;color:#9eb3cf">${LEGAL_DISCLAIMER_AR}</p>
</body>
</html>`;
}

async function readJsonBody(req, maxBodyBytes) {
  const contentLength = Number(req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    req.resume();
    throw new HttpError(
      413,
      'PAYLOAD_TOO_LARGE',
      `Request body exceeds limit of ${maxBodyBytes} bytes.`,
    );
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalBytes = 0;
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      totalBytes += chunk.length;
      if (totalBytes > maxBodyBytes) {
        settled = true;
        req.resume();
        reject(
          new HttpError(
            413,
            'PAYLOAD_TOO_LARGE',
            `Request body exceeds limit of ${maxBodyBytes} bytes.`,
          ),
        );
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new HttpError(400, 'INVALID_JSON', 'Request body must be a JSON object.'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new HttpError(400, 'INVALID_JSON', 'Malformed JSON request body.'));
      }
    });

    req.on('error', (err) => {
      if (settled) return;
      settled = true;
      reject(new HttpError(400, 'READ_ERROR', err.message));
    });
  });
}

function asNumberInRange(val, fallback, min, max, fieldName) {
  if (val === undefined || val === null || val === '') return fallback;
  const n = Number(val);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${fieldName} must be between ${min} and ${max}.`);
  }
  return n;
}

function validateIsoDate(raw, fieldName) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${fieldName} must use ISO YYYY-MM-DD format.`);
  }
  const dt = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(dt.getTime()) || dt.toISOString().slice(0, 10) !== raw) {
    throw new HttpError(400, 'VALIDATION_ERROR', `${fieldName} is not a valid calendar date.`);
  }
  return raw;
}

function validateEnumField(value, validSet, fieldName) {
  if (!validSet.has(value)) {
    throw new HttpError(400, 'VALIDATION_ERROR', `Unsupported ${fieldName}: ${value}`);
  }
  return value;
}

function normalizeControlArray(val, fallback) {
  if (val === undefined) return [...fallback];
  if (!Array.isArray(val)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'implementedControls must be an array.');
  }
  const seen = new Set();
  const out = [];
  for (const item of val) {
    const id = String(item).trim();
    if (!id) continue;
    if (!VALID_CONTROL_IDS.has(id)) {
      throw new HttpError(400, 'VALIDATION_ERROR', `Unsupported control ID: ${id}`);
    }
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function resolveAssessmentInput(body, baseInput = null) {
  let presetBase = baseInput;
  if (body.presetId !== undefined) {
    const found = DNCR_PRESETS.find((p) => p.id === String(body.presetId));
    if (!found) {
      throw new HttpError(404, 'PRESET_NOT_FOUND', `Unknown presetId: ${body.presetId}`);
    }
    presetBase = found.input;
  }

  const defaults = presetBase || DNCR_PRESETS[0].input;
  const rawInput =
    body.input && typeof body.input === 'object' && !Array.isArray(body.input)
      ? { ...body, ...body.input }
      : body;

  const organizationName =
    rawInput.organizationName !== undefined
      ? String(rawInput.organizationName).trim()
      : defaults.organizationName;
  if (!organizationName) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'organizationName is required.');
  }

  const sector = validateEnumField(
    rawInput.sector !== undefined ? String(rawInput.sector).trim() : defaults.sector,
    VALID_SECTORS,
    'sector',
  );

  const carrier = validateEnumField(
    rawInput.carrier !== undefined ? String(rawInput.carrier).trim() : defaults.carrier,
    VALID_CARRIERS,
    'carrier',
  );

  const callerLineType = validateEnumField(
    rawInput.callerLineType !== undefined
      ? String(rawInput.callerLineType).trim()
      : defaults.callerLineType,
    VALID_LINE_TYPES,
    'callerLineType',
  );

  const offenseTier = validateEnumField(
    rawInput.offenseTier !== undefined
      ? String(rawInput.offenseTier).trim()
      : defaults.offenseTier,
    VALID_OFFENSE_TIERS,
    'offenseTier',
  );

  const assessmentDate = validateIsoDate(
    rawInput.assessmentDate !== undefined
      ? String(rawInput.assessmentDate).trim()
      : defaults.assessmentDate,
    'assessmentDate',
  );

  const boolField = (key, fallbackVal) =>
    rawInput[key] !== undefined ? Boolean(rawInput[key]) : fallbackVal;

  return {
    organizationName,
    sector,
    assessmentDate,
    hasPriorTelemarketingPermit: boolField(
      'hasPriorTelemarketingPermit',
      defaults.hasPriorTelemarketingPermit,
    ),
    carrier,
    callerLineType,
    isPersonalMobileUsed: boolField('isPersonalMobileUsed', defaults.isPersonalMobileUsed),
    dncrScrubbingActive: boolField('dncrScrubbingActive', defaults.dncrScrubbingActive),
    callingWindowStartHour: asNumberInRange(
      rawInput.callingWindowStartHour,
      defaults.callingWindowStartHour,
      0,
      23,
      'callingWindowStartHour',
    ),
    callingWindowEndHour: asNumberInRange(
      rawInput.callingWindowEndHour,
      defaults.callingWindowEndHour,
      1,
      24,
      'callingWindowEndHour',
    ),
    maxCallsPerDay: Math.trunc(
      asNumberInRange(rawInput.maxCallsPerDay, defaults.maxCallsPerDay, 0, 100, 'maxCallsPerDay'),
    ),
    maxCallsPerWeek: Math.trunc(
      asNumberInRange(
        rawInput.maxCallsPerWeek,
        defaults.maxCallsPerWeek,
        0,
        500,
        'maxCallsPerWeek',
      ),
    ),
    blocksRejectedFollowups: boolField(
      'blocksRejectedFollowups',
      defaults.blocksRejectedFollowups,
    ),
    callRecordingEnabled: boolField('callRecordingEnabled', defaults.callRecordingEnabled),
    openingDisclosureGiven: boolField('openingDisclosureGiven', defaults.openingDisclosureGiven),
    automatedDialerUsed: boolField('automatedDialerUsed', defaults.automatedDialerUsed),
    offenseTier,
    callLogsCsv:
      rawInput.callLogsCsv !== undefined
        ? rawInput.callLogsCsv === null || rawInput.callLogsCsv === ''
          ? undefined
          : String(rawInput.callLogsCsv)
        : defaults.callLogsCsv,
    implementedControls: normalizeControlArray(
      rawInput.implementedControls,
      defaults.implementedControls,
    ),
    notes:
      rawInput.notes !== undefined
        ? String(rawInput.notes).trim() || undefined
        : defaults.notes,
  };
}

function mapProfileRow(row) {
  return {
    id: row.id,
    organizationName: row.organization_name,
    sector: row.sector,
    carrier: row.carrier,
    assessmentDate: row.assessment_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAssessmentRow(row) {
  return {
    id: row.id,
    profileId: row.profile_id ?? null,
    dossierCode: row.dossier_code,
    title: row.title,
    organizationName: row.organization_name,
    sector: row.sector,
    carrier: row.carrier,
    assessmentDate: row.assessment_date,
    status: row.status,
    readinessScore: row.readiness_score,
    offenseTier: row.offense_tier,
    estimatedMaxExposureAed: row.estimated_max_exposure_aed,
    activeViolationCount: row.active_violation_count,
    canonicalText: row.canonical_text,
    dossierSha256: row.dossier_sha256,
    publicSlug: row.public_slug ?? null,
    lockedAt: row.locked_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    input: JSON.parse(row.input_json),
    result: JSON.parse(row.result_json),
  };
}

function findAssessmentRow(db, idOrCode) {
  const decoded = decodeURIComponent(String(idOrCode || '')).trim();
  if (!decoded) return null;
  if (/^\d+$/.test(decoded)) {
    return db.prepare('SELECT * FROM assessments WHERE id = ?').get(Number(decoded)) ?? null;
  }
  return db.prepare('SELECT * FROM assessments WHERE dossier_code = ?').get(decoded) ?? null;
}

function insertAssessmentRecord(db, { profileId, title, input, result }) {
  const now = new Date().toISOString();
  const currentYear = new Date().getUTCFullYear();
  return withImmediateTransaction(db, () => {
    const dossierCode = allocateDossierCodeTx(db, currentYear);
    return db
      .prepare(
        `INSERT INTO assessments (
           profile_id, dossier_code, title, organization_name, sector, carrier,
           assessment_date, status, readiness_score, offense_tier,
           estimated_max_exposure_aed, active_violation_count,
           input_json, result_json, canonical_text, dossier_sha256,
           public_slug, locked_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
         RETURNING *`,
      )
      .get(
        profileId ?? null,
        dossierCode,
        title,
        input.organizationName,
        input.sector,
        input.carrier,
        input.assessmentDate,
        result.status,
        result.readinessScore,
        input.offenseTier,
        result.penalty.estimatedMaxExposureAed,
        result.callingRules.activeViolationCount,
        JSON.stringify(input),
        JSON.stringify(result),
        result.canonicalDossierText,
        result.dossierSha256,
        now,
        now,
      );
  });
}

function buildFallbackSummaryCsv(item) {
  const header = [
    'dossier_code',
    'organization_name',
    'sector',
    'carrier',
    'assessment_date',
    'status',
    'readiness_score',
    'offense_tier',
    'estimated_max_exposure_aed',
    'active_violation_count',
    'dossier_sha256',
  ].join(',');
  const row = [
    sanitizeCsvCell(item.dossierCode),
    sanitizeCsvCell(item.organizationName),
    sanitizeCsvCell(item.sector),
    sanitizeCsvCell(item.carrier),
    sanitizeCsvCell(item.assessmentDate),
    sanitizeCsvCell(item.status),
    sanitizeCsvCell(item.readinessScore),
    sanitizeCsvCell(item.offenseTier),
    sanitizeCsvCell(item.estimatedMaxExposureAed),
    sanitizeCsvCell(item.activeViolationCount),
    sanitizeCsvCell(item.dossierSha256),
  ].join(',');
  return `\uFEFF${header}\n${row}\n`;
}

export function createApp(options = {}) {
  const startedAtMs = Date.now();
  const basePath = normalizeBasePath(
    options.basePath !== undefined ? options.basePath : process.env.BASE_PATH || '',
  );
  const maxBodyBytes = Number(options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES);
  const rateLimitMax = Number(options.rateLimitMax ?? DEFAULT_RATE_LIMIT_MAX);
  const rateLimitWindowMs = Number(options.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS);
  const staticDir = path.resolve(
    options.staticDir || path.resolve(import.meta.dirname, '..', 'dist'),
  );
  const db = createDb({ dbPath: options.dbPath, dataDir: options.dataDir });

  const rateBuckets = new Map();

  function checkRateLimit(req) {
    if (rateLimitMax <= 0) return;
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp =
      (Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '')).split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
    const now = Date.now();
    const bucket = rateBuckets.get(clientIp);
    if (!bucket || now - bucket.windowStart >= rateLimitWindowMs) {
      rateBuckets.set(clientIp, { windowStart: now, count: 1 });
      return;
    }
    bucket.count += 1;
    if (bucket.count > rateLimitMax) {
      throw new HttpError(429, 'RATE_LIMITED', 'Too many API requests; please wait and retry.');
    }
  }

  function tryServeStatic(res, routePath, method = 'GET') {
    const indexPath = path.join(staticDir, 'index.html');
    const cleanRel = routePath.replace(/^\/+/, '');
    if (cleanRel && !cleanRel.startsWith('api/')) {
      const candidate = path.resolve(staticDir, cleanRel);
      if (
        candidate.startsWith(`${staticDir}${path.sep}`) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile()
      ) {
        const ext = path.extname(candidate).toLowerCase();
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        if (ext === '.html') {
          const html = injectBaseTagHtml(fs.readFileSync(candidate, 'utf8'), basePath);
          sendText(res, 200, mime, html, { 'Cache-Control': 'no-cache' }, method);
          return true;
        }
        const buf = fs.readFileSync(candidate);
        res.writeHead(200, {
          ...getSecurityHeaders(),
          'Content-Type': mime,
          'Content-Length': buf.byteLength,
          'Cache-Control': cleanRel.startsWith('assets/')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=300',
        });
        if (method === 'HEAD') {
          res.end();
          return true;
        }
        res.end(buf);
        return true;
      }
    }

    if (fs.existsSync(indexPath)) {
      const html = injectBaseTagHtml(fs.readFileSync(indexPath, 'utf8'), basePath);
      sendText(res, 200, 'text/html; charset=utf-8', html, { 'Cache-Control': 'no-cache' }, method);
      return true;
    }

    const fallbackHtml = injectBaseTagHtml(buildFallbackShellHtml(basePath), basePath);
    sendText(
      res,
      200,
      'text/html; charset=utf-8',
      fallbackHtml,
      { 'Cache-Control': 'no-cache' },
      method,
    );
    return true;
  }

  async function handleRequest(req, res) {
    const method = (req.method || 'GET').toUpperCase();
    const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
    const routePath = stripBasePath(urlObj.pathname, basePath);

    // Health and readiness probes stay outside rate limits
    if (method === 'GET' && (routePath === '/health' || routePath === '/api/health')) {
      return sendJson(res, 200, {
        ok: true,
        service: 'dncrcheck',
        version: DNCRCHECK_TOOL_VERSION,
        basePath,
        uptimeSec: Math.round((Date.now() - startedAtMs) / 1000),
        db: getDbStats(db),
      });
    }

    if (method === 'GET' && (routePath === '/readyz' || routePath === '/api/readyz')) {
      try {
        const check = db.prepare('SELECT 1 AS ready').get();
        const stats = getDbStats(db);
        if (Number(check?.ready) !== 1) {
          throw new Error('SQLite readiness probe failed.');
        }
        return sendJson(res, 200, {
          ok: true,
          ready: true,
          service: 'dncrcheck',
          version: DNCRCHECK_TOOL_VERSION,
          journalMode: stats.journalMode,
        });
      } catch (err) {
        return sendJson(res, 503, {
          ok: false,
          ready: false,
          error: 'DB_UNAVAILABLE',
          message: err instanceof Error ? err.message : 'Database unavailable',
        });
      }
    }

    if (routePath.startsWith('/api/')) {
      checkRateLimit(req);
    }

    if (method === 'GET' && routePath === '/api/presets') {
      return sendJson(res, 200, {
        ok: true,
        toolName: 'DNCRCheck',
        version: DNCRCHECK_TOOL_VERSION,
        legalDisclaimerEn: LEGAL_DISCLAIMER_EN,
        legalDisclaimerAr: LEGAL_DISCLAIMER_AR,
        presets: DNCR_PRESETS,
      });
    }

    if (method === 'POST' && routePath === '/api/calling-rules') {
      const body = await readJsonBody(req, maxBodyBytes);
      const input = resolveAssessmentInput(body);
      const { callingRules, findings } = evaluateCallingWindowAndCaps(input);
      return sendJson(res, 200, {
        ok: true,
        toolName: 'DNCRCheck',
        version: DNCRCHECK_TOOL_VERSION,
        legalDisclaimerEn: LEGAL_DISCLAIMER_EN,
        legalDisclaimerAr: LEGAL_DISCLAIMER_AR,
        callingRules,
        findings,
      });
    }

    if (method === 'POST' && routePath === '/api/penalties') {
      const body = await readJsonBody(req, maxBodyBytes);
      const input = resolveAssessmentInput(body);
      const { callingRules } = evaluateCallingWindowAndCaps(input);
      const penalty = evaluateDncrPenalties(input, callingRules);
      return sendJson(res, 200, {
        ok: true,
        toolName: 'DNCRCheck',
        version: DNCRCHECK_TOOL_VERSION,
        legalDisclaimerEn: LEGAL_DISCLAIMER_EN,
        legalDisclaimerAr: LEGAL_DISCLAIMER_AR,
        callingRules,
        penalty,
      });
    }

    if (method === 'POST' && routePath === '/api/audit-csv') {
      const body = await readJsonBody(req, maxBodyBytes);
      const csv = typeof body.csv === 'string' ? body.csv : '';
      if (!csv.trim()) {
        throw new HttpError(400, 'EMPTY_CSV', 'Field "csv" must contain a non-empty CSV string.');
      }
      const audit = auditCallLogsCsv(csv);
      const exportCsv = exportCallLogsAuditCsv(audit);
      return sendJson(res, 200, {
        ok: true,
        toolName: 'DNCRCheck',
        version: DNCRCHECK_TOOL_VERSION,
        legalDisclaimerEn: LEGAL_DISCLAIMER_EN,
        legalDisclaimerAr: LEGAL_DISCLAIMER_AR,
        audit,
        exportCsv,
      });
    }

    if (method === 'POST' && routePath === '/api/assess') {
      const body = await readJsonBody(req, maxBodyBytes);
      const input = resolveAssessmentInput(body);
      const assessment = await assessDncrReadiness(input);
      return sendJson(res, 200, {
        ok: true,
        input,
        assessment,
      });
    }

    // Profiles CRUD
    if (routePath === '/api/profiles' && method === 'GET') {
      const rows = db.prepare('SELECT * FROM profiles ORDER BY updated_at DESC, id DESC').all();
      return sendJson(res, 200, {
        ok: true,
        items: rows.map(mapProfileRow),
        total: rows.length,
      });
    }

    if (routePath === '/api/profiles' && method === 'POST') {
      const body = await readJsonBody(req, maxBodyBytes);
      const organizationName = String(body.organizationName || '').trim();
      if (!organizationName) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'organizationName is required.');
      }
      const sector = validateEnumField(
        body.sector !== undefined ? String(body.sector).trim() : 'real_estate_brokerage',
        VALID_SECTORS,
        'sector',
      );
      const carrier = validateEnumField(
        body.carrier !== undefined ? String(body.carrier).trim() : 'etisalat_e_and',
        VALID_CARRIERS,
        'carrier',
      );
      const assessmentDate = body.assessmentDate
        ? validateIsoDate(String(body.assessmentDate).trim(), 'assessmentDate')
        : DNCR_PRESETS[0].input.assessmentDate;
      const notes = body.notes ? String(body.notes).trim() : '';
      const now = new Date().toISOString();

      const inserted = db
        .prepare(
          `INSERT INTO profiles (
             organization_name, sector, carrier, assessment_date, notes,
             created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?)
           RETURNING *`,
        )
        .get(organizationName, sector, carrier, assessmentDate, notes, now, now);
      return sendJson(res, 201, { ok: true, profile: mapProfileRow(inserted) });
    }

    const profileMatch = routePath.match(/^\/api\/profiles\/(\d+)$/);
    if (profileMatch) {
      const profileId = Number(profileMatch[1]);
      const existing = db.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId);
      if (!existing) {
        throw new HttpError(404, 'PROFILE_NOT_FOUND', `Profile ${profileId} not found.`);
      }
      if (method === 'GET') {
        return sendJson(res, 200, { ok: true, profile: mapProfileRow(existing) });
      }
      if (method === 'PATCH') {
        const body = await readJsonBody(req, maxBodyBytes);
        const organizationName =
          body.organizationName !== undefined
            ? String(body.organizationName).trim()
            : existing.organization_name;
        if (!organizationName) {
          throw new HttpError(400, 'VALIDATION_ERROR', 'organizationName cannot be empty.');
        }
        const sector = validateEnumField(
          body.sector !== undefined ? String(body.sector).trim() : existing.sector,
          VALID_SECTORS,
          'sector',
        );
        const carrier = validateEnumField(
          body.carrier !== undefined ? String(body.carrier).trim() : existing.carrier,
          VALID_CARRIERS,
          'carrier',
        );
        const assessmentDate =
          body.assessmentDate !== undefined
            ? validateIsoDate(String(body.assessmentDate).trim(), 'assessmentDate')
            : existing.assessment_date;
        const notes = body.notes !== undefined ? String(body.notes).trim() : existing.notes;
        const now = new Date().toISOString();

        const updated = db
          .prepare(
            `UPDATE profiles
             SET organization_name = ?, sector = ?, carrier = ?,
                 assessment_date = ?, notes = ?, updated_at = ?
             WHERE id = ?
             RETURNING *`,
          )
          .get(organizationName, sector, carrier, assessmentDate, notes, now, profileId);
        return sendJson(res, 200, { ok: true, profile: mapProfileRow(updated) });
      }
      if (method === 'DELETE') {
        db.prepare('DELETE FROM profiles WHERE id = ?').run(profileId);
        return sendJson(res, 200, { ok: true, deletedId: profileId });
      }
    }

    // Assessments & Dossiers aliases
    const isCollection = routePath === '/api/assessments' || routePath === '/api/dossiers';
    if (isCollection && method === 'GET') {
      const statusFilter = (urlObj.searchParams.get('status') || '').trim().toLowerCase();
      const searchQ = (urlObj.searchParams.get('q') || '').trim().toLowerCase();
      let rows = db.prepare('SELECT * FROM assessments ORDER BY updated_at DESC, id DESC').all();
      if (statusFilter) {
        rows = rows.filter((r) => r.status.toLowerCase() === statusFilter);
      }
      if (searchQ) {
        rows = rows.filter(
          (r) =>
            r.dossier_code.toLowerCase().includes(searchQ) ||
            r.organization_name.toLowerCase().includes(searchQ) ||
            r.sector.toLowerCase().includes(searchQ) ||
            r.carrier.toLowerCase().includes(searchQ) ||
            r.title.toLowerCase().includes(searchQ),
        );
      }
      return sendJson(res, 200, {
        ok: true,
        items: rows.map(mapAssessmentRow),
        total: rows.length,
      });
    }

    if (isCollection && method === 'POST') {
      const body = await readJsonBody(req, maxBodyBytes);
      let profileId = null;
      let profileBase = null;
      if (body.profileId !== undefined && body.profileId !== null) {
        const pid = Number(body.profileId);
        const prof = db.prepare('SELECT * FROM profiles WHERE id = ?').get(pid);
        if (!prof) {
          throw new HttpError(404, 'PROFILE_NOT_FOUND', `Profile ${pid} not found.`);
        }
        profileId = pid;
        profileBase = {
          ...DNCR_PRESETS[0].input,
          organizationName: prof.organization_name,
          sector: prof.sector,
          carrier: prof.carrier,
          assessmentDate: prof.assessment_date,
        };
      }

      const input = resolveAssessmentInput(body, profileBase);
      const result = await assessDncrReadiness(input);
      const title =
        body.title !== undefined && String(body.title).trim()
          ? String(body.title).trim()
          : `${input.organizationName} (${input.assessmentDate})`;

      const inserted = insertAssessmentRecord(db, { profileId, title, input, result });
      return sendJson(res, 201, {
        ok: true,
        item: mapAssessmentRow(inserted),
      });
    }

    const dossierActionMatch = routePath.match(
      /^\/api\/(?:assessments|dossiers)\/([^/]+)(?:\/(duplicate|finalize|lock|brief\.md|export\.csv|summary))?$/,
    );
    if (dossierActionMatch) {
      const idOrCode = dossierActionMatch[1];
      const action = dossierActionMatch[2] || '';
      const row = findAssessmentRow(db, idOrCode);
      if (!row) {
        throw new HttpError(404, 'DOSSIER_NOT_FOUND', `Dossier "${idOrCode}" not found.`);
      }

      if (!action && method === 'GET') {
        return sendJson(res, 200, { ok: true, item: mapAssessmentRow(row) });
      }

      if (!action && method === 'PATCH') {
        if (row.locked_at) {
          throw new HttpError(
            409,
            'DOSSIER_LOCKED',
            'Sealed dossier cannot be modified. Duplicate it to edit a new draft.',
            { dossierCode: row.dossier_code, lockedAt: row.locked_at },
          );
        }
        const body = await readJsonBody(req, maxBodyBytes);
        const prevInput = JSON.parse(row.input_json);
        const nextInput = resolveAssessmentInput(body, prevInput);
        const result = await assessDncrReadiness(nextInput);
        const title =
          body.title !== undefined && String(body.title).trim()
            ? String(body.title).trim()
            : row.title;
        const now = new Date().toISOString();

        const updated = db
          .prepare(
            `UPDATE assessments
             SET title = ?, organization_name = ?, sector = ?, carrier = ?,
                 assessment_date = ?, status = ?, readiness_score = ?, offense_tier = ?,
                 estimated_max_exposure_aed = ?, active_violation_count = ?,
                 input_json = ?, result_json = ?, canonical_text = ?, dossier_sha256 = ?,
                 updated_at = ?
             WHERE id = ?
             RETURNING *`,
          )
          .get(
            title,
            nextInput.organizationName,
            nextInput.sector,
            nextInput.carrier,
            nextInput.assessmentDate,
            result.status,
            result.readinessScore,
            nextInput.offenseTier,
            result.penalty.estimatedMaxExposureAed,
            result.callingRules.activeViolationCount,
            JSON.stringify(nextInput),
            JSON.stringify(result),
            result.canonicalDossierText,
            result.dossierSha256,
            now,
            row.id,
          );
        return sendJson(res, 200, { ok: true, item: mapAssessmentRow(updated) });
      }

      if (!action && method === 'DELETE') {
        if (row.locked_at) {
          throw new HttpError(409, 'DOSSIER_LOCKED', 'Sealed dossier cannot be deleted.', {
            dossierCode: row.dossier_code,
            lockedAt: row.locked_at,
          });
        }
        db.prepare('DELETE FROM assessments WHERE id = ?').run(row.id);
        return sendJson(res, 200, {
          ok: true,
          deletedId: row.id,
          dossierCode: row.dossier_code,
        });
      }

      if (action === 'duplicate' && method === 'POST') {
        const body = await readJsonBody(req, maxBodyBytes);
        const sourceInput = JSON.parse(row.input_json);
        const result = await assessDncrReadiness(sourceInput);
        const copyTitle =
          body.title && String(body.title).trim()
            ? String(body.title).trim()
            : `${row.title} (Copy)`;
        const cloned = insertAssessmentRecord(db, {
          profileId: row.profile_id,
          title: copyTitle,
          input: sourceInput,
          result,
        });
        return sendJson(res, 201, { ok: true, item: mapAssessmentRow(cloned) });
      }

      if ((action === 'finalize' || action === 'lock') && method === 'POST') {
        if (row.locked_at) {
          throw new HttpError(
            409,
            'ALREADY_LOCKED',
            'Dossier is already finalized and cryptographically sealed.',
            {
              dossierCode: row.dossier_code,
              lockedAt: row.locked_at,
              dossierSha256: row.dossier_sha256,
              publicSlug: row.public_slug,
            },
          );
        }
        const sourceInput = JSON.parse(row.input_json);
        const result = await assessDncrReadiness(sourceInput);
        const publicSlug = row.public_slug || generatePublicSlug();
        const now = new Date().toISOString();
        const sealed = db
          .prepare(
            `UPDATE assessments
             SET status = ?, readiness_score = ?, offense_tier = ?,
                 estimated_max_exposure_aed = ?, active_violation_count = ?,
                 result_json = ?, canonical_text = ?, dossier_sha256 = ?,
                 public_slug = ?, locked_at = ?, updated_at = ?
             WHERE id = ?
             RETURNING *`,
          )
          .get(
            result.status,
            result.readinessScore,
            sourceInput.offenseTier,
            result.penalty.estimatedMaxExposureAed,
            result.callingRules.activeViolationCount,
            JSON.stringify(result),
            result.canonicalDossierText,
            result.dossierSha256,
            publicSlug,
            now,
            now,
            row.id,
          );
        return sendJson(res, 200, { ok: true, item: mapAssessmentRow(sealed) });
      }

      if (action === 'brief.md' && method === 'GET') {
        const langRaw = (
          urlObj.searchParams.get('lang') ||
          urlObj.searchParams.get('locale') ||
          'ar'
        )
          .trim()
          .toLowerCase();
        const locale = langRaw === 'en' ? 'en' : 'ar';
        const item = mapAssessmentRow(row);
        const md = buildDncrBriefMarkdown(
          item.input,
          item.result,
          item.dossierCode,
          item.dossierSha256,
          locale,
        );
        const safeFilename = item.dossierCode.replace(/[^A-Za-z0-9_-]/g, '');
        return sendText(res, 200, 'text/markdown; charset=utf-8', md, {
          'Content-Disposition': `attachment; filename="${safeFilename}.${locale}.brief.md"`,
          'Cache-Control': 'no-store',
        });
      }

      if (action === 'export.csv' && method === 'GET') {
        const item = mapAssessmentRow(row);
        const csvContent =
          item.result.csvAudit && item.result.csvAudit.rows.length > 0
            ? exportCallLogsAuditCsv(item.result.csvAudit)
            : buildFallbackSummaryCsv(item);
        const safeFilename = item.dossierCode.replace(/[^A-Za-z0-9_-]/g, '');
        return sendText(res, 200, 'text/csv; charset=utf-8', csvContent, {
          'Content-Disposition': `attachment; filename="${safeFilename}.audit.csv"`,
          'Cache-Control': 'no-store',
        });
      }

      if (action === 'summary' && method === 'GET') {
        const item = mapAssessmentRow(row);
        const langRaw = (
          urlObj.searchParams.get('lang') ||
          urlObj.searchParams.get('locale') ||
          'ar'
        )
          .trim()
          .toLowerCase();
        const locale = langRaw === 'en' ? 'en' : 'ar';
        const briefMarkdown = buildDncrBriefMarkdown(
          item.input,
          item.result,
          item.dossierCode,
          item.dossierSha256,
          locale,
        );
        return sendJson(res, 200, {
          ok: true,
          dossierCode: item.dossierCode,
          title: item.title,
          organizationName: item.organizationName,
          sector: item.sector,
          carrier: item.carrier,
          assessmentDate: item.assessmentDate,
          status: item.status,
          readinessScore: item.readinessScore,
          lockedAt: item.lockedAt,
          publicSlug: item.publicSlug,
          dossierSha256: item.dossierSha256,
          legalDisclaimerEn: item.result.legalDisclaimerEn,
          legalDisclaimerAr: item.result.legalDisclaimerAr,
          callingRules: item.result.callingRules,
          penalty: item.result.penalty,
          csvAuditSummary: item.result.csvAudit
            ? {
                totalRows: item.result.csvAudit.totalRows,
                readyCount: item.result.csvAudit.readyCount,
                conditionalCount: item.result.csvAudit.conditionalCount,
                blockedCount: item.result.csvAudit.blockedCount,
                dncrHitCount: item.result.csvAudit.dncrHitCount,
                afterHoursCount: item.result.csvAudit.afterHoursCount,
                frequencyCapBreachCount: item.result.csvAudit.frequencyCapBreachCount,
                personalLineCount: item.result.csvAudit.personalLineCount,
              }
            : null,
          topFindings: item.result.findings.slice(0, 5),
          briefMarkdown,
        });
      }
    }

    const publicMatch = routePath.match(/^\/api\/public\/reports\/([^/]+)$/);
    if (publicMatch && method === 'GET') {
      const slugOrCode = decodeURIComponent(publicMatch[1]).trim();
      const row = db
        .prepare(
          'SELECT * FROM assessments WHERE (public_slug = ? OR dossier_code = ?) AND locked_at IS NOT NULL',
        )
        .get(slugOrCode, slugOrCode);
      if (!row) {
        throw new HttpError(
          404,
          'PUBLIC_REPORT_NOT_FOUND',
          `Published sealed DNCRCheck report "${slugOrCode}" was not found.`,
        );
      }

      const now = new Date().toISOString();
      const viewRow = db
        .prepare(
          `INSERT INTO public_report_views (slug_or_code, view_count, last_viewed_at)
           VALUES (?, 1, ?)
           ON CONFLICT(slug_or_code) DO UPDATE SET
             view_count = view_count + 1,
             last_viewed_at = excluded.last_viewed_at
           RETURNING view_count, last_viewed_at`,
        )
        .get(row.dossier_code, now);

      const item = mapAssessmentRow(row);
      return sendJson(res, 200, {
        ok: true,
        viewCount: Number(viewRow?.view_count ?? 1),
        lastViewedAt: viewRow?.last_viewed_at ?? now,
        report: {
          dossierCode: item.dossierCode,
          publicSlug: item.publicSlug,
          organizationName: item.organizationName,
          sector: item.sector,
          carrier: item.carrier,
          assessmentDate: item.assessmentDate,
          status: item.status,
          readinessScore: item.readinessScore,
          lockedAt: item.lockedAt,
          dossierSha256: item.dossierSha256,
          legalDisclaimerEn: item.result.legalDisclaimerEn,
          legalDisclaimerAr: item.result.legalDisclaimerAr,
          callingRules: item.result.callingRules,
          penalty: item.result.penalty,
          briefAr: buildDncrBriefMarkdown(
            item.input,
            item.result,
            item.dossierCode,
            item.dossierSha256,
            'ar',
          ),
          briefEn: buildDncrBriefMarkdown(
            item.input,
            item.result,
            item.dossierCode,
            item.dossierSha256,
            'en',
          ),
        },
      });
    }

    if (routePath.startsWith('/api/')) {
      throw new HttpError(404, 'API_NOT_FOUND', `Unknown API endpoint: ${method} ${routePath}`);
    }

    if (method === 'GET' || method === 'HEAD') {
      return tryServeStatic(res, routePath, method);
    }

    throw new HttpError(405, 'METHOD_NOT_ALLOWED', `Method ${method} not allowed on ${routePath}`);
  }

  const server = http.createServer((req, res) => {
    void handleRequest(req, res).catch((err) => {
      if (err instanceof HttpError) {
        return sendJson(res, err.status, {
          ok: false,
          error: err.code,
          message: err.message,
          ...err.extra,
        });
      }
      return sendJson(res, 500, {
        ok: false,
        error: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected server error',
      });
    });
  });

  return {
    server,
    db,
    basePath,
    async listen(port = Number(options.port ?? 0), host = options.host || '127.0.0.1') {
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.removeListener('error', reject);
          resolve();
        });
      });
      const addr = server.address();
      const boundPort = typeof addr === 'object' && addr ? addr.port : port;
      return {
        port: boundPort,
        host,
        url: `http://${host}:${boundPort}${basePath}`,
      };
    },
    async close() {
      await new Promise((resolve) => {
        server.close(() => resolve());
      });
      closeDb(db);
    },
  };
}
