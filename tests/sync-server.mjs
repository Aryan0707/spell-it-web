import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../server/worker.mjs';
const db = new DatabaseSync(':memory:');
db.exec(readFileSync(new URL('../server/schema.sql', import.meta.url), 'utf8'));
const DB = { prepare(sql) { return { bind(...args) { return {
  first: async () => db.prepare(sql).get(...args),
  run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
}; } }; } };
const auth = 'Bearer ' + 'a'.repeat(64);
const payload = { iv: 'a'.repeat(16), ciphertext: 'a'.repeat(32) };
const call = (method, body, headers = {}) => worker.fetch(new Request('https://spell.example/api/sync', {
  method, headers: { Authorization: auth, 'Content-Type': 'application/json', ...headers },
  ...(body ? { body: JSON.stringify(body) } : {}),
}), { DB });
test('sync rejects unauthenticated and cross-origin requests', async () => {
  assert.equal((await call('GET', null, { Authorization: '' })).status, 401);
  assert.equal((await call('PUT', { revision: 0, payload }, { Origin: 'https://other.example' })).status, 403);
});
test('sync stores encrypted data and rejects stale concurrent writes', async () => {
  assert.equal((await call('PUT', { revision: 0, payload })).status, 200);
  assert.equal((await call('PUT', { revision: 0, payload })).status, 409);
  assert.deepEqual(await (await call('GET')).json(), { revision: 1, payload });
  const updates = await Promise.all([call('PUT', { revision: 1, payload }), call('PUT', { revision: 1, payload })]);
  assert.deepEqual(updates.map(r => r.status).sort(), [200, 409]);
  const other = await call('GET', null, { Authorization: 'Bearer ' + 'b'.repeat(64) });
  assert.deepEqual(await other.json(), { revision: 0, payload: null });
});
test('sync validates payloads and never allows oversized uploads', async () => {
  assert.equal((await call('PUT', { revision: -1, payload })).status, 400);
  assert.equal((await call('PUT', { revision: 1, payload: { ciphertext: 'bad' } })).status, 400);
  assert.equal((await call('PUT', { revision: 1, payload: { ...payload, ciphertext: 'a'.repeat(2_000_001) } })).status, 413);
});
