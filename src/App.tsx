import { useEffect, useMemo, useState } from 'react';
import { CallLogCsvAuditPanel } from './components/CallLogCsvAuditPanel.tsx';
import { ControlsAndFindingsPanel } from './components/ControlsAndFindingsPanel.tsx';
import { DncrWindowAndFineSvg } from './components/DncrWindowAndFineSvg.tsx';
import { DossierVaultAndPrint } from './components/DossierVaultAndPrint.tsx';
import { RulesAndPenaltyPanel } from './components/RulesAndPenaltyPanel.tsx';
import {
  DNCRCHECK_TOOL_VERSION,
  LEGAL_DISCLAIMER_AR,
  LEGAL_DISCLAIMER_EN,
} from './core/dncrCatalog.ts';
import { DNCR_PRESETS } from './core/presets.ts';
import {
  assessDncrReadiness,
  evaluateDncrCoreSync,
} from './core/readinessAssessor.ts';
import type { AssessmentInput, AssessmentResult, DncrControlId } from './core/types.ts';
import {
  createDossier,
  deleteDossier,
  detectApiMode,
  downloadAuditCsv,
  downloadBriefMarkdown,
  duplicateDossier,
  finalizeDossier,
  getPublicReport,
  listDossiers,
  updateDossier,
  type ApiMode,
  type DncrDossierRecord,
  type PublicDncrReport,
} from './lib/api.ts';
import { stripBase, withBase } from './lib/basePath.ts';
import {
  carrierLabel,
  formatNumber,
  getText,
  sectorLabel,
  statusLabel,
  type Locale,
  type ThemeMode,
} from './lib/i18n.ts';

type WorkspaceTab = 'rules' | 'controls' | 'csv' | 'vault';

function readStoredLocale(): Locale {
  try {
    return localStorage.getItem('dncrcheck.ui.locale') === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

function readStoredTheme(): ThemeMode {
  try {
    return localStorage.getItem('dncrcheck.ui.theme') === 'gulf-night'
      ? 'gulf-night'
      : 'telecom-ivory';
  } catch {
    return 'telecom-ivory';
  }
}

function extractPublicSlug(pathname: string): string | null {
  const rel = stripBase(pathname);
  const match = rel.match(/^\/r\/([^/?#]+)\/?$/i);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function App() {
  const [locale, setLocale] = useState<Locale>(readStoredLocale);
  const [theme, setTheme] = useState<ThemeMode>(readStoredTheme);
  const [mode, setMode] = useState<ApiMode>('local');
  const [input, setInput] = useState<AssessmentInput>(() => DNCR_PRESETS[1]!.input);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('rules');
  const [dossiers, setDossiers] = useState<DncrDossierRecord[]>([]);
  const [activeDossierId, setActiveDossierId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const [publicSlug, setPublicSlug] = useState<string | null>(() =>
    extractPublicSlug(window.location.pathname),
  );
  const [publicState, setPublicState] = useState<{
    loading: boolean;
    data: PublicDncrReport | null;
    error: boolean;
  }>({ loading: false, data: null, error: false });

  const isAr = locale === 'ar';
  const t = getText(locale);
  const syncResult = useMemo(() => evaluateDncrCoreSync(input), [input]);
  const [asyncSha256, setAsyncSha256] = useState<string>('');
  const result: AssessmentResult = useMemo(
    () => ({ ...syncResult, dossierSha256: asyncSha256 || syncResult.dossierSha256 }),
    [syncResult, asyncSha256],
  );

  useEffect(() => {
    let cancelled = false;
    void assessDncrReadiness(input)
      .then((full) => {
        if (!cancelled) {
          setAsyncSha256(full.dossierSha256);
        }
      })
      .catch(() => {
        // Fallback silently if WebCrypto unavailable
      });
    return () => {
      cancelled = true;
    };
  }, [input]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme === 'gulf-night' ? 'dark' : 'light';
    document.body.style.backgroundColor = theme === 'gulf-night' ? '#09111E' : '#F8F9FB';
    try {
      localStorage.setItem('dncrcheck.ui.locale', locale);
      localStorage.setItem('dncrcheck.ui.theme', theme);
    } catch {
      // Ignore storage errors in restricted environments
    }
  }, [locale, theme]);

  useEffect(() => {
    const onPopState = () => {
      setPublicSlug(extractPublicSlug(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const detected = await detectApiMode();
      if (cancelled) return;
      setMode(detected);
      const saved = await listDossiers(detected).catch(() => []);
      if (!cancelled) {
        setDossiers(saved);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!publicSlug) return;
    let cancelled = false;
    setPublicState({ loading: true, data: null, error: false });
    (async () => {
      const detected = await detectApiMode();
      if (cancelled) return;
      setMode(detected);
      const report = await getPublicReport(detected, publicSlug);
      if (cancelled) return;
      if (!report) {
        setPublicState({ loading: false, data: null, error: true });
      } else {
        setPublicState({ loading: false, data: report, error: false });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicSlug]);

  const activeDossier = useMemo(
    () => dossiers.find((d) => d.dossierCode === activeDossierId) ?? null,
    [dossiers, activeDossierId],
  );

  const patchInput = (patch: Partial<AssessmentInput>) => {
    setInput((prev) => ({ ...prev, ...patch }));
  };

  const handleLoadPreset = (presetInput: AssessmentInput, label: string) => {
    setInput(presetInput);
    setDraftTitle(label);
    setActiveDossierId(null);
    setBannerMsg(null);
  };

  const refreshDossiers = async (selectCode?: string) => {
    const list = await listDossiers(mode);
    setDossiers(list);
    if (selectCode) {
      setActiveDossierId(selectCode);
    }
  };

  const handleCreateDossier = async () => {
    setBusy(true);
    setBannerMsg(null);
    try {
      const title = draftTitle.trim() || `${input.organizationName} — ${input.assessmentDate}`;
      const created = await createDossier(mode, input, title);
      await refreshDossiers(created.dossierCode);
      setDraftTitle(created.title);
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : 'Failed to create dossier');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateDossier = async () => {
    if (!activeDossier || activeDossier.lockedAt) return;
    setBusy(true);
    setBannerMsg(null);
    try {
      const updated = await updateDossier(
        mode,
        activeDossier.dossierCode,
        input,
        draftTitle.trim() || activeDossier.title,
      );
      await refreshDossiers(updated.dossierCode);
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : 'Failed to update draft');
    } finally {
      setBusy(false);
    }
  };

  const handleSelectDossier = (dossier: DncrDossierRecord) => {
    setInput(dossier.input);
    setDraftTitle(dossier.title);
    setActiveDossierId(dossier.dossierCode);
    setBannerMsg(null);
  };

  const handleFinalizeDossier = async (dossier: DncrDossierRecord) => {
    setBusy(true);
    setBannerMsg(null);
    try {
      const sealed = await finalizeDossier(mode, dossier.dossierCode);
      await refreshDossiers(sealed.dossierCode);
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : 'Failed to finalize dossier');
    } finally {
      setBusy(false);
    }
  };

  const handleDuplicateDossier = async (dossier: DncrDossierRecord) => {
    setBusy(true);
    setBannerMsg(null);
    try {
      const copy = await duplicateDossier(mode, dossier.dossierCode);
      await refreshDossiers(copy.dossierCode);
      setInput(copy.input);
      setDraftTitle(copy.title);
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : 'Failed to duplicate dossier');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteDossier = async (dossier: DncrDossierRecord) => {
    setBusy(true);
    setBannerMsg(null);
    try {
      await deleteDossier(mode, dossier.dossierCode);
      if (activeDossierId === dossier.dossierCode) {
        setActiveDossierId(null);
      }
      await refreshDossiers();
    } catch (err) {
      setBannerMsg(err instanceof Error ? err.message : 'Failed to delete draft');
    } finally {
      setBusy(false);
    }
  };

  const navigatePublicReport = (slugOrCode: string) => {
    const nextUrl = withBase(`/r/${encodeURIComponent(slugOrCode)}`);
    window.history.pushState({}, '', nextUrl);
    setPublicSlug(slugOrCode);
  };

  const navigateBackStudio = () => {
    window.history.pushState({}, '', withBase('/'));
    setPublicSlug(null);
  };

  const renderHeader = () => (
    <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0"
            style={{
              backgroundColor: 'var(--accent-primary)',
              color: 'var(--accent-primary-fg)',
            }}
          >
            DN
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base font-bold text-[var(--text-primary)]">{t.appName}</h1>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold dnc-mono bg-[var(--bg-soft)] text-[var(--accent-primary)]">
                <bdi dir="ltr">v{DNCRCHECK_TOOL_VERSION}</bdi>
              </span>
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                style={{
                  backgroundColor:
                    mode === 'server' ? 'var(--accent-emerald-soft)' : 'var(--bg-elevated)',
                  color: mode === 'server' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                }}
              >
                {mode === 'server' ? t.serverMode : t.localMode}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{t.appSubtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="lang-toggle"
            onClick={() => setLocale((prev) => (prev === 'ar' ? 'en' : 'ar'))}
            className="px-3 py-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
          >
            {t.toggleLang}
          </button>
          <button
            type="button"
            data-testid="theme-toggle"
            onClick={() =>
              setTheme((prev) => (prev === 'telecom-ivory' ? 'gulf-night' : 'telecom-ivory'))
            }
            className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
          >
            {theme === 'telecom-ivory' ? t.themeDark : t.themeLight}
          </button>
          <button
            type="button"
            data-testid="print-brief-btn"
            onClick={() => window.print()}
            className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-fg)] text-xs font-bold hover:bg-[var(--accent-primary-hover)] cursor-pointer"
          >
            {t.printBrief}
          </button>
        </div>
      </div>
    </header>
  );

  // Public Sealed Report Route (/r/:slugOrCode)
  if (publicSlug) {
    const rep = publicState.data?.report;
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
        {renderHeader()}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
          <div className="flex flex-wrap items-center justify-between gap-2 no-print">
            <button
              type="button"
              data-testid="back-to-studio-btn"
              onClick={navigateBackStudio}
              className="px-3.5 py-2 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] text-xs font-bold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] cursor-pointer"
            >
              {t.publicBackStudio}
            </button>
            {publicState.data && (
              <span className="text-xs font-semibold text-[var(--text-secondary)] num-tabular">
                {t.publicViewsLabel}{' '}
                <strong className="text-[var(--text-primary)]">
                  <bdi dir="ltr">{formatNumber(publicState.data.viewCount)}</bdi>
                </strong>
              </span>
            )}
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-xs text-[var(--text-secondary)] leading-relaxed">
            {isAr ? LEGAL_DISCLAIMER_AR : LEGAL_DISCLAIMER_EN}
          </div>

          {publicState.loading && (
            <div className="dnc-card rounded-2xl p-6 text-xs text-[var(--text-secondary)]">
              {isAr ? 'جارٍ تحميل التقرير المختوم...' : 'Loading sealed public report...'}
            </div>
          )}

          {!publicState.loading && (publicState.error || !rep) && (
            <div
              className="rounded-2xl p-6 text-xs font-bold"
              style={{
                backgroundColor: 'var(--accent-crimson-soft)',
                color: 'var(--accent-crimson)',
              }}
            >
              {t.publicNotFound}
            </div>
          )}

          {rep && (
            <div className="dnc-card rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
                <div className="space-y-1">
                  <div className="dnc-mono text-xs font-bold text-[var(--accent-primary)]">
                    <bdi dir="ltr">{rep.dossierCode}</bdi>
                  </div>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    {rep.organizationName}
                  </h2>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {sectorLabel(rep.sector, locale)} · {carrierLabel(rep.carrier, locale)} ·{' '}
                    <bdi dir="ltr">{rep.assessmentDate}</bdi>
                  </div>
                </div>
                <div className="text-end space-y-1">
                  <span
                    className="inline-block px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor:
                        rep.status === 'ready'
                          ? 'var(--accent-emerald-soft)'
                          : rep.status === 'conditional'
                            ? 'var(--accent-amber-soft)'
                            : 'var(--accent-crimson-soft)',
                      color:
                        rep.status === 'ready'
                          ? 'var(--accent-emerald)'
                          : rep.status === 'conditional'
                            ? 'var(--accent-amber)'
                            : 'var(--accent-crimson)',
                    }}
                  >
                    {statusLabel(rep.status, locale)} · <bdi dir="ltr">{rep.readinessScore}/100</bdi>
                  </span>
                  <div className="dnc-mono text-[11px] text-[var(--text-secondary)]">
                    SHA-256: <bdi dir="ltr">{rep.dossierSha256.slice(0, 16)}…</bdi>
                  </div>
                </div>
              </div>

              <pre
                dir={isAr ? 'rtl' : 'ltr'}
                className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-primary)] bg-[var(--bg-elevated)] rounded-xl p-4 border border-[var(--border-subtle)] font-sans"
              >
                {isAr ? rep.briefAr : rep.briefEn}
              </pre>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      {renderHeader()}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
        {/* Non-MoET / Non-TDRA / Non-Carrier Legal Disclaimer */}
        <div
          data-testid="legal-disclaimer-banner"
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-xs text-[var(--text-secondary)] leading-relaxed"
        >
          {isAr ? LEGAL_DISCLAIMER_AR : LEGAL_DISCLAIMER_EN}
        </div>

        {bannerMsg && (
          <div
            className="rounded-xl p-3 text-xs font-semibold no-print"
            style={{
              backgroundColor: 'var(--accent-crimson-soft)',
              color: 'var(--accent-crimson)',
            }}
          >
            {bannerMsg}
          </div>
        )}

        {/* 3 Presets Row */}
        <section className="space-y-2 no-print">
          <h2 className="text-xs font-bold text-[var(--text-secondary)]">{t.presetsHeading}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {DNCR_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-testid={`preset-${preset.id}`}
                onClick={() =>
                  handleLoadPreset(preset.input, isAr ? preset.labelAr : preset.labelEn)
                }
                className="dnc-card rounded-xl p-3.5 text-start hover:border-[var(--accent-primary)] transition-colors cursor-pointer space-y-1"
              >
                <div className="text-xs font-bold text-[var(--text-primary)]">
                  {isAr ? preset.labelAr : preset.labelEn}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {isAr ? preset.descriptionAr : preset.descriptionEn}
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Interactive 3-Panel Calling Window & Penalty Exposure SVG */}
        <DncrWindowAndFineSvg input={input} result={result} locale={locale} />

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap items-center gap-2 no-print" aria-label="Workspace Tabs">
          {(
            [
              ['rules', t.tabRules],
              ['controls', t.tabControls],
              ['csv', t.tabCsv],
              ['vault', t.tabVault],
            ] as const
          ).map(([tabId, label]) => {
            const active = activeTab === tabId;
            return (
              <button
                key={tabId}
                type="button"
                data-testid={`tab-${tabId}`}
                onClick={() => setActiveTab(tabId)}
                className="px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer"
                style={{
                  backgroundColor: active ? 'var(--accent-primary)' : 'var(--bg-surface)',
                  color: active ? 'var(--accent-primary-fg)' : 'var(--text-primary)',
                  borderColor: active ? 'var(--accent-primary)' : 'var(--border-subtle)',
                }}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* Active Panel */}
        {activeTab === 'rules' && (
          <RulesAndPenaltyPanel
            input={input}
            result={result}
            locale={locale}
            onChange={patchInput}
          />
        )}

        {activeTab === 'controls' && (
          <ControlsAndFindingsPanel
            implementedControls={input.implementedControls}
            result={result}
            locale={locale}
            onUpdateControls={(controls: DncrControlId[]) =>
              patchInput({ implementedControls: controls })
            }
          />
        )}

        {activeTab === 'csv' && (
          <CallLogCsvAuditPanel
            csvText={input.callLogsCsv ?? ''}
            auditSummary={result.csvAudit}
            locale={locale}
            onChangeCsv={(callLogsCsv: string) => patchInput({ callLogsCsv })}
          />
        )}

        {activeTab === 'vault' && (
          <DossierVaultAndPrint
            input={input}
            result={result}
            dossiers={dossiers}
            activeDossier={activeDossier}
            draftTitle={draftTitle}
            locale={locale}
            busy={busy}
            onChangeTitle={setDraftTitle}
            onCreate={handleCreateDossier}
            onUpdate={handleUpdateDossier}
            onSelect={handleSelectDossier}
            onFinalize={handleFinalizeDossier}
            onDuplicate={handleDuplicateDossier}
            onDelete={handleDeleteDossier}
            onDownloadBrief={(dossier, lang) => downloadBriefMarkdown(mode, dossier, lang)}
            onDownloadCsv={(dossier) => downloadAuditCsv(mode, dossier)}
            onOpenPublic={navigatePublicReport}
          />
        )}
      </main>
    </div>
  );
}
