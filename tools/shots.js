// Capturas de pantalla para revisión visual
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8848';
const OUT = process.env.OUT_DIR || '/tmp/motogo-shots';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/01-plan.png` });

  await page.click('[data-quick="mercado28"]');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${OUT}/02-quote.png` });

  await page.click('#confirmBtn');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/03-searching.png` });

  await page.waitForSelector('#viewRide:not(.hidden)', { timeout: 12000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/04-ride.png` });

  await page.click('#chatBtn');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/05-chat.png` });
  await page.click('[data-close-chat]');

  await page.waitForSelector('#viewFinished:not(.hidden)', { timeout: 45000 });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/06-finished.png` });

  await page.click('[data-role-btn="driver"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/07-driver.png` });

  await page.click('#demoRequestBtn');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/08-alert.png` });

  await page.click('#acceptBtn');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/09-accepted.png` });

  await page.click('#arrivedBtn');
  await page.click('#startBtn');
  await page.waitForTimeout(600);
  await page.click('#finishBtn');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/10-history.png` });

  await page.click('[data-role-btn="passenger"]');
  await page.waitForTimeout(500);
  await page.click('#destBtn');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/11-picker.png` });

  await browser.close();
  console.log('capturas en', OUT);
})().catch((e) => { console.error(e.message); process.exit(1); });
