import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, configurationError } from "./services/supabase";
import { adminApi } from "./services/adminApi";
import { OrderManagement } from "./components/OrderManagement";
import { DriverManagement } from "./components/DriverManagement";
import { AddFoodModal } from "./components/AddFoodModal";
import { RestaurantManagement } from './components/RestaurantManagement';
import { VoucherManagement } from './components/VoucherManagement';
import { AdminShell } from './components/AdminShell';
import type { AdminPage } from './components/AdminShell';
import { ArrowRight, ShieldCheck, Eye, EyeOff, Utensils, Bike, Store } from 'lucide-react';

function VerifiedAdmin({ session }: { session: Session }) {
  const [page, setPage] = useState<AdminPage>('orders');
  const [verified, setVerified] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const deny = () => {
      setVerified(false);
      setError(
        "Phiên đăng nhập không còn quyền truy cập. Hãy đăng xuất hoặc thử lại.",
      );
    };
    window.addEventListener("admin-access-denied", deny);
    return () => window.removeEventListener("admin-access-denied", deny);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void adminApi("/api/admin/me", { signal: controller.signal })
      .then(() => setVerified(true))
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [retry]);
  return <AdminShell page={page} onPage={setPage} email={session.user.email || ''} onLogout={() => { void supabase.auth.signOut().then(({ error }) => { if (error) setError('Chưa đăng xuất được. Vui lòng thử lại.'); }); }} panels={{
    orders: verified ? <OrderManagement /> : <p>Đang xác minh quyền quản trị…</p>,
    drivers: verified ? <DriverManagement /> : null,
    restaurants: verified ? <RestaurantManagement /> : null,
    foods: verified ? <AddFoodModal /> : null,
    vouchers: verified ? <VoucherManagement /> : null,
  }} alert={error ? <div role="alert" className="mb-5 rounded-xl bg-red-50 p-4 text-red-700">{error}<button className="ml-4 underline" onClick={() => { setError(''); setRetry(x => x + 1); }}>Thử lại</button></div> : null} />;
}
export default function App() {
  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(!configurationError),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (configurationError) return;
    let active = true;
    let changed = false;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !changed) {
          if (error) setError("Không khôi phục được phiên.");
          setSession(data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active && !changed) {
          setError("Không khôi phục được phiên. Vui lòng đăng nhập lại.");
          setLoading(false);
        }
      });
    const { data } = supabase.auth.onAuthStateChange((_event, value) => {
      if (active) {
        changed = true;
        setSession(value);
        setLoading(false);
      }
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);
  if (loading) return <p className="p-8">Đang tải phiên đăng nhập…</p>;
  if (session)
    return (
      <VerifiedAdmin
        key={session.user.id + ":" + session.expires_at}
        session={session}
      />
    );
  return (
    <div className="login-layout">
      <aside className="login-story"><a className="brand brand-light" href="#"><img src="/subifood.png" alt="" /><span>soopiFood<small>KHÔNG GIAN QUẢN TRỊ</small></span></a><div className="login-story-content"><span className="story-pill"><span />Cùng vận hành, cùng phát triển</span><h1>Mỗi món ngon.<br />Một trải nghiệm<br /><em>trọn vẹn.</em></h1><p>Kết nối nhà hàng, tài xế và khách hàng.<br />Mọi hoạt động, trong một không gian.</p><div className="story-cards"><div><Store /><span>Nhà hàng</span></div><div><Utensils /><span>Thực đơn</span></div><div><Bike /><span>Chuyến giao</span></div></div></div><p className="story-footer">soopiFood Operations <span>Được tạo nên từ sự tận tâm.</span></p><div className="story-orbit" aria-hidden="true" /></aside>
      <section className="login-panel"><div className="login-panel-inner"><span className="login-kicker"><ShieldCheck size={16} /> DÀNH CHO QUẢN TRỊ VIÊN</span>
      <form
        className="login-form space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          void supabase.auth
            .signInWithPassword({ email: email.trim().toLowerCase(), password })
            .then(({ error }) => {
              if (error) setError("Email hoặc mật khẩu không đúng.");
              else setPassword("");
            })
            .catch(() => setError("Không kết nối được Supabase."))
            .finally(() => setBusy(false));
        }}
      >
        <div className="login-form-heading"><h2>Chào mừng trở lại<span>.</span></h2><p>Đăng nhập để bắt đầu phiên làm việc của bạn.</p></div>
        {(error || configurationError) && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {configurationError || error}
          </p>
        )}
        <label className="block">
          Email
          <input
            className="mt-2 w-full rounded-xl border p-3.5"
            type="email"
            required
            autoComplete="username"
            placeholder="Email quản trị của bạn"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block">
          Mật khẩu
          <div className="password-field"><input
            className="mt-2 w-full rounded-xl border p-3.5 pr-12"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="current-password"
            placeholder="Nhập mật khẩu"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          /><button className="password-toggle" type="button" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} onClick={() => setShowPassword(x => !x)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
        </label>
        <button
          disabled={busy || !!configurationError}
          className="joly-primary login-submit w-full disabled:opacity-50"
        >
          {busy ? <><span className="loading-spinner" />Đang đăng nhập…</> : <>Đăng nhập <ArrowRight size={18} /></>}
        </button>
      </form>
      <p className="login-trust"><ShieldCheck size={16} /> Chỉ tài khoản được cấp quyền mới có thể truy cập.</p><p className="login-help">Bạn cần quyền truy cập? Liên hệ người quản lý hệ thống.</p></div><div className="login-bottom">soopiFood ADMIN <span>Quản lý tinh gọn. Vận hành hiệu quả.</span></div></section>
    </div>
  );
}
