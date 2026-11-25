import type {
  CallerLineType,
  DncrSector,
  OffenseTier,
  ReadinessStatus,
  TelecomCarrier,
} from '../core/types.ts';

export type Locale = 'ar' | 'en';
export type ThemeMode = 'telecom-ivory' | 'gulf-night';

export function formatNumber(val: number): string {
  return Number.isFinite(val) ? Math.round(val).toLocaleString('en-US') : '0';
}

export function formatAed(val: number, locale: Locale): string {
  const num = formatNumber(val);
  return locale === 'ar' ? `${num} د.إ` : `AED ${num}`;
}

export const SECTOR_OPTIONS: ReadonlyArray<{
  value: DncrSector;
  labelAr: string;
  labelEn: string;
}> = [
  { value: 'real_estate_brokerage', labelAr: 'الوساطة والتطوير العقاري', labelEn: 'Real Estate & Brokerage' },
  { value: 'banking_insurance_finance', labelAr: 'المصارف والتأمين والتمويل', labelEn: 'Banking, Insurance & Finance' },
  { value: 'saas_b2b_services', labelAr: 'البرمجيات وخدمات الأعمال B2B', labelEn: 'B2B Software & Services' },
  { value: 'retail_ecommerce', labelAr: 'التجزئة والتجارة الإلكترونية', labelEn: 'Retail & E-Commerce' },
  { value: 'education_healthcare', labelAr: 'التعليم والرعاية الصحية', labelEn: 'Education & Healthcare' },
  { value: 'other_commercial', labelAr: 'الأنشطة التجارية الأخرى', labelEn: 'Other Commercial Tele-Sales' },
];

export const CARRIER_OPTIONS: ReadonlyArray<{
  value: TelecomCarrier;
  labelAr: string;
  labelEn: string;
}> = [
  { value: 'etisalat_e_and', labelAr: 'اتصالات (e&)', labelEn: 'e& (Etisalat)' },
  { value: 'du', labelAr: 'دو (du)', labelEn: 'du' },
  { value: 'other_licensed', labelAr: 'مشغّل محلي مرخص آخر', labelEn: 'Other Licensed UAE Carrier' },
];

export const CALLER_LINE_OPTIONS: ReadonlyArray<{
  value: CallerLineType;
  labelAr: string;
  labelEn: string;
}> = [
  { value: 'corporate_licensed_uae', labelAr: 'خط شركة مرخص باسم المنشأة', labelEn: 'Licensed Corporate UAE Line' },
  { value: 'registered_call_center', labelAr: 'خط مركز اتصال تجاري مسجل', labelEn: 'Registered Commercial Call Center' },
  { value: 'personal_mobile', labelAr: 'هاتف جوال شخصي (محظور نظاماً)', labelEn: 'Personal Mobile Phone (Prohibited)' },
  { value: 'unregistered_voip', labelAr: 'خط VoIP غير مسجل بالرخصة (محظور)', labelEn: 'Unregistered / Foreign VoIP (Prohibited)' },
];

export const OFFENSE_TIER_OPTIONS: ReadonlyArray<{
  value: OffenseTier;
  labelAr: string;
  labelEn: string;
}> = [
  { value: 'first', labelAr: 'المخالفة الأولى (50k DNCR / 75k بلا تصريح)', labelEn: 'First Violation (50k DNCR / 75k Permit)' },
  { value: 'second', labelAr: 'التكرار الثاني (75k DNCR / 100k)', labelEn: 'Second Repeat (75k DNCR / 100k)' },
  { value: 'third_or_more', labelAr: 'التكرار الثالث+ (السقف 150,000 د.إ + وقف الرخصة)', labelEn: 'Third+ Repeat (AED 150k Ceiling + License Risk)' },
];

export function statusLabel(status: ReadinessStatus, locale: Locale): string {
  if (locale === 'ar') {
    if (status === 'ready') return 'جاهز';
    if (status === 'conditional') return 'مشروط';
    return 'محجوب';
  }
  return status.toUpperCase();
}

export function sectorLabel(sector: DncrSector, locale: Locale): string {
  const item = SECTOR_OPTIONS.find((opt) => opt.value === sector);
  return item ? (locale === 'ar' ? item.labelAr : item.labelEn) : sector;
}

export function carrierLabel(carrier: TelecomCarrier, locale: Locale): string {
  const item = CARRIER_OPTIONS.find((opt) => opt.value === carrier);
  return item ? (locale === 'ar' ? item.labelAr : item.labelEn) : carrier;
}

const DICTIONARY = {
  ar: {
    appName: 'DNCR الإمارات · DNCRCheck',
    appSubtitle:
      'مدقق جاهزية الامتثال لائحة التسويق الهاتفي وسجل عدم الاتصال الإماراتي (قرارا مجلس الوزراء 56 و57 لسنة 2024)',
    serverMode: 'خادم SQLite WAL متصل',
    localMode: 'وضع متصفح $0 (localStorage)',
    toggleLang: 'EN',
    themeLight: 'نهاري (Ivory)',
    themeDark: 'ليلي (Gulf Night)',
    printBrief: 'طباعة تقرير A4',
    presetsHeading: 'سيناريوهات التسويق الهاتفي الإماراتية (بنقرة واحدة)',
    tabRules: 'ساعات الاتصال والسقوف والغرامات',
    tabControls: 'الضوابط الـ 6 والنتائج',
    tabCsv: 'تدقيق سجل المكالمات CSV',
    tabVault: 'خزنة الملفات والتصدير',
    statWindow: 'نافذة الاتصال بتوقيت الإمارات',
    statCaps: 'سقوف عدم الرد (1/يوم · 2/أسبوع)',
    statLine: 'حالة خط الاتصال الصادر',
    statTier: 'مستوى تكرار المخالفة',
    statFineBand: 'تعرض الغرامات الإدارية (57/2024)',
    compliantTag: 'ممتثل',
    nonCompliantTag: 'مخالف',
    organizationName: 'اسم المنشأة / مكتب الاتصال الإماراتي',
    sector: 'القطاع التجاري',
    carrier: 'مشغّل الاتصالات الإماراتي',
    callerLineType: 'نوع الخط الصادر المستخدم',
    offenseTier: 'درجة التكرار المقدّرة (قرار 57/2024)',
    assessmentDate: 'تاريخ الفحص (ISO)',
    startHour: 'ساعة بداية الاتصال (0–23 GST)',
    endHour: 'ساعة انتهاء الاتصال (1–24 GST)',
    maxPerDay: 'الحد الأقصى يومياً (لكل رقم)',
    maxPerWeek: 'الحد الأقصى أسبوعياً (لكل رقم)',
    hasPermit: 'الحصول على موافقة مسبقة للتسويق الهاتفي من السلطة المختصة',
    dncrScrub: 'تفعيل الفحص والاستبعاد من سجل عدم الاتصال (DNCR) قبل الطلب',
    personalUsed: 'يُستخدم حالياً هاتف جوال شخصي من قِبل المندوبين',
    blocksRejected: 'حظر معاودة الاتصال فوراً عند رفض المستهلك للعرض',
    recordingOn: 'تفعيل التسجيل الإلزامي لجميع المكالمات التسويقية',
    disclosureOn: 'الإفصاح في بداية المكالمة (اسم الشركة، الغرض، والتسجيل)',
    autoDialer: 'استخدام نظام اتصال آلي (Automated Dialer)',
    notes: 'ملاحظات التقييم الداخلي',
    notesPlaceholder: 'أضف ملاحظات حول موافقة RERA/DED، تصفية DNCR، أو نصوص المكالمات...',
    controlsHeader: 'الضوابط الرقابية الستة لضوابط التسويق الهاتفي (100 نقطة)',
    selectAll: 'تحديد الكل',
    clearAll: 'إلغاء الكل',
    findingsHeader: 'النتائج والتنبيهات التشريعية التفصيلية',
    noFindings: 'لا توجد مخالفات؛ إجراءات التسويق الهاتفي مستوفية لضوابط القرارين 56 و57/2024.',
    sevBlocker: 'مانع حرج',
    sevWarning: 'تحذير تشغيلي',
    sevInfo: 'معلومة',
    csvHeader: 'تدقيق دفعات سجلات المكالمات CSV (مع تحييد حقن الصيغ CWE-1236)',
    csvHint: 'الأعمدة: call_id, caller_line, on_dncr, call_hour_gst, calls_same_day, calls_same_week, prior_rejected, recorded_and_disclosed',
    csvUpload: 'استيراد ملف CSV',
    csvLoadSample: 'تحميل عينة مخالفات (=HYPERLINK)',
    csvClear: 'مسح الكشف',
    csvDownloadBom: 'تنزيل CSV الآمن (UTF-8 BOM)',
    csvReady: 'جاهز',
    csvConditional: 'مشروط',
    csvBlocked: 'محجوب',
    csvDncrHits: 'اتصالات DNCR',
    csvAfterHours: 'خارج 9ص–6م',
    vaultSaveNew: 'حفظ كمسودة جديدة (DNC-YYYY-0001)',
    vaultUpdateDraft: 'تحديث المسودة المفتوحة',
    vaultDossierTitle: 'عنوان الملف',
    vaultSealLock: 'ختم نهائي وإصدار رابط عام',
    vaultDuplicate: 'نسخ لمسودة جديدة',
    vaultDelete: 'حذف المسودة',
    vaultDownloadMdAr: 'ملخص Markdown عربي',
    vaultDownloadMdEn: 'ملخص Markdown إنجليزي',
    vaultDownloadCsv: 'تصدير CSV (UTF-8 BOM)',
    vaultOpenPublic: 'فتح صفحة التقرير العام',
    vaultSavedList: 'خزنة تقارير DNCRCheck المحفوظة',
    vaultEmpty: 'لا توجد ملفات محفوظة بعد. احفظ التقييم الحالي لإصدار رقم DNC-YYYY-0001.',
    vaultLockedBadge: 'مختوم غير قابل للتعديل',
    vaultDraftBadge: 'مسودة قابلة للتعديل',
    publicBackStudio: 'العودة إلى استوديو DNCRCheck',
    publicViewsLabel: 'عدد المشاهدات:',
    publicNotFound: 'التقرير العام المطلوب غير موجود أو غير مختوم نهائياً.',
    briefPreviewTitle: 'معاينة التقرير التنفيذي للطباعة (A4 PDF)',
  },
  en: {
    appName: 'DNCRCheck',
    appSubtitle:
      'Independent Readiness Auditor for UAE Telemarketing & Do-Not-Call Registry Regulations (Cabinet Resolutions No. 56 & 57 of 2024)',
    serverMode: 'SQLite WAL Backend Connected',
    localMode: '$0 Static Mode (localStorage)',
    toggleLang: 'عربي',
    themeLight: 'Light (Ivory)',
    themeDark: 'Dark (Night)',
    printBrief: 'Print A4 Brief',
    presetsHeading: 'One-Click UAE Telemarketing Scenarios',
    tabRules: 'Calling Hours, Caps & Fines',
    tabControls: '6 Controls & Findings',
    tabCsv: 'Outbound Call Log CSV Audit',
    tabVault: 'Dossier Vault & Exports',
    statWindow: 'UAE GST Calling Window',
    statCaps: 'Unanswered Caps (1/d · 2/wk)',
    statLine: 'Outbound Caller Line Posture',
    statTier: 'Modeled Offense Tier',
    statFineBand: 'Statutory Fine Exposure',
    compliantTag: 'Compliant',
    nonCompliantTag: 'Breach',
    organizationName: 'UAE Company / Call Desk Name',
    sector: 'Commercial Sector',
    carrier: 'UAE Telecom Carrier',
    callerLineType: 'Outbound Caller Line Type',
    offenseTier: 'Modeled Offense Tier (CD 57/2024)',
    assessmentDate: 'Assessment Date (ISO)',
    startHour: 'Window Start Hour (0–23 GST)',
    endHour: 'Window End Hour (1–24 GST)',
    maxPerDay: 'Max Calls/Day (Unanswered)',
    maxPerWeek: 'Max Calls/Week (Unanswered)',
    hasPermit: 'Prior authority telemarketing approval secured',
    dncrScrub: 'Pre-dial Do-Not-Call Registry (DNCR) scrubbing active',
    personalUsed: 'Personal mobile phones currently used by sales reps',
    blocksRejected: 'Zero re-calls locked immediately after consumer rejection',
    recordingOn: 'Mandatory recording enabled for all telemarketing calls',
    disclosureOn: 'Start-of-call disclosure (company, purpose & recording)',
    autoDialer: 'Automated dialing system in use',
    notes: 'Internal Compliance Notes',
    notesPlaceholder: 'Document authority permit number, e&/du line registry, or call script QA...',
    controlsHeader: 'Six UAE Telemarketing Compliance Controls (100 Points)',
    selectAll: 'Select All',
    clearAll: 'Clear All',
    findingsHeader: 'Detailed Regulatory Findings',
    noFindings: 'No blocking gaps detected; Cabinet Resolutions 56 & 57 of 2024 checks pass.',
    sevBlocker: 'Blocker',
    sevWarning: 'Warning',
    sevInfo: 'Info',
    csvHeader: 'Outbound Call Log CSV Auditor (CWE-1236 Safe Export)',
    csvHint: 'Columns: call_id, caller_line, on_dncr, call_hour_gst, calls_same_day, calls_same_week, prior_rejected, recorded_and_disclosed',
    csvUpload: 'Import .csv File',
    csvLoadSample: 'Load Sample CSV (=HYPERLINK Test)',
    csvClear: 'Clear CSV',
    csvDownloadBom: 'Download Safe CSV (UTF-8 BOM)',
    csvReady: 'Ready',
    csvConditional: 'Conditional',
    csvBlocked: 'Blocked',
    csvDncrHits: 'DNCR Calls',
    csvAfterHours: 'After Hours',
    vaultSaveNew: 'Save New Draft (DNC-YYYY-0001)',
    vaultUpdateDraft: 'Update Open Draft',
    vaultDossierTitle: 'Dossier Title',
    vaultSealLock: 'Finalize & Seal Public Report',
    vaultDuplicate: 'Duplicate Draft',
    vaultDelete: 'Delete Draft',
    vaultDownloadMdAr: 'Brief Markdown (AR)',
    vaultDownloadMdEn: 'Brief Markdown (EN)',
    vaultDownloadCsv: 'Export CSV (UTF-8 BOM)',
    vaultOpenPublic: 'Open Public Report View',
    vaultSavedList: 'Saved DNCRCheck Dossiers',
    vaultEmpty: 'No saved dossiers yet. Save the current assessment to issue DNC-YYYY-0001.',
    vaultLockedBadge: 'Sealed Immutable',
    vaultDraftBadge: 'Editable Draft',
    publicBackStudio: 'Back to DNCRCheck Studio',
    publicViewsLabel: 'View Count:',
    publicNotFound: 'The requested public report was not found or has not been sealed yet.',
    briefPreviewTitle: 'Executive Brief Preview (A4 PDF Ready)',
  },
} as const;

export function getText(locale: Locale) {
  return DICTIONARY[locale];
}
