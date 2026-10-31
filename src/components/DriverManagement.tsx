import { useEffect, useRef, useState } from 'react';
import { adminApi } from '../services/adminApi';
type Driver = { id: string; full_name: string | null; phone: string | null; driver_profiles: { approval_status: string; vehicle_type: string; plate_number: string | null } | null };
const field = 'mt-1 w-full rounded-lg border p-3';
const button = 'rounded-lg bg-emerald-700 px-4 py-2.5 text-white disabled:opacity-50';
export function DriverManagement() {
  const [drivers, setDrivers] = useState<Driver[]>([]), [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [fullName, setName] = useState(''), [email, setEmail] = useState(''), [phone, setPhone] = useState(''), [password, setPassword] = useState(''), [repairId, setRepairId] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    const c = new AbortController(); setLoading(true);
    adminApi<Driver[]>('/api/admin/driver-accounts', { signal: c.signal }).then(setDrivers).catch(e => { if (!c.signal.aborted) setError(e.message); }).finally(() => { if (!c.signal.aborted) setLoading(false); });
    return () => c.abort();
  }, [reload]);
  async function act(path: string, body: object, created = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const r = await adminApi<{ message: string }>(path, { method: 'POST', body: JSON.stringify(body) });
      setMessage(r.message);
      if (created) { setName(''); setEmail(''); setPhone(''); setPassword(''); }
      setReload(x => x + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không xử lý được yêu cầu.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="space-y-6">
    <div className="flex justify-between gap-3"><h2 className="text-2xl font-bold">Quản lý tài xế</h2><button className={button} disabled={busy || loading} onClick={() => { setError(''); setReload(x => x + 1); }}>Làm mới</button></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{message}</p>}
    <form className="rounded-xl border bg-white p-5 space-y-4" onSubmit={e => { e.preventDefault(); void act('/api/admin/driver-accounts', { fullName, email, phone, password }, true); }}>
      <h3 className="font-semibold text-lg">Tạo tài khoản tài xế</h3>
      <div className="grid md:grid-cols-2 gap-4">
        <label>Họ và tên<input className={field} required minLength={2} maxLength={100} autoComplete="off" value={fullName} onChange={e => setName(e.target.value)} /></label>
        <label>Email<input className={field} required type="email" maxLength={254} autoComplete="off" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Số điện thoại<input className={field} required type="tel" maxLength={40} placeholder="Ví dụ: 09xxxxxxxx" value={phone} onChange={e => setPhone(e.target.value)} /></label>
        <label>Mật khẩu ban đầu<input className={field} required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
      </div>
      <p className="text-sm text-slate-500">Mật khẩu từ 12 ký tự. Email được xác nhận sẵn; hồ sơ tài xế chờ duyệt. Bàn giao mật khẩu riêng cho tài xế.</p>
      <button className={button} disabled={busy}>{busy ? 'Đang xử lý…' : 'Tạo tài khoản chờ duyệt'}</button>
    </form>
    <details className="rounded-xl border bg-white p-5"><summary className="cursor-pointer font-medium">Hoàn tất tài khoản nếu lần tạo trước bị gián đoạn</summary><form className="mt-3 flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); void act('/api/admin/driver-accounts/' + repairId.trim() + '/setup', {}); }}><input aria-label="UID tài khoản cần hoàn tất" className="flex-1 min-w-48 border rounded-lg p-3" required placeholder="UID trong thông báo lỗi trước đó" value={repairId} onChange={e => setRepairId(e.target.value)} /><button className={button} disabled={busy}>Hoàn tất tài khoản</button></form></details>
    {loading ? <p>Đang tải tài xế…</p> : !drivers.length ? <p>Chưa có tài xế.</p> : <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-100"><tr>{['Tài xế', 'Liên hệ', 'Phương tiện', 'Trạng thái', 'Thao tác'].map(s => <th key={s} className="p-4">{s}</th>)}</tr></thead><tbody>{drivers.map(d => <tr key={d.id} className="border-t">
      <td className="p-4"><p className="font-semibold">{d.full_name || 'Chưa có tên'}</p><p className="text-xs text-slate-500 break-all">{d.id}</p></td><td className="p-4">{d.phone || 'Chưa có số điện thoại'}</td>
      <td className="p-4">{d.driver_profiles?.vehicle_type || 'Chưa hoàn tất'}<p>{d.driver_profiles?.plate_number}</p></td>
      <td className="p-4">{({ pending: 'Chờ duyệt', approved: 'Đã duyệt', suspended: 'Tạm ngưng' })[d.driver_profiles?.approval_status || ''] || 'Chưa hoàn tất hồ sơ'}</td>
      <td className="p-4">{d.driver_profiles?.approval_status === 'pending' && <button className={button} disabled={busy} onClick={() => { if (window.confirm('Duyệt tài xế ' + (d.full_name || d.id) + ' sau khi kiểm tra hồ sơ?')) void act('/api/admin/driver-accounts/' + d.id + '/approve', {}); }}>Duyệt tài xế</button>}{!d.driver_profiles && <button className={button} disabled={busy} onClick={() => void act('/api/admin/driver-accounts/' + d.id + '/setup', {})}>Hoàn tất hồ sơ</button>}</td>
    </tr>)}</tbody></table></div>}
  </div>;
}
