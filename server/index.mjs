import { createClient } from "@supabase/supabase-js";
import { createAdminApp, uuid } from "./app.mjs";
import { createMedia } from './media.mjs';
const {
  SUPABASE_URL: url,
  SUPABASE_PUBLISHABLE_KEY: publicKey,
  SUPABASE_SECRET_KEY: secretKey,
} = process.env;
const admins = new Set(
  (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean),
);
if (
  !url ||
  !publicKey ||
  !secretKey ||
  !admins.size ||
  [...admins].some((id) => !uuid.test(id))
)
  throw new Error(
    "Điền server/.env.local: URL, public key, secret key và UUID quản trị hợp lệ.",
  );
const options = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};
const authClient = createClient(url, publicKey, options);
const db = createClient(url, secretKey, options);
const port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT không hợp lệ.");
createAdminApp({ authClient, db, admins, media: createMedia(process.env) }).listen(port, "0.0.0.0", () =>
