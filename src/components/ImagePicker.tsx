import { useEffect, useState } from 'react';
export function ImagePicker({ file, onChange, disabled = false }: { file: File | null; onChange: (file: File | null) => void; disabled?: boolean }) {
  const [preview, setPreview] = useState(''), [error, setError] = useState('');
  useEffect(() => { if (!file) { setPreview(''); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  return <div className="space-y-2"><label className="block">Ảnh (JPG, PNG, WebP · tối đa 8 MB)<input disabled={disabled} className="block w-full rounded-lg border p-3 mt-1" type="file" accept="image/jpeg,image/png,image/webp" required onChange={e => {
    const next = e.target.files?.[0] || null;
    if (next && (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || next.size > 8 * 1024 * 1024)) { setError('Chọn JPG, PNG hoặc WebP tối đa 8 MB.'); e.target.value = ''; onChange(null); return; }
    setError(''); onChange(next);
  }} /></label>{error && <p role="alert" className="text-red-700">{error}</p>}{preview && <img src={preview} alt="Xem trước ảnh đã chọn" className="h-32 w-48 rounded-lg object-contain border" />}<p className="text-xs text-slate-500">Ảnh được upload lên Backblaze B2 khi bấm Lưu. Database lưu link Cloudflare.</p></div>;
}
