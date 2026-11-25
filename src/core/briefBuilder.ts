import type {
  AssessmentInput,
  AssessmentResult,
  CallerLineType,
  DncrSector,
  OffenseTier,
  TelecomCarrier,
} from './types.ts';

function escMdCell(value: unknown): string {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function formatNum(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString('en-US') : '0';
}

const SECTOR_LABELS: Record<DncrSector, { en: string; ar: string }> = {
  real_estate_brokerage: { en: 'Real Estate & Brokerage', ar: 'الوساطة والتطوير العقاري' },
  banking_insurance_finance: { en: 'Banking, Insurance & Finance', ar: 'المصارف والتأمين والتمويل' },
  saas_b2b_services: { en: 'B2B Software & Services', ar: 'البرمجيات وخدمات الأعمال' },
  retail_ecommerce: { en: 'Retail & E-Commerce', ar: 'التجزئة والتجارة الإلكترونية' },
  education_healthcare: { en: 'Education & Healthcare', ar: 'التعليم والرعاية الصحية' },
  other_commercial: { en: 'Other Commercial Tele-Sales', ar: 'الأنشطة التجارية الأخرى' },
};

const CARRIER_LABELS: Record<TelecomCarrier, { en: string; ar: string }> = {
  etisalat_e_and: { en: 'e& (Etisalat)', ar: 'اتصالات e&' },
  du: { en: 'du', ar: 'دو du' },
  other_licensed: { en: 'Other Licensed UAE Carrier', ar: 'مشغّل مرخص آخر في الإمارات' },
};

const LINE_TYPE_LABELS: Record<CallerLineType, { en: string; ar: string }> = {
  corporate_licensed_uae: { en: 'Licensed Corporate UAE Number', ar: 'خط شركة مرخص باسم المنشأة' },
  registered_call_center: { en: 'Registered Commercial Call Center Line', ar: 'خط مركز اتصال تجاري مسجل' },
  personal_mobile: { en: 'Personal Mobile Phone (Prohibited)', ar: 'هاتف جوال شخصي (محظور)' },
  unregistered_voip: { en: 'Unregistered / Foreign VoIP (Prohibited)', ar: 'اتصال VoIP غير مسجل بالرخصة (محظور)' },
};

const TIER_LABELS: Record<OffenseTier, { en: string; ar: string }> = {
  first: { en: 'First Violation Tier', ar: 'المخالفة الأولى' },
  second: { en: 'Second Repeat Tier', ar: 'التكرار الثاني' },
  third_or_more: { en: 'Third+ Repeat Tier (Maximum)', ar: 'التكرار الثالث فأكثر (الحد الأقصى)' },
};

export function buildDncrBriefMarkdown(
  input: AssessmentInput,
  result: AssessmentResult,
  dossierCode: string,
  sha256Digest: string,
  locale: 'en' | 'ar' = 'ar',
): string {
  const digest = sha256Digest || result.dossierSha256;
  const sec = SECTOR_LABELS[input.sector] ?? { en: input.sector, ar: input.sector };
  const car = CARRIER_LABELS[input.carrier] ?? { en: input.carrier, ar: input.carrier };
  const line = LINE_TYPE_LABELS[input.callerLineType] ?? {
    en: input.callerLineType,
    ar: input.callerLineType,
  };
  const tier = TIER_LABELS[input.offenseTier] ?? {
    en: input.offenseTier,
    ar: input.offenseTier,
  };

  if (locale === 'ar') {
    const lines: string[] = [
      `# ملف جاهزية الامتثال للتسويق الهاتفي وسجل عدم الاتصال الإماراتي — \`${dossierCode}\``,
      '',
      `> **تنبيه الحوكمة وعدم الاعتماد الرسمي:** ${result.legalDisclaimerAr}`,
      '',
      '## 1. ملخص المنشأة وحالة الجاهزية',
      '',
      '| البند | القيمة |',
      '|---|---|',
      `| رمز الملف | \`${escMdCell(dossierCode)}\` |`,
      `| الأداة والإصدار | \`DNCRCheck v${escMdCell(result.version)}\` |`,
      `| اسم المنشأة | ${escMdCell(input.organizationName)} |`,
      `| القطاع والمشغّل | ${escMdCell(sec.ar)} / ${escMdCell(car.ar)} |`,
      `| نوع الخط الصادر | ${escMdCell(line.ar)} |`,
      `| تاريخ الفحص | \`${escMdCell(input.assessmentDate)}\` |`,
      `| حالة الجاهزية | **${result.status.toUpperCase()}** |`,
      `| درجة الجاهزية | **${result.readinessScore}/100** |`,
      `| بصمة SHA-256 القانونية | \`${escMdCell(digest)}\` |`,
      '',
      '## 2. ضوابط قرار مجلس الوزراء رقم (56) لسنة 2024',
      '',
      `- الموافقة المسبقة من السلطة المختصة: **${input.hasPriorTelemarketingPermit ? 'متوفرة ✓' : 'مفقودة ✗'}**`,
      `- تصفية سجل عدم الاتصال (DNCR): **${input.dncrScrubbingActive ? 'مفعلة ✓' : 'معطلة ✗'}**`,
      `- نافذة الاتصال (09:00–18:00 بتوقيت الإمارات): \`${input.callingWindowStartHour}:00 – ${input.callingWindowEndHour}:00\` (**${result.callingRules.callingHoursCompliant ? 'مطابق ✓' : 'مخالف ✗'}**)`,
      `- سقوف عدم الرد (الحد الأقصى 1/يوم و2/أسبوع): \`${input.maxCallsPerDay}/يوم · ${input.maxCallsPerWeek}/أسبوع\` (**${result.callingRules.dailyCapCompliant && result.callingRules.weeklyCapCompliant ? 'مطابق ✓' : 'متجاوز ✗'}**)`,
      `- منع الاتصال بعد رفض المستهلك: **${result.callingRules.rejectionRuleCompliant ? 'مفعل ✓' : 'غير مفعل ✗'}**`,
      `- استخدام خطوط شركة مرخصة (دون جوال شخصي): **${result.callingRules.lineCompliant ? 'ممتثل ✓' : 'مخالف ✗'}**`,
      `- تسجيل المكالمات والإفصاح عند البدء: **${result.callingRules.disclosureAndRecordingCompliant ? 'مكتمل ✓' : 'ناقص ✗'}**`,
      '',
      '## 3. تقدير تعرض الغرامات والعقوبات الإدارية (قرار 57/2024)',
      '',
      `- فئة التكرار المقاسة: **${escMdCell(tier.ar)}**`,
      `- غرامة التسويق بدون تصريح مسبق: **${formatNum(result.penalty.permitFineAed)} د.إ**`,
      `- غرامة الاتصال بأرقام DNCR: **${formatNum(result.penalty.dncrBreachFineAed)} د.إ**`,
      `- غرامة استخدام الهاتف الشخصي للأفراد: **${formatNum(result.penalty.personalLineMinFineAed)} – ${formatNum(result.penalty.personalLineMaxFineAed)} د.إ**`,
      `- نطاق التعرض الأقصى التقديري للغرامة: **${formatNum(result.penalty.estimatedMinExposureAed)} – ${formatNum(result.penalty.estimatedMaxExposureAed)} د.إ**`,
      `- خطر وقف/إلغاء الرخصة التجارية: **${result.penalty.licenseSuspensionRisk ? 'نعم — مرتفع' : 'منخفض'}** | خطر قطع خطوط الاتصالات: **${result.penalty.telecomDisconnectionRisk ? 'نعم' : 'لا'}**`,
      '',
      '## 4. الضوابط الرقابية الستة (DNCRCheck Controls)',
      '',
      '| الضابط | الحالة | الوزن | الوصف |',
      '|---|---|---|---|',
      ...result.controls.map(
        (ctrl) =>
          `| \`${ctrl.id}\` | ${ctrl.implemented ? 'مُنفذ ✓' : 'ناقص ✗'} | ${ctrl.weight} | ${escMdCell(ctrl.titleAr)} |`,
      ),
    ];

    if (result.csvAudit) {
      lines.push(
        '',
        '## 5. تدقيق سجلات المكالمات (CSV)',
        '',
        `- الإجمالي: ${result.csvAudit.totalRows} | جاهز: ${result.csvAudit.readyCount} | مشروط: ${result.csvAudit.conditionalCount} | محجوب: ${result.csvAudit.blockedCount} | مكالمات DNCR: ${result.csvAudit.dncrHitCount} | خارج 9ص–6م: ${result.csvAudit.afterHoursCount} | تجاوز السقف: ${result.csvAudit.frequencyCapBreachCount} | جوال شخصي: ${result.csvAudit.personalLineCount}`,
        '',
      );
      if (result.csvAudit.rows.length > 0) {
        lines.push(
          '| الصف | رمز المكالمة | الخط الصادر | DNCR | الساعة | يوم/أسبوع | رفض مسبق | الحالة |',
          '|---|---|---|---|---|---|---|---|',
          ...result.csvAudit.rows.map(
            (row) =>
              `| ${row.rowNumber} | \`${escMdCell(row.callId)}\` | \`${escMdCell(row.callerLine)}\` | ${row.onDncr ? 'نعم' : 'لا'} | \`${row.callHourGst}\` | \`${row.callsSameDay}/${row.callsSameWeek}\` | ${row.priorRejected ? 'نعم' : 'لا'} | **${row.status.toUpperCase()}** |`,
          ),
        );
      }
    }

    lines.push(
      '',
      `## ${result.csvAudit ? '6' : '5'}. الملاحظات والنتائج التفصيلية`,
      '',
      ...(result.findings.length > 0
        ? result.findings.map(
            (f) =>
              `- **[${f.severity.toUpperCase()}] ${f.code} — ${escMdCell(f.titleAr)}:** ${escMdCell(f.detailAr)} *(${escMdCell(f.legalRef)})*`,
          )
        : ['- لا توجد مخالفات مانعة؛ إجراءات التسويق الهاتفي مستوفية لضوابط القرارين 56 و57/2024.']),
    );

    if (input.notes) {
      lines.push('', '### ملاحظات المستخدم', '', escMdCell(input.notes));
    }

    return `${lines.join('\n')}\n`;
  }

  const lines: string[] = [
    `# UAE Telemarketing & DNCR Readiness Brief — \`${dossierCode}\``,
    '',
    `> **Independence Disclaimer:** ${result.legalDisclaimerEn}`,
    '',
    '## 1. Organization Profile & Readiness Summary',
    '',
    '| Field | Value |',
    '|---|---|',
    `| Dossier Code | \`${escMdCell(dossierCode)}\` |`,
    `| Tool / Version | \`DNCRCheck v${escMdCell(result.version)}\` |`,
    `| Organization | ${escMdCell(input.organizationName)} |`,
    `| Sector / Carrier | ${escMdCell(sec.en)} / ${escMdCell(car.en)} |`,
    `| Caller Line Type | ${escMdCell(line.en)} |`,
    `| Assessment Date | \`${escMdCell(input.assessmentDate)}\` |`,
    `| Readiness Status | **${result.status.toUpperCase()}** |`,
    `| Readiness Score | **${result.readinessScore}/100** |`,
    `| Canonical SHA-256 Digest | \`${escMdCell(digest)}\` |`,
    '',
    '## 2. Cabinet Resolution No. 56 of 2024 Compliance Posture',
    '',
    `- Prior Authority Approval: **${input.hasPriorTelemarketingPermit ? 'Active' : 'Missing'}**`,
    `- DNCR Pre-Dial Suppression: **${input.dncrScrubbingActive ? 'Active' : 'Disabled'}**`,
    `- Permitted Hours (` + '`09:00–18:00 GST`' + `): \`${input.callingWindowStartHour}:00 – ${input.callingWindowEndHour}:00\` (**${result.callingRules.callingHoursCompliant ? 'Compliant' : 'Out of Window'}**)`,
    `- Unanswered Repeat Caps (` + '`<=1/day, <=2/week`' + `): \`${input.maxCallsPerDay}/day · ${input.maxCallsPerWeek}/week\` (**${result.callingRules.dailyCapCompliant && result.callingRules.weeklyCapCompliant ? 'Compliant' : 'Exceeded'}**)`,
    `- Post-Rejection Opt-Out Lock: **${result.callingRules.rejectionRuleCompliant ? 'Enabled' : 'Missing'}**`,
    `- Licensed Corporate Line Enforcement: **${result.callingRules.lineCompliant ? 'Compliant (No Personal Phones)' : 'Violation Risk'}**`,
    `- Mandatory Call Recording & Upfront Disclosure: **${result.callingRules.disclosureAndRecordingCompliant ? 'Complete' : 'Incomplete'}**`,
    '',
    '## 3. Cabinet Resolution No. 57 of 2024 Administrative Penalty Exposure',
    '',
    `- Offense Tier Modeled: **${escMdCell(tier.en)}**`,
    `- Unapproved Telemarketing Fine: **AED ${formatNum(result.penalty.permitFineAed)}**`,
    `- DNCR Violation Fine (` + '`AED 50k / 75k / 150k`' + `): **AED ${formatNum(result.penalty.dncrBreachFineAed)}**`,
    `- Personal Phone / Individual Fine Band: **AED ${formatNum(result.penalty.personalLineMinFineAed)} – AED ${formatNum(result.penalty.personalLineMaxFineAed)}**`,
    `- Estimated Statutory Fine Exposure Band: **AED ${formatNum(result.penalty.estimatedMinExposureAed)} – AED ${formatNum(result.penalty.estimatedMaxExposureAed)}**`,
    `- License Suspension Risk: **${result.penalty.licenseSuspensionRisk ? 'Yes (Elevated)' : 'Low'}** | Telecom Disconnection Risk: **${result.penalty.telecomDisconnectionRisk ? 'Yes' : 'No'}**`,
    '',
    '## 4. Controls Assessment Matrix',
    '',
    '| Control | Status | Weight | Description |',
    '|---|---|---|---|',
    ...result.controls.map(
      (ctrl) =>
        `| \`${ctrl.id}\` | ${ctrl.implemented ? 'Implemented' : 'Gap'} | ${ctrl.weight} | ${escMdCell(ctrl.titleEn)} |`,
    ),
  ];

  if (result.csvAudit) {
    lines.push(
      '',
      '## 5. Outbound Call Log CSV Audit',
      '',
      `- Total Rows: ${result.csvAudit.totalRows} | Ready: ${result.csvAudit.readyCount} | Conditional: ${result.csvAudit.conditionalCount} | Blocked: ${result.csvAudit.blockedCount} | DNCR Hits: ${result.csvAudit.dncrHitCount} | After Hours: ${result.csvAudit.afterHoursCount} | Cap Breaches: ${result.csvAudit.frequencyCapBreachCount} | Personal Lines: ${result.csvAudit.personalLineCount}`,
      '',
    );
    if (result.csvAudit.rows.length > 0) {
      lines.push(
        '| Row | Call ID | Line | DNCR | Hour | Day/Week | Prior Rejected | Status |',
        '|---|---|---|---|---|---|---|---|',
        ...result.csvAudit.rows.map(
          (row) =>
            `| ${row.rowNumber} | \`${escMdCell(row.callId)}\` | \`${escMdCell(row.callerLine)}\` | ${row.onDncr ? 'Yes' : 'No'} | \`${row.callHourGst}\` | \`${row.callsSameDay}/${row.callsSameWeek}\` | ${row.priorRejected ? 'Yes' : 'No'} | **${row.status.toUpperCase()}** |`,
        ),
      );
    }
  }

  lines.push(
    '',
    `## ${result.csvAudit ? '6' : '5'}. Detailed Regulatory Findings`,
    '',
    ...(result.findings.length > 0
      ? result.findings.map(
          (f) =>
            `- **[${f.severity.toUpperCase()}] ${f.code} — ${escMdCell(f.titleEn)}:** ${escMdCell(f.detailEn)} *(${escMdCell(f.legalRef)})*`,
        )
      : ['- No blocking findings; UAE Cabinet Resolutions 56 & 57 of 2024 obligations are satisfied.']),
  );

  if (input.notes) {
    lines.push('', '### Assessment Notes', '', escMdCell(input.notes));
  }

  return `${lines.join('\n')}\n`;
}
