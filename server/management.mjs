import { installCatalog } from './catalog.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v, max) => typeof v === 'string' && v.trim().length <= max ? v.trim() : '';
export function normalizePhone(value) {
  let p = text(value, 40).replace(/[\s().-]/g, '');
  if (/^0\d{9}$/.test(p)) p = '+84' + p.slice(1);
  if (!/^\+?[1-9]\d{8,14}$/.test(p)) return null;
  return p.startsWith('+') ? p : '+' + p;
}
export function foodPayload(body) {
  const b = body || {};
  const name = text(b.name, 200), description = text(b.description ?? '', 3000);
  if (!uuid.test(b.restaurant_id || '') || !name || (b.category_id != null && !uuid.test(b.category_id))) return null;
  if (!Number.isSafeInteger(b.price) || b.price < 0 || b.price > 100000000) return null;
  if (b.original_price != null && (!Number.isSafeInteger(b.original_price) || b.original_price <= b.price || b.original_price > 100000000)) return null;
  if (typeof b.is_available !== 'boolean' || typeof (b.description ?? '') !== 'string' || (b.description || '').trim().length > 3000) return null;
  const image = text(b.image_url ?? '', 2048);
  if ((b.image_url && !image)) return null;
  if (image) { try { if (new URL(image).protocol !== 'https:') return null; } catch { return null; } }
  return { restaurant_id: b.restaurant_id, category_id: b.category_id ?? null, name, description: description || null, price: b.price, original_price: b.original_price ?? null, image_url: image || null, is_available: b.is_available };
}
export function installManagement(app, db, databaseError, media) {
  installCatalog(app, db, databaseError, media, foodPayload);
  async function provision(user) {
    // Only accounts explicitly created by this backend may use the retry route.
    if (user.app_metadata?.subifood_driver_provisioning !== true) throw Error('not-provisioned');
    const profile = await db.from('profiles').update({ role: 'driver' }).eq('id', user.id).select('id').single();
    if (profile.error) throw profile.error;
    const result = await db.from('driver_profiles').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });
    if (result.error) throw result.error;
  }
  app.get('/api/admin/driver-accounts', async (_req, res) => {
    const { data, error } = await db.from('profiles').select('id,full_name,phone,driver_profiles(approval_status,vehicle_type,plate_number)').eq('role', 'driver').order('created_at', { ascending: false }).limit(500);
    if (error) return databaseError(res, error);
    res.json(data || []);
  });
  app.post('/api/admin/driver-accounts', async (req, res) => {
    const b = req.body || {}, name = text(b.fullName, 100), email = text(b.email, 254).toLowerCase(), phone = normalizePhone(b.phone);
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !phone || typeof b.password !== 'string' || b.password.length < 12 || Buffer.byteLength(b.password, 'utf8') > 72)
      return res.status(400).json({ error: 'Nhập tên, email, số điện thoại hợp lệ và mật khẩu từ 12 ký tự, tối đa 72 byte.' });
    const { data, error } = await db.auth.admin.createUser({ email, password: b.password, email_confirm: true, user_metadata: { full_name: name, phone }, app_metadata: { subifood_driver_provisioning: true } });
    if (error) return res.status(409).json({ error: 'Không tạo được tài khoản. Kiểm tra email/số điện thoại đã trùng hoặc yêu cầu mật khẩu của Supabase.' });
    try { await provision(data.user); }
    catch { return res.status(409).json({ error: 'Tài khoản đăng nhập đã tạo nhưng hồ sơ tài xế chưa hoàn tất. Dùng chức năng Hoàn tất tài khoản với UID: ' + data.user.id }); }
    res.status(201).json({ id: data.user.id, message: 'Đã tạo tài khoản tài xế chờ duyệt. Email đã được xác nhận; số điện thoại chưa xác minh OTP.' });
  });
  app.post('/api/admin/driver-accounts/:id/setup', async (req, res) => {
    if (!uuid.test(req.params.id)) return res.status(400).json({ error: 'UID không hợp lệ.' });
    const { data, error } = await db.auth.admin.getUserById(req.params.id);
    if (error || data.user?.app_metadata?.subifood_driver_provisioning !== true) return res.status(409).json({ error: 'Chỉ hoàn tất được tài khoản tài xế đã tạo bằng chức năng này.' });
    try { await provision(data.user); } catch { return res.status(409).json({ error: 'Chưa hoàn tất được hồ sơ. Giữ UID và thử lại sau.' }); }
    res.json({ message: 'Đã hoàn tất hồ sơ tài xế. Trạng thái duyệt hiện tại được giữ nguyên.' });
  });
  app.post('/api/admin/driver-accounts/:id/approve', async (req, res) => {
    if (!uuid.test(req.params.id)) return res.status(400).json({ error: 'UID không hợp lệ.' });
    const profile = await db.from('profiles').select('id').eq('id', req.params.id).eq('role', 'driver').maybeSingle();
    if (profile.error) return databaseError(res, profile.error);
    if (!profile.data) return res.status(404).json({ error: 'Không tìm thấy tài xế.' });
    const { data, error } = await db.from('driver_profiles').update({ approval_status: 'approved', updated_at: new Date().toISOString() }).eq('user_id', req.params.id).eq('approval_status', 'pending').select('user_id');
    if (error) return databaseError(res, error);
    if (!data?.length) return res.status(409).json({ error: 'Chỉ duyệt hồ sơ đang chờ. Hãy tải lại danh sách.' });
    res.json({ message: 'Đã duyệt tài xế. Tài xế còn rảnh sẽ xuất hiện trong danh sách phân công.' });
  });
  app.get('/api/admin/food-lookups', async (_req, res) => {
    const [restaurants, categories] = await Promise.all([db.from('restaurants').select('id,name').order('name').limit(1000), db.from('categories').select('id,name').order('name').limit(1000)]);
    if (restaurants.error || categories.error) return databaseError(res, restaurants.error || categories.error);
    res.json({ restaurants: restaurants.data || [], categories: categories.data || [] });
  });
  app.get('/api/admin/foods', async (req, res) => {
    if (typeof req.query.restaurantId !== 'string' || !uuid.test(req.query.restaurantId)) return res.status(400).json({ error: 'Chọn quán hợp lệ.' });
    const { data, error } = await db.from('foods').select('id,restaurant_id,category_id,name,description,price,original_price,image_url,is_available').eq('restaurant_id', req.query.restaurantId).order('created_at', { ascending: false }).limit(200);
    if (error) return databaseError(res, error);
    res.json(data || []);
  });
}
