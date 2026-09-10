const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

test('Polly endpoint: validation, origin, MP3, signing, cache and upstream failures', async () => {
  const worker = (await import(pathToFileURL(path.resolve('worker/index.js')))).default;
  const env = { ALLOWED_ORIGIN: 'https://alabanzascapital.cssoftware.org', AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'test-key', AWS_SECRET_ACCESS_KEY: 'test-secret' };
  const request = (text, origin = env.ALLOWED_ORIGIN) => new Request('https://alabanzascapital.cssoftware.org/api/tts', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({text}) });
  const originalFetch = global.fetch;
  const originalCaches = global.caches;
  let calls = 0, body, headers;
  const stored = new Map();
  global.caches = { default: { match: async key => stored.get(key.url)?.clone(), put: async (key, value) => { stored.set(key.url, value); } } };
  global.fetch = async (_url, options) => { calls++; body = JSON.parse(options.body); headers = options.headers; return new Response(new Uint8Array([73, 68, 51]), { headers: {'Content-Type': 'audio/mpeg'} }); };
  try {
    assert.equal((await worker.fetch(request('hola', env.ALLOWED_ORIGIN + '.evil.test'), env)).status, 403);
    assert.equal((await worker.fetch(request({}), env)).status, 400);
    assert.equal((await worker.fetch(request('x'.repeat(2501)), env)).status, 413);
    assert.equal((await worker.fetch(request('hola'), {...env, AWS_SECRET_ACCESS_KEY: ''})).status, 503);
    const response = await worker.fetch(request('Paz & <amor>'), env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
    assert.equal(body.VoiceId, 'Andres');
    assert.equal(body.LanguageCode, 'es-MX');
    assert.equal(body.TextType, 'ssml');
    assert.match(body.Text, /Paz &amp; &lt;amor&gt;/);
    assert.match(headers.Authorization, /^AWS4-HMAC-SHA256 /);
    await worker.fetch(request('Paz & <amor>'), env);
    assert.equal(calls, 1);
    global.fetch = async () => new Response('private AWS diagnostics', {status:403});
    const error = await worker.fetch(request('otro texto'), env);
    assert.equal(error.status, 502);
    assert.ok(!(await error.text()).includes('private AWS'));
  } finally { global.fetch = originalFetch; global.caches = originalCaches; }
});
