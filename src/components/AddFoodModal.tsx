import { useEffect, useRef, useState } from 'react';
import { adminApi } from '../services/adminApi';
import type { Database } from '../types/database.types';
import { ImagePicker } from './ImagePicker';
import { FoodOptions } from './FoodOptions';
import { DiscoveryBadges, DiscoveryModal, DiscoveryPicker } from './DiscoveryGroups';
import type { DiscoveryGroup } from './DiscoveryGroups';
type Food = Database['public']['Tables']['foods']['Row'];
type Lookup = { id: string; name: string };
const field = 'mt-1 w-full rounded-lg border p-3';
const button = 'rounded-lg bg-emerald-700 px-4 py-2.5 text-white disabled:opacity-50';
const money = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
export function AddFoodModal() {
  const [lookups, setLookups] = useState<{ restaurants: Lookup[]; categories: Lookup[] }>({ restaurants: [], categories: [] });
  const [restaurant, setRestaurant] = useState(''), [foods, setFoods] = useState<Food[]>([]), [reload, setReload] = useState(0), [lookupReload, setLookupReload] = useState(0);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [name, setName] = useState(''), [description, setDescription] = useState(''), [category, setCategory] = useState(''), [price, setPrice] = useState(''), [original, setOriginal] = useState(''), [image, setImage] = useState(''), [available, setAvailable] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null), [optionsFood, setOptionsFood] = useState<Food | null>(null), [newCategory, setNewCategory] = useState('');
  const lock = useRef(false); const [pendingFood, setPendingFood] = useState('');
  const [groups, setGroups] = useState<DiscoveryGroup[]>([]), [groupsError, setGroupsError] = useState(''), [links, setLinks] = useState<Record<string, string[]>>({}), [linksError, setLinksError] = useState('');
  const [newGroups, setNewGroups] = useState<string[]>([]), [discoveryFood, setDiscoveryFood] = useState<{ id: string; name: string; notice?: string } | null>(null);
  useEffect(() => { const c = new AbortController(); adminApi<DiscoveryGroup[]>('/api/admin/discovery-groups', { signal: c.signal }).then(r => { setGroups(r); setGroupsError(''); }).catch(e => { if (!c.signal.aborted) setGroupsError(e.message); }); return () => c.abort(); }, [lookupReload]);
  useEffect(() => {
    if (!restaurant) return;
    const c = new AbortController(); setLinks({}); setLinksError('');
    adminApi<Record<string, string[]>>('/api/admin/discovery-links?restaurantId=' + encodeURIComponent(restaurant), { signal: c.signal }).then(setLinks).catch(e => { if (!c.signal.aborted) setLinksError(e.message); });
    return () => c.abort();
  }, [restaurant, reload]);
  useEffect(() => { const c = new AbortController(); adminApi<typeof lookups>('/api/admin/food-lookups', { signal: c.signal }).then(setLookups).catch(e => { if (!c.signal.aborted) setError(e.message); }); return () => c.abort(); }, [lookupReload]);
  useEffect(() => {
    if (!restaurant) return;
    const c = new AbortController(); setLoading(true); setFoods([]);
    adminApi<Food[]>('/api/admin/foods?restaurantId=' + encodeURIComponent(restaurant), { signal: c.signal }).then(setFoods).catch(e => { if (!c.signal.aborted) setError(e.message); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [restaurant, reload]);
  async function save() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    const payload: Database['public']['Tables']['foods']['Insert'] = { restaurant_id: restaurant, category_id: category || null, name: name.trim(), description: description.trim() || null, price: Number(price), original_price: original === '' ? null : Number(original), image_url: image.trim() || null, is_available: available };
    try {
      if (!imageFile) throw new Error('Chọn ảnh món để upload lên B2.');
      const form = new FormData(); form.append('payload', JSON.stringify(payload)); form.append('image', imageFile);
      const r = await adminApi<{ id: string; message: string }>('/api/admin/foods', { method: 'POST', body: form }); setMessage(r.message); setOpen(false);
      if (newGroups.length) {
        try {
          const g = await adminApi<{ selected_ids: string[] }>('/api/admin/foods/' + r.id + '/discovery-groups', { method: 'PUT', body: JSON.stringify({ discovery_category_ids: newGroups }) });
          setLinks(x => ({ ...x, [r.id]: g.selected_ids }));
        } catch { setMessage('Món đã tạo nhưng chưa lưu nhóm khám phá. Hãy thử lại bên dưới, không tạo món lần nữa.'); setDiscoveryFood({ id: r.id, name: payload.name, notice: 'Món đã tạo nhưng chưa lưu nhóm khám phá. Bấm Lưu phân loại để thử lại.' }); }
      }
      setNewGroups([]); setName(''); setDescription(''); setPrice(''); setOriginal(''); setImage(''); setImageFile(null); setCategory(''); setAvailable(true); setReload(x => x + 1);
    }
    catch (e) { setError(e instanceof Error ? e.message : 'Chưa lưu được món.'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function toggleAvailable(f: Food) {
    if (lock.current) return;
    const next = !f.is_available;
    lock.current = true; setPendingFood(f.id); setError(''); setMessage('');
    try {
      const r = await adminApi<{ is_available: boolean; message: string }>('/api/admin/foods/' + f.id + '/availability', { method: 'PATCH', body: JSON.stringify({ is_available: next }) });
      setFoods(list => list.map(x => x.id === f.id ? { ...x, is_available: r.is_available } : x)); setMessage(r.message);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không cập nhật được trạng thái món.'); }
    finally { lock.current = false; setPendingFood(''); }
  }
  return <div className="space-y-5">
    <h2 className="text-2xl font-bold">Thực đơn và thêm món</h2>
    <div className="flex flex-wrap gap-3 items-end"><label className="flex-1 min-w-56">Nhà hàng<select className={field} value={restaurant} onChange={e => { setRestaurant(e.target.value); setError(''); setMessage(''); }}><option value="">-- Chọn nhà hàng --</option>{lookups.restaurants.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label><button className={button} onClick={() => { setError(''); setLookupReload(x => x + 1); setReload(x => x + 1); }}>Làm mới</button><button className={button} disabled={!restaurant} onClick={() => { setError(''); setOpen(true); }}>+ Thêm món ăn</button></div>
    {!open && error && <p role="alert" className="p-4 bg-red-50 text-red-700 rounded-xl">{error}</p>}
    {message && <p role="status" className="p-4 bg-green-50 text-green-800 rounded-xl">{message}</p>}
    {!restaurant ? <p>Chọn quán để xem thực đơn và thêm món.</p> : loading ? <p>Đang tải thực đơn…</p> : <><p className="text-sm text-slate-500">{foods.length} món · Hiển thị tối đa 200 món mới nhất của quán.</p>{linksError && <p role="alert" className="text-sm text-amber-700">Chưa tải được nhóm khám phá của món: {linksError}</p>}<div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{foods.map(f => <article key={f.id} className="rounded-xl border bg-white p-4 flex gap-3">{f.image_url && <img className="w-20 h-20 rounded-lg object-cover" src={f.image_url} alt="" referrerPolicy="no-referrer" />}<div><h3 className="font-semibold">{f.name}</h3><p className="text-sm text-slate-500">{lookups.categories.find(c => c.id === f.category_id)?.name || 'Chưa phân loại'}</p><DiscoveryBadges ids={links[f.id]} groups={groups} /><button type="button" className="mt-2 mr-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm" aria-label={'Phân loại khám phá ' + f.name} onClick={() => setDiscoveryFood({ id: f.id, name: f.name })}>Phân loại khám phá</button><p className="text-orange-600 font-semibold">{money(f.price)} {f.original_price != null && f.original_price > f.price && <del className="text-slate-400 text-sm font-normal">{money(f.original_price)}</del>}</p><p className={'text-xs font-medium ' + (f.is_available ? 'text-emerald-700' : 'text-red-600')}>{f.is_available ? 'Đang bán' : 'Hết món'}</p><button type="button" className={'mt-2 rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 ' + (f.is_available ? 'border-red-300 text-red-700' : 'border-emerald-600 text-emerald-700')} disabled={pendingFood === f.id} aria-label={(f.is_available ? 'Báo hết món ' : 'Mở bán lại ') + f.name} onClick={() => void toggleAvailable(f)}>{pendingFood === f.id ? 'Đang cập nhật…' : f.is_available ? 'Báo hết món' : 'Mở bán lại'}</button></div></article>)}</div></>}
    {open && <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="food-title" className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-6 w-full max-w-2xl"><form className="space-y-4" onSubmit={e => { e.preventDefault(); void save(); }}>
      <div className="flex justify-between"><h3 id="food-title" className="text-xl font-bold">Thêm món ăn</h3><button type="button" disabled={busy} onClick={() => setOpen(false)} aria-label="Đóng">✕</button></div>
      <p className="text-sm text-slate-500">{lookups.restaurants.find(r => r.id === restaurant)?.name}</p>
      {error && <p role="alert" className="text-red-700 bg-red-50 p-3 rounded-lg">{error}</p>}
      <label className="block">Tên món<input autoFocus className={field} required maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="block">Danh mục<select className={field} value={category} onChange={e => setCategory(e.target.value)}><option value="">Chưa phân loại</option>{lookups.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <div className="grid sm:grid-cols-2 gap-4"><label>Giá bán (VND)<input className={field} required type="number" min="0" max="100000000" step="1" value={price} onChange={e => setPrice(e.target.value)} /></label><label>Giá gốc (không bắt buộc)<input className={field} type="number" min={Number(price) + 1} max="100000000" step="1" value={original} onChange={e => setOriginal(e.target.value)} /></label></div>
      <label className="block">Mô tả<textarea className={field} maxLength={3000} rows={3} value={description} onChange={e => setDescription(e.target.value)} /></label>
      <ImagePicker file={imageFile} onChange={setImageFile} disabled={busy} />
      <p className="text-xs text-slate-500">Để trống giá gốc nếu món không giảm giá.</p>
      <DiscoveryPicker groups={groups} selected={newGroups} onChange={setNewGroups} disabled={busy} loading={!groups.length && !groupsError} error={groupsError} />
      <label className="flex gap-2"><input type="checkbox" checked={available} onChange={e => setAvailable(e.target.checked)} />Đang bán</label>
      <div className="flex gap-3"><button className={button} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu món ăn'}</button><button type="button" className="rounded-lg border px-4 py-2" disabled={busy} onClick={() => setOpen(false)}>Hủy</button></div>
    </form></section></div>}
    {discoveryFood && <DiscoveryModal key={discoveryFood.id} food={discoveryFood} groups={groups} groupsError={groupsError} notice={discoveryFood.notice} onClose={() => setDiscoveryFood(null)} onSaved={(id, ids, msg) => { setLinks(x => ({ ...x, [id]: ids })); setMessage(msg); setDiscoveryFood(null); }} />}
    {optionsFood && <FoodOptions key={optionsFood.id} foodId={optionsFood.id} foodName={optionsFood.name} onClose={() => setOptionsFood(null)} />}
    <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-medium">Thêm danh mục thực đơn</summary><form className="mt-3 flex gap-3" onSubmit={async e => { e.preventDefault(); if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { const r = await adminApi<{ message: string }>('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name: newCategory }) }); setMessage(r.message); setNewCategory(''); setLookupReload(x => x + 1); } catch (e) { setError(e instanceof Error ? e.message : 'Không thêm được danh mục.'); } finally { lock.current = false; setBusy(false); } }}><input className={field} aria-label="Tên danh mục mới" required maxLength={100} value={newCategory} onChange={e => setNewCategory(e.target.value)} /><button className={button} disabled={busy}>Thêm danh mục</button></form></details>
    {restaurant && !loading && foods.length > 0 && <section className="rounded-xl border bg-white p-4 space-y-3"><h3 className="font-semibold">Cấu hình Size / Topping</h3><label className="block">Chọn món để thêm nhóm và lựa chọn<select className={field} value="" onChange={e => setOptionsFood(foods.find(f => f.id === e.target.value) || null)}><option value="">-- Chọn món cần cấu hình --</option>{foods.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label></section>}
  </div>;
}
