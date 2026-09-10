const { chromium } = require('../tools/render-intro/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', { value: undefined });
      window.spoken = []; window.audioInstances = [];
      window.Audio = function () {
        window.audioInstances.push(this);
        this.play = () => { if (this.src.startsWith('blob:')) setTimeout(() => this.onplaying && this.onplaying(), 0); return Promise.resolve(); };
        this.pause = () => {};
        this.load = () => {};
        this.removeAttribute = () => { this.src = ''; };
      };
    });
    await page.route('**/api/tts', async route => {
      const text = route.request().postDataJSON().text;
      await page.evaluate(t => window.spoken.push(t), text);
      await route.fulfill({status:200,contentType:'audio/mpeg',body:'mock mp3'});
    });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:8765');
    await page.locator('#bible-toggle').click();
    for (const name of ['Salmos','23','3']) await page.getByRole('button', {name,exact:true}).click();
    assert.equal(await page.locator('#bible-read').isEnabled(), true);
    await page.locator('#bible-read-chapter').click();
    await page.waitForFunction(() => document.querySelector('.is-reading')?.dataset.verse === '1');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.verse), '1');
    await page.evaluate(() => window.audioInstances[0].onended());
    await page.waitForFunction(() => document.querySelector('.is-reading')?.dataset.verse === '2');
    await page.keyboard.press('ArrowDown');
    const y = await page.evaluate(() => scrollY);
    for (const next of ['3','4']) {
      await page.evaluate(() => window.audioInstances[0].onended());
      await page.waitForFunction(n => document.querySelector('.is-reading')?.dataset.verse === n, next);
    }
    assert.equal(await page.evaluate(() => scrollY), y);
    assert.equal(await page.evaluate(() => window.audioInstances.length), 1);
    assert.ok((await page.evaluate(() => window.spoken[0])).startsWith('Salmos, capítulo 23.'));
    assert.ok(!(await page.evaluate(() => window.spoken[1])).includes('capítulo'));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.is-reading').count(), 0);
    await page.getByRole('button', {name:'3',exact:true}).click();
    await page.route('**/api/tts', route => route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Faltan credenciales de Amazon Polly.'})}));
    await page.locator('#bible-read').click();
    await page.waitForFunction(() => document.getElementById('bible-status').textContent.includes('Faltan credenciales'));
    assert.equal(await page.locator('#bible-read').innerText(), 'Leer versículo seleccionado');
    let releaseRequest;
    const pending = new Promise(resolve => { releaseRequest = resolve; });
    await page.route('**/api/tts', async route => {
      await pending;
      await route.fulfill({status:200,contentType:'audio/mpeg',body:'late mp3'}).catch(() => {});
    });
    await page.locator('#bible-read').click();
    await page.locator('#bible-read').click();
    releaseRequest();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#bible-read').innerText(), 'Leer versículo seleccionado');
    assert.equal(await page.evaluate(() => window.audioInstances[0].src), '');
    console.log('PASS: no browser voices required, reusable audio, chapter progression, follow/cancel, AWS error message');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
