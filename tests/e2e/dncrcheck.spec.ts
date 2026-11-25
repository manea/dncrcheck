import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function assertNoHorizontalOverflow(page: Page) {
  const dims = await page.evaluate(() => {
    const main = document.querySelector('main');
    const header = document.querySelector('header');
    const mainRect = main?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      mainWidth: mainRect ? Math.ceil(mainRect.width) : 0,
      headerWidth: headerRect ? Math.ceil(headerRect.width) : 0,
    };
  });
  expect(dims.scrollWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.mainWidth).toBeLessThanOrEqual(dims.innerWidth);
  expect(dims.headerWidth).toBeLessThanOrEqual(dims.innerWidth);
}

function buildCleanCallLogCsv(): string {
  return [
    'call_id,caller_line,on_dncr,call_hour_gst,calls_same_day,calls_same_week,prior_rejected,recorded_and_disclosed',
    'CALL-CLEAN-01,corporate_licensed_uae,false,10:30,1,1,false,true',
  ].join('\n');
}

test.describe('DNCRCheck — UAE Cabinet Resolutions 56 & 57 of 2024 E2E', () => {
  test('defaults to AR RTL Telecom Ivory, toggles EN LTR Gulf Night, and persists across reload', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.locator('header')).toContainText('SQLite WAL');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'telecom-ivory');
    await expect(page.locator('svg[role="img"]').first()).toBeVisible();
    await expect(page.getByTestId('status-badge')).toContainText('70/100');
    await expect(page.getByTestId('legal-disclaimer-banner')).toContainText('ليست تابعة');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/01-workspace-ar-telecom-ivory.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('lang-toggle').click();
    await page.getByTestId('theme-toggle').click();

    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'gulf-night');
    await expect(page.getByTestId('legal-disclaimer-banner')).toContainText('NOT affiliated');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/02-workspace-en-gulf-night.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'gulf-night');

    expect(errors).toEqual([]);
  });

  test('evaluates Preset 1/2/3 & remediates Preset 3 into sealed DNC-YYYY-0001 with BOM CSV & /r/:code', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    const year = new Date().getUTCFullYear();
    const expectedCode = `DNC-${year}-0001`;

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByTestId('lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // Preset 1: Dubai Real Estate Desk (Ready 100/100)
    await page.getByTestId('preset-dubai-realestate-brokerage-ready').click();
    await expect(page.getByTestId('status-badge')).toContainText('READY · 100/100');

    // Preset 2: Sharjah Insurance Desk (Conditional 70/100, AED 10,000)
    await page.getByTestId('preset-sharjah-insurance-automated-dialer-conditional').click();
    await expect(page.getByTestId('status-badge')).toContainText('CONDITIONAL · 70/100');
    await expect(page.locator('main')).toContainText('AED 10,000');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/03-sharjah-conditional-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // Preset 3: Abu Dhabi Unlicensed Sales Team (Blocked 0/100, AED 150,000, CWE-1236 CSV)
    await page.getByTestId('preset-abudhabi-unlicensed-coldcall-blocked').click();
    await expect(page.getByTestId('status-badge')).toContainText('BLOCKED · 0/100');
    await expect(page.locator('main')).toContainText('AED 150,000');

    // Remediate Preset 3 on Rules tab
    await page.getByTestId('caller-line-select').selectOption('corporate_licensed_uae');
    await page.getByTestId('start-hour-input').fill('9');
    await page.getByTestId('end-hour-input').fill('18');
    await page.getByTestId('max-day-input').fill('1');
    await page.getByTestId('max-week-input').fill('2');
    await page.getByTestId('toggle-hasPriorTelemarketingPermit').check();
    await page.getByTestId('toggle-dncrScrubbingActive').check();
    await page.getByTestId('toggle-blocksRejectedFollowups').check();
    await page.getByTestId('toggle-callRecordingEnabled').check();
    await page.getByTestId('toggle-openingDisclosureGiven').check();
    await page.getByTestId('toggle-isPersonalMobileUsed').uncheck();
    await page.getByTestId('toggle-automatedDialerUsed').uncheck();

    // Check all 6 controls on Controls tab
    await page.getByTestId('tab-controls').click();
    await page.getByRole('button', { name: 'Select All' }).click();

    // Replace injected CSV on CSV tab
    await page.getByTestId('tab-csv').click();
    await page.getByTestId('csv-textarea').fill(buildCleanCallLogCsv());

    await expect(page.getByTestId('status-badge')).toContainText('READY · 100/100');

    // Vault tab: save DNC-YYYY-0001 -> seal -> download raw wire UTF-8 BOM CSV -> screenshot
    await page.getByTestId('tab-vault').click();
    await page.getByTestId('create-dossier-btn').click();
    await expect(page.locator('main')).toContainText(expectedCode);

    await page.getByTestId('finalize-dossier-btn').click();
    await expect(page.getByTestId('finalize-dossier-btn')).toHaveCount(0);
    await expect(page.getByTestId('open-public-report-btn')).toBeVisible();

    const dlPromise = page.waitForEvent('download');
    await page.getByTestId('download-vault-csv-btn').click();
    const dl = await dlPromise;
    expect(dl.suggestedFilename()).toContain('.csv');
    const dlPath = await dl.path();
    expect(dlPath).toBeTruthy();
    if (dlPath) {
      const bytes = fs.readFileSync(dlPath);
      expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    }

    await page.screenshot({
      path: 'test-results/qa-screenshots/04-sealed-dossier-desktop.png',
      fullPage: true,
      animations: 'disabled',
    });

    // Public report route /r/:code & persistent view counter across reload
    await page.getByTestId('open-public-report-btn').click();
    await expect(page.locator('body')).toContainText(expectedCode);
    await expect(page.locator('body')).toContainText('Capital Crescent Tele-Sales FZE');
    await expect(page.locator('body')).toContainText('View Count: 1');

    await page.reload();
    await expect(page.locator('body')).toContainText(expectedCode);
    await expect(page.locator('body')).toContainText('View Count: 2');

    expect(errors).toEqual([]);
  });

  test('verifies mobile 390x844 responsiveness in AR Telecom Ivory and EN Gulf Night with zero overflow', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('svg[role="img"]').first()).toBeVisible();
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/05-mobile-ar-telecom-ivory.png',
      fullPage: true,
      animations: 'disabled',
    });

    await page.getByTestId('lang-toggle').click();
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'gulf-night');
    await assertNoHorizontalOverflow(page);

    await page.screenshot({
      path: 'test-results/qa-screenshots/06-mobile-en-gulf-night.png',
      fullPage: true,
      animations: 'disabled',
    });

    expect(errors).toEqual([]);
  });
});
