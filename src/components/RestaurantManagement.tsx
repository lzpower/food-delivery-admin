import { useEffect, useRef, useState } from 'react';
import { adminApi } from '../services/adminApi';
import { ImagePicker } from './ImagePicker';
import type { Database } from '../types/database.types';
type Restaurant = Pick<Database['public']['Tables']['restaurants']['Row'], 'id' | 'name' | 'address' | 'image_url' | 'is_open' | 'is_active' | 'latitude' | 'longitude'>;
const field = 'mt-1 w-full rounded-lg border p-3', button = 'rounded-lg bg-emerald-700 text-white px-4 py-2.5 disabled:opacity-50';
export function RestaurantManagement() {
  const [rows, setRows] = useState<Restaurant[]>([]), [reload, setReload] = useState(0), [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [name, setName] = useState(''), [address, setAddress] = useState(''), [lat, setLat] = useState(''), [lng, setLng] = useState(''), [hours, setHours] = useState(''), [range, setRange] = useState(''), [tags, setTags] = useState('');
  const [active, setActive] = useState(true), [isOpen, setIsOpen] = useState(true), [file, setFile] = useState<File | null>(null), [error, setError] = useState(''), [message, setMessage] = useState(''); const lock = useRef(false); const [pending, setPending] = useState('');
  useEffect(() => { const c = new AbortController(); setLoading(true); adminApi<Restaurant[]>('/api/admin/restaurants', { signal: c.signal }).then(setRows).catch(e => { if (!c.signal.aborted) setError(e.message); }).finally(() => { if (!c.signal.aborted) setLoading(false); }); return () => c.abort(); }, [reload]);
  async function save() {
    if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      if (!file) throw Error('Chọn ảnh nhà hàng để upload lên B2.');
      const payload: Database['public']['Tables']['restaurants']['Insert'] = { name: name.trim(), address: address.trim(), latitude: Number(lat), longitude: Number(lng), opening_hours: hours.trim(), price_range: range.trim(), promo_tags: tags.split(',').map(t => t.trim()).filter(Boolean), is_open: isOpen, is_active: active };
      const form = new FormData(); form.append('payload', JSON.stringify(payload)); form.append('image', file);
      const r = await adminApi<{ message: string }>('/api/admin/restaurants', { method: 'POST', body: form }); setMessage(r.message); setOpen(false); setName(''); setAddress(''); setLat(''); setLng(''); setHours(''); setRange(''); setTags(''); setFile(null); setActive(true); setIsOpen(true); setReload(x => x + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thêm được nhà hàng.'); } finally { lock.current = false; setBusy(false); }
  }
  async function toggleOpen(r: Restaurant) {
    if (lock.current) return;
    const next = !r.is_open;
    if (!next && !window.confirm('Đóng cửa "' + r.name + '"?')) return;
    lock.current = true; setPending(r.id); setError(''); setMessage('');
    try {
      const res = await adminApi<{ is_open: boolean; message: string }>('/api/admin/restaurants/' + r.id + '/open', { method: 'PATCH', body: JSON.stringify({ is_open: next }) });
      setRows(list => list.map(x => x.id === r.id ? { ...x, is_open: res.is_open } : x)); setMessage(res.message);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không cập nhật được trạng thái mở cửa.'); } finally { lock.current = false; setPending(''); }
  }
  return <div className="space-y-5"><div className="flex justify-between gap-3"><h2 className="text-2xl font-bold">Nhà hàng</h2><div className="flex gap-2"><button className={button} onClick={() => { setError(''); setReload(x => x + 1); }}>Làm mới</button><button className={button} onClick={() => { setError(''); setOpen(true); }}>+ Thêm nhà hàng</button></div></div>
    {!open && error && <p role="alert" className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</p>}{message && <p role="status" className="bg-emerald-50 text-emerald-800 p-4 rounded-xl">{message}</p>}
    {loading ? <p>Đang tải nhà hàng…</p> : <><p className="text-sm text-slate-500">{rows.length} quán · Tối đa 500 quán mới nhất.</p><div className="grid md:grid-cols-2 gap-4">{rows.map(r => <article key={r.id} className="border rounded-xl bg-white p-4 flex gap-3">{r.image_url && <img src={r.image_url} alt="" className="w-24 h-24 object-cover rounded-lg" referrerPolicy="no-referrer" />}<div><h3 className="font-semibold">{r.name}</h3><p className="text-sm text-slate-600">{r.address}</p><p className="text-xs text-slate-500">{r.latitude}, {r.longitude}</p><p className={'text-sm font-medium ' + (r.is_open ? 'text-emerald-700' : 'text-red-600')}>{(!r.is_active ? 'Đang ẩn · ' : '') + (r.is_open ? 'Mở cửa' : 'Đóng cửa')}</p><button type="button" className={'mt-2 rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 ' + (r.is_open ? 'border-red-300 text-red-700' : 'border-emerald-600 text-emerald-700')} disabled={pending === r.id} aria-label={(r.is_open ? 'Đóng cửa ' : 'Mở cửa ') + r.name} onClick={() => void toggleOpen(r)}>{pending === r.id ? 'Đang cập nhật…' : r.is_open ? 'Đóng cửa' : 'Mở cửa'}</button></div></article>)}</div></>}
    {open && <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="restaurant-title" className="max-h-[90dvh] overflow-y-auto bg-white rounded-2xl p-6 w-full max-w-2xl"><form className="space-y-4" onSubmit={e => { e.preventDefault(); void save(); }}><div className="flex justify-between"><h3 id="restaurant-title" className="text-xl font-bold">Thêm nhà hàng</h3><button type="button" aria-label="Đóng" disabled={busy} onClick={() => setOpen(false)}>✕</button></div>
      {error && <p role="alert" className="text-red-700 bg-red-50 p-3 rounded-lg">{error}</p>}
      <label className="block">Tên nhà hàng<input autoFocus className={field} required minLength={2} maxLength={200} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="block">Địa chỉ<input className={field} required minLength={5} maxLength={500} value={address} onChange={e => setAddress(e.target.value)} /></label>
      <div className="grid sm:grid-cols-2 gap-4"><label>Vĩ độ<input type="number" required min="-90" max="90" step="any" className={field} value={lat} onChange={e => setLat(e.target.value)} /></label><label>Kinh độ<input type="number" required min="-180" max="180" step="any" className={field} value={lng} onChange={e => setLng(e.target.value)} /></label></div>
      <p className="text-xs text-slate-500">Nhập đúng tọa độ quán để app khách tính khoảng cách và phí giao hàng.</p>
      <div className="grid sm:grid-cols-2 gap-4"><label>Giờ hoạt động<input className={field} maxLength={100} placeholder="06:00 - 22:00" value={hours} onChange={e => setHours(e.target.value)} /></label><label>Khoảng giá (VND)<input className={field} maxLength={100} placeholder="20.000 ₫ - 100.000 ₫" value={range} onChange={e => setRange(e.target.value)} /></label></div>
      <label className="block">Nhãn thông tin (ngăn cách bằng dấu phẩy)<input className={field} maxLength={800} placeholder="Quán mới, Quán trứ danh" value={tags} onChange={e => setTags(e.target.value)} /></label>
      <ImagePicker file={file} onChange={setFile} disabled={busy} />
      <div className="flex gap-5"><label className="flex gap-2"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Hiển thị quán</label><label className="flex gap-2"><input type="checkbox" checked={isOpen} onChange={e => setIsOpen(e.target.checked)} />Đang mở cửa</label></div>
      <button className={button} disabled={busy}>{busy ? 'Đang upload và lưu…' : 'Lưu nhà hàng'}</button>
    </form></section></div>}
  </div>;
}
