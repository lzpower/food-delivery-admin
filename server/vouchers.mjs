const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fields = new Set([
  'code', 'applies_to', 'discount_type', 'discount_value',
  'min_order_value', 'restaurant_id', 'expiry_date', 'is_active',
]);
const money = n => Number.isSafeInteger(n) && n >= 0 && n <= 100000000;

export function voucherPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(k => !fields.has(k))) return null;
  if (typeof input.code !== 'string') return null;
  const code = input.code.trim().toUpperCase();
  const minimum = input.min_order_value ?? 0;
  const restaurant = input.restaurant_id ?? null;
  const expiry = input.expiry_date ?? null;
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)
    || !['food', 'shipping'].includes(input.applies_to)
    || !['fixed', 'percentage'].includes(input.discount_type)
    || typeof input.discount_value !== 'number'
    || !Number.isFinite(input.discount_value) || input.discount_value <= 0
    || (input.discount_type === 'fixed' && !money(input.discount_value))
    || (input.discount_type === 'percentage' && input.discount_value > 100)
    || !money(minimum) || typeof input.is_active !== 'boolean'
    || (restaurant !== null && (typeof restaurant !== 'string' || !uuid.test(restaurant)))) return null;
  if (expiry !== null && (typeof expiry !== 'string'
    || !/(Z|[+-]\d{2}:\d{2})$/i.test(expiry)
    || !Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= Date.now())) return null;
  return {
    code, applies_to: input.applies_to, discount_type: input.discount_type,
    discount_value: input.discount_value, min_order_value: minimum,
    restaurant_id: restaurant,
    expiry_date: expiry === null ? null : new Date(expiry).toISOString(),
    is_active: input.is_active, reward_owner_id: null,
  };
}

export function installVouchers(app, db) {
  app.get('/api/admin/vouchers', async (req, res) => {
    const page = Number(req.query.page ?? 0);
    if (!Number.isInteger(page) || page < 0 || page > 10000)
      return res.status(400).json({ error: 'Trang không hợp lệ.' });
    try {
      const { data, error, count } = await db.from('vouchers')
        .select('*', { count: 'exact' }).is('reward_owner_id', null)
        .order('code').order('id').range(page * 50, page * 50 + 49);
      if (error) throw error;
      res.json({ items: data ?? [], total: count ?? 0, page });
    } catch { res.status(500).json({ error: 'Không tải được voucher.' }); }
  });

  app.post('/api/admin/vouchers', async (req, res) => {
    const row = voucherPayload(req.body);
    if (!row) return res.status(400).json({ error: 'Kiểm tra mã, giá trị giảm, phạm vi và hạn dùng.' });
    try {
      if (row.restaurant_id) {
        const { data, error } = await db.from('restaurants').select('id')
          .eq('id', row.restaurant_id).eq('is_active', true).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(400).json({ error: 'Quán không tồn tại hoặc ngừng hoạt động.' });
      }
      const { data, error } = await db.from('vouchers').insert(row).select('*').single();
      if (error?.code === '23505')
        return res.status(409).json({ error: 'Mã khuyến mãi đã tồn tại. Hãy dùng mã khác.' });
      if (error) throw error;
      res.status(201).json(data);
    } catch { res.status(500).json({ error: 'Không tạo được voucher. Hãy kiểm tra danh sách trước khi thử lại.' }); }
  });

  app.patch('/api/admin/vouchers/:id/status', async (req, res) => {
    if (!uuid.test(req.params.id) || !req.body || Array.isArray(req.body)
      || Object.keys(req.body).length !== 1 || typeof req.body.is_active !== 'boolean')
      return res.status(400).json({ error: 'Thông tin kích hoạt không hợp lệ.' });
    try {
      const { data: current, error: readError } = await db.from('vouchers')
        .select('id,expiry_date').eq('id', req.params.id).is('reward_owner_id', null).maybeSingle();
      if (readError) throw readError;
      if (!current) return res.status(404).json({ error: 'Không tìm thấy voucher công khai.' });
      if (req.body.is_active && current.expiry_date && Date.parse(current.expiry_date) <= Date.now())
        return res.status(409).json({ error: 'Mã đã hết hạn. Hãy tạo mã mới.' });
      const { data, error } = await db.from('vouchers').update({ is_active: req.body.is_active })
        .eq('id', req.params.id).is('reward_owner_id', null).select('*').maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Không tìm thấy voucher.' });
      res.json(data);
    } catch { res.status(500).json({ error: 'Không cập nhật được trạng thái voucher.' }); }
  });
}
