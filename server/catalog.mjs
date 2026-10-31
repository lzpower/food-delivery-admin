import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { imageBuffer, MAX_IMAGE_BYTES } from './media.mjs';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validText = (v, min, max) => typeof v === 'string' && v.trim().length >= min && v.trim().length <= max;
export function restaurantPayload(b) {
  if (!b || !validText(b.name, 2, 200) || !validText(b.address, 5, 500)) return null;
  if (!Number.isFinite(b.latitude) || Math.abs(b.latitude) > 90 || !Number.isFinite(b.longitude) || Math.abs(b.longitude) > 180) return null;
  if (typeof b.is_open !== 'boolean' || typeof b.is_active !== 'boolean' || !validText(b.opening_hours, 0, 100) || !validText(b.price_range, 0, 100)) return null;
  if (!Array.isArray(b.promo_tags) || b.promo_tags.length > 10 || b.promo_tags.some(t => !validText(t, 1, 80))) return null;
  return { name: b.name.trim(), address: b.address.trim(), latitude: b.latitude, longitude: b.longitude, is_open: b.is_open, is_active: b.is_active, opening_hours: b.opening_hours.trim(), price_range: b.price_range.trim(), promo_tags: [...new Set(b.promo_tags.map(t => t.trim()))], rating: 0 };
}
export function installCatalog(app, db, databaseError, media, foodPayload) {
  const parseFile = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 1, fieldSize: 32768, parts: 2 } }).single('image');
  app.get('/api/admin/media-status', (_req, res) => res.json({ ready: !!media?.ready }));
  function createImageRoute(path, table, validate) {
    app.post(path, (req, res, next) => {
      if (!req.is('multipart/form-data')) return res.status(400).json({ error: 'Chọn tệp ảnh để upload lên B2 cùng thông tin cần lưu.' });
      parseFile(req, res, error => error ? res.status(400).json({ error: 'Chỉ nhận một ảnh JPG/PNG/WebP tối đa 8 MB và thông tin hợp lệ.' }) : next());
    }, async (req, res) => {
      let body;
      try { body = JSON.parse(req.body?.payload); } catch { return res.status(400).json({ error: 'Thông tin gửi lên không hợp lệ.' }); }
      const row = validate(body);
      if (!row) return res.status(400).json({ error: table === 'foods' ? 'Kiểm tra tên món, quán, danh mục, giá VND và giá gốc lớn hơn giá bán.' : 'Kiểm tra tên quán, địa chỉ, tọa độ và các trường thông tin quán.' });
      if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn ảnh.' });
      if (!media?.ready) return res.status(503).json({ error: 'Backend chưa cấu hình đủ B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET, B2_ENDPOINT, IMAGE_PUBLIC_BASE.' });
      let bytes;
      try { bytes = await imageBuffer(req.file.buffer); } catch { return res.status(400).json({ error: 'Không đọc được ảnh. Chọn JPG, PNG hoặc WebP tĩnh, tối đa 8 MB / 25 triệu điểm ảnh.' }); }
      const id = randomUUID(); let upload;
      try { upload = await media.upload(bytes, table, id); } catch { return res.status(502).json({ error: 'Upload B2 thất bại. Chưa tạo bản ghi. Kiểm tra cấu hình S3 và quyền ghi bucket.' }); }
      const { data, error } = await db.from(table).insert({ ...row, id, image_url: upload.url }).select('id').single();
      if (error) {
        if (/^(22|23|42|P0)/.test(error.code || '')) { try { await media.remove(upload); } catch { /* Only this newly uploaded object may need operator cleanup. */ } }
        if (error.code === '23503') return res.status(409).json({ error: 'Quán hoặc danh mục không tồn tại. Hãy tải lại danh sách.' });
        return databaseError(res, error);
      }
      res.status(201).json({ id: data.id, image_url: upload.url, message: table === 'foods' ? 'Đã thêm món và lưu ảnh qua Cloudflare.' : 'Đã thêm nhà hàng và lưu ảnh qua Cloudflare.' });
    });
  }
  createImageRoute('/api/admin/foods', 'foods', foodPayload);
  createImageRoute('/api/admin/restaurants', 'restaurants', restaurantPayload);
  app.get('/api/admin/restaurants', async (_req, res) => {
    const { data, error } = await db.from('restaurants').select('id,name,address,latitude,longitude,image_url,is_open,is_active,opening_hours,promo_tags').order('created_at', { ascending: false }).limit(500);
    if (error) return databaseError(res, error); res.json(data || []);
  });
  app.post('/api/admin/categories', async (req, res) => {
    if (!validText(req.body?.name, 1, 100)) return res.status(400).json({ error: 'Tên danh mục cần 1–100 ký tự.' });
    const name = req.body.name.trim();
    const existing = await db.from('categories').select('id,name').eq('name', name).limit(1);
    if (existing.error) return databaseError(res, existing.error);
    if (existing.data?.length) return res.json({ ...existing.data[0], message: 'Danh mục đã tồn tại.' });
    const { data, error } = await db.from('categories').insert({ name }).select('id,name').single();
    if (error) return databaseError(res, error); res.status(201).json({ ...data, message: 'Đã thêm danh mục.' });
  });
  app.get('/api/admin/foods/:id/options', async (req, res) => {
    if (!uuid.test(req.params.id)) return res.status(400).json({ error: 'Mã món không hợp lệ.' });
    const { data, error } = await db.from('food_option_groups').select('id,name,is_required,allow_multiple,food_option_items(id,name,extra_price)').eq('food_id', req.params.id).order('id');
    if (error) return databaseError(res, error); res.json(data || []);
  });
  app.post('/api/admin/foods/:id/option-groups', async (req, res) => {
    const b = req.body || {};
    if (!uuid.test(req.params.id) || !validText(b.name, 1, 100) || typeof b.is_required !== 'boolean' || typeof b.allow_multiple !== 'boolean') return res.status(400).json({ error: 'Tên nhóm, món ăn hoặc quy tắc chọn không hợp lệ.' });
    const { data, error } = await db.from('food_option_groups').insert({ food_id: req.params.id, name: b.name.trim(), is_required: b.is_required, allow_multiple: b.allow_multiple }).select('id').single();
    if (error) return databaseError(res, error); res.status(201).json({ id: data.id, message: 'Đã tạo nhóm. Hãy thêm các lựa chọn bên dưới.' });
  });
  app.post('/api/admin/option-groups/:id/items', async (req, res) => {
    const b = req.body || {};
    if (!uuid.test(req.params.id) || !validText(b.name, 1, 100) || !Number.isSafeInteger(b.extra_price) || b.extra_price < 0 || b.extra_price > 100000000) return res.status(400).json({ error: 'Tên lựa chọn hoặc giá cộng thêm VND không hợp lệ.' });
    const { data, error } = await db.from('food_option_items').insert({ group_id: req.params.id, name: b.name.trim(), extra_price: b.extra_price }).select('id').single();
    if (error) return databaseError(res, error); res.status(201).json({ id: data.id, message: 'Đã thêm lựa chọn.' });
  });
}
