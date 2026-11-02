import { useEffect, useRef, useState } from 'react';
import { adminApi } from '../services/adminApi';

export type DiscoveryGroup = { id: string; name: string };
type FoodGroups = { food_id: string; selected_ids: string[]; inactive_links: DiscoveryGroup[] };
const button = 'rounded-lg bg-emerald-700 px-4 py-2.5 text-white disabled:opacity-50';

export function toggleId(current: string[], id: string, checked: boolean) {
  return checked ? [...new Set([...current, id])] : current.filter((value) => value !== id);
}

// Danh sách checkbox dùng chung cho form thêm món và modal phân loại.
export function DiscoveryPicker({ groups, selected, onChange, disabled = false, loading = false, error = '' }: {
  groups: DiscoveryGroup[]; selected: string[]; onChange: (ids: string[]) => void; disabled?: boolean; loading?: boolean; error?: string;
}) {
  return <fieldset className="space-y-2" disabled={disabled}>
    <legend className="font-medium">Nhóm khám phá</legend>
    <p className="text-xs text-slate-500">Dùng cho thẻ khám phá và bộ lọc AI trên app khách. Khác với “Danh mục” sắp xếp thực đơn của quán.</p>
    {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : loading ? <p className="text-sm text-slate-500">Đang tải nhóm khám phá…</p>
      : !groups.length ? <p className="text-sm text-slate-500">Chưa có nhóm khám phá đang hoạt động.</p>
      : <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{groups.map((g) => <label key={g.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
        <input type="checkbox" checked={selected.includes(g.id)} onChange={(e) => onChange(toggleId(selected, g.id, e.target.checked))} />{g.name}</label>)}</div>}
  </fieldset>;
}

// Nhãn nhỏ trên thẻ món.
export function DiscoveryBadges({ ids, groups }: { ids: string[] | undefined; groups: DiscoveryGroup[] }) {
  const names = (ids || []).map((id) => groups.find((g) => g.id === id)?.name).filter(Boolean) as string[];
  if (!names.length) return <p className="text-xs text-slate-400">Chưa có nhóm khám phá</p>;
  return <p className="flex flex-wrap gap-1 pt-1">{names.map((n) => <span key={n} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">{n}</span>)}</p>;
}

export function DiscoveryModal({ food, groups, groupsError, notice = '', onClose, onSaved }: {
  food: { id: string; name: string }; groups: DiscoveryGroup[]; groupsError: string; notice?: string;
  onClose: () => void; onSaved: (foodId: string, ids: string[], message: string) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]), [inactive, setInactive] = useState<DiscoveryGroup[]>([]);
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [confirmInactive, setConfirmInactive] = useState(false), [confirmEmpty, setConfirmEmpty] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    adminApi<FoodGroups>('/api/admin/foods/' + food.id + '/discovery-groups', { signal: c.signal }).then((r) => {
      if (c.signal.aborted || r.food_id !== food.id) return;
      setSelected(r.selected_ids); setInactive(r.inactive_links); setLoaded(true);
    }).catch((e) => { if (!c.signal.aborted) setError(e.message); });
    return () => c.abort();
  }, [food.id]);
  async function save() {
    if (lock.current || !loaded) return;
    if (inactive.length && !confirmInactive) { setError('Hãy xác nhận loại bỏ các nhóm đã tắt trước khi lưu.'); return; }
    if (!selected.length && !confirmEmpty) { setConfirmEmpty(true); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const r = await adminApi<{ food_id: string; selected_ids: string[]; message: string }>('/api/admin/foods/' + food.id + '/discovery-groups', {
        method: 'PUT', body: JSON.stringify({ discovery_category_ids: selected, ...(inactive.length ? { remove_inactive: true } : {}) }),
      });
      onSaved(r.food_id, r.selected_ids, r.message);
    } catch (e) { setError(e instanceof Error ? e.message : 'Chưa lưu được nhóm khám phá.'); setConfirmEmpty(false); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"><section role="dialog" aria-modal="true" aria-labelledby="discovery-title" className="max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-6 w-full max-w-xl space-y-4">
    <div className="flex justify-between gap-4"><h3 id="discovery-title" className="text-xl font-bold">Phân loại khám phá · {food.name}</h3><button type="button" disabled={busy} onClick={onClose} aria-label="Đóng">✕</button></div>
    {notice && <p role="status" className="rounded-lg bg-amber-50 p-3 text-amber-800">{notice}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    <DiscoveryPicker groups={groups} selected={selected} onChange={(ids) => { setSelected(ids); setConfirmEmpty(false); }} disabled={busy || !loaded} loading={!loaded && !error && !groupsError} error={groupsError} />
    {loaded && inactive.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 space-y-2"><p>Món vẫn liên kết với nhóm đã tắt hoặc không dành cho món: <b>{inactive.map((g) => g.name).join(', ')}</b>. Các liên kết này không hiện trong danh sách chọn.</p>
      <label className="flex gap-2"><input type="checkbox" checked={confirmInactive} onChange={(e) => setConfirmInactive(e.target.checked)} />Tôi xác nhận loại bỏ các liên kết này khi lưu</label></div>}
    {confirmEmpty && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Bạn đang bỏ tất cả nhóm khám phá. Món vẫn có trong thực đơn và khi tìm theo tên, nhưng sẽ không xuất hiện khi khách lọc theo nhóm khám phá và có thể bị loại khi AI yêu cầu nhóm cụ thể. Bấm “Xác nhận lưu” để tiếp tục.</p>}
    <div className="flex gap-3"><button type="button" className={button} disabled={busy || !loaded} onClick={() => void save()}>{busy ? 'Đang lưu…' : confirmEmpty ? 'Xác nhận lưu' : 'Lưu phân loại'}</button><button type="button" className="rounded-lg border px-4 py-2" disabled={busy} onClick={onClose}>Đóng</button></div>
  </section></div>;
}
