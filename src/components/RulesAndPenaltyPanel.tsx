import type {
  AssessmentInput,
  AssessmentResult,
  CallerLineType,
  DncrSector,
  OffenseTier,
  TelecomCarrier,
} from '../core/types.ts';
import {
  CALLER_LINE_OPTIONS,
  CARRIER_OPTIONS,
  OFFENSE_TIER_OPTIONS,
  SECTOR_OPTIONS,
  formatNumber,
  getText,
  type Locale,
} from '../lib/i18n.ts';

interface Props {
  input: AssessmentInput;
  result: AssessmentResult;
  locale: Locale;
  onChange: (patch: Partial<AssessmentInput>) => void;
}

export function RulesAndPenaltyPanel({ input, result, locale, onChange }: Props) {
  const t = getText(locale);
  const isAr = locale === 'ar';
  const { callingRules, penalty } = result;

  const capsCompliant = callingRules.dailyCapCompliant && callingRules.weeklyCapCompliant;

  const shortLineLabels: Record<CallerLineType, { ar: string; en: string }> = {
    corporate_licensed_uae: { ar: 'خط شركة مرخص', en: 'Corporate Line' },
    registered_call_center: { ar: 'خط مركز اتصال', en: 'Call Center Line' },
    personal_mobile: { ar: 'جوال شخصي (محظور)', en: 'Personal Mobile' },
    unregistered_voip: { ar: 'VoIP غير مسجل', en: 'Unregistered VoIP' },
  };
  const shortTierLabels: Record<OffenseTier, { ar: string; en: string }> = {
    first: { ar: 'المخالفة الأولى', en: '1st Violation Tier' },
    second: { ar: 'التكرار الثاني', en: '2nd Repeat Tier' },
    third_or_more: { ar: 'التكرار الثالث+', en: '3rd+ Repeat Ceiling' },
  };
  const shortLineText = shortLineLabels[input.callerLineType][isAr ? 'ar' : 'en'];
  const shortTierText = shortTierLabels[input.offenseTier][isAr ? 'ar' : 'en'];
  const sameExposure = penalty.estimatedMinExposureAed === penalty.estimatedMaxExposureAed;

  return (
    <div className="space-y-5" dir={isAr ? 'rtl' : 'ltr'}>
      {/* 5 Statutory KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="dnc-card rounded-xl p-3.5 space-y-1.5">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
            {t.statWindow}
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-lg font-bold num-tabular dnc-mono text-[var(--text-primary)]">
              <bdi dir="ltr">
                {String(input.callingWindowStartHour).padStart(2, '0')}:00–
                {String(input.callingWindowEndHour).padStart(2, '0')}:00
              </bdi>
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{
                backgroundColor: callingRules.callingHoursCompliant
                  ? 'var(--accent-emerald-soft)'
                  : 'var(--accent-crimson-soft)',
                color: callingRules.callingHoursCompliant
                  ? 'var(--accent-emerald)'
                  : 'var(--accent-crimson)',
              }}
            >
              {callingRules.callingHoursCompliant ? t.compliantTag : t.nonCompliantTag}
            </span>
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">
            {isAr ? 'النطاق الإلزامي: 09:00–18:00 بتوقيت الإمارات' : 'Mandatory: 09:00–18:00 UAE GST'}
          </div>
        </div>

        <div className="dnc-card rounded-xl p-3.5 space-y-1.5">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">{t.statCaps}</div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold num-tabular text-[var(--text-primary)]">
              <bdi dir="ltr">{formatNumber(input.maxCallsPerDay)}</bdi>{' '}
              {isAr ? 'مكالمة/يوم' : '/day'} ·{' '}
              <bdi dir="ltr">{formatNumber(input.maxCallsPerWeek)}</bdi>{' '}
              {isAr ? 'أسبوعياً' : '/wk'}
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-bold"
              style={{
                backgroundColor: capsCompliant
                  ? 'var(--accent-emerald-soft)'
                  : 'var(--accent-crimson-soft)',
                color: capsCompliant ? 'var(--accent-emerald)' : 'var(--accent-crimson)',
              }}
            >
              {capsCompliant ? t.compliantTag : t.nonCompliantTag}
            </span>
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">
            {isAr ? 'حد عدم الرد + المنع الفوري عند الرفض' : 'Unanswered cap + zero call after opt-out'}
          </div>
        </div>

        <div className="dnc-card rounded-xl p-3.5 space-y-1.5">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">{t.statLine}</div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--text-primary)]">{shortLineText}</span>
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0"
              style={{
                backgroundColor: callingRules.lineCompliant
                  ? 'var(--accent-emerald-soft)'
                  : 'var(--accent-crimson-soft)',
                color: callingRules.lineCompliant
                  ? 'var(--accent-emerald)'
                  : 'var(--accent-crimson)',
              }}
            >
              {callingRules.lineCompliant ? t.compliantTag : t.nonCompliantTag}
            </span>
          </div>
          <div className="text-[11px] text-[var(--text-secondary)]">
            {penalty.telecomDisconnectionRisk
              ? isAr
                ? 'خطر فصل خدمة الاتصالات وتغريم 5k–50k د.إ'
                : 'Service disconnection + AED 5k–50k risk'
              : isAr
                ? 'خط مؤسسي مرخص تحت الرخصة التجارية'
                : 'Licensed corporate line under UAE trade license'}
          </div>
        </div>

        <div className="dnc-card rounded-xl p-3.5 space-y-1.5">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">{t.statTier}</div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--text-primary)]">{shortTierText}</span>
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] num-tabular">
            {isAr ? 'المخالفات النشطة:' : 'Active breaches:'}{' '}
            <bdi dir="ltr">{formatNumber(callingRules.activeViolationCount)}</bdi>
          </div>
        </div>

        <div className="dnc-card rounded-xl p-3.5 space-y-1.5">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
            {t.statFineBand}
          </div>
          <div className="text-base font-bold num-tabular text-[var(--text-primary)]">
            {sameExposure ? (
              isAr ? (
                <>
                  <bdi dir="ltr">{formatNumber(penalty.estimatedMaxExposureAed)}</bdi> د.إ
                </>
              ) : (
                <bdi dir="ltr">AED {formatNumber(penalty.estimatedMaxExposureAed)}</bdi>
              )
            ) : isAr ? (
              <>
                <bdi dir="ltr">{formatNumber(penalty.estimatedMinExposureAed)}</bdi>–
                <bdi dir="ltr">{formatNumber(penalty.estimatedMaxExposureAed)}</bdi> د.إ
              </>
            ) : (
              <bdi dir="ltr">
                AED {formatNumber(penalty.estimatedMinExposureAed)}–
                {formatNumber(penalty.estimatedMaxExposureAed)}
              </bdi>
            )}
          </div>
          <div
            className="text-[11px] font-semibold"
            style={{
              color: penalty.licenseSuspensionRisk
                ? 'var(--accent-crimson)'
                : penalty.estimatedMaxExposureAed > 0
                  ? 'var(--accent-amber)'
                  : 'var(--accent-emerald)',
            }}
          >
            {penalty.licenseSuspensionRisk
              ? isAr
                ? 'خطر وقف/إلغاء الرخصة التجارية!'
                : 'License suspension / revocation risk!'
              : penalty.estimatedMaxExposureAed > 0
                ? isAr
                  ? 'تعرض غرامة إدارية نشط'
                  : 'Active administrative fine exposure'
                : isAr
                  ? 'صفر تعرض مالي تشريعي'
                  : 'AED 0 statutory exposure'}
          </div>
        </div>
      </div>

      {/* Interactive Parameters Form */}
      <div className="dnc-card rounded-2xl p-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">
              {t.organizationName}
            </span>
            <input
              type="text"
              dir="auto"
              data-testid="org-name-input"
              className="dnc-input"
              value={input.organizationName}
              onChange={(e) => onChange({ organizationName: e.target.value })}
            />
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">
              {t.sector}
            </span>
            <select
              className="dnc-input"
              data-testid="sector-select"
              value={input.sector}
              onChange={(e) => onChange({ sector: e.target.value as DncrSector })}
            >
              {SECTOR_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isAr ? opt.labelAr : opt.labelEn}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">
              {t.carrier}
            </span>
            <select
              className="dnc-input"
              data-testid="carrier-select"
              value={input.carrier}
              onChange={(e) => onChange({ carrier: e.target.value as TelecomCarrier })}
            >
              {CARRIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isAr ? opt.labelAr : opt.labelEn}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">
              {t.callerLineType}
            </span>
            <select
              className="dnc-input"
              data-testid="caller-line-select"
              value={input.callerLineType}
              onChange={(e) => {
                const nextType = e.target.value as CallerLineType;
                onChange({
                  callerLineType: nextType,
                  isPersonalMobileUsed:
                    nextType === 'personal_mobile' ? true : input.isPersonalMobileUsed,
                });
              }}
            >
              {CALLER_LINE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isAr ? opt.labelAr : opt.labelEn}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">
              {t.offenseTier}
            </span>
            <select
              className="dnc-input"
              data-testid="offense-tier-select"
              value={input.offenseTier}
              onChange={(e) => onChange({ offenseTier: e.target.value as OffenseTier })}
            >
              {OFFENSE_TIER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isAr ? opt.labelAr : opt.labelEn}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">
              {t.assessmentDate}
            </span>
            <input
              type="date"
              dir="ltr"
              className="dnc-input dnc-mono"
              value={input.assessmentDate}
              onChange={(e) => onChange({ assessmentDate: e.target.value })}
            />
          </label>
        </div>

        {/* Numeric Calling Window & Cap Controls */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-[var(--border-subtle)]">
          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">
              {t.startHour}
            </span>
            <input
              type="number"
              min={0}
              max={23}
              dir="ltr"
              data-testid="start-hour-input"
              className="dnc-input dnc-mono num-tabular"
              value={input.callingWindowStartHour}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                onChange({
                  callingWindowStartHour: Number.isFinite(parsed)
                    ? Math.max(0, Math.min(23, parsed))
                    : 0,
                });
              }}
            />
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">
              {t.endHour}
            </span>
            <input
              type="number"
              min={1}
              max={24}
              dir="ltr"
              data-testid="end-hour-input"
              className="dnc-input dnc-mono num-tabular"
              value={input.callingWindowEndHour}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                onChange({
                  callingWindowEndHour: Number.isFinite(parsed)
                    ? Math.max(1, Math.min(24, parsed))
                    : 18,
                });
              }}
            />
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">
              {t.maxPerDay}
            </span>
            <input
              type="number"
              min={1}
              max={20}
              dir="ltr"
              data-testid="max-day-input"
              className="dnc-input dnc-mono num-tabular"
              value={input.maxCallsPerDay}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                onChange({
                  maxCallsPerDay: Number.isFinite(parsed) ? Math.max(1, Math.min(20, parsed)) : 1,
                });
              }}
            />
          </label>

          <label className="space-y-1.5">
            <span className="block text-xs font-semibold text-[var(--text-secondary)]">
              {t.maxPerWeek}
            </span>
            <input
              type="number"
              min={1}
              max={30}
              dir="ltr"
              data-testid="max-week-input"
              className="dnc-input dnc-mono num-tabular"
              value={input.maxCallsPerWeek}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                onChange({
                  maxCallsPerWeek: Number.isFinite(parsed)
                    ? Math.max(1, Math.min(30, parsed))
                    : 2,
                });
              }}
            />
          </label>
        </div>

        {/* 7 Statutory Conduct Switches */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[var(--border-subtle)]">
          {(
            [
              ['hasPriorTelemarketingPermit', t.hasPermit, false],
              ['dncrScrubbingActive', t.dncrScrub, false],
              ['isPersonalMobileUsed', t.personalUsed, true],
              ['blocksRejectedFollowups', t.blocksRejected, false],
              ['callRecordingEnabled', t.recordingOn, false],
              ['openingDisclosureGiven', t.disclosureOn, false],
              ['automatedDialerUsed', t.autoDialer, true],
            ] as const
          ).map(([field, label, isInverseRisk]) => {
            const checked = Boolean(input[field]);
            const warnHighlight = isInverseRisk ? checked : !checked;
            return (
              <label
                key={field}
                className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors"
                style={{
                  borderColor: warnHighlight ? 'var(--accent-amber)' : 'var(--border-subtle)',
                  backgroundColor: warnHighlight ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                }}
              >
                <input
                  type="checkbox"
                  data-testid={`toggle-${field}`}
                  checked={checked}
                  onChange={(e) => onChange({ [field]: e.target.checked })}
                  className="mt-1 h-4 w-4 accent-[var(--accent-primary)] shrink-0"
                />
                <span className="text-xs font-medium text-[var(--text-primary)] leading-relaxed">
                  {label}
                </span>
              </label>
            );
          })}
        </div>

        {/* Internal Notes */}
        <label className="block space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
          <span className="block text-xs font-semibold text-[var(--text-secondary)]">
            {t.notes}
          </span>
          <textarea
            rows={2}
            dir="auto"
            className="dnc-input"
            placeholder={t.notesPlaceholder}
            value={input.notes ?? ''}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </label>
      </div>
    </div>
  );
}
