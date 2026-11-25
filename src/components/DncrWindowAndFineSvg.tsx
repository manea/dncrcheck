import {
  MAX_CALLS_PER_DAY,
  MAX_CALLS_PER_WEEK,
  PERMITTED_END_HOUR_GST,
  PERMITTED_START_HOUR_GST,
  STATUTORY_SINGLE_VIOLATION_CEILING_AED,
} from '../core/dncrCatalog.ts';
import type { AssessmentInput, AssessmentResult } from '../core/types.ts';
import { formatNumber, type Locale } from '../lib/i18n.ts';

interface Props {
  input: AssessmentInput;
  result: AssessmentResult;
  locale: Locale;
}

export function DncrWindowAndFineSvg({ input, result, locale }: Props) {
  const { callingRules, penalty } = result;
  const isAr = locale === 'ar';

  const statusColor =
    result.status === 'ready'
      ? 'var(--accent-emerald)'
      : result.status === 'conditional'
        ? 'var(--accent-amber)'
        : 'var(--accent-crimson)';

  // Panel 1: 24h GST Timeline (x = 16..304 -> 288px = 24h -> 12px/hour)
  const startClamped = Math.max(0, Math.min(23, Number(input.callingWindowStartHour) || 0));
  const endClamped = Math.max(startClamped + 1, Math.min(24, Number(input.callingWindowEndHour) || 1));
  const permX = 16 + PERMITTED_START_HOUR_GST * 12;
  const permW = (PERMITTED_END_HOUR_GST - PERMITTED_START_HOUR_GST) * 12;
  const userX = 16 + startClamped * 12;
  const userW = Math.max(8, (endClamped - startClamped) * 12);

  const dayBarW = Math.min(288, Math.max(10, Math.round((input.maxCallsPerDay / 4) * 288)));
  const weekBarW = Math.min(288, Math.max(10, Math.round((input.maxCallsPerWeek / 6) * 288)));

  const fineColor =
    penalty.estimatedMaxExposureAed >= 150_000
      ? 'var(--accent-crimson)'
      : penalty.estimatedMaxExposureAed > 0
        ? 'var(--accent-amber)'
        : 'var(--accent-emerald)';
  const fineBarW =
    penalty.estimatedMaxExposureAed > 0
      ? Math.max(
          12,
          Math.round((penalty.estimatedMaxExposureAed / STATUTORY_SINGLE_VIOLATION_CEILING_AED) * 288),
        )
      : 6;

  const scoreBarW = Math.max(8, Math.round((result.readinessScore / 100) * 288));

  const tierShort = isAr
    ? input.offenseTier === 'first'
      ? 'الأولى'
      : input.offenseTier === 'second'
        ? 'الثانية'
        : 'الثالثة+'
    : input.offenseTier === 'first'
      ? '1st Tier'
      : input.offenseTier === 'second'
        ? '2nd Tier'
        : '3rd+ Tier';

  const headingX = isAr ? 304 : 16;
  const headingAnchor = 'start' as const;
  const metricX = isAr ? 16 : 304;
  const metricAnchor = 'end' as const;
  const ltrMetricAnchor = isAr ? 'start' : 'end';

  return (
    <div className="dnc-card rounded-2xl p-4 space-y-2.5" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[var(--text-secondary)]">
        <span>
          {isAr ? (
            <>
              رصد نافذة الاتصال (<bdi dir="ltr">09:00–18:00 GST</bdi>) وسقوف التكرار وغرامات{' '}
              <bdi dir="ltr">CD 57/2024</bdi>
            </>
          ) : (
            'UAE 09:00–18:00 GST Calling Window, Repeat Caps & CD 57/2024 Fine Telemetry'
          )}
        </span>
        <span
          data-testid="status-badge"
          className="dnc-mono num-tabular font-bold"
          dir="ltr"
          style={{ color: statusColor }}
        >
          {result.status.toUpperCase()} · {result.readinessScore}/100
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2" dir="ltr">
        {/* Panel 1: 24h GST Window + Daily/Weekly Frequency Caps */}
        <svg
          viewBox="0 0 320 206"
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={
            isAr
              ? 'مخطط ساعات الاتصال 9ص إلى 6م وسقوف التكرار اليومية والأسبوعية'
              : 'UAE 09:00-18:00 GST calling window and daily/weekly frequency cap bars'
          }
        >
          <rect
            x="2"
            y="2"
            width="316"
            height="202"
            rx="14"
            fill="var(--bg-elevated)"
            stroke="var(--border-subtle)"
            strokeWidth="1.2"
          />
          <text
            x={headingX}
            y="26"
            textAnchor={headingAnchor}
            direction={isAr ? 'rtl' : 'ltr'}
            fill="var(--text-primary)"
            fontSize="13"
            fontWeight="700"
          >
            {isAr ? 'ساعات الاتصال والسقوف (قرار 56/2024)' : 'CD 56/2024 Hours & Frequency Caps'}
          </text>

          {/* 24-Hour GST Track */}
          <text
            x={headingX}
            y="52"
            textAnchor={headingAnchor}
            direction={isAr ? 'rtl' : 'ltr'}
            fill="var(--text-secondary)"
            fontSize="10.5"
            fontWeight="600"
          >
            {isAr ? 'نافذة الإمارات (09:00–18:00)' : 'GST Window (09:00–18:00 Limit)'}
          </text>
          <text
            x={metricX}
            y="52"
            textAnchor={ltrMetricAnchor}
            direction="ltr"
            fill={callingRules.callingHoursCompliant ? 'var(--accent-emerald)' : 'var(--accent-crimson)'}
            fontSize="11"
            fontWeight="700"
            className="dnc-mono num-tabular"
          >
            {String(startClamped).padStart(2, '0')}:00–{String(endClamped).padStart(2, '0')}:00
          </text>
          <rect x="16" y="60" width="288" height="18" rx="6" fill="var(--bg-surface)" />
          <rect
            x={permX}
            y="60"
            width={permW}
            height="18"
            rx="4"
            fill="var(--accent-emerald-soft)"
            stroke="var(--accent-emerald)"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
          <rect
            x={userX}
            y="64"
            width={userW}
            height="10"
            rx="4"
            fill={callingRules.callingHoursCompliant ? 'var(--accent-emerald)' : 'var(--accent-crimson)'}
          />
          <text x={permX} y="90" fill="var(--text-secondary)" fontSize="9.5" className="dnc-mono">
            09h
          </text>
          <text x={permX + permW} y="90" textAnchor="end" fill="var(--text-secondary)" fontSize="9.5" className="dnc-mono">
            18h GST
          </text>

          {/* Daily Cap */}
          <text
            x={headingX}
            y="114"
            textAnchor={headingAnchor}
            direction={isAr ? 'rtl' : 'ltr'}
            fill="var(--text-secondary)"
            fontSize="10.5"
            fontWeight="600"
          >
            {isAr
              ? `السقف اليومي (الحد ${MAX_CALLS_PER_DAY} يومياً)`
              : `Daily Follow-Up Cap (<= ${MAX_CALLS_PER_DAY}/day)`}
          </text>
          <text
            x={metricX}
            y="114"
            textAnchor={metricAnchor}
            direction={isAr ? 'rtl' : 'ltr'}
            fill={callingRules.dailyCapCompliant ? 'var(--accent-emerald)' : 'var(--accent-crimson)'}
            fontSize="11"
            fontWeight="700"
            className="dnc-mono num-tabular"
          >
            {isAr ? `${input.maxCallsPerDay} يومياً` : `${input.maxCallsPerDay}/day`}
          </text>
          <rect x="16" y="122" width="288" height="14" rx="5" fill="var(--bg-surface)" />
          <rect
            x="16"
            y="122"
            width={dayBarW}
            height="14"
            rx="5"
            fill={callingRules.dailyCapCompliant ? 'var(--accent-emerald)' : 'var(--accent-crimson)'}
          />

          {/* Weekly Cap */}
          <text
            x={headingX}
            y="156"
            textAnchor={headingAnchor}
            direction={isAr ? 'rtl' : 'ltr'}
            fill="var(--text-secondary)"
            fontSize="10.5"
            fontWeight="600"
          >
            {isAr
              ? `السقف الأسبوعي (الحد ${MAX_CALLS_PER_WEEK} أسبوعياً)`
              : `Weekly Follow-Up Cap (<= ${MAX_CALLS_PER_WEEK}/wk)`}
          </text>
          <text
            x={metricX}
            y="156"
            textAnchor={metricAnchor}
            direction={isAr ? 'rtl' : 'ltr'}
            fill={callingRules.weeklyCapCompliant ? 'var(--accent-cobalt)' : 'var(--accent-crimson)'}
            fontSize="11"
            fontWeight="700"
            className="dnc-mono num-tabular"
          >
            {isAr ? `${input.maxCallsPerWeek} أسبوعياً` : `${input.maxCallsPerWeek}/wk`}
          </text>
          <rect x="16" y="164" width="288" height="14" rx="5" fill="var(--bg-surface)" />
          <rect
            x="16"
            y="164"
            width={weekBarW}
            height="14"
            rx="5"
            fill={callingRules.weeklyCapCompliant ? 'var(--accent-cobalt)' : 'var(--accent-crimson)'}
          />

          <text
            x={headingX}
            y="194"
            textAnchor={headingAnchor}
            direction={isAr ? 'rtl' : 'ltr'}
            fill="var(--text-secondary)"
            fontSize="10"
            className="dnc-mono"
          >
            {isAr
              ? `الخط الصادر: ${callingRules.lineCompliant ? 'خط مؤسسي مرخص' : 'خطر استخدام جوال شخصي'}`
              : `Corporate Line: ${callingRules.lineCompliant ? 'Verified (e& / du)' : 'Personal Mobile Risk'}`}
          </text>
        </svg>

        {/* Panel 2: Statutory Fine Exposure & Readiness Score */}
        <svg
          viewBox="0 0 320 206"
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={
            isAr
              ? 'مخطط التعرض للغرامات الإدارية حتى 150,000 درهم ومؤشر الجاهزية'
              : 'Cabinet Resolution 57/2024 fine ceiling gauge and overall readiness score'
          }
        >
          <rect
            x="2"
            y="2"
            width="316"
            height="202"
            rx="14"
            fill="var(--bg-elevated)"
            stroke="var(--border-subtle)"
            strokeWidth="1.2"
          />
          <text
            x={headingX}
            y="26"
            textAnchor={headingAnchor}
            direction={isAr ? 'rtl' : 'ltr'}
            fill="var(--text-primary)"
            fontSize="13"
            fontWeight="700"
          >
            {isAr ? 'نطاق الغرامات والجاهزية (قرار 57/2024)' : 'CD 57/2024 Fine Band & Readiness'}
          </text>

          {/* Max Exposure Bar */}
          <text
            x={headingX}
            y="54"
            textAnchor={headingAnchor}
            direction={isAr ? 'rtl' : 'ltr'}
            fill="var(--text-secondary)"
            fontSize="10.5"
            fontWeight="600"
          >
            {isAr ? `أقصى غرامة (الدرجة ${tierShort})` : `Max Penalty (${tierShort})`}
          </text>
          <text
            x={metricX}
            y="54"
            textAnchor={metricAnchor}
            direction={isAr ? 'rtl' : 'ltr'}
            fill={fineColor}
            fontSize="11.5"
            fontWeight="700"
            className="dnc-mono num-tabular"
          >
            {isAr
              ? `${formatNumber(penalty.estimatedMaxExposureAed)} د.إ`
              : `AED ${formatNumber(penalty.estimatedMaxExposureAed)}`}
          </text>
          <rect x="16" y="62" width="288" height="18" rx="6" fill="var(--bg-surface)" />
          <rect x="16" y="62" width={fineBarW} height="18" rx="6" fill={fineColor} />

          {/* Readiness Index */}
          <text
            x={headingX}
            y="108"
            textAnchor={headingAnchor}
            direction={isAr ? 'rtl' : 'ltr'}
            fill="var(--text-secondary)"
            fontSize="10.5"
            fontWeight="600"
          >
            {isAr
              ? `مؤشر الجاهزية (ثغرات: ${callingRules.activeViolationCount})`
              : `Readiness Score (Gaps: ${callingRules.activeViolationCount})`}
          </text>
          <text
            x={metricX}
            y="108"
            textAnchor={ltrMetricAnchor}
            direction="ltr"
            fill={statusColor}
            fontSize="11.5"
            fontWeight="700"
            className="dnc-mono num-tabular"
          >
            {result.readinessScore}%
          </text>
          <rect x="16" y="116" width="288" height="16" rx="6" fill="var(--bg-surface)" />
          <rect x="16" y="116" width={scoreBarW} height="16" rx="6" fill={statusColor} />

          {/* Status Summary Pills */}
          <rect x="16" y="148" width="138" height="40" rx="8" fill="var(--bg-surface)" stroke="var(--border-subtle)" />
          <text x="85" y="164" textAnchor="middle" direction={isAr ? 'rtl' : 'ltr'} fill="var(--text-secondary)" fontSize="9.5">
            {isAr ? 'خطر وقف الرخصة' : 'License Suspension'}
          </text>
          <text
            x="85"
            y="179"
            textAnchor="middle"
            direction={isAr ? 'rtl' : 'ltr'}
            fill={penalty.licenseSuspensionRisk ? 'var(--accent-crimson)' : 'var(--accent-emerald)'}
            fontSize="10.5"
            fontWeight="700"
            className="dnc-mono"
          >
            {penalty.licenseSuspensionRisk
              ? isAr
                ? 'خطر مرتفع'
                : 'ELEVATED RISK'
              : isAr
                ? 'منخفض'
                : 'LOW RISK'}
          </text>

          <rect x="166" y="148" width="138" height="40" rx="8" fill="var(--bg-surface)" stroke="var(--border-subtle)" />
          <text x="235" y="164" textAnchor="middle" direction={isAr ? 'rtl' : 'ltr'} fill="var(--text-secondary)" fontSize="9.5">
            {isAr ? 'فصل خط الاتصالات' : 'Telecom Ban Risk'}
          </text>
          <text
            x="235"
            y="179"
            textAnchor="middle"
            direction={isAr ? 'rtl' : 'ltr'}
            fill={penalty.telecomDisconnectionRisk ? 'var(--accent-crimson)' : 'var(--accent-emerald)'}
            fontSize="10.5"
            fontWeight="700"
            className="dnc-mono"
          >
            {penalty.telecomDisconnectionRisk
              ? isAr
                ? 'خطر فصل الخط'
                : 'LINE BAN RISK'
              : isAr
                ? 'سليم'
                : 'CLEAR'}
          </text>
        </svg>
      </div>
    </div>
  );
}
