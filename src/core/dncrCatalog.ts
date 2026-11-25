import type { DncrControlSpec } from './types.ts';

export const DNCRCHECK_TOOL_VERSION = '0.5.0';
export const CD56_EFFECTIVE_DATE = '2024-08-27';

export const PERMITTED_START_HOUR_GST = 9;
export const PERMITTED_END_HOUR_GST = 18;
export const MAX_CALLS_PER_DAY = 1;
export const MAX_CALLS_PER_WEEK = 2;

export const FINE_PERMIT_MISSING_FIRST_AED = 75_000;
export const FINE_PERMIT_MISSING_SECOND_AED = 100_000;
export const FINE_PERMIT_MISSING_REPEAT_AED = 150_000;

export const FINE_DNCR_FIRST_AED = 50_000;
export const FINE_DNCR_SECOND_AED = 75_000;
export const FINE_DNCR_REPEAT_AED = 150_000;

export const FINE_PERSONAL_LINE_MIN_AED = 5_000;
export const FINE_PERSONAL_LINE_MAX_AED = 50_000;
export const FINE_OPERATIONAL_TIER_AED = 10_000;
export const STATUTORY_SINGLE_VIOLATION_CEILING_AED = 150_000;

export const LEGAL_DISCLAIMER_EN =
  'Notice: DNCRCheck is an independent technical readiness utility and is NOT affiliated with, endorsed by, or connected to the UAE Ministry of Economy (MoET), Telecommunications & Digital Government Regulatory Authority (TDRA), e&, du, or any licensing authority. It does not query live DNCR databases, and outputs are indicative only (not legal advice).';

export const LEGAL_DISCLAIMER_AR =
  'تنبيه مهم: أداة DNCRCheck أداة فحص تقنية مستقلة وليست تابعة أو معتمدة من وزارة الاقتصاد الإماراتية (MoET) أو هيئة تنظيم الاتصالات (TDRA) أو شركة e& أو du أو أي دائرة ترخيص. لا تتصل الأداة بسجلات DNCR الرسمية الحية ومخرجاتها استرشادية ولا تُعد استشارة قانونية.';

export const DNCR_CONTROLS: readonly DncrControlSpec[] = [
  {
    id: 'DNC-CTRL-01',
    weight: 20,
    titleEn: 'Prior Authority Telemarketing Approval & Staff Training (CD 56/2024)',
    titleAr: 'الموافقة المسبقة للتسويق الهاتفي وتدريب الموظفين (قرار 56/2024)',
    descriptionEn:
      'Hold active telemarketing authorization from the competent UAE authority and train staff on mandatory call conduct.',
    descriptionAr:
      'الحصول على تصريح مسبق من السلطة المختصة وتأهيل مسؤولي المبيعات بضوابط الاتصال المعتمدة.',
  },
  {
    id: 'DNC-CTRL-02',
    weight: 20,
    titleEn: 'Licensed Local Company Phone Lines Only (Zero Personal Mobiles)',
    titleAr: 'استخدام خطوط محلية مسجلة بالرخصة التجارية فقط (حظر الهواتف الشخصية)',
    descriptionEn:
      'Route all outbound marketing calls through licensed corporate e& / du numbers registered under the UAE trade license.',
    descriptionAr:
      'قصر المكالمات التسويقية على خطوط شركات محلية مرخصة من e& أو du تحت الرخصة التجارية ومنع الجوال الشخصي.',
  },
  {
    id: 'DNC-CTRL-03',
    weight: 20,
    titleEn: 'Pre-Dial Do-Not-Call Registry (DNCR) Suppression Workflow',
    titleAr: 'فحص واستبعاد الأرقام المدرجة في سجل عدم الاتصال (DNCR) قبل الطلب',
    descriptionEn:
      'Verify and suppress all numbers listed on the national DNCR list prior to every outbound calling campaign.',
    descriptionAr:
      'تصفية قوائم العملاء يومياً واستبعاد أي رقم مسجل في سجل عدم الاتصال قبل بدء أي حملة اتصال.',
  },
  {
    id: 'DNC-CTRL-04',
    weight: 15,
    titleEn: '09:00–18:00 GST Calling Window & Frequency Caps (1/Day, 2/Week)',
    titleAr: 'الالتزام بنافذة 9:00 صباحاً–6:00 مساءً وسقوف التكرار (1/يوم، 2/أسبوع)',
    descriptionEn:
      'Restrict outbound dials to 09:00–18:00 UAE local time and cap unanswered follow-ups at 1 per day and 2 per week.',
    descriptionAr:
      'تقييد الاتصال الصادر بين 9 صباحاً و6 مساءً بتوقيت الإمارات، وبحد أقصى مكالمة يومياً ومكالمتين أسبوعياً عند عدم الرد.',
  },
  {
    id: 'DNC-CTRL-05',
    weight: 15,
    titleEn: 'Zero Follow-Up After Consumer Rejection & Opt-Out Locking',
    titleAr: 'منع إعادة الاتصال فوراً عند رفض المستهلك للعرض',
    descriptionEn:
      'Permanently suppress prospects from repeat campaign outreach once they decline the product or service.',
    descriptionAr:
      'حظر الرقم نهائياً من قوائم الحملة فور رفض المستهلك أو عدم رغبته في المتابعة.',
  },
  {
    id: 'DNC-CTRL-06',
    weight: 10,
    titleEn: 'Mandatory Call Recording & Start-of-Call Identity Disclosure',
    titleAr: 'تسجيل المكالمات والإفصاح عند البداية عن الهوية والغرض والتسجيل',
    descriptionEn:
      'Record every telemarketing call and state caller identity, company name, offer purpose, and recording notice upfront.',
    descriptionAr:
      'تسجيل جميع المكالمات التسويقية وإبلاغ المستهلك في الثواني الأولى باسم الشركة والغرض من المكالمة وبأنها مسجلة.',
  },
];
