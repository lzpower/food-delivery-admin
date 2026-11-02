import express from "express";
import { installManagement } from "./management.mjs";
import { installVouchers } from "./vouchers.mjs";

export const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const activeStates = [
  "offered",
  "accepted",
  "at_restaurant",
  "picked_up",
  "at_customer",
];
export function createAdminApp({ authClient, db, admins, media }) {
  const app = express();
  app.disable("x-powered-by");
  app.use("/api/admin", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "8kb" }));
  app.use("/api/admin", async (req, res, next) => {
    const token = /^Bearer (\S+)$/i.exec(req.headers.authorization || "")?.[1];
    if (!token)
      return res.status(401).json({ error: "Vui lòng đăng nhập quản trị." });
    try {
      const { data, error } = await authClient.auth.getUser(token);
      if (error || !data.user)
        return res
          .status(401)
          .json({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
      if (!admins.has(data.user.id.toLowerCase()))
        return res
          .status(403)
          .json({ error: "Tài khoản không có quyền quản trị." });
      res.locals.adminId = data.user.id;
      next();
    } catch {
      res
        .status(503)
        .json({
          error: "Chưa xác minh được phiên đăng nhập. Vui lòng thử lại.",
        });
    }
  });
  function databaseError(res, error) {
    if (error.code === "23505")
      return res
        .status(409)
        .json({
          error:
            "Đơn hoặc tài xế đã có chuyến đang hoạt động. Hãy tải lại danh sách.",
        });
    if (error.code === "P0001")
      return res.status(409).json({ error: error.message });
    return res
      .status(500)
      .json({ error: "Không xử lý được dữ liệu. Vui lòng thử lại." });
  }
  app.get("/api/admin/me", (_req, res) => res.json({ id: res.locals.adminId }));
  app.get("/api/admin/orders", async (_req, res) => {
    const { data, error } = await db
      .from("orders")
      .select(
        `*, restaurants(name),
      order_items(id,food_id,quantity,unit_price,options_snapshot,foods(name)),
      delivery_assignments(id,driver_id,status,reason,created_at,expires_at,fee,cod_amount)`,
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return databaseError(res, error);
    res.json(data || []);
  });
  app.get("/api/admin/drivers", async (_req, res) => {
    const results = await Promise.all([
      db
        .from("driver_profiles")
        .select("user_id")
        .eq("approval_status", "approved"),
      db.from("driver_presence").select("driver_id,is_online,last_seen_at"),
      db
        .from("delivery_assignments")
        .select("driver_id")
        .in("status", activeStates),
    ]);
    for (const result of results)
      if (result.error) return databaseError(res, result.error);
    const [approval, presence, active] = results;
    const ids = (approval.data || []).map((x) => x.user_id);
    if (!ids.length) return res.json([]);
    const { data, error } = await db
      .from("profiles")
      .select("id,full_name,phone")
      .eq("role", "driver")
      .in("id", ids);
    if (error) return databaseError(res, error);
    const busy = new Set((active.data || []).map((x) => x.driver_id));
    const online = new Set(
      (presence.data || []).filter((x) => x.is_online).map((x) => x.driver_id),
    );
    res.json(
      (data || [])
        .filter((x) => !busy.has(x.id))
        .map((x) => ({ ...x, is_online: online.has(x.id) })),
    );
  });
  app.post("/api/admin/orders/:orderId/assign", async (req, res) => {
    const { orderId } = req.params;
    const driverId = req.body?.driverId;
    if (
      !uuid.test(orderId) ||
      typeof driverId !== "string" ||
      !uuid.test(driverId)
    )
      return res
        .status(400)
        .json({ error: "Mã đơn hoặc tài xế không hợp lệ." });
    const { data, error } = await db.rpc("admin_driver_assign", {
      p_order_id: orderId,
      p_driver_id: driverId,
    });
    if (error) return databaseError(res, error);
    res.json({
      assignmentId: data,
      message: "Đã gửi đề nghị nhận chuyến cho tài xế.",
    });
  });
  app.post("/api/admin/orders/:orderId/prepare", async (req, res) => {
    if (!uuid.test(req.params.orderId))
      return res.status(400).json({ error: "Mã đơn không hợp lệ." });
    const { data, error } = await db
      .from("orders")
      .update({ status: "preparing" })
      .eq("id", req.params.orderId)
      .eq("status", "pending")
      .select("id");
    if (error) return databaseError(res, error);
    if (!data?.length)
      return res
        .status(409)
        .json({ error: "Đơn đã thay đổi trạng thái. Hãy tải lại." });
    res.json({ message: "Đã tiếp nhận đơn." });
  });
  app.post("/api/admin/assignments/:assignmentId/resolve", async (req, res) => {
    const { outcome, reason, goodsReturned } = req.body || {};
    if (
      !uuid.test(req.params.assignmentId) ||
      !["cancel", "return_to_dispatch"].includes(outcome) ||
      typeof reason !== "string" ||
      reason.trim().length < 10 ||
      reason.trim().length > 1000 ||
      typeof goodsReturned !== "boolean"
    )
      return res
        .status(400)
        .json({
          error:
            "Chọn hướng xử lý, nhập lý do 10–1000 ký tự và xác nhận hàng hóa.",
        });
    const { error } = await db.rpc("admin_driver_resolve", {
      p_assignment_id: req.params.assignmentId,
      p_outcome: outcome,
      p_reason: reason.trim(),
      p_goods_returned: goodsReturned,
    });
    if (error) return databaseError(res, error);
    res.json({
      message:
        "Đã ghi nhận xử lý sự cố. Tiền thực thu/hoàn trả cần đối soát riêng.",
    });
  });
  installManagement(app, db, databaseError, media);
  installVouchers(app, db);
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Không có API này." }),
  );
  app.use((err, _req, res, _next) => {
    res
      .status(err.status === 400 ? 400 : err.status === 413 ? 413 : 500)
      .json({ error: "Yêu cầu không hợp lệ hoặc máy chủ chưa xử lý được." });
  });
  return app;
}
