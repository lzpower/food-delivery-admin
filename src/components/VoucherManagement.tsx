import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '../services/adminApi';
import type { Database } from '../types/database.types';

type Voucher = Database['public']['Tables']['vouchers']['Row'];
type VoucherPage = { items: Voucher[]; total: number; page: number };
type Lookups = { restaurants: { id: string; name: string }[] };
const PAGE_SIZE = 50;
const field = 'mt-1 w-full rounded-lg border p-3';
const button = 'rounded-lg bg-emerald-700 text-white px-4 py-2.5 disabled:opacity-50';
const ghost = 'rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50';
const vnd = new Intl.NumberFormat('vi-VN');
const vnTime = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' });

// Giá trị của <input type="datetime-local"> được hiểu là giờ Việt Nam (UTC+7),
// không phụ thuộc múi giờ của trình duyệt.
function vietnamLocalToIso(value: string): string | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) throw new Error('Hạn dùng không hợp lệ.');
  const date = new Date(`${match[1]}:${match[2] ?? '00'}+07:00`);
  if (Number.isNaN(date.getTime())) throw new Error('Hạn dùng không hợp lệ.');
  return date.toISOString();
}
const digits = (v: string) => v.replace(/\D/g, '');
const formatDiscount = (v: Voucher) => v.discount_type === 'percentage' ? `${v.discount_value}%` : `${vnd.format(v.discount_value)}₫`;

export function VoucherManagement() {
  const [page, setPage] = useState(0), [data, setData] = useState<VoucherPage | null>(null), [loading, setLoading] = useState(true), [reload, setReload] = useState(0);
  const [restaurants, setRestaurants] = useState<Lookups['restaurants']>([]);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [toggling, setToggling] = useState<string | null>(null);
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [formError, setFormError] = useState('');
  const [code, setCode] = useState(''), [appliesTo, setAppliesTo] = useState<'food' | 'shipping'>('food'), [type, setType] = useState<'fixed' | 'percentage'>('fixed');
  const [value, setValue] = useState(''), [minimum, setMinimum] = useState(''), [restaurantId, setRestaurantId] = useState(''), [expiry, setExpiry] = useState(''), [active, setActive] = useState(false);
  const lock = useRef(false), toggleLock = useRef(false);

  useEffect(() => {
    const c = new AbortController(); setLoading(true); setError('');
    adminApi<VoucherPage>(`/api/admin/vouchers?page=${page}`, { signal: c.signal }).then(setData)
      .catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Không tải được voucher.'); })
      .finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [page, reload]);
  useEffect(() => {
    const c = new AbortController();
    adminApi<Lookups>('/api/admin/food-lookups', { signal: c.signal }).then(r => setRestaurants(r.restaurants)).catch(() => undefined);
    return () => c.abort();
  }, []);

  const restaurantName = useCallback((id: string | null) => id ? restaurants.find(r => r.id === id)?.name ?? `Quán ${id.slice(0, 8)}…` : 'Tất cả quán', [restaurants]);
  const refresh = () => setReload(x => x + 1);
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  function openForm() {
    setFormError(''); setMessage(''); setCode(''); setAppliesTo('food'); setType('fixed'); setValue(''); setMinimum(''); setRestaurantId(''); setExpiry(''); setActive(false); setOpen(true);
  }
  function build() {
    const discount = type === 'percentage' ? Number(value.replace(',', '.')) : Number(digits(value));
    if (!Number.isFinite(discount) || discount <= 0) throw new Error('Nhập giá trị giảm lớn hơn 0.');
    if (type === 'percentage' && discount > 100) throw new Error('Phần trăm giảm tối đa là 100.');
    const expiryIso = vietnamLocalToIso(expiry);
    if (expiryIso && Date.parse(expiryIso) <= Date.now()) throw new Error('Hạn dùng phải ở tương lai.');
    return { code: code.trim().toUpperCase(), applies_to: appliesTo, discount_type: type, discount_value: discount, min_order_value: Number(digits(minimum) || '0'), restaurant_id: restaurantId || null, expiry_date: expiryIso, is_active: active };
  }
  async function save() {
    if (lock.current) return; lock.current = true; setBusy(true); setFormError('');
    try {
      const payload = build();
      const expiryText = payload.expiry_date ? `hết hạn lúc ${vnTime.format(new Date(payload.expiry_date))} (giờ Việt Nam)` : 'không có hạn dùng';
      if (!window.confirm(`Tạo mã ${payload.code}, ${expiryText}${payload.is_active ? ', bật ngay' : ', chưa bật'}. Xác nhận?`)) return;
      await adminApi<Voucher>('/api/admin/vouchers', { method: 'POST', body: JSON.stringify(payload) });
      setOpen(false); setMessage(`Đã tạo voucher ${payload.code}.${payload.is_active ? '' : ' Voucher đang tắt, hãy kiểm tra rồi bật.'}`);
      if (page === 0) refresh(); else setPage(0);
    } catch (e) {
      // Không tự gửi lại POST: nếu mất mạng, hãy tải lại danh sách và tìm mã trước khi thử tiếp.
      const text = e instanceof TypeError ? 'Mất kết nối. Hãy tải lại danh sách và kiểm tra mã đã được tạo chưa trước khi thử lại.' : e instanceof Error ? e.message : 'Không tạo được voucher.';
      setFormError(text);
    } finally { lock.current = false; setBusy(false); }
  }
  async function toggle(v: Voucher) {
    if (toggleLock.current) return;
    const next = !v.is_active;
    if (!next && !window.confirm(`Tắt mã ${v.code}? Khách đã lưu mã nhưng chưa dùng cũng sẽ không áp dụng được nữa.`)) return;
    toggleLock.current = true; setToggling(v.id); setError(''); setMessage('');
    try {
      const updated = await adminApi<Voucher>(`/api/admin/vouchers/${v.id}/status`, { method: 'PATCH', body: JSON.stringify({ is_active: next }) });
      setData(d => d && { ...d, items: d.items.map(x => x.id === updated.id ? updated : x) });
      setMessage(`Đã ${next ? 'bật' : 'tắt'} voucher ${v.code}.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không cập nhật được trạng thái.'); }
    finally { toggleLock.current = false; setToggling(null); }
  }
  const expired = (v: Voucher) => !!v.expiry_date && Date.parse(v.expiry_date) <= Date.now();

  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><h2 className="text-2xl font-bold">Voucher khuyến mãi</h2>
      <div className="flex gap-2"><button className={button} onClick={refresh} disabled={loading}>Làm mới</button><button className={button} onClick={openForm}>+ Tạo voucher</button></div></div>
    {error && <p role="alert" className="bg-red-50 text-red-700 p-4 rounded-xl">{error}</p>}
    {message && <p role="status" className="bg-emerald-50 text-emerald-800 p-4 rounded-xl">{message}</p>}
    {loading && !data ? <p>Đang tải voucher…</p> : <>
      <p className="text-sm text-slate-500">{data?.total ?? 0} voucher công khai · Mã đổi xu riêng của khách không hiển thị ở đây. Nên tắt mã thay vì xóa.</p>
      <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-sm text-left">
        <thead className="bg-slate-50 text-slate-600"><tr>{['Mã', 'Giảm cho', 'Giá trị', 'Đơn tối thiểu', 'Quán', 'Hạn dùng', 'Trạng thái', ''].map(h => <th key={h} className="p-3 font-semibold whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{(data?.items ?? []).map(v => <tr key={v.id} className="border-t">
          <td className="p-3 font-mono font-semibold">{v.code}</td>
          <td className="p-3">{v.applies_to === 'shipping' ? 'Phí giao hàng' : 'Tiền món'}</td>
          <td className="p-3 whitespace-nowrap">{formatDiscount(v)}</td>
          <td className="p-3 whitespace-nowrap">{vnd.format(v.min_order_value)}₫</td>
          <td className="p-3">{restaurantName(v.restaurant_id)}</td>
          <td className="p-3 whitespace-nowrap">{v.expiry_date ? vnTime.format(new Date(v.expiry_date)) : 'Không hạn'}</td>
          <td className="p-3">{expired(v) ? <span className="text-slate-500">Hết hạn</span> : v.is_active ? <span className="text-emerald-700">Đang bật</span> : <span className="text-amber-700">Đang tắt</span>}</td>
          <td className="p-3"><button className={ghost} disabled={toggling !== null || (!v.is_active && expired(v))} onClick={() => void toggle(v)}>{toggling === v.id ? 'Đang lưu…' : v.is_active ? 'Tắt' : 'Bật'}</button></td>
        </tr>)}
        {!data?.items.length && <tr><td colSpan={8} className="p-6 text-center text-slate-500">Chưa có voucher công khai.</td></tr>}</tbody>
      </table></div>
      <div className="flex items-center justify-between"><button className={ghost} disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>← Trước</button><span className="text-sm text-slate-500">Trang {page + 1}/{pages}</span><button className={ghost} disabled={page + 1 >= pages || loading} onClick={() => setPage(p => p + 1)}>Sau →</button></div>
    </>}
    {open && <div className="fixed inset-0 bg-black/40 z-30 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="voucher-title" className="max-h-[90dvh] overflow-y-auto bg-white rounded-2xl p-6 w-full max-w-2xl">
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save(); }}>
        <div className="flex justify-between"><h3 id="voucher-title" className="text-xl font-bold">Tạo voucher</h3><button type="button" aria-label="Đóng" disabled={busy} onClick={() => setOpen(false)}>✕</button></div>
        {formError && <p role="alert" className="text-red-700 bg-red-50 p-3 rounded-lg">{formError}</p>}
        <label className="block">Mã khuyến mãi<input autoFocus className={field + ' uppercase'} required minLength={3} maxLength={40} pattern="[A-Za-z0-9_\-]{3,40}" title="3–40 ký tự: chữ, số, _ hoặc -" value={code} onChange={e => setCode(e.target.value)} /></label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label>Giảm cho<select className={field} value={appliesTo} onChange={e => setAppliesTo(e.target.value as 'food' | 'shipping')}><option value="food">Tiền món</option><option value="shipping">Phí giao hàng</option></select></label>
          <label>Cách giảm<select className={field} value={type} onChange={e => { setType(e.target.value as 'fixed' | 'percentage'); setValue(''); }}><option value="fixed">Số tiền (VND)</option><option value="percentage">Phần trăm (%)</option></select></label>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label>Giá trị giảm {type === 'percentage' ? '(%)' : '(₫)'}<input className={field} required inputMode={type === 'percentage' ? 'decimal' : 'numeric'} value={type === 'fixed' && value ? vnd.format(Number(digits(value))) : value} onChange={e => setValue(type === 'fixed' ? digits(e.target.value) : e.target.value.replace(/[^\d.,]/g, ''))} /></label>
          <label>Tiền món tối thiểu (₫)<input className={field} inputMode="numeric" placeholder="0" value={minimum ? vnd.format(Number(digits(minimum))) : ''} onChange={e => setMinimum(digits(e.target.value))} /></label>
        </div>
        <p className="text-xs text-slate-500">Điều kiện tối thiểu chỉ tính tiền món, không cộng phí ship. Voucher phần trăm hiện chưa có mức giảm tối đa; số tiền giảm không vượt quá tiền món/phí ship thực tế.</p>
        <label className="block">Phạm vi áp dụng<select className={field} value={restaurantId} onChange={e => setRestaurantId(e.target.value)}><option value="">Tất cả quán</option>{restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
        <label className="block">Hết hạn lúc (giờ Việt Nam, UTC+7)<input type="datetime-local" className={field} value={expiry} onChange={e => setExpiry(e.target.value)} /><span className="text-xs text-slate-500">Để trống nếu không có hạn dùng.</span></label>
        <label className="flex gap-2"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />Kích hoạt ngay (nên để tắt, kiểm tra rồi bật sau)</label>
        <p className="text-xs text-slate-500">Tạo voucher không tự thêm vào ví khách; khách thu thập mã ở trang khuyến mãi trong app. Sau khi tạo, không sửa số tiền/điều kiện của mã đã phát hành.</p>
        <button className={button} disabled={busy}>{busy ? 'Đang lưu…' : 'Tạo voucher'}</button>
      </form></section></div>}
  </div>;
}
