import {
  MAX_CALLS_PER_DAY,
  MAX_CALLS_PER_WEEK,
  PERMITTED_END_HOUR_GST,
  PERMITTED_START_HOUR_GST,
} from './dncrCatalog.ts';
import type { AssessmentInput, CallingRulesResult, FindingItem } from './types.ts';

export function evaluateCallingWindowAndCaps(input: AssessmentInput): {
  callingRules: CallingRulesResult;
  findings: FindingItem[];
} {
  const startH = Number(input.callingWindowStartHour);
  const endH = Number(input.callingWindowEndHour);

  const callingHoursCompliant =
    Number.isFinite(startH) &&
    Number.isFinite(endH) &&
    startH >= PERMITTED_START_HOUR_GST &&
    endH <= PERMITTED_END_HOUR_GST &&
    startH < endH;

  const dailyCapCompliant =
    Number.isFinite(input.maxCallsPerDay) &&
    input.maxCallsPerDay >= 1 &&
    input.maxCallsPerDay <= MAX_CALLS_PER_DAY;

  const weeklyCapCompliant =
    Number.isFinite(input.maxCallsPerWeek) &&
    input.maxCallsPerWeek >= 1 &&
    input.maxCallsPerWeek <= MAX_CALLS_PER_WEEK;

  const lineCompliant =
    !input.isPersonalMobileUsed &&
    (input.callerLineType === 'corporate_licensed_uae' ||
      input.callerLineType === 'registered_call_center');

  const permitAndDncrCompliant =
    Boolean(input.hasPriorTelemarketingPermit) && Boolean(input.dncrScrubbingActive);

  const disclosureAndRecordingCompliant =
    Boolean(input.callRecordingEnabled) && Boolean(input.openingDisclosureGiven);

  const rejectionRuleCompliant = Boolean(input.blocksRejectedFollowups);

  const findings: FindingItem[] = [];

  if (!input.hasPriorTelemarketingPermit) {
    findings.push({
      code: 'DNC-NO-PERMIT',
      severity: 'blocker',
      titleEn: 'Missing Prior Authority Telemarketing Approval',
      titleAr: 'غياب الموافقة المسبقة لممارسة التسويق الهاتفي',
      detailEn:
        'Unapproved outbound telemarketing violates UAE Cabinet Resolution No. 56 of 2024 and carries AED 75,000–150,000 administrative fines.',
      detailAr:
        'ممارسة التسويق الهاتفي دون تصريح مسبق من السلطة المختصة تخالف قرار 56/2024 وتستوجب غرامة 75,000–150,000 د.إ.',
      legalRef: 'UAE Cabinet Resolutions No. 56 & 57 of 2024 — Prior Approval',
    });
  }

  if (!input.dncrScrubbingActive) {
    findings.push({
      code: 'DNC-NO-DNCR-SCRUB',
      severity: 'blocker',
      titleEn: 'National DNCR List Suppression Disabled',
      titleAr: 'تعطيل تصفية قوائم العملاء مقابل سجل عدم الاتصال DNCR',
      detailEn:
        'Calling consumers listed on the UAE Do-Not-Call Registry triggers AED 50,000 (1st), AED 75,000 (2nd), up to AED 150,000 (repeat) fines.',
      detailAr:
        'الاتصال بأرقام مدرجة في سجل DNCR يفرض غرامات تصاعدية قدرها 50,000 ثم 75,000 وحتى 150,000 د.إ.',
      legalRef: 'UAE Cabinet Resolutions No. 56 & 57 of 2024 — DNCR Protection',
    });
  }

  if (!lineCompliant) {
    findings.push({
      code: 'DNC-PERSONAL-OR-UNREG-LINE',
      severity: 'blocker',
      titleEn: 'Personal Mobile or Unregistered Outbound Line Prohibited',
      titleAr: 'حظر استخدام الهواتف الشخصية أو الأرقام غير المسجلة بالرخصة التجارية',
      detailEn:
        'Telemarketing calls must originate strictly from licensed e& or du corporate numbers under the commercial license; personal lines risk AED 5k–50k fines and line disconnection.',
      detailAr:
        'يُمنع إجراء مكالمات تسويقية من هواتف شخصية أو خطوط غير مرخصة، مع تعرض المخالف لغرامة 5,000–50,000 د.إ وقطع الخدمة.',
      legalRef: 'Cabinet Resolutions No. 56 & 57 of 2024 — Licensed Corporate Numbers',
    });
  }

  if (!callingHoursCompliant) {
    findings.push({
      code: 'DNC-OUTSIDE-09-18-WINDOW',
      severity: 'blocker',
      titleEn: 'Calling Window Exceeds Permitted 09:00–18:00 UAE GST Hours',
      titleAr: 'تجاوز أوقات الاتصال المسموحة (09:00 صباحاً – 06:00 مساءً بتوقيت الإمارات)',
      detailEn:
        'Permitted outbound marketing window is strictly 09:00 to 18:00 UAE local time.',
      detailAr:
        'يقتصر وقت المكالمات التسويقية نظامياً على الفترة من التاسعة صباحاً وحتى السادسة مساءً بتوقيت الإمارات.',
      legalRef: 'Cabinet Resolution No. 56 of 2024 — Permitted Calling Hours',
    });
  }

  if (!dailyCapCompliant || !weeklyCapCompliant) {
    findings.push({
      code: 'DNC-FREQUENCY-CAP-EXCEEDED',
      severity: 'blocker',
      titleEn: 'Follow-Up Frequency Exceeds Statutory 1/Day or 2/Week Limit',
      titleAr: 'تجاوز سقف إعادة الاتصال (حد أقصى 1 مكالمة/يوم و2 مكالمتان/أسبوع)',
      detailEn:
        'Unanswered or disconnected calls are capped at once per day and at most twice per week.',
      detailAr:
        'عند عدم رد المستهلك أو إنهاء المكالمة يُحظر معاودة الطلب أكثر من مرة واحدة يومياً ومرتين أسبوعياً.',
      legalRef: 'Cabinet Resolution No. 56 of 2024 — Repeat Call Caps',
    });
  }

  if (!rejectionRuleCompliant) {
    findings.push({
      code: 'DNC-REJECTED-FOLLOWUP-ALLOWED',
      severity: 'blocker',
      titleEn: 'Immediate Post-Rejection Re-Dial Lock Missing',
      titleAr: 'عدم تفعيل الحظر الفوري بعد رفض المستهلك للعرض',
      detailEn:
        'If a consumer explicitly declines the offer, further telemarketing follow-up calls are prohibited.',
      detailAr:
        'في حال رفض المستهلك العرض أثناء المكالمة يُحظر معاودة الاتصال به نهائياً بشأن نفس الخدمة.',
      legalRef: 'Cabinet Resolution No. 56 of 2024 — Consumer Rejection Lock',
    });
  }

  if (!disclosureAndRecordingCompliant) {
    findings.push({
      code: 'DNC-DISCLOSURE-RECORDING-GAP',
      severity: 'warning',
      titleEn: 'Call Recording or Start-of-Call Disclosure Incomplete',
      titleAr: 'نقص في تسجيل المكالمات أو الإفصاح المبدئي عند بدء الاتصال',
      detailEn:
        'All telemarketing calls must be recorded and open with company name, purpose, and recording notice.',
      detailAr:
        'يشترط تسجيل كافة المكالمات التسويقية والإفصاح في البداية عن اسم الشركة والغرض وإشعار التسجيل.',
      legalRef: 'Cabinet Resolution No. 56 of 2024 — Recording & Opening Disclosure',
    });
  }

  if (input.automatedDialerUsed) {
    findings.push({
      code: 'DNC-AUTOMATED-DIALER',
      severity: 'warning',
      titleEn: 'Automated Dialing System Flagged (CD 57/2024 Compliance Review)',
      titleAr: 'رصد استخدام نظام اتصال آلي يتطلب مراجعة امتثال (قرار 57/2024)',
      detailEn:
        'Automated telemarketing dialing violations carry administrative fines starting at AED 10,000.',
      detailAr:
        'مخالفات استخدام أنظمة الاتصال الآلي في التسويق الهاتفي تخضع لغرامات إدارية تبدأ من 10,000 د.إ.',
      legalRef: 'Cabinet Resolutions No. 56 & 57 of 2024 — Automated Dialing',
    });
  }

  let activeViolationCount = 0;
  if (!input.hasPriorTelemarketingPermit) activeViolationCount += 1;
  if (!input.dncrScrubbingActive) activeViolationCount += 1;
  if (!lineCompliant) activeViolationCount += 1;
  if (!callingHoursCompliant || !dailyCapCompliant || !weeklyCapCompliant) {
    activeViolationCount += 1;
  }
  if (!rejectionRuleCompliant) activeViolationCount += 1;
  if (!disclosureAndRecordingCompliant) activeViolationCount += 1;
  if (input.automatedDialerUsed) activeViolationCount += 1;

  return {
    callingRules: {
      callingHoursCompliant,
      dailyCapCompliant,
      weeklyCapCompliant,
      lineCompliant,
      permitAndDncrCompliant,
      disclosureAndRecordingCompliant,
      rejectionRuleCompliant,
      activeViolationCount,
    },
    findings,
  };
}
