import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createAdminApp } from '../server/app.mjs';
import { voucherPayload } from '../server/vouchers.mjs';
const admin = '11111111-1111-4111-8111-111111111111', id = '22222222-2222-4222-8222-222222222222';
const future = new Date(Date.now() + 86400000).toISOString();
const base = { code: ' giammon20k ', applies_to: 'food', discount_type: 'fixed', discount_value: 20000, min_order_value: 80000, restaurant_id: null, expiry_date: future, is_active: false };
async function setup(t, { insertError = null, restaurant = { id }, current = { id, expiry_date: null } } = {}) {
  const calls = [];
  const db = { from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const b = { select(c, o) { call.columns = c; call.options = o; return b; }, is(k, v) { call.filters.push(['is', k, v]); return b; }, eq(k, v) { call.filters.push([k, v]); return b; },
      order() { return b; }, range(a, z) { call.range = [a, z]; return b; }, insert(v) { call.insert = v; return b; }, update(v) { call.update = v; return b; },
      single() { return Promise.resolve({ data: { id, ...call.insert }, error: insertError }); },
      maybeSingle() { return Promise.resolve({ data: table === 'restaurants' ? restaurant : call.update ? { id, ...call.update } : current, error: null }); },
      then(resolve, reject) { return Promise.resolve({ data: [{ id }], count: 1, error: null }).then(resolve, reject); } };
    return b;
  } };
  const authClient = { auth: { async getUser(token) { return { data: { user: { id: token === 'admin' ? admin : id } }, error: null }; } } };
  const server = createAdminApp({ db, authClient, media: {}, admins: new Set([admin]) }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise(r => server.close(r)));
  return { calls, request: (path, method = 'GET', body, token = 'admin') => fetch('http://127.0.0.1:' + server.address().port + '/api/admin' + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }) };
}
test('payload normalizes code, forces public voucher and rejects bad input', () => {
  const row = voucherPayload(base);
  assert.equal(row.code, 'GIAMMON20K'); assert.equal(row.reward_owner_id, null);
  for (const change of [{ code: 'ab' }, { discount_value: -1 }, { discount_value: 1.5 }, { discount_type: 'percentage', discount_value: 101 }, { restaurant_id: 'bad' }, { expiry_date: '2020-01-01T00:00:00.000Z' }, { expiry_date: '2030-01-01T00:00:00' }, { applies_to: 'all' }, { is_active: 'true' }, { reward_owner_id: id }, { id }])
    assert.equal(voucherPayload({ ...base, ...change }), null, JSON.stringify(change));
  assert.equal(voucherPayload({ ...base, discount_type: 'percentage', discount_value: 100, applies_to: 'shipping' }).discount_value, 100);
});
test('voucher routes require admin before touching tables', async t => {
  const { request, calls } = await setup(t);
  for (const [path, method, body] of [['/vouchers', 'GET'], ['/vouchers', 'POST', base], ['/vouchers/' + id + '/status', 'PATCH', { is_active: true }]]) assert.equal((await request(path, method, body, 'customer')).status, 403);
  assert.equal(calls.length, 0);
});
test('create inserts only the whitelisted public voucher', async t => {
  const { request, calls } = await setup(t);
  assert.equal((await request('/vouchers', 'POST', base)).status, 201);
  const saved = calls.find(c => c.insert).insert;
  assert.equal(saved.code, 'GIAMMON20K'); assert.equal(saved.reward_owner_id, null); assert.equal(saved.is_active, false);
  assert.equal((await request('/vouchers', 'POST', { ...base, reward_owner_id: id })).status, 400);
});
test('restaurant scope must exist and duplicate codes return 409', async t => {
  assert.equal((await (await setup(t, { restaurant: null })).request('/vouchers', 'POST', { ...base, restaurant_id: id })).status, 400);
  assert.equal((await (await setup(t, { insertError: { code: '23505' } })).request('/vouchers', 'POST', base)).status, 409);
});
test('list only reads public vouchers and validates page', async t => {
  const { request, calls } = await setup(t);
  assert.equal((await request('/vouchers?page=1')).status, 200);
  const c = calls.find(x => x.table === 'vouchers');
  assert.deepEqual(c.filters, [['is', 'reward_owner_id', null]]); assert.deepEqual(c.range, [50, 99]);
  assert.equal((await request('/vouchers?page=-1')).status, 400);
});
test('status toggle accepts only is_active and refuses reactivating expired codes', async t => {
  const ok = await setup(t);
  assert.equal((await ok.request('/vouchers/' + id + '/status', 'PATCH', { is_active: false })).status, 200);
  assert.deepEqual(ok.calls.find(c => c.update).update, { is_active: false });
  assert.equal((await ok.request('/vouchers/' + id + '/status', 'PATCH', { is_active: true, code: 'X' })).status, 400);
  const expired = await setup(t, { current: { id, expiry_date: '2020-01-01T00:00:00.000Z' } });
  assert.equal((await expired.request('/vouchers/' + id + '/status', 'PATCH', { is_active: true })).status, 409);
});
