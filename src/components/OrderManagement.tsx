import { useEffect, useRef, useState } from "react";
import { adminApi } from "../services/adminApi";

type Assignment = {
  id: string;
  driver_id: string;
  status: string;
  reason: string | null;
  created_at: string;
  expires_at: string;
  fee: number;
  cod_amount: number;
};
type Order = {
  id: string;
  driver_id: string | null;
  status: string;
  total: number;
  payment_method: string | null;
  delivery_address: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  created_at: string;
  restaurants: { name: string } | null;
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    options_snapshot: unknown;
    foods: { name: string } | null;
  }[];
  delivery_assignments: Assignment[];
};
type Driver = {
  id: string;
  full_name: string;
  phone: string | null;
  is_online: boolean;
};
const labels: Record<string, string> = {
  pending: "Chờ xác nhận",
  preparing: "Đang chuẩn bị",
  delivering: "Đang giao",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
  offered: "Chờ tài xế nhận",
  accepted: "Tài xế đang đến quán",
  at_restaurant: "Tài xế đang chờ món",
  picked_up: "Đã lấy món",
  at_customer: "Đã đến khách",
  delivered: "Đã giao",
  rejected: "Từ chối",
  expired: "Hết hạn",
  failed: "Cần xử lý sự cố",
};
const money = (n: number) => Number(n).toLocaleString("vi-VN") + " đ";
const button =
  "rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-slate-300 disabled:cursor-not-allowed";
function itemDescription(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const v = value as {
    options?: { groupName?: string; label?: string }[];
    note?: string;
  };
  return [
    ...(Array.isArray(v.options)
      ? v.options.map((x) => [x.groupName, x.label].filter(Boolean).join(": "))
      : []),
    v.note,
  ]
    .filter(Boolean)
    .join(" · ");
}
export function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]),
    [drivers, setDrivers] = useState<Driver[]>([]),
    [selected, setSelected] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [loadError, setLoadError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [reload, setReload] = useState(0),
    [filter, setFilter] = useState("all"),
    [lastUpdated, setLastUpdated] = useState("");
  const [incident, setIncident] = useState<Assignment | null>(null),
    [reason, setReason] = useState(""),
    [outcome, setOutcome] = useState("return_to_dispatch"),
    [returned, setReturned] = useState(false);
  const mutation = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true,
      inFlight = false;
    const load = async () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      try {
        const [o, d] = await Promise.all([
          adminApi<Order[]>("/api/admin/orders", { signal: controller.signal }),
          adminApi<Driver[]>("/api/admin/drivers", {
            signal: controller.signal,
          }),
        ]);
        if (active) {
          setOrders(o);
          setDrivers(d);
          setLoadError("");
          setLastUpdated(new Date().toLocaleTimeString("vi-VN"));
        }
      } catch (e) {
        if (active && !controller.signal.aborted)
          setLoadError(
            e instanceof Error ? e.message : "Không tải được danh sách.",
          );
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    const visibility = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [reload]);
  const submit = async (
    key: string,
    path: string,
    body: object,
    onSuccess?: () => void,
  ) => {
    if (mutation.current) return;
    mutation.current = true;
    setBusy(key);
    setError("");
    setSuccess("");
    try {
      const result = await adminApi<{ message: string }>(path, {
        method: "POST",
        body: JSON.stringify(body),
        signal: lifetime.current?.signal,
      });
      if (lifetime.current?.signal.aborted) return;
      setSuccess(result.message);
      onSuccess?.();
      setReload((x) => x + 1);
    } catch (e) {
      if (!lifetime.current?.signal.aborted) {
        setError(e instanceof Error ? e.message : "Không xử lý được yêu cầu.");
        setReload((x) => x + 1);
      }
    } finally {
      mutation.current = false;
      setBusy(null);
    }
  };
  const refresh = () => {
    setLoading(true);
    setReload((x) => x + 1);
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Điều phối đơn hàng
          </h2>
          <p className="text-sm text-slate-500">
            100 đơn mới nhất · Tải lại mỗi 10 giây khi trang hiển thị
            {lastUpdated ? " · Cập nhật " + lastUpdated : ""}
          </p>
        </div>
        <button className={button} onClick={refresh} disabled={loading}>
          Làm mới
        </button>
      </div>
      {success && (
        <p
          role="status"
          className="rounded-xl bg-emerald-50 p-4 text-emerald-800"
        >
          {success}
        </p>
      )}
      {(error || loadError) && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
          {success ? "Thao tác đã thành công. " : ""}
          {error || loadError}
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Đơn đang hiển thị", orders.length],
          ["Chờ xác nhận", orders.filter((o) => o.status === "pending").length],
          [
            "Đang chuẩn bị / giao",
            orders.filter((o) => ["preparing", "delivering"].includes(o.status))
              .length,
          ],
          ["Tài xế đã duyệt còn rảnh", drivers.length],
        ].map(([name, count]) => (
          <div key={name} className="rounded-xl border bg-white p-4">
            <p className="text-xs text-slate-500">{name}</p>
            <p className="text-2xl font-bold">{count}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          "all",
          "pending",
          "preparing",
          "delivering",
          "completed",
          "cancelled",
        ].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={
              "rounded-lg border px-4 py-2 text-sm " +
              (filter === status ? "bg-slate-900 text-white" : "bg-white")
            }
          >
            {status === "all" ? "Tất cả" : labels[status]}
          </button>
        ))}
      </div>
      {loading && <p>Đang tải dữ liệu…</p>}
      {!loading &&
        !orders.filter((o) => filter === "all" || o.status === filter)
          .length && (
          <p className="rounded-xl border bg-white p-8 text-slate-500">
            Chưa có đơn ở mục này.
          </p>
        )}
      {orders
        .filter((o) => filter === "all" || o.status === filter)
        .map((order) => {
          const assignment = [...(order.delivery_assignments || [])].sort(
            (a, b) => b.created_at.localeCompare(a.created_at),
          )[0];
          return (
            <article
              key={order.id}
              className="rounded-2xl border bg-white overflow-hidden"
            >
              <header className="flex flex-wrap gap-3 justify-between bg-slate-50 px-5 py-4">
                <div>
                  <strong>
                    #{order.id.slice(0, 8).toUpperCase()} ·{" "}
                    {order.restaurants?.name || "Quán"}
                  </strong>
                  <p className="text-xs text-slate-500">
                    {new Date(order.created_at).toLocaleString("vi-VN")}
                  </p>
                </div>
                <span className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                  {labels[order.status] || order.status}
                </span>
              </header>
              <div className="grid md:grid-cols-3 gap-6 p-5">
                <section className="space-y-2">
                  <h3 className="font-semibold">Giao hàng</h3>
                  <p>{order.delivery_address}</p>
                  <p className="text-sm text-slate-500">
                    {[order.recipient_name, order.recipient_phone]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <p className="text-sm">
                    {order.payment_method === "cash"
                      ? "Tiền mặt (COD)"
                      : order.payment_method || "Chưa xác minh thanh toán"}
                  </p>
                  {assignment && (
                    <div className="rounded-xl bg-indigo-50 p-3 text-sm">
                      <strong>
                        {labels[assignment.status] || assignment.status}
                      </strong>
                      <p>Tài xế: {assignment.driver_id.slice(0, 8)}</p>
                      {assignment.status === "offered" && (
                        <p>
                          Hạn nhận:{" "}
                          {new Date(assignment.expires_at).toLocaleTimeString(
                            "vi-VN",
                          )}
                        </p>
                      )}
                      <p>Tiền công: {money(assignment.fee)}</p>
                      {assignment.reason && (
                        <p className="text-red-700">{assignment.reason}</p>
                      )}
                    </div>
                  )}
                </section>
                <section className="space-y-3">
                  <h3 className="font-semibold">Món đã đặt</h3>
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="text-sm">
                      <p>
                        {item.quantity} × {item.foods?.name || "Món ăn"} ·{" "}
                        {money(item.quantity * item.unit_price)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {itemDescription(item.options_snapshot)}
                      </p>
                    </div>
                  ))}
                </section>
                <section className="space-y-3">
                  <p className="text-xl font-bold">{money(order.total)}</p>
                  {order.status === "pending" && (
                    <button
                      className={button}
                      disabled={busy !== null}
                      onClick={() =>
                        void submit(
                          order.id,
                          "/api/admin/orders/" + order.id + "/prepare",
                          {},
                        )
                      }
                    >
                      {busy === order.id
                        ? "Đang xử lý…"
                        : "Tiếp nhận & làm món"}
                    </button>
                  )}
                  {["pending", "preparing"].includes(order.status) &&
                    !order.driver_id && (
                      <>
                        <label className="block text-sm font-medium">
                          Tài xế đã duyệt, chưa có chuyến
                          <select
                            aria-label={
                              "Tài xế cho đơn " + order.id.slice(0, 8)
                            }
                            className="mt-2 w-full rounded-lg border p-3"
                            value={selected[order.id] || ""}
                            disabled={busy !== null}
                            onChange={(e) =>
                              setSelected((x) => ({
                                ...x,
                                [order.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="">-- Chọn tài xế --</option>
                            {drivers.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.full_name}
                                {d.phone ? " · " + d.phone : ""} ·{" "}
                                {d.is_online ? "Đang online" : "Offline"}
                              </option>
                            ))}
                          </select>
                        </label>
                        {!drivers.length && (
                          <p className="text-xs text-slate-500">
                            Không có tài xế đã duyệt còn rảnh. Hãy tải lại sau.
                          </p>
                        )}
                        <button
                          className={button}
                          disabled={
                            !drivers.some((d) => d.id === selected[order.id]) ||
                            busy !== null
                          }
                          onClick={() =>
                            void submit(
                              order.id,
                              "/api/admin/orders/" + order.id + "/assign",
                              { driverId: selected[order.id] },
                              () =>
                                setSelected((x) => ({ ...x, [order.id]: "" })),
                            )
                          }
                        >
                          {busy === order.id
                            ? "Đang phân công…"
                            : "Phân công tài xế"}
                        </button>
                        <p className="text-xs text-slate-500">
                          Có thể gửi đề nghị khi offline; tài xế cần bật online
                          trước khi nhận.
                        </p>
                      </>
                    )}
                  {order.driver_id &&
                    ["pending", "preparing"].includes(order.status) && (
                      <p className="text-sm text-indigo-700">
                        Đã phân công
                        {assignment
                          ? " · " +
                            (labels[assignment.status] || assignment.status)
                          : ", chờ đối chiếu chuyến cũ"}
                        . Chỉ bắt đầu giao khi tài xế lấy món.
                      </p>
                    )}
                  {order.status === "delivering" && (
                    <p className="text-sm text-indigo-700">
                      Tài xế xác nhận giao hàng và thu COD trên app để hoàn tất
                      đơn.
                    </p>
                  )}
                  {assignment &&
                    [
                      "offered",
                      "accepted",
                      "at_restaurant",
                      "picked_up",
                      "at_customer",
                      "failed",
                    ].includes(assignment.status) &&
                    !["completed", "cancelled"].includes(order.status) && (
                      <button
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-700"
                        disabled={busy !== null}
                        onClick={() => {
                          setIncident(assignment);
                          setReason("");
                          setOutcome("return_to_dispatch");
                          setReturned(false);
                        }}
                      >
                        Xử lý ngoại lệ / đổi tài xế
                      </button>
                    )}
                </section>
              </div>
            </article>
          );
        })}
      {incident && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Xử lý ngoại lệ"
          className="fixed inset-0 z-20 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 space-y-4">
            <h3 className="text-xl font-bold">Xử lý ngoại lệ chuyến</h3>
            <p className="text-sm text-slate-600">
              Chỉ xác nhận sau khi kiểm tra hàng hóa và tiền thực tế. Thao tác
              không tự hoàn tiền hoặc ghi thu nhập.
            </p>
            <label className="block">
              Hướng xử lý
              <select
                className="w-full border rounded-lg p-2"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              >
                <option value="return_to_dispatch">
                  Trả về điều phối để phân công lại
                </option>
                <option value="cancel">Hủy đơn</option>
              </select>
            </label>
            <label className="block">
              Lý do đã xác minh
              <textarea
                className="w-full border rounded-lg p-3"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={1000}
                placeholder="Ít nhất 10 ký tự"
              />
            </label>
            <label className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={returned}
                onChange={(e) => setReturned(e.target.checked)}
              />
              Đã xác nhận món được trả về quán (bắt buộc nếu đã lấy món và muốn
              phân công lại).
            </label>
            <div className="flex gap-3">
              <button
                className={button}
                disabled={busy !== null || reason.trim().length < 10}
                onClick={() =>
                  void submit(
                    incident.id,
                    "/api/admin/assignments/" + incident.id + "/resolve",
                    { outcome, reason, goodsReturned: returned },
                    () => setIncident(null),
                  )
                }
              >
                Xác nhận xử lý
              </button>
              <button
                className="border rounded-lg px-4"
                disabled={busy !== null}
                onClick={() => setIncident(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
