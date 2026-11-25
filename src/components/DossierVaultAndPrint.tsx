import { buildDncrBriefMarkdown } from '../core/briefBuilder.ts';
import type { AssessmentInput, AssessmentResult } from '../core/types.ts';
import type { DncrDossierRecord } from '../lib/api.ts';
import { formatNumber, getText, statusLabel, type Locale } from '../lib/i18n.ts';

interface Props {
  input: AssessmentInput;
  result: AssessmentResult;
  dossiers: DncrDossierRecord[];
  activeDossier: DncrDossierRecord | null;
  draftTitle: string;
  locale: Locale;
  busy: boolean;
  onChangeTitle: (title: string) => void;
  onCreate: () => void;
  onUpdate: () => void;
  onSelect: (dossier: DncrDossierRecord) => void;
  onFinalize: (dossier: DncrDossierRecord) => void;
  onDuplicate: (dossier: DncrDossierRecord) => void;
  onDelete: (dossier: DncrDossierRecord) => void;
  onDownloadBrief: (dossier: DncrDossierRecord, lang: Locale) => void;
  onDownloadCsv: (dossier: DncrDossierRecord) => void;
  onOpenPublic: (slugOrCode: string) => void;
}

export function DossierVaultAndPrint({
  input,
  result,
  dossiers,
  activeDossier,
  draftTitle,
  locale,
  busy,
  onChangeTitle,
  onCreate,
  onUpdate,
  onSelect,
  onFinalize,
  onDuplicate,
  onDelete,
  onDownloadBrief,
  onDownloadCsv,
  onOpenPublic,
}: Props) {
  const t = getText(locale);
  const isAr = locale === 'ar';
  const isLocked = Boolean(activeDossier?.lockedAt);

  const previewCode = activeDossier?.dossierCode ?? 'DNC-PREVIEW-DRAFT';
  const previewSha = activeDossier?.dossierSha256 ?? result.dossierSha256;
  const liveBrief = buildDncrBriefMarkdown(input, result, previewCode, previewSha, locale);

  return (
    <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Save / Update / Seal Action Card */}
      <div className="dnc-card rounded-2xl p-5 space-y-4 no-print">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <label className="md:col-span-2 space-y-1.5">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">
              {t.vaultDossierTitle}
            </span>
            <input
              type="text"
              dir="auto"
              data-testid="dossier-title-input"
              className="dnc-input"
              placeholder={input.organizationName}
              value={draftTitle}
              onChange={(e) => onChangeTitle(e.target.value)}
            />
          </label>
          <div className="text-xs text-[var(--text-secondary)] dnc-mono truncate">
            {activeDossier ? (
              <bdi dir="ltr">
                {activeDossier.dossierCode} · {activeDossier.dossierSha256.slice(0, 12)}
              </bdi>
            ) : (
              <bdi dir="ltr">{result.dossierSha256.slice(0, 12)}</bdi>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="create-dossier-btn"
            disabled={busy}
            onClick={onCreate}
            className="px-3.5 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] text-xs font-bold hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 cursor-pointer"
          >
            {t.vaultSaveNew}
          </button>

          {activeDossier && !isLocked && (
            <button
              type="button"
              data-testid="update-dossier-btn"
              disabled={busy}
              onClick={onUpdate}
              className="px-3.5 py-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-50 cursor-pointer"
            >
              {t.vaultUpdateDraft}
            </button>
          )}

          {activeDossier && !isLocked && (
            <button
              type="button"
              data-testid="finalize-dossier-btn"
              disabled={busy}
              onClick={() => onFinalize(activeDossier)}
              className="px-3.5 py-2 rounded-lg border border-[var(--accent-emerald)] text-xs font-bold text-[var(--accent-emerald)] hover:bg-[var(--accent-emerald-soft)] disabled:opacity-50 cursor-pointer"
            >
              {t.vaultSealLock}
            </button>
          )}

          {activeDossier && isLocked && (activeDossier.publicSlug || activeDossier.dossierCode) && (
            <button
              type="button"
              data-testid="open-public-report-btn"
              onClick={() =>
                onOpenPublic(activeDossier.publicSlug || activeDossier.dossierCode)
              }
              className="px-3.5 py-2 rounded-lg bg-[var(--accent-emerald)] text-white text-xs font-bold hover:opacity-90 cursor-pointer"
            >
              {t.vaultOpenPublic}
            </button>
          )}

          {activeDossier && (
            <>
              <button
                type="button"
                data-testid="duplicate-dossier-btn"
                disabled={busy}
                onClick={() => onDuplicate(activeDossier)}
                className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
              >
                {t.vaultDuplicate}
              </button>
              <button
                type="button"
                onClick={() => onDownloadBrief(activeDossier, 'ar')}
                className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
              >
                {t.vaultDownloadMdAr}
              </button>
              <button
                type="button"
                onClick={() => onDownloadBrief(activeDossier, 'en')}
                className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
              >
                {t.vaultDownloadMdEn}
              </button>
              <button
                type="button"
                data-testid="download-vault-csv-btn"
                onClick={() => onDownloadCsv(activeDossier)}
                className="px-3 py-2 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
              >
                {t.vaultDownloadCsv}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Saved Dossiers List */}
      <div className="dnc-card rounded-2xl p-5 space-y-3 no-print">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{t.vaultSavedList}</h3>
          <span className="text-xs font-bold num-tabular text-[var(--text-secondary)]">
            <bdi dir="ltr">{formatNumber(dossiers.length)}</bdi>
          </span>
        </div>

        {dossiers.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">{t.vaultEmpty}</p>
        ) : (
          <div className="space-y-2.5">
            {dossiers.map((item) => {
              const selected = activeDossier?.dossierCode === item.dossierCode;
              const locked = Boolean(item.lockedAt);
              return (
                <div
                  key={item.dossierCode}
                  data-testid={`dossier-row-${item.dossierCode}`}
                  className="rounded-xl border p-3.5 flex flex-wrap items-center justify-between gap-3 transition-colors"
                  style={{
                    borderColor: selected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                    backgroundColor: selected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                  }}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="dnc-mono text-xs font-bold text-[var(--accent-primary)]">
                        <bdi dir="ltr">{item.dossierCode}</bdi>
                      </span>
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {item.title || item.organizationName}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-bold"
                        style={{
                          backgroundColor: locked
                            ? 'var(--accent-emerald-soft)'
                            : 'var(--bg-soft)',
                          color: locked ? 'var(--accent-emerald)' : 'var(--accent-cobalt)',
                        }}
                      >
                        {locked ? t.vaultLockedBadge : t.vaultDraftBadge}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] flex flex-wrap items-center gap-3 num-tabular">
                      <span>{statusLabel(item.status, locale)}</span>
                      <span>
                        <bdi dir="ltr">{item.readinessScore}/100</bdi>
                      </span>
                      <span>
                        {isAr ? 'الحد الأقصى للغرامة' : 'Max Fine'}:{' '}
                        {isAr ? (
                          <>
                            <bdi dir="ltr">{formatNumber(item.estimatedMaxExposureAed)}</bdi> د.إ
                          </>
                        ) : (
                          <bdi dir="ltr">AED {formatNumber(item.estimatedMaxExposureAed)}</bdi>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      className="px-2.5 py-1 rounded-lg border border-[var(--border-strong)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
                    >
                      {isAr ? 'فتح' : 'Load'}
                    </button>
                    {locked && (item.publicSlug || item.dossierCode) && (
                      <button
                        type="button"
                        onClick={() => onOpenPublic(item.publicSlug || item.dossierCode)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--accent-emerald-soft)] text-[var(--accent-emerald)] text-xs font-semibold cursor-pointer"
                      >
                        {isAr ? 'التقرير العام' : 'Public'}
                      </button>
                    )}
                    {!locked && (
                      <button
                        type="button"
                        data-testid={`delete-dossier-${item.dossierCode}`}
                        onClick={() => onDelete(item)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--accent-crimson-soft)] text-[var(--accent-crimson)] text-xs font-semibold cursor-pointer"
                      >
                        {t.vaultDelete}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Printable A4 Executive Brief */}
      <div className="dnc-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{t.briefPreviewTitle}</h3>
          <span className="dnc-mono text-[11px] text-[var(--text-secondary)]">
            <bdi dir="ltr">{previewSha.slice(0, 16)}…</bdi>
          </span>
        </div>
        <pre
          data-testid="brief-markdown-preview"
          dir={isAr ? 'rtl' : 'ltr'}
          className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-primary)] bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)] font-sans"
        >
          {liveBrief}
        </pre>
      </div>
    </div>
  );
}
