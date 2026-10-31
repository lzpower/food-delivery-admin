import { supabase } from "./supabase";
export async function adminApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!supabase)
    throw new Error("Điền cấu hình Supabase công khai trong .env.local.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Vui lòng đăng nhập quản trị.");
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${data.session.access_token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(path, {
    ...options,
    headers,
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    if (
      (response.status === 401 || response.status === 403) &&
      !options.signal?.aborted
    )
      window.dispatchEvent(new Event("admin-access-denied"));
    throw new Error(
      payload?.error || "Không xử lý được yêu cầu. Kiểm tra backend đã chạy.",
    );
  }
  return payload as T;
}
