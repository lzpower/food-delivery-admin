const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_GROUPS = 50;
const isPlainObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// Chỉ nhận body { discovery_category_ids: string[], remove_inactive?: boolean }.
export function discoveryPayload(body) {
  if (!isPlainObject(body)) return null;
  const keys = Object.keys(body);
  if (!keys.includes('discovery_category_ids') || keys.some((k) => !['discovery_category_ids', 'remove_inactive'].includes(k))) return null;
  const ids = body.discovery_category_ids;
  if (!Array.isArray(ids) || ids.length > MAX_GROUPS) return null;
  if (ids.some((id) => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(id))) return null;
  if (body.remove_inactive !== undefined && typeof body.remove_inactive !== 'boolean') return null;
  return { ids: [...new Set(ids)], removeInactive: body.remove_inactive === true };
}

export function installDiscovery(app, db, databaseError) {
  const invalidFood = (res) => res.status(400).json({ error: 'Mã món không hợp lệ.' });

  // Nhóm khám phá có thể gán cho món: đọc động từ database, không hard code ở frontend.
  app.get('/api/admin/discovery-groups', async (_req, res) => {
    const { data, error } = await db.from('discovery_categories').select('id,name,kind,is_active,sort_order')
      .eq('kind', 'food').eq('is_active', true).order('sort_order').order('id');
    if (error) return databaseError(res, error);
    res.json(data || []);
  });

  // Nhóm đã chọn cho đúng một món, kèm liên kết tới nhóm đã tắt/không dành cho món để UI cảnh báo.
  app.get('/api/admin/foods/:foodId/discovery-groups', async (req, res) => {
    const foodId = req.params.foodId;
    if (!uuid.test(foodId)) return invalidFood(res);
    const food = await db.from('foods').select('id').eq('id', foodId).maybeSingle();
    if (food.error) return databaseError(res, food.error);
    if (!food.data) return res.status(404).json({ error: 'Không tìm thấy món. Hãy tải lại danh sách.' });
    const links = await db.from('food_discovery_categories').select('discovery_category_id').eq('food_id', foodId);
    if (links.error) return databaseError(res, links.error);
    const linked = [...new Set((links.data || []).map((x) => x.discovery_category_id))];
    if (!linked.length) return res.json({ food_id: foodId, selected_ids: [], inactive_links: [] });
    const meta = await db.from('discovery_categories').select('id,name,kind,is_active').in('id', linked);
    if (meta.error) return databaseError(res, meta.error);
    const byId = new Map((meta.data || []).map((x) => [x.id, x]));
    const selected = [], inactive = [];
    for (const id of linked) {
      const g = byId.get(id);
      if (g && g.kind === 'food' && g.is_active) selected.push(id);
      else inactive.push({ id, name: g?.name || id });
    }
    res.json({ food_id: foodId, selected_ids: selected, inactive_links: inactive });
  });

  // Nhóm khám phá của các món trong một quán, để hiện nhãn trên thẻ món.
  app.get('/api/admin/discovery-links', async (req, res) => {
    const restaurantId = req.query.restaurantId;
    if (typeof restaurantId !== 'string' || !uuid.test(restaurantId)) return res.status(400).json({ error: 'Chọn quán hợp lệ.' });
    const foods = await db.from('foods').select('id').eq('restaurant_id', restaurantId).order('created_at', { ascending: false }).limit(200);
    if (foods.error) return databaseError(res, foods.error);
    const foodIds = (foods.data || []).map((x) => x.id);
    if (!foodIds.length) return res.json({});
    const links = await db.from('food_discovery_categories').select('food_id,discovery_category_id').in('food_id', foodIds);
    if (links.error) return databaseError(res, links.error);
    const map = {};
    for (const l of links.data || []) (map[l.food_id] ||= []).push(l.discovery_category_id);
    res.json(map);
  });

  // Thay toàn bộ liên kết của món trong một giao dịch (RPC chỉ dành cho service_role).
  app.put('/api/admin/foods/:foodId/discovery-groups', async (req, res) => {
    const foodId = req.params.foodId;
    if (!uuid.test(foodId)) return invalidFood(res);
    const payload = discoveryPayload(req.body);
    if (!payload) return res.status(400).json({ error: 'Danh sách nhóm khám phá không hợp lệ.' });
    const { data, error } = await db.rpc('admin_set_food_discovery_groups', {
      p_food_id: foodId,
      p_discovery_category_ids: payload.ids,
      p_remove_inactive: payload.removeInactive,
    });
    if (error) {
      if (error.code === 'P0002') return res.status(404).json({ error: 'Không tìm thấy món. Hãy tải lại danh sách.' });
      return databaseError(res, error);
    }
    res.json({ food_id: foodId, selected_ids: Array.isArray(data) ? data : payload.ids, message: 'Đã lưu nhóm khám phá.' });
  });
}
