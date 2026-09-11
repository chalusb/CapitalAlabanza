const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const worker = import('data:text/javascript;base64,' + readFileSync('worker/index.js').toString('base64'));
const request = (body = {text: 'Jehová es mi pastor.'}, headers = {}) => new Request('https://example.org/api/tts', {
  method: 'POST', headers: {'Content-Type': 'application/json', ...headers}, body: JSON.stringify(body)
});
async function run(req, env) { return (await worker).default.fetch(req, env); }

test('Spanish model request returns MP3 without persistent storage', async () => {
  for (const output of [new Uint8Array([73,68,51]), {audio:'SUQz'}, new ReadableStream({start(c) {c.enqueue(new Uint8Array([73,68,51]));c.close();}})]) {
    const response = await run(request(), {AI: {async run(model, input) {
      assert.equal(model, '@cf/myshell-ai/melotts');
      assert.deepEqual(input, {prompt:'Jehová es mi pastor.',lang:'es'});
      return output;
    }}});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'audio/mpeg');
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.equal(await response.text(), 'ID3');
  }
});
test('invalid input and foreign origins never call AI', async () => {
  const env = {AI: {run() {throw new Error('Should not call AI');}}};
  assert.equal((await run(request({text:''}), env)).status, 400);
  assert.equal((await run(request({text:'a'.repeat(2001)}), env)).status, 400);
  assert.equal((await run(request({text:'a'.repeat(17000)}), env)).status, 413);
  assert.equal((await run(request(undefined, {Origin:'https://other.org'}), env)).status, 403);
  assert.equal((await run(new Request('https://example.org/api/tts'), env)).status, 405);
});
test('setup, quota, and upstream failures give actionable errors', async () => {
  assert.equal((await run(request(), {})).status, 503);
  const response = await run(request(), {AI:{run() {throw new Error('daily neuron quota exceeded');}}});
  assert.equal(response.status, 429);
  assert.match((await response.json()).error, /límite/);
  assert.equal((await run(request(), {AI:{run() {return {unexpected:true};}}})).status, 502);
});
test('ordinary pages still use static assets', async () => {
  const response = await run(new Request('https://example.org/'), {ASSETS:{fetch() {return new Response('page');}}});
  assert.equal(await response.text(), 'page');
});
