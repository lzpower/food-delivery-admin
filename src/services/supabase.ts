import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
function isPublicKey(value: string) {
  if (value.startsWith("sb_secret_")) return false;
  if (value.startsWith("eyJ")) {
    try {
      return (
        JSON.parse(
          atob(value.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
        ).role === "anon"
      );
    } catch {
      return false;
    }
  }
  return value.startsWith("sb_publishable_");
}
export const configurationError =
  !url || !key
    ? "Điền VITE_SUPABASE_URL và VITE_SUPABASE_PUBLISHABLE_KEY trong .env.local."
    : !isPublicKey(key)
      ? "Frontend chỉ nhận publishable/anon key. Secret key phải nằm ở backend."
      : "";
export const supabase = createClient(
  configurationError ? "http://127.0.0.1:9" : url!,
  configurationError ? "missing-public-key" : key!,
);
