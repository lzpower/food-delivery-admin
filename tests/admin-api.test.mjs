import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createAdminApp } from "../server/app.mjs";
const admin = "11111111-1111-4111-8111-111111111111",
  order = "22222222-2222-4222-8222-222222222222",
  driver = "33333333-3333-4333-8333-333333333333";
async function setup(
  t,
  { rpcError = null, authError = false, throwAuth = false } = {},
) {
  const calls = [];
  const db = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: "assignment-id", error: rpcError };
    },
    from(table) {
      const call = { table, filters: [] };
      calls.push(call);
      const builder = {
        select(columns) {
          call.columns = columns;
          return builder;
        },
        order() {
          return builder;
        },
        limit(n) {
          call.limit = n;
          return builder;
        },
        eq(k, v) {
          call.filters.push([k, v]);
          return builder;
        },
        in(k, v) {
          call.filters.push([k, v]);
          return builder;
        },
        update(value) {
          call.update = value;
          return builder;
        },
        then(resolve, reject) {
          let data = [];
          if (table === "driver_profiles") data = [{ user_id: driver }];
          if (table === "driver_presence")
            data = [{ driver_id: driver, is_online: true }];
          if (table === "profiles")
            data = [
              { id: driver, full_name: "Approved Driver", phone: null },
              { id: "busy-driver", full_name: "Busy" },
            ];
          if (table === "delivery_assignments")
            data = [{ driver_id: "busy-driver" }];
          if (table === "orders") data = [{ id: order }];
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  const authClient = {
    auth: {
      getUser: async (token) => {
        if (throwAuth) throw Error("private upstream detail");
        return {
          data: {
            user:
              token === "admin"
                ? { id: admin }
                : token === "customer"
                  ? { id: driver }
                  : null,
          },
          error: authError ? { message: "secret token" } : null,
        };
      },
    },
  };
  const server = createAdminApp({
    db,
    authClient,
    admins: new Set([admin]),
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = "http://127.0.0.1:" + server.address().port;
  const request = (path, body, token = "admin") =>
    fetch(base + "/api/admin" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  return { request, calls };
}
test("missing/invalid tokens return 401 without touching data", async (t) => {
  const { request, calls } = await setup(t);
  for (const token of ["", "expired"]) {
    const r = await request("/orders", undefined, token);
    assert.equal(r.status, 401);
    assert.equal(r.headers.get("cache-control"), "no-store");
  }
  assert.equal(calls.length, 0);
});
test("valid ordinary user is denied with 403 before any RPC", async (t) => {
  const { request, calls } = await setup(t);
  assert.equal(
    (
      await request(
        "/orders/" + order + "/assign",
        { driverId: driver },
        "customer",
      )
    ).status,
    403,
  );
  assert.equal(calls.length, 0);
});
test("upstream auth outage returns safe 503", async (t) => {
  const { request } = await setup(t, { throwAuth: true });
  const r = await request("/me");
  assert.equal(r.status, 503);
  assert.ok(!(await r.text()).includes("private upstream"));
});
test("assignment calls the privileged RPC once, without direct status writes", async (t) => {
  const { request, calls } = await setup(t);
  const r = await request("/orders/" + order + "/assign", {
    driverId: driver,
    status: "completed",
  });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).assignmentId, "assignment-id");
  assert.deepEqual(calls, [
    {
      name: "admin_driver_assign",
      args: { p_order_id: order, p_driver_id: driver },
    },
  ]);
});
test("invalid UUID is rejected before RPC", async (t) => {
  const { request, calls } = await setup(t);
  assert.equal(
    (await request("/orders/bad/assign", { driverId: driver })).status,
    400,
  );
  assert.equal(calls.length, 0);
});
test("concurrent assignment conflict is surfaced as 409", async (t) => {
  const { request } = await setup(t, {
    rpcError: { code: "23505", message: "private SQL details" },
  });
  const r = await request("/orders/" + order + "/assign", { driverId: driver });
  assert.equal(r.status, 409);
  assert.ok(!(await r.text()).includes("private SQL"));
});
test("unknown DB errors do not expose details", async (t) => {
  const { request } = await setup(t, {
    rpcError: { code: "XX000", message: "secret key detail" },
  });
  const r = await request("/orders/" + order + "/assign", { driverId: driver });
  assert.equal(r.status, 500);
  assert.ok(!(await r.text()).includes("secret key"));
});
test("driver list filters approval and role, excludes active drivers, returns presence", async (t) => {
  const { request, calls } = await setup(t);
  const r = await request("/drivers");
  const drivers = await r.json();
  assert.equal(drivers.length, 1);
  assert.equal(drivers[0].id, driver);
  assert.equal(drivers[0].is_online, true);
  assert.ok(
    calls
      .find((x) => x.table === "driver_profiles")
      .filters.some(([k, v]) => k === "approval_status" && v === "approved"),
  );
  assert.ok(
    calls
      .find((x) => x.table === "profiles")
      .filters.some(([k, v]) => k === "role" && v === "driver"),
  );
});
test("prepare uses compare-and-set against pending status", async (t) => {
  const { request, calls } = await setup(t);
  assert.equal(
    (await request("/orders/" + order + "/prepare", {})).status,
    200,
  );
  assert.deepEqual(calls[0].update, { status: "preparing" });
  assert.ok(
    calls[0].filters.some(([k, v]) => k === "status" && v === "pending"),
  );
});
test("incident resolution validates inputs and forwards operator decision", async (t) => {
  const { request, calls } = await setup(t);
  assert.equal(
    (
      await request("/assignments/" + order + "/resolve", {
        outcome: "cancel",
        reason: "x",
        goodsReturned: false,
      })
    ).status,
    400,
  );
  assert.equal(calls.length, 0);
  assert.equal(
    (
      await request("/assignments/" + order + "/resolve", {
        outcome: "return_to_dispatch",
        reason: "Quán đã nhận lại đủ món",
        goodsReturned: true,
      })
    ).status,
    200,
  );
  assert.equal(calls[0].name, "admin_driver_resolve");
  assert.equal(calls[0].args.p_goods_returned, true);
});
test("malformed and oversized JSON receive safe errors", async (t) => {
  const { request } = await setup(t);
  const r = await request("/orders/" + order + "/assign", {
    driverId: driver,
    extra: "x".repeat(9000),
  });
  assert.equal(r.status, 413);
});
