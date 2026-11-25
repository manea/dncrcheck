import {
  MAX_CALLS_PER_DAY,
  MAX_CALLS_PER_WEEK,
  PERMITTED_END_HOUR_GST,
  PERMITTED_START_HOUR_GST,
} from './dncrCatalog.ts';
import type {
  CallLogCsvAuditSummary,
  CallLogCsvRowAudit,
  ReadinessStatus,
} from './types.ts';

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiter(headerLine: string): string {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const tabCount = (headerLine.match(/\t/g) || []).length;
  if (tabCount > commaCount && tabCount >= semiCount) return '\t';
  if (semiCount > commaCount) return ';';
  return ',';
}

function parseBool(raw: string | undefined): boolean {
  const val = (raw ?? '').trim().toLowerCase();
  return val === 'true' || val === '1' || val === 'yes' || val === 'y';
}

function parseHourGst(raw: string | undefined): number {
  const s = (raw ?? '').trim();
  const hhmm = s.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmm) {
    const h = Number(hhmm[1]);
    const m = Number(hhmm[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      return Math.round((h + m / 60) * 100) / 100;
    }
  }
  const num = Number(s);
  return Number.isFinite(num) && num >= 0 && num <= 24 ? Math.round(num * 100) / 100 : 12;
}

function parseIntNonNeg(raw: string | undefined, fallback: number): number {
  const n = Number((raw ?? '').trim());
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : fallback;
}

/**
 * Neutralizes CWE-1236 formula injection prefixes and applies RFC 4180 quoting.
 */
export function sanitizeCsvCell(value: string | number | boolean): string {
  const raw = String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export function auditCallLogsCsv(csvText: string): CallLogCsvAuditSummary {
  const cleaned = csvText.replace(/^\uFEFF/, '').trim();
  if (!cleaned) {
    return {
      totalRows: 0,
      readyCount: 0,
      conditionalCount: 0,
      blockedCount: 0,
      dncrHitCount: 0,
      afterHoursCount: 0,
      frequencyCapBreachCount: 0,
      rejectedFollowupCount: 0,
      personalLineCount: 0,
      rows: [],
      parseErrors: ['Call log CSV payload is empty.'],
    };
  }

  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      totalRows: 0,
      readyCount: 0,
      conditionalCount: 0,
      blockedCount: 0,
      dncrHitCount: 0,
      afterHoursCount: 0,
      frequencyCapBreachCount: 0,
      rejectedFollowupCount: 0,
      personalLineCount: 0,
      rows: [],
      parseErrors: ['Call log CSV must include header row and at least one data row.'],
    };
  }

  const delimiter = detectDelimiter(lines[0]!);
  const headers = splitCsvLine(lines[0]!, delimiter).map((h) => h.toLowerCase());
  const idx = (name: string): number => headers.indexOf(name);

  const cCallId = idx('call_id');
  const cLine = idx('caller_line');
  const cDncr = idx('on_dncr');
  const cHour = idx('call_hour_gst');
  const cDay = idx('calls_same_day');
  const cWeek = idx('calls_same_week');
  const cRejected = idx('prior_rejected');
  const cRecDiscl = idx('recorded_and_disclosed');

  const rows: CallLogCsvRowAudit[] = [];
  let readyCount = 0;
  let conditionalCount = 0;
  let blockedCount = 0;
  let dncrHitCount = 0;
  let afterHoursCount = 0;
  let frequencyCapBreachCount = 0;
  let rejectedFollowupCount = 0;
  let personalLineCount = 0;

  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]!, delimiter);
    const callId = cCallId >= 0 && cells[cCallId] ? cells[cCallId]! : `CALL-${i}`;
    const callerLine =
      cLine >= 0 && cells[cLine] ? cells[cLine]! : 'corporate_licensed_uae';
    const onDncr = cDncr >= 0 ? parseBool(cells[cDncr]) : false;
    const callHourGst = cHour >= 0 ? parseHourGst(cells[cHour]) : 12;
    const callsSameDay = cDay >= 0 ? parseIntNonNeg(cells[cDay], 1) : 1;
    const callsSameWeek = cWeek >= 0 ? parseIntNonNeg(cells[cWeek], 1) : 1;
    const priorRejected = cRejected >= 0 ? parseBool(cells[cRejected]) : false;
    const recordedAndDisclosed =
      cRecDiscl >= 0 ? parseBool(cells[cRecDiscl]) : true;

    const lineLower = callerLine.toLowerCase();
    const isPersonal =
      lineLower.includes('personal') || lineLower.includes('unregistered');
    const isAfterHours =
      callHourGst < PERMITTED_START_HOUR_GST ||
      callHourGst >= PERMITTED_END_HOUR_GST;
    const isCapBreach =
      callsSameDay > MAX_CALLS_PER_DAY || callsSameWeek > MAX_CALLS_PER_WEEK;

    const issues: string[] = [];
    let hasBlocker = false;
    let hasWarning = false;

    if (onDncr) {
      dncrHitCount += 1;
      hasBlocker = true;
      issues.push('Called number listed on DNCR (AED 50k–150k fine risk).');
    }
    if (isPersonal) {
      personalLineCount += 1;
      hasBlocker = true;
      issues.push('Used personal/unregistered phone line (AED 5k–50k fine & disconnection risk).');
    }
    if (isAfterHours) {
      afterHoursCount += 1;
      hasBlocker = true;
      issues.push('Dialed outside permitted 09:00–18:00 UAE GST hours.');
    }
    if (isCapBreach) {
      frequencyCapBreachCount += 1;
      hasBlocker = true;
      issues.push('Exceeded 1 call/day or 2 calls/week cap.');
    }
    if (priorRejected) {
      rejectedFollowupCount += 1;
      hasBlocker = true;
      issues.push('Re-called consumer after prior offer rejection.');
    }
    if (!recordedAndDisclosed) {
      hasWarning = true;
      issues.push('Missing call recording or upfront company/purpose disclosure.');
    }

    const status: ReadinessStatus = hasBlocker
      ? 'blocked'
      : hasWarning
        ? 'conditional'
        : 'ready';
    if (status === 'ready') readyCount += 1;
    else if (status === 'conditional') conditionalCount += 1;
    else blockedCount += 1;

    rows.push({
      rowNumber: i,
      callId,
      callerLine,
      onDncr,
      callHourGst,
      callsSameDay,
      callsSameWeek,
      priorRejected,
      recordedAndDisclosed,
      status,
      issues,
    });
  }

  return {
    totalRows: rows.length,
    readyCount,
    conditionalCount,
    blockedCount,
    dncrHitCount,
    afterHoursCount,
    frequencyCapBreachCount,
    rejectedFollowupCount,
    personalLineCount,
    rows,
    parseErrors: [],
  };
}

export function exportCallLogsAuditCsv(summary: CallLogCsvAuditSummary): string {
  const header = [
    'row_number',
    'call_id',
    'caller_line',
    'on_dncr',
    'call_hour_gst',
    'calls_same_day',
    'calls_same_week',
    'prior_rejected',
    'recorded_and_disclosed',
    'status',
    'issues',
  ].join(',');

  const lines = summary.rows.map((row) =>
    [
      sanitizeCsvCell(row.rowNumber),
      sanitizeCsvCell(row.callId),
      sanitizeCsvCell(row.callerLine),
      sanitizeCsvCell(row.onDncr),
      sanitizeCsvCell(row.callHourGst),
      sanitizeCsvCell(row.callsSameDay),
      sanitizeCsvCell(row.callsSameWeek),
      sanitizeCsvCell(row.priorRejected),
      sanitizeCsvCell(row.recordedAndDisclosed),
      sanitizeCsvCell(row.status),
      sanitizeCsvCell(row.issues.join(' | ')),
    ].join(','),
  );

  return `\uFEFF${header}\n${lines.join('\n')}${lines.length > 0 ? '\n' : ''}`;
}
