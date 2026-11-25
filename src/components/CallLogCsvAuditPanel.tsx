import type { ChangeEvent } from 'react';
import { auditCallLogsCsv, exportCallLogsAuditCsv } from '../core/callLogCsvAuditor.ts';
import { DNCR_PRESETS } from '../core/presets.ts';
import type { CallLogCsvAuditSummary } from '../core/types.ts';
import { triggerTextDownload } from '../lib/api.ts';
import { formatNumber, getText, statusLabel, type Locale } from '../lib/i18n.ts';

interface Props {
  csvText: string;
  auditSummary: CallLogCsvAuditSummary | null;
  locale: Locale;
  onChangeCsv: (csv: string) => void;
}

export function CallLogCsvAuditPanel({ csvText, auditSummary, locale, onChangeCsv }: Props) {
  const t = getText(locale);
  const isAr = locale === 'ar';

  const effectiveAudit = auditSummary ?? (csvText.trim() ? auditCallLogsCsv(csvText) : null);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChangeCsv(String(reader.result ?? ''));
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleDownloadSafeCsv = () => {
    if (!effectiveAudit) return;
    const csvOut = exportCallLogsAuditCsv(effectiveAudit);
    const bomSafe = csvOut.startsWith('\uFEFF') ? csvOut : `\uFEFF${csvOut}`;
    triggerTextDownload('dncrcheck-call-logs-audit.csv', 'text/csv;charset=utf-8', bomSafe);
  };

  return (
    <div className="dnc-card rounded-2xl p-5 space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{t.csvHeader}</h3>
          <p className="text-xs text-[var(--text-secondary)] dnc-mono">
            <bdi dir="ltr">{t.csvHint}</bdi>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="px-3 py-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer">
            {t.csvUpload}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            type="button"
            data-testid="load-sample-csv-btn"
            onClick={() => onChangeCsv(DNCR_PRESETS[2]?.input.callLogsCsv ?? '')}
            className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] text-xs font-semibold hover:bg-[var(--accent-primary-hover)] cursor-pointer"
          >
            {t.csvLoadSample}
          </button>
          <button
            type="button"
            onClick={() => onChangeCsv('')}
            className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            {t.csvClear}
          </button>
          <button
            type="button"
            data-testid="download-safe-csv-btn"
            disabled={!effectiveAudit || effectiveAudit.totalRows === 0}
            onClick={handleDownloadSafeCsv}
            className="px-3 py-1.5 rounded-lg border border-[var(--accent-emerald)] text-xs font-semibold text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-soft)] disabled:opacity-40 cursor-pointer"
          >
            {t.csvDownloadBom}
          </button>
        </div>
      </div>

      <textarea
        rows={5}
        dir="ltr"
        data-testid="csv-textarea"
        className="dnc-input dnc-mono text-xs"
        placeholder="call_id,caller_line,on_dncr,call_hour_gst,calls_same_day,calls_same_week,prior_rejected,recorded_and_disclosed"
        value={csvText}
        onChange={(e) => onChangeCsv(e.target.value)}
      />

      {effectiveAudit && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {(
              [
                [isAr ? 'إجمالي السجلات' : 'Total Rows', effectiveAudit.totalRows, 'var(--text-primary)'],
                [t.csvReady, effectiveAudit.readyCount, 'var(--accent-emerald)'],
                [t.csvConditional, effectiveAudit.conditionalCount, 'var(--accent-amber)'],
                [t.csvBlocked, effectiveAudit.blockedCount, 'var(--accent-crimson)'],
                [t.csvDncrHits, effectiveAudit.dncrHitCount, 'var(--accent-crimson)'],
                [t.csvAfterHours, effectiveAudit.afterHoursCount, 'var(--accent-amber)'],
              ] as const
            ).map(([label, count, color]) => (
              <div
                key={label}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3"
              >
                <div className="text-[11px] font-semibold text-[var(--text-secondary)]">{label}</div>
                <div className="text-lg font-bold num-tabular mt-0.5" style={{ color }}>
                  <bdi dir="ltr">{formatNumber(count)}</bdi>
                </div>
              </div>
            ))}
          </div>

          {effectiveAudit.parseErrors.length > 0 && (
            <div
              className="rounded-xl p-3 text-xs font-medium"
              style={{
                backgroundColor: 'var(--accent-crimson-soft)',
                color: 'var(--accent-crimson)',
              }}
            >
              {effectiveAudit.parseErrors.join(' · ')}
            </div>
          )}

          {effectiveAudit.rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-xs text-start">
                <thead className="bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="p-2.5 text-start font-semibold">#</th>
                    <th className="p-2.5 text-start font-semibold">{isAr ? 'معرّف المكالمة' : 'Call ID'}</th>
                    <th className="p-2.5 text-start font-semibold">{isAr ? 'نوع الخط' : 'Caller Line'}</th>
                    <th className="p-2.5 text-start font-semibold">DNCR</th>
                    <th className="p-2.5 text-start font-semibold">{isAr ? 'الساعة GST' : 'Hour GST'}</th>
                    <th className="p-2.5 text-start font-semibold">{isAr ? 'التكرار' : 'Day / Wk'}</th>
                    <th className="p-2.5 text-start font-semibold">{isAr ? 'رفض سابق' : 'Prior Reject'}</th>
                    <th className="p-2.5 text-start font-semibold">{isAr ? 'الحالة' : 'Status'}</th>
                    <th className="p-2.5 text-start font-semibold">{isAr ? 'الملاحظات' : 'Issues'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {effectiveAudit.rows.map((row) => (
                    <tr key={`${row.rowNumber}-${row.callId}`} className="bg-[var(--bg-surface)]">
                      <td className="p-2.5 num-tabular text-[var(--text-secondary)]">
                        <bdi dir="ltr">{row.rowNumber}</bdi>
                      </td>
                      <td className="p-2.5 dnc-mono font-semibold text-[var(--text-primary)]">
                        <bdi dir="ltr">{row.callId}</bdi>
                      </td>
                      <td className="p-2.5 dnc-mono text-[var(--text-secondary)]">
                        <bdi dir="ltr">{row.callerLine}</bdi>
                      </td>
                      <td className="p-2.5 font-semibold">
                        {row.onDncr ? (
                          <span style={{ color: 'var(--accent-crimson)' }}>DNCR</span>
                        ) : (
                          <span style={{ color: 'var(--accent-emerald)' }}>—</span>
                        )}
                      </td>
                      <td className="p-2.5 dnc-mono num-tabular">
                        <bdi dir="ltr">{String(row.callHourGst).padStart(2, '0')}:00</bdi>
                      </td>
                      <td className="p-2.5 dnc-mono num-tabular">
                        <bdi dir="ltr">
                          {row.callsSameDay}/{row.callsSameWeek}
                        </bdi>
                      </td>
                      <td className="p-2.5">
                        {row.priorRejected
                          ? isAr
                            ? 'نعم (مرفوض)'
                            : 'Yes (Opted out)'
                          : isAr
                            ? 'لا'
                            : 'No'}
                      </td>
                      <td className="p-2.5">
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                          style={{
                            backgroundColor:
                              row.status === 'ready'
                                ? 'var(--accent-emerald-soft)'
                                : row.status === 'conditional'
                                  ? 'var(--accent-amber-soft)'
                                  : 'var(--accent-crimson-soft)',
                            color:
                              row.status === 'ready'
                                ? 'var(--accent-emerald)'
                                : row.status === 'conditional'
                                  ? 'var(--accent-amber)'
                                  : 'var(--accent-crimson)',
                          }}
                        >
                          {statusLabel(row.status, locale)}
                        </span>
                      </td>
                      <td className="p-2.5 text-[var(--text-secondary)] max-w-xs">
                        {row.issues.length > 0 ? row.issues.join(', ') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
