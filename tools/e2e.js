// Prueba E2E de humo para All Conductor (Playwright + Chrome del sistema)
// Uso: BASE_URL=http://127.0.0.1:8848 node tools/e2e.js
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8848';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });

  const step = (msg) => console.log(`• ${msg}`);

  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#viewPassenger:not(.hidden)');
  step('carga inicial OK');

  const confirmDisabled = await page.$eval('#confirmBtn', (b) => b.disabled);
  if (!confirmDisabled) throw new Error('El botón de confirmar debería iniciar deshabilitado');
  step('confirmar deshabilitado sin destino OK');

  await page.click('[data-quick="mercado28"]');
  await page.waitForSelector('#quoteBox:not(.hidden)');
  const price = await page.$eval('#quotePrice', (e) => e.textContent);
  const km = await page.$eval('#quoteDist', (e) => e.textContent);
  step(`cotización generada: ${price} MXN · ${km}`);
  const fareNum = Number(price.replace('$', ''));
  if (!(fareNum >= 20 && fareNum <= 40)) throw new Error(`Tarifa fuera de rango: ${price}`);

  await page.click('#confirmBtn');
  await page.waitForSelector('#viewSearching:not(.hidden)');
  step('pantalla de búsqueda OK');

  await page.waitForSelector('#viewRide:not(.hidden)', { timeout: 12000 });
  const driverName = await page.$eval('#driverName', (e) => e.textContent);
  const unit = await page.$eval('#driverUnit', (e) => e.textContent);
  step(`conductor asignado: ${driverName} ${unit}`);

  await page.click('#chatBtn');
  await page.waitForSelector('#chatOverlay.is-open');
  await page.waitForSelector('.bubble.them');
  await page.click('[data-quick-reply="Ya estoy en la esquina"]');
  await page.waitForFunction(() => document.querySelectorAll('.bubble.me').length >= 1);
  await page.waitForFunction(() => document.querySelectorAll('#chatScroll .bubble.them').length >= 2, { timeout: 6000 });
  step('chat con respuesta del conductor OK');
  await page.click('[data-close-chat]');

  await page.waitForSelector('#viewFinished:not(.hidden)', { timeout: 45000 });
  step('viaje finalizado OK');

  await page.click('#starPicker [data-star="5"]');
  await page.waitForFunction(() => !document.querySelector('#rateBtn').disabled);
  await page.click('#rateBtn');
  await page.waitForSelector('#viewPassenger:not(.hidden)', { timeout: 6000 });
  const destReset = await page.$eval('#destLabel', (e) => e.textContent);
  if (!/Toca el mapa/.test(destReset)) throw new Error('El destino no se reinició');
  step('calificación y reinicio OK');

  await page.click('[data-role-btn="driver"]');
  await page.waitForSelector('#viewDriver:not(.hidden)');
  step('modo conductor OK');

  await page.click('#demoRequestBtn');
  await page.waitForSelector('#tripAlert.is-open');
  const countdown = await page.$eval('#countdownText', (e) => e.textContent);
  step(`alerta de nuevo viaje OK (${countdown}s)`);

  const earningsBefore = Number(await page.$eval('#dayEarnings', (e) => e.textContent));
  await page.click('#acceptBtn');
  await page.waitForSelector('#driverTripActions:not(.hidden)');
  step('viaje aceptado OK');

  await page.click('#arrivedBtn');
  await page.waitForSelector('#startBtn:not(.hidden)');
  await page.click('#startBtn');
  await page.waitForSelector('#finishBtn:not(.hidden)');
  await page.click('#finishBtn');
  await page.waitForTimeout(500);

  const earningsAfter = Number(await page.$eval('#dayEarnings', (e) => e.textContent));
  if (!(earningsAfter > earningsBefore)) throw new Error(`Saldo no actualizado: ${earningsBefore} → ${earningsAfter}`);
  step(`saldo actualizado: $${earningsBefore} → $${earningsAfter}`);

  const histRows = await page.$$eval('#driverHistory .hist-row', (els) => els.length);
  if (histRows < 2) throw new Error('Historial no registró los eventos');
  step(`historial: ${histRows} eventos`);

  await page.click('#demoRequestBtn');
  await page.waitForSelector('#tripAlert.is-open');
  await page.click('#rejectBtn');
  await page.waitForSelector('#tripAlert:not(.is-open)');
  step('rechazo OK');

  await page.click('[data-role-btn="passenger"]');
  await page.waitForSelector('#viewPassenger:not(.hidden)');
  step('regreso a conductor OK');

  await page.click('#destBtn');
  await page.waitForSelector('#placeOverlay.is-open');
  await page.fill('#placeSearch', 'kabah');
  await page.waitForTimeout(250);
  const results = await page.$$eval('#placeResults .place-row', (e) => e.length);
  if (!results) throw new Error('Búsqueda de lugares sin resultados');
  await page.click('#placeResults .place-row');
  await page.waitForSelector('#placeOverlay:not(.is-open)');
  step(`selector de lugares OK (${results} resultados)`);

  // Persistencia de la tarifa al recargar el manifiesto
  const manifestOk = await page.evaluate(async (base) => {
    const r = await fetch(`${base}/manifest.json`);
    const j = await r.json();
    return Boolean(j.name && j.icons && j.icons.length);
  }, BASE);
  if (!manifestOk) throw new Error('manifest.json inválido');

  const swState = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ? 'registered' : 'none';
  });
  step(`manifest OK · service worker: ${swState}`);

  console.log('\nERRORES DE CONSOLA:', errors.length ? errors : 'ninguno');
  await browser.close();
  if (errors.length) process.exitCode = 1;
  console.log('\n✅ E2E completado');
})().catch((err) => {
  console.error('\n❌ FALLO:', err.message);
  process.exit(1);
});
