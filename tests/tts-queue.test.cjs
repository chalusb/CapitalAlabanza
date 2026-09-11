const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup() {
  const requests = [], starts = [], errors = [], revoked = [];
  let buffers = 0, ended = 0, url = 0;
  const player = {
    play() { return Promise.resolve(); }, pause() {}, load() {},
    removeAttribute() { this.src = ''; }
  };
  const sandbox = {
    Audio: function () { return player; }, AbortController,
    ArrayBuffer, DataView, Uint8Array, clearTimeout, setTimeout,
    btoa: s => Buffer.from(s, 'binary').toString('base64'),
    URL: {createObjectURL: () => 'blob:' + (++url), revokeObjectURL: u => revoked.push(u)},
    fetch(path, options) {
      return new Promise(resolve => requests.push({options, text: JSON.parse(options.body).text,
        resolve: (status = 200) => resolve(new Response(status === 200 ? 'ID3' : JSON.stringify({error:'quota'}),
          {status, headers:{'Content-Type':status === 200 ? 'audio/mpeg' : 'application/json'}}))}));
    }
  };
  sandbox.window = sandbox;
  vm.runInNewContext(fs.readFileSync('js/tts.js', 'utf8'), sandbox);
  const begin = texts => sandbox.speakSequence(texts, {
    onStart: i => starts.push(i), onBuffer: () => buffers++,
    onEnd: () => ended++, onError: e => errors.push(e.message)
  });
  return {requests, starts, errors, revoked, player, begin, stop: sandbox.stopSpeakText,
    buffers: () => buffers, ended: () => ended};
}

test('out-of-order synthesis is buffered and ready verses advance without network waits', async () => {
  const q = setup();
  try {
    q.begin(['one','two','three','four','five']);
    assert.deepEqual(q.requests.map(r => r.text), ['one','two']);
    q.requests[1].resolve(); await tick();
    assert.equal(q.requests[2].text, 'three');
    q.requests[0].resolve(); await tick();
    assert.ok(!q.player.src.startsWith('blob:'), 'Wait for initial cushion');
    q.requests[2].resolve(); await tick();
    q.player.onplaying();
    const first = q.player.src;
    q.player.onended();
    assert.notEqual(q.player.src, first, 'Next verse is available synchronously');
    q.player.onplaying();
    assert.deepEqual(q.starts, [0,1]);
    assert.equal(q.buffers(), 0);
    assert.equal(q.requests.length, 4, 'Only current plus two ahead');
    q.requests[3].resolve(); await tick();
    q.player.onended(); q.player.onplaying();
    assert.deepEqual(q.starts, [0,1,2]);
    assert.equal(new Set(q.requests.map(r => r.text)).size, 5, 'No duplicate synthesis');
    q.requests[4].resolve(); await tick();
    q.player.onended(); q.player.onplaying();
    q.player.onended(); q.player.onplaying();
    q.player.onended();
    assert.equal(q.ended(), 1);
    assert.equal(q.revoked.length, 5);
  } finally {q.stop();}
});

test('cancel aborts all pending synthesis and late responses cannot restart audio', async () => {
  const q = setup();
  q.begin(['one','two','three','four']);
  q.stop();
  for (const r of q.requests) { assert.ok(r.options.signal.aborted); r.resolve(); }
  await tick();
  assert.equal(q.requests.length, 2);
  assert.equal(q.player.src, '');
  assert.deepEqual(q.starts, []);
});

test('an unusually slow next verse buffers once and resumes in order when available', async () => {
  const q = setup();
  try {
    q.begin(['one','two','three','four']);
    q.requests[0].resolve(); q.requests[1].resolve(); await tick();
    q.requests[2].resolve(); await tick();
    q.player.onplaying(); q.player.onended();
    q.player.onplaying(); q.player.onended();
    q.player.onplaying(); q.player.onended();
    assert.equal(q.buffers(), 1);
    assert.deepEqual(q.starts, [0,1,2]);
    q.requests[3].resolve(); await tick();
    q.player.onplaying(); q.player.onended();
    assert.deepEqual(q.starts, [0,1,2,3]);
    assert.equal(q.ended(), 1);
  } finally {q.stop();}
});

test('background quota failure lets the ready verse finish and then reports the error', async () => {
  const q = setup();
  try {
    q.begin(['one','two','three']);
    q.requests[1].resolve(429); await tick();
    q.requests[0].resolve(); await tick();
    q.player.onplaying();
    assert.deepEqual(q.errors, []);
    q.player.onended();
    assert.deepEqual(q.errors, ['quota']);
    assert.equal(q.requests.length, 2);
    assert.equal(q.player.src, '');
  } finally {q.stop();}
});
