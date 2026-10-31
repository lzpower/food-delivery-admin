import { Bike, Store, Utensils, LayoutDashboard, LogOut, ChevronRight, ShieldCheck, ArrowUpRight, Menu, X, PanelsTopLeft } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { VercelTabs } from './ui/vercel-tabs';
export type AdminPage = 'orders' | 'drivers' | 'restaurants' | 'foods';
const pages = [
  { id: 'orders', label: 'Điều phối đơn hàng', short: 'Đơn hàng', icon: LayoutDashboard, description: 'Mỗi đơn hàng, một hành trình trọn vẹn.' },
  { id: 'drivers', label: 'Quản lý tài xế', short: 'Tài xế', icon: Bike, description: 'Kết nối đội ngũ, sẵn sàng cho những chuyến giao.' },
  { id: 'restaurants', label: 'Nhà hàng đối tác', short: 'Nhà hàng', icon: Store, description: 'Quán ngon hội tụ trong cùng một không gian.' },
  { id: 'foods', label: 'Thực đơn & tùy chọn', short: 'Thực đơn', icon: Utensils, description: 'Chăm chút từng món, từ hình ảnh đến hương vị.' },
] as const;
export function AdminShell({ page, onPage, email, onLogout, alert, panels }: { page: AdminPage; onPage: (p: AdminPage) => void; email: string; onLogout: () => void; alert: ReactNode; panels: Record<AdminPage, ReactNode> }) {
  const [menu, setMenu] = useState(false); const selected = pages.find(p => p.id === page)!;
  function navigate(id: AdminPage) { onPage(id); setMenu(false); }
  return <div className="admin-workspace">
    {menu && <button className="sidebar-backdrop" aria-label="Đóng menu" onClick={() => setMenu(false)} />}
    <aside className={'admin-sidebar ' + (menu ? 'is-open' : '')}>
      <a className="brand" href="#" onClick={e => { e.preventDefault(); navigate('orders'); }}><img src="/subifood.png" alt="" /><span>soopiFood<small>KHÔNG GIAN QUẢN TRỊ</small></span></a>
      <div className="workspace-switch"><span className="workspace-mark"><PanelsTopLeft size={19} /></span><div><strong>soopiFood Operations</strong><small>Quản lý & vận hành</small></div><ChevronRight size={15} /></div>
      <p className="nav-caption">KHÔNG GIAN LÀM VIỆC</p>
      <nav className="sidebar-navigation" aria-label="Điều hướng chính">{pages.map(p => <button key={p.id} className={page === p.id ? 'active' : ''} aria-current={page === p.id ? 'page' : undefined} onClick={() => navigate(p.id)}><p.icon size={19} strokeWidth={1.7} /><span>{p.label}</span>{page === p.id && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-note"><span className="note-icon"><Utensils size={22} /></span><strong>Ngon từ món ăn.<br />Tốt từ trải nghiệm.</strong><p>Chăm sóc từng đơn hàng cùng soopiFood.</p><span className="note-arrow"><ArrowUpRight size={19} /></span></div>
      <div className="sidebar-account"><span className="account-avatar">{email.charAt(0).toUpperCase() || 'A'}</span><div><strong>Quản trị viên</strong><small title={email}>{email}</small></div><button onClick={onLogout} aria-label="Đăng xuất" title="Đăng xuất"><LogOut size={18} /></button></div>
    </aside>
    <div className="workspace-body"><header className="workspace-topbar"><button className="mobile-menu" onClick={() => setMenu(x => !x)} aria-label={menu ? 'Đóng menu' : 'Mở menu'} aria-expanded={menu}>{menu ? <X size={21} /> : <Menu size={21} />}</button><div className="breadcrumb">Không gian làm việc<ChevronRight size={14} /><strong>{selected.short}</strong></div><span className="admin-session"><ShieldCheck size={15} />Phiên quản trị</span></header>
      <main className="workspace-main"><section className="workspace-heading"><div><p className="eyebrow">soopiFood / VẬN HÀNH</p><h1>{selected.label}<span>.</span></h1><p>{selected.description}</p></div><span className="workspace-date">{new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date())}</span></section>
      {alert}
      <VercelTabs value={page} onValueChange={v => navigate(v as AdminPage)} tabs={pages.map(p => ({ value: p.id, label: p.short, icon: <p.icon size={16} />, content: panels[p.id] }))} />
      <footer className="workspace-footer"><span>soopiFood Admin</span><span>Chăm chút từng trải nghiệm.</span></footer>
      </main>
    </div>
  </div>;
}
