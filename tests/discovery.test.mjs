import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createAdminApp } from '../server/app.mjs';
import { discoveryPayload } from '../server/discovery.mjs';
const admin = '11111111-1111-4111-8111-111111111111', food = '22222222-2222-4222-8222-222222222222', rest = '33333333-3333-4333-8333-333333333333';
async function setup(t, { rows = {}, rpc = { data: ['com', 'mon-chay'], error: null } } = {}) {
  const calls = [];
  const db = {
    async rpc(name, args) { calls.push({ rpc: name, args }); return rpc; },
    from(table) {
      const call = { table, filters: [] }; calls.push(call);
      const result = () => ({ data: rows[table] ?? [], error: null });
      const b = { select(c) { call.columns = c; return b; }, eq(k, v) { call.filters.push([k, v]); return b; }, in(k, v) { call.filters.push([k, v]); return b; }, order() { return b; }, limit() { return b; },
        maybeSingle() { const r = result(); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: null }); },
        then(res, rej) { return Promise.resolve(result()).then(res, rej); } };
      return b;
    },
  };
  const authClient = { auth: { async getUser(token) { return { data: { user: { id: token === 'admin' ? admin : food } }, error: null }; } } };
  const server = createAdminApp({ db, authClient, media: {}, admins: new Set([admin]) }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise(r => server.close(r)));
  return { calls, request: (path, method = 'GET', body, token = 'admin') => fetch('http://127.0.0.1:' + server.address().port + '/api/admin' + path, { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }) };
}
test('payload validation rejects unknown keys, non-arrays, odd ids and dedupes', () => {
  assert.deepEqual(discoveryPayload({ discovery_category_ids: ['com', 'com', 'mon-chay'] }), { ids: ['com', 'mon-chay'], removeInactive: false });
  assert.equal(discoveryPayload({ discovery_category_ids: [], remove_inactive: true }).removeInactive, true);
  for (const bad of [null, [], {}, { discovery_category_ids: null }, { discovery_category_ids: 'com' }, { discovery_category_ids: [1] }, { discovery_category_ids: ['A b'] },
    { discovery_category_ids: ['com'], food_id: food }, { discovery_category_ids: ['com'], remove_inactive: 'yes' }, { discovery_category_ids: Array(51).fill('a') }]) assert.equal(discoveryPayload(bad), null);
});
test('discovery endpoints reject ordinary users before touching the database', async t => {
  const { request, calls } = await setup(t);
  for (const [path, method, body] of [['/discovery-groups'], ['/foods/' + food + '/discovery-groups'], ['/discovery-links?restaurantId=' + rest], ['/foods/' + food + '/discovery-groups', 'PUT', { discovery_category_ids: [] }]])
    assert.equal((await request(path, method, body, 'customer')).status, 403);
  assert.equal(calls.length, 0);
});
test('group list only reads active food groups', async t => {
  const { request, calls } = await setup(t, { rows: { discovery_categories: [{ id: 'com', name: 'Cơm' }] } });
  const r = await request('/discovery-groups'); assert.equal(r.status, 200); assert.deepEqual(await r.json(), [{ id: 'com', name: 'Cơm' }]);
  const f = calls[0].filters; assert.deepEqual(f, [['kind', 'food'], ['is_active', true]]);
});
test('food groups separate selectable ids from inactive links and 404 for missing food', async t => {
  const rows = { foods: [{ id: food }], food_discovery_categories: [{ discovery_category_id: 'com' }, { discovery_category_id: 'cu' }], discovery_categories: [{ id: 'com', name: 'Cơm', kind: 'food', is_active: true }, { id: 'cu', name: 'Cũ', kind: 'food', is_active: false }] };
  const { request } = await setup(t, { rows });
  assert.deepEqual(await (await request('/foods/' + food + '/discovery-groups')).json(), { food_id: food, selected_ids: ['com'], inactive_links: [{ id: 'cu', name: 'Cũ' }] });
  assert.equal((await request('/foods/bad/discovery-groups')).status, 400);
  const missing = await setup(t, { rows: { foods: [] } });
  assert.equal((await missing.request('/foods/' + food + '/discovery-groups')).status, 404);
});
test('PUT passes only validated params to the transactional RPC', async t => {
  const { request, calls } = await setup(t);
  const r = await request('/foods/' + food + '/discovery-groups', 'PUT', { discovery_category_ids: ['com', 'com', 'mon-chay'] });
  assert.equal(r.status, 200); assert.deepEqual((await r.json()).selected_ids, ['com', 'mon-chay']);
  assert.deepEqual(calls, [{ rpc: 'admin_set_food_discovery_groups', args: { p_food_id: food, p_discovery_category_ids: ['com', 'mon-chay'], p_remove_inactive: false } }]);
  assert.equal(calls.some(c => c.table), false);
});
test('PUT accepts empty list, rejects bad bodies and maps RPC errors without hitting tables', async t => {
  const { request, calls } = await setup(t, { rpc: { data: [], error: null } });
  assert.equal((await request('/foods/' + food + '/discovery-groups', 'PUT', { discovery_category_ids: [] })).status, 200);
  assert.equal((await request('/foods/' + food + '/discovery-groups', 'PUT', { discovery_category_ids: ['quan-moi'], food_id: admin })).status, 400);
  assert.equal(calls.length, 1);
  for (const [error, status] of [[{ code: 'P0001', message: 'Món còn liên kết với nhóm đã tắt.' }, 409], [{ code: 'P0002', message: 'x' }, 404], [{ code: 'XX000', message: 'secret' }, 500]]) {
    const s = await setup(t, { rpc: { data: null, error } });
    const r = await s.request('/foods/' + food + '/discovery-groups', 'PUT', { discovery_category_ids: ['com'] }); assert.equal(r.status, status);
    assert.ok(!(await r.text()).includes('secret'));
  }
});
test('discovery links are grouped by food for one restaurant', async t => {
  const { request } = await setup(t, { rows: { foods: [{ id: food }], food_discovery_categories: [{ food_id: food, discovery_category_id: 'com' }, { food_id: food, discovery_category_id: 'mon-chay' }] } });
  assert.deepEqual(await (await request('/discovery-links?restaurantId=' + rest)).json(), { [food]: ['com', 'mon-chay'] });
  assert.equal((await request('/discovery-links')).status, 400);
});
