import { DNCR_CONTROLS } from '../core/dncrCatalog.ts';
import type { AssessmentResult, DncrControlId } from '../core/types.ts';
import { formatNumber, getText, type Locale } from '../lib/i18n.ts';

interface Props {
  implementedControls: readonly DncrControlId[];
  result: AssessmentResult;
  locale: Locale;
  onUpdateControls: (controls: DncrControlId[]) => void;
}

export function ControlsAndFindingsPanel({
  implementedControls,
  result,
  locale,
  onUpdateControls,
}: Props) {
  const t = getText(locale);
  const isAr = locale === 'ar';
  const activeSet = new Set(implementedControls);

  const toggleControl = (id: DncrControlId) => {
    if (activeSet.has(id)) {
      onUpdateControls(implementedControls.filter((c) => c !== id));
    } else {
      onUpdateControls([...implementedControls, id]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Six Controls Matrix */}
      <div className="dnc-card rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{t.controlsHeader}</h3>
            <p className="text-xs text-[var(--text-secondary)] num-tabular">
              {isAr ? 'النتيجة الحالية:' : 'Current score:'}{' '}
              <strong className="text-[var(--text-primary)]">
                <bdi dir="ltr">{formatNumber(result.readinessScore)} / 100</bdi>
              </strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdateControls(DNCR_CONTROLS.map((c) => c.id))}
              className="px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
            >
              {t.selectAll}
            </button>
            <button
              type="button"
              onClick={() => onUpdateControls([])}
              className="px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
            >
              {t.clearAll}
            </button>
          </div>
        </div>

        <div className="space-y-2.5">
          {DNCR_CONTROLS.map((ctrl) => {
            const checked = activeSet.has(ctrl.id);
            return (
              <label
                key={ctrl.id}
                className="flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-colors"
                style={{
                  borderColor: checked ? 'var(--accent-emerald)' : 'var(--border-subtle)',
                  backgroundColor: checked ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                }}
              >
                <input
                  type="checkbox"
                  data-testid={`control-${ctrl.id}`}
                  checked={checked}
                  onChange={() => toggleControl(ctrl.id)}
                  className="mt-1 h-4 w-4 accent-[var(--accent-primary)] shrink-0"
                />
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      <span className="dnc-mono text-[var(--accent-primary)] me-1.5">
                        <bdi dir="ltr">{ctrl.id}</bdi>
                      </span>
                      {isAr ? ctrl.titleAr : ctrl.titleEn}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--bg-soft)] text-[var(--accent-primary)] num-tabular">
                      <bdi dir="ltr">{ctrl.weight}</bdi> {isAr ? 'نقطة' : 'pts'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {isAr ? ctrl.descriptionAr : ctrl.descriptionEn}
                  </p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Findings List */}
      <div className="dnc-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{t.findingsHeader}</h3>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[var(--bg-elevated)] text-[var(--text-primary)] num-tabular">
            <bdi dir="ltr">{formatNumber(result.findings.length)}</bdi>
          </span>
        </div>

        {result.findings.length === 0 ? (
          <div
            className="rounded-xl p-4 text-xs font-semibold leading-relaxed"
            style={{
              backgroundColor: 'var(--accent-emerald-soft)',
              color: 'var(--accent-emerald)',
            }}
          >
            {t.noFindings}
          </div>
        ) : (
          <div className="space-y-3">
            {result.findings.map((finding) => {
              const badgeStyle =
                finding.severity === 'blocker'
                  ? {
                      bg: 'var(--accent-crimson-soft)',
                      fg: 'var(--accent-crimson)',
                      label: t.sevBlocker,
                    }
                  : finding.severity === 'warning'
                    ? {
                        bg: 'var(--accent-amber-soft)',
                        fg: 'var(--accent-amber)',
                        label: t.sevWarning,
                      }
                    : {
                        bg: 'var(--accent-cobalt-soft)',
                        fg: 'var(--accent-cobalt)',
                        label: t.sevInfo,
                      };

              return (
                <div
                  key={finding.code}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3.5 space-y-1.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                        style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.fg }}
                      >
                        {badgeStyle.label}
                      </span>
                      <span className="dnc-mono text-[11px] font-bold text-[var(--text-secondary)]">
                        <bdi dir="ltr">{finding.code}</bdi>
                      </span>
                    </div>
                    <span className="dnc-mono text-[11px] text-[var(--text-secondary)]">
                      <bdi dir="ltr">{finding.legalRef}</bdi>
                    </span>
                  </div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">
                    {isAr ? finding.titleAr : finding.titleEn}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {isAr ? finding.detailAr : finding.detailEn}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
