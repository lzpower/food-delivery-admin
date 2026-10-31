import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createAdminApp } from '../server/app.mjs';
import sharp from 'sharp';
import { createMedia } from '../server/media.mjs';
const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#008844' } }).png().toBuffer();
function imageForm(payload, bytes = png, type = 'image/png') { const form = new FormData(); form.append('payload', JSON.stringify(payload)); form.append('image', new Blob([bytes], { type }), 'image.png'); return form; }
const admin = '11111111-1111-4111-8111-111111111111', id = '22222222-2222-4222-8222-222222222222';
async function setup(t, { failProvision = false, marker = true, uploadError = false, mediaReady = true, insertError = null } = {}) {
  const calls = [];
  const db = { auth: { admin: {
    async createUser(args) { calls.push({ auth: 'create', args }); return { data: { user: { id, app_metadata: args.app_metadata } }, error: null }; },
    async getUserById() { calls.push({ auth: 'get' }); return { data: { user: { id, app_metadata: { subifood_driver_provisioning: marker } } }, error: null }; },
  } }, from(table) {
    const call = { table, filters: [] }; calls.push(call);
    const b = { select() { return b; }, eq(k, v) { call.filters.push([k, v]); return b; }, order() { return b; }, limit() { return b; },
      update(v) { call.update = v; return b; }, upsert(v, opts) { call.upsert = v; call.options = opts; return b; }, insert(v) { call.insert = v; return b; },
      single() { return Promise.resolve({ data: { id }, error: failProvision && table === 'profiles' ? { code: 'XX000' } : call.insert ? insertError : null }); },
      maybeSingle() { return Promise.resolve({ data: { id }, error: null }); },
      then(resolve, reject) { return Promise.resolve({ data: [{ user_id: id }], error: null }).then(resolve, reject); },
    }; return b;
  } };
  const authClient = { auth: { async getUser(token) { return { data: { user: { id: token === 'admin' ? admin : id } }, error: null }; } } };
  const media = { ready: mediaReady, async upload(bytes, kind, entityId) { if (uploadError) throw Error('private B2 key error'); calls.push({ media: 'upload', bytes: bytes.length, kind, entityId }); return { key: 'new-unique-object', url: 'https://cdn.example/images/new.webp' }; }, async remove(upload) { calls.push({ media: 'remove', key: upload.key }); } };
  const server = createAdminApp({ db, authClient, media, admins: new Set([admin]) }).listen(0, '127.0.0.1');
  await once(server, 'listening'); t.after(() => new Promise(resolve => server.close(resolve)));
  return { calls, request: (path, body, token = 'admin') => fetch('http://127.0.0.1:' + server.address().port + '/api/admin' + path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + token, ...(body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }) }) };
}
const food = { restaurant_id: id, category_id: null, name: 'Cơm gà', description: null, price: 40000, original_price: 50000, image_url: 'https://images.example/food.png', is_available: true };
test('new management endpoints reject ordinary users before touching Auth or tables', async t => {
  const { request, calls } = await setup(t);
  for (const path of ['/driver-accounts', '/foods', '/driver-accounts/' + id + '/approve']) assert.equal((await request(path, {}, 'customer')).status, 403);
  assert.equal(calls.length, 0);
});
test('food writes only whitelisted fields and preserves VND discount prices', async t => {
  const { request, calls } = await setup(t);
  assert.equal((await request('/foods', imageForm({ ...food, id: admin, sold_count: 999, role: 'admin' }))).status, 201);
  const saved = calls.find(c => c.insert).insert;
  assert.equal(saved.price, 40000); assert.equal(saved.original_price, 50000);
  assert.equal(saved.image_url, 'https://cdn.example/images/new.webp'); assert.notEqual(saved.id, admin);
  assert.equal(saved.role, undefined); assert.equal(saved.sold_count, undefined);
});
test('invalid prices, image protocols and foreign IDs cannot reach food insert', async t => {
  const { request, calls } = await setup(t);
  for (const change of [{ price: -1 }, { price: '40000' }, { original_price: 30000 }, { image_url: 'javascript:alert(1)' }, { restaurant_id: 'bad' }, { is_available: 'true' }]) assert.equal((await request('/foods', imageForm({ ...food, ...change }))).status, 400);
  assert.equal(calls.length, 0);
});
test('driver creation passes phone to Auth trigger and does not auto-approve', async t => {
  const { request, calls } = await setup(t);
  assert.equal((await request('/driver-accounts', { fullName: 'Tài xế thử', email: 'DRIVER@example.com', phone: '0912345678', password: 'LongPassword123!', approval_status: 'approved' })).status, 201);
  const c = calls.find(c => c.auth === 'create');
  assert.equal(c.args.user_metadata.phone, '+84912345678');
  assert.equal(c.args.email, 'driver@example.com');
  assert.equal(c.args.email_confirm, true);
  assert.deepEqual(calls.find(c => c.upsert).upsert, { user_id: id });
  assert.equal(calls.find(c => c.upsert).options.ignoreDuplicates, true);
  assert.deepEqual(calls.find(c => c.update).update, { role: 'driver' });
});
test('driver phone and password validation happens before account creation', async t => {
  const { request, calls } = await setup(t);
  assert.equal((await request('/driver-accounts', { fullName: 'Name', email: 'a@example.com', phone: '0123', password: 'LongPassword123!' })).status, 400);
  assert.equal(calls.length, 0);
});
test('partial Auth success provides recovery UID, not false success or automatic deletion', async t => {
  const { request, calls } = await setup(t, { failProvision: true });
  const r = await request('/driver-accounts', { fullName: 'Name', email: 'a@example.com', phone: '0912345678', password: 'LongPassword123!' });
  assert.equal(r.status, 409); assert.ok((await r.json()).error.includes(id));
  assert.equal(calls.filter(c => c.auth === 'create').length, 1);
});
test('recovery endpoint cannot turn an unrelated customer into a driver', async t => {
  const { request, calls } = await setup(t, { marker: false });
  assert.equal((await request('/driver-accounts/' + id + '/setup', {})).status, 409);
  assert.equal(calls.filter(c => c.table).length, 0);
});
test('approval is conditional on pending and cannot overwrite a suspended profile', async t => {
  const { request, calls } = await setup(t);
  assert.equal((await request('/driver-accounts/' + id + '/approve', {})).status, 200);
  const c = calls.find(c => c.table === 'driver_profiles');
  assert.ok(c.filters.some(([k, v]) => k === 'approval_status' && v === 'pending'));
  assert.equal(c.update.approval_status, 'approved');
});
test('upload is mandatory and forged images cannot reach B2 or SQL', async t => {
  const { request, calls } = await setup(t);
  assert.equal((await request('/foods', food)).status, 400);
  assert.equal((await request('/foods', imageForm(food, Buffer.from('<svg onload="alert(1)"></svg>')))).status, 400);
  assert.equal(calls.length, 0);
});
test('new multipart endpoints are protected before image processing', async t => {
  const { request, calls } = await setup(t);
  for (const path of ['/foods', '/restaurants']) assert.equal((await request(path, imageForm(food), 'customer')).status, 403);
  for (const path of ['/foods/' + id + '/option-groups', '/option-groups/' + id + '/items', '/categories']) assert.equal((await request(path, {}, 'customer')).status, 403);
  assert.equal(calls.length, 0);
});
test('B2 failure and missing configuration do not create menu rows', async t => {
  for (const [opts, status] of [[{ uploadError: true }, 502], [{ mediaReady: false }, 503]]) {
    const { request, calls } = await setup(t, opts);
    const r = await request('/foods', imageForm(food)); assert.equal(r.status, status);
    assert.equal(calls.filter(c => c.table).length, 0);
    assert.ok(!(await r.text()).includes('private B2 key'));
  }
});
test('known SQL rejection cleans only the newly uploaded object', async t => {
  const { request, calls } = await setup(t, { insertError: { code: '23503' } });
  assert.equal((await request('/foods', imageForm(food))).status, 409);
  assert.deepEqual(calls.find(c => c.media === 'remove'), { media: 'remove', key: 'new-unique-object' });
});
test('ambiguous database transport error retains image to avoid breaking a possibly committed row', async t => {
  const { request, calls } = await setup(t, { insertError: { code: '' } });
  assert.equal((await request('/foods', imageForm(food))).status, 500);
  assert.equal(calls.some(c => c.media === 'remove'), false);
});
const restaurant = { name: 'Quán thử', address: '24 Đường kiểm thử', latitude: 10.8, longitude: 106.6, is_open: true, is_active: true, opening_hours: '06:00 - 22:00', price_range: '20.000 ₫ - 80.000 ₫', promo_tags: ['Quán mới'] };
test('restaurant image URL comes from B2 and clients cannot forge rating or ID', async t => {
  const { request, calls } = await setup(t);
  assert.equal((await request('/restaurants', imageForm({ ...restaurant, id: admin, rating: 5 }))).status, 201);
  const row = calls.find(c => c.table === 'restaurants').insert;
  assert.equal(row.image_url, 'https://cdn.example/images/new.webp'); assert.equal(row.rating, 0); assert.notEqual(row.id, admin);
  assert.equal(row.longitude, 106.6);
});
test('restaurant coordinates must be numeric and in geographic bounds', async t => {
  const { request, calls } = await setup(t);
  for (const change of [{ latitude: 91 }, { longitude: null }, { latitude: '10.8' }]) assert.equal((await request('/restaurants', imageForm({ ...restaurant, ...change }))).status, 400);
  assert.equal(calls.length, 0);
});
test('option endpoints store group rules and VND extras with allowed fields only', async t => {
  const { request, calls } = await setup(t);
  assert.equal((await request('/foods/' + id + '/option-groups', { name: 'Size', is_required: true, allow_multiple: false, food_id: admin })).status, 201);
  assert.deepEqual(calls.find(c => c.table === 'food_option_groups').insert, { food_id: id, name: 'Size', is_required: true, allow_multiple: false });
  assert.equal((await request('/option-groups/' + id + '/items', { name: 'L', extra_price: 5000 })).status, 201);
  assert.deepEqual(calls.find(c => c.table === 'food_option_items').insert, { group_id: id, name: 'L', extra_price: 5000 });
  assert.equal((await request('/option-groups/' + id + '/items', { name: 'L', extra_price: -1 })).status, 400);
});
test('S3 uploader uses configured bucket, unique keys, Cloudflare URL and exact version cleanup', async () => {
  const sent = [];
  const media = createMedia({ B2_KEY_ID: 'test', B2_APPLICATION_KEY: 'test', B2_BUCKET: 'assets', B2_ENDPOINT: 'https://s3.us-east-005.backblazeb2.com', IMAGE_PUBLIC_BASE: 'https://cdn.example/file/assets/' }, { async send(cmd) { sent.push(cmd); return { VersionId: 'new-version' }; } });
  const upload = await media.upload(Buffer.from('webp'), 'foods', id);
  assert.equal(sent[0].input.Bucket, 'assets'); assert.equal(sent[0].input.ContentType, 'image/webp');
  assert.match(sent[0].input.Key, new RegExp('^images/foods/' + id + '/[a-f0-9-]+\\.webp$'));
  assert.equal(upload.url, 'https://cdn.example/file/assets/' + upload.key);
  await media.remove(upload); assert.equal(sent[1].input.VersionId, 'new-version'); assert.equal(sent[1].input.Key, upload.key);
});
