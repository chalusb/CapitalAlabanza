const { chromium } = require('../tools/render-intro/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(window, 'speechSynthesis', {value:undefined});
      window.audioInstances = [];
      window.Audio = function () {
        window.audioInstances.push(this);
        this.play = () => Promise.resolve();
        this.pause = () => {};
        this.load = () => {};
        this.removeAttribute = () => {this.src = '';};
      };
    });
    const requests = [];
    let failure = false;
    await page.route('**/api/tts', route => {
      requests.push(route.request().postDataJSON());
      return route.fulfill(failure
        ? {status:429,contentType:'application/json',body:JSON.stringify({error:'Se alcanzó el límite de voz de Cloudflare.'})}
        : {contentType:'audio/mpeg',body:Buffer.from('ID3')});
    });
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:8765');
    await page.locator('#bible-toggle').click();
    for (const name of ['Salmos','23','3']) await page.getByRole('button',{name,exact:true}).click();
    await page.locator('#bible-read-chapter').click();
    await page.waitForFunction(() => window.audioInstances[0].src.startsWith('blob:'));
    assert.match(requests[0].text, /Jehová es mi pastor/);
    assert.doesNotMatch(requests[0].text, /Salmos|Capítulo|Versículo/i);
    assert.equal(await page.locator('#bible-status.audio-loading').count(), 1);
    assert.equal(await page.locator('#bible-read-chapter').getAttribute('aria-busy'), 'true');
    await page.evaluate(() => window.audioInstances[0].onplaying());
    assert.equal(await page.locator('.audio-loading').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.dataset.verse), '1');
    await page.evaluate(() => window.audioInstances[0].onended());
    await page.waitForFunction(() => window.audioInstances[0].src.startsWith('blob:'));
    assert.match(requests[1].text, /delicados pastos/);
    await page.evaluate(() => window.audioInstances[0].onplaying());
    assert.equal(await page.evaluate(() => document.activeElement.dataset.verse), '2');
    await page.keyboard.press('ArrowDown');
    const y = await page.evaluate(() => scrollY);
    await page.evaluate(() => window.audioInstances[0].onended());
    await page.waitForFunction(() => window.audioInstances[0].src.startsWith('blob:'));
    await page.evaluate(() => window.audioInstances[0].onplaying());
    assert.equal(await page.evaluate(() => scrollY), y);
    await page.evaluate(() => window.audioInstances[0].onwaiting());
    assert.equal(await page.locator('.audio-loading').count(), 1);
    await page.evaluate(() => window.audioInstances[0].onplaying());
    assert.equal(await page.locator('.audio-loading').count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.audio-loading, .is-reading').count(), 0);
    await page.getByRole('button',{name:'3',exact:true}).click();
    await page.locator('#bible-read').click();
    await page.waitForFunction(() => window.audioInstances[0].src.startsWith('blob:'));
    assert.match(requests.at(-1).text, /Confortará mi alma/);
    await page.locator('#bible-read').click();
    assert.equal(await page.locator('.audio-loading').count(), 0);
    assert.equal(await page.evaluate(() => window.audioInstances[0].src), '');
    assert.equal(await page.evaluate(() => window.audioInstances.length), 1);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'24',exact:true}).click();
    await page.getByRole('button',{name:'1',exact:true}).click();
    failure = true;
    await page.locator('#bible-read').click();
    await page.waitForFunction(() => document.getElementById('bible-status').textContent.includes('límite de voz'));
    assert.equal(await page.locator('.audio-loading').count(), 0);
    // A stopped request must not begin playback when its response finally arrives.
    await page.unroute('**/api/tts');
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route('**/api/tts', async route => {
      await held;
      await route.fulfill({contentType:'audio/mpeg',body:Buffer.from('ID3')}).catch(() => {});
    });
    const pending = page.waitForRequest('**/api/tts');
    await page.locator('#bible-read').click();
    await pending;
    await page.locator('#bible-read').click();
    release();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.evaluate(() => window.audioInstances[0].src), '');
    assert.equal(await page.locator('.audio-loading').count(), 0);
    console.log('PASS: on-demand text, MP3 player, loader, follow, cancellation, quota error, late response');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
