import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createAdminApp } from '../server/app.mjs';
const admin = '11111111-1111-4111-8111-111111111111', id = '22222222-2222-4222-8222-222222222222';
async function setup(t, { found = true, dbError = null } = {}) {
  const calls = [];
  const db = { from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const b = { update(v) { call.update = v; return b; }, eq(k, v) { call.filters.push([k, v]); return b; }, select() { return b; },
      maybeSingle() { return Promise.resolve({ data: found && !dbError ? { id, ...call.update } : null, error: dbError }); } };
    return b;
  } };
  const authClient = { auth: { async getUser(token) { return { data: { user: { id: token === 'admin' ? admin : id } }, error: null }; } } };
  const server = createAdminApp({ db, authClient, media: {}, admins: new Set([admin]) }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise(r => server.close(r)));
  return { calls, patch: (path, body, token = 'admin') => fetch('http://127.0.0.1:' + server.address().port + '/api/admin' + path, { method: 'PATCH', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) };
}
test('admin can close and reopen a restaurant, writing only is_open', async t => {
  const { patch, calls } = await setup(t);
  const closed = await patch('/restaurants/' + id + '/open', { is_open: false });
  assert.equal(closed.status, 200); assert.equal((await closed.json()).is_open, false);
  assert.equal((await patch('/restaurants/' + id + '/open', { is_open: true })).status, 200);
  assert.deepEqual(calls.map(c => c.update), [{ is_open: false }, { is_open: true }]);
  assert.ok(calls.every(c => c.table === 'restaurants' && c.filters.some(([k, v]) => k === 'id' && v === id)));
});
test('admin can mark a food sold out and available again, writing only is_available', async t => {
  const { patch, calls } = await setup(t);
  const sold = await patch('/foods/' + id + '/availability', { is_available: false });
  assert.equal(sold.status, 200); assert.equal((await sold.json()).is_available, false);
  assert.equal((await patch('/foods/' + id + '/availability', { is_available: true })).status, 200);
  assert.deepEqual(calls.map(c => c.update), [{ is_available: false }, { is_available: true }]);
});
test('availability endpoints reject non-admins, bad ids and extra or non-boolean fields before the database', async t => {
  const { patch, calls } = await setup(t);
  assert.equal((await patch('/restaurants/' + id + '/open', { is_open: false }, 'customer')).status, 403);
  assert.equal((await patch('/foods/' + id + '/availability', { is_available: false }, 'customer')).status, 403);
  for (const [path, body] of [['/restaurants/bad/open', { is_open: true }], ['/restaurants/' + id + '/open', { is_open: 'false' }], ['/restaurants/' + id + '/open', { is_open: true, is_active: false }], ['/foods/bad/availability', { is_available: true }], ['/foods/' + id + '/availability', { is_available: 0 }], ['/foods/' + id + '/availability', { is_available: true, price: 1 }], ['/foods/' + id + '/availability', []]])
    assert.equal((await patch(path, body)).status, 400, path + JSON.stringify(body));
  assert.equal(calls.length, 0);
});
test('unknown restaurant or food returns 404 instead of false success', async t => {
  const { patch } = await setup(t, { found: false });
  assert.equal((await patch('/restaurants/' + id + '/open', { is_open: false })).status, 404);
  assert.equal((await patch('/foods/' + id + '/availability', { is_available: false })).status, 404);
});
