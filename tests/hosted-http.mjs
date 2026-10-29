import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const base = process.env.VITE_SUPABASE_URL;
assert.equal(new URL(base).hostname, "ekdtgzjpuaakvymsfvsh.supabase.co");
const anon = process.env.VITE_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const url = new URL(process.env.POSTGRES_URL_NON_POOLING);
url.searchParams.delete("sslmode");
const db = new pg.Client({
  connectionString: url.toString(),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
const runId = randomUUID();
const users = [],
  bookings = [];
let checks = 0,
  failed = false,
  before;
async function api(path, { token = anon, method = "GET", body } = {}) {
  const r = await fetch(base + path, {
    method,
    signal: AbortSignal.timeout(20000),
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return { status: r.status, ok: r.ok, data };
}
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`PASS ${name}`);
}
async function denied(result) {
  assert.ok(!result.ok, `Expected rejection, got HTTP ${result.status}`);
  assert.ok(result.status < 500, "Permission rejection must not be a server failure");
}
async function snapshot() {
  return (
    await db.query(`select jsonb_build_object(
    'settings',(select to_jsonb(s) from public.settings s),
    'services',(select jsonb_agg(to_jsonb(s) order by id) from public.services s),
    'resources',(select jsonb_agg(to_jsonb(r) order by id) from public.resources r),
    'policies',(select jsonb_agg(to_jsonb(p) order by id) from public.policies p),
    'users',(select count(*) from auth.users),'bookings',(select count(*) from public.bookings),
    'notifications',(select count(*) from public.notification_jobs)) value`)
  ).rows[0].value;
}
async function fixture(label, role = "customer") {
  const password = randomUUID() + "aA9!",
    email = `cc-http-${runId}-${label}@example.invalid`;
  // Admin create-user does not send an invitation or verification email.
  const r = await api("/auth/v1/admin/users", {
    token: serviceKey,
    method: "POST",
    body: {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: `HTTP test ${label}`,
        phone: "8760000000",
        role: "administrator",
      },
    },
  });
  assert.equal(r.status, 200, `Could not create fixture ${label}: HTTP ${r.status}`);
  const id = r.data.id;
  users.push(id);
  assert.equal(
    (await db.query("select role from public.profiles where id=$1", [id])).rows[0].role,
    "customer",
    "Signup metadata must not grant administrator access",
  );
  if (role !== "customer")
    await db.query("update public.profiles set role=$2 where id=$1", [id, role]);
  const signIn = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(signIn.status, 200, `Could not authenticate fixture ${label}`);
  return { id, token: signIn.data.access_token };
}
try {
  await db.connect();
  before = await snapshot();
  assert.equal(before.settings.launch_approved, false, "Keep launch pending during tests");
  const alice = await fixture("alice"),
    bob = await fixture("bob"),
    staff = await fixture("staff", "staff"),
    admin = await fixture("admin", "administrator");
  // Cancelled fixture records occupy no inventory and enqueue no messages.
  for (const who of [alice, bob]) {
    const id = randomUUID();
    bookings.push(id);
    await db.query(
      `insert into public.bookings(id,customer_id,customer_email,customer_name,service_id,service_name,brand,starts_at,ends_at,attendees,total_minor,price_snapshot,booking_state,policy_snapshot,idempotency_key)
      values($1,$2,'fixture@example.invalid','HTTP test','svc-enigma-meeting','HTTP permission fixture','enigma',now()+interval '14 days',now()+interval '14 days 1 hour',1,100,'{"lines":[],"currency":"JMD"}','cancelled','{}',$3)`,
      [id, who.id, randomUUID()],
    );
  }
  await check("public catalog is available while live reservations remain disabled", async () => {
    const r = await api("/rest/v1/rpc/public_catalog", { method: "POST", body: {} });
    assert.equal(r.status, 200);
    assert.equal(r.data.ready, false);
  });
  await check("anonymous requests cannot read customer profiles or bookings", async () => {
    for (const table of ["profiles", "bookings"]) {
      const r = await api(`/rest/v1/${table}?select=id`);
      if (r.ok) assert.deepEqual(r.data, []);
      else await denied(r);
    }
  });
  await check("customer A sees only their own booking", async () => {
    const r = await api(`/rest/v1/bookings?id=in.(${bookings.join(",")})&select=id`, {
      token: alice.token,
    });
    assert.equal(r.status, 200);
    assert.deepEqual(
      r.data.map((x) => x.id),
      [bookings[0]],
    );
  });
  await check("customer B cannot fetch A by known booking ID", async () => {
    const r = await api(`/rest/v1/bookings?id=eq.${bookings[0]}&select=id`, { token: bob.token });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, []);
  });
  await check("customer profiles are isolated", async () => {
    const r = await api(`/rest/v1/profiles?id=in.(${alice.id},${bob.id})&select=id`, {
      token: alice.token,
    });
    assert.equal(r.status, 200);
    assert.deepEqual(
      r.data.map((x) => x.id),
      [alice.id],
    );
  });
  await check("customers cannot escalate their own role", async () => {
    await denied(
      await api(`/rest/v1/profiles?id=eq.${alice.id}`, {
        token: alice.token,
        method: "PATCH",
        body: { role: "administrator" },
      }),
    );
    assert.equal(
      (await db.query("select role from profiles where id=$1", [alice.id])).rows[0].role,
      "customer",
    );
  });
  await check("customers cannot directly rewrite bookings", async () => {
    await denied(
      await api(`/rest/v1/bookings?id=eq.${bookings[0]}`, {
        token: alice.token,
        method: "PATCH",
        body: { total_minor: 1 },
      }),
    );
  });
  await check("customers cannot call staff booking actions", async () => {
    await denied(
      await api("/rest/v1/rpc/transition_booking", {
        token: alice.token,
        method: "POST",
        body: { p_id: bookings[1], p_state: "confirmed" },
      }),
    );
  });
  await check("customers cannot call expiry, allocation, or notification internals", async () => {
    for (const [name, body] of [
      ["expire_reservations", {}],
      ["claim_notifications", { p_limit: 1 }],
      [
        "allocate_booking",
        {
          p_booking: bookings[0],
          p_start: new Date().toISOString(),
          p_end: new Date().toISOString(),
        },
      ],
    ])
      await denied(await api(`/rest/v1/rpc/${name}`, { token: alice.token, method: "POST", body }));
  });
  await check("customers cannot edit business configuration", async () => {
    const r = await api("/rest/v1/settings?id=eq.true", {
      token: alice.token,
      method: "PATCH",
      body: { launch_approved: false },
    });
    if (r.ok) assert.deepEqual(r.data, []);
    else await denied(r);
  });
  await check("staff can read both customer reservations", async () => {
    const r = await api(`/rest/v1/bookings?id=in.(${bookings.join(",")})&select=id`, {
      token: staff.token,
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.length, 2);
  });
  await check("staff cannot grant administrator access", async () => {
    await denied(
      await api("/rest/v1/rpc/set_role", {
        token: staff.token,
        method: "POST",
        body: { p_user: bob.id, p_role: "administrator" },
      }),
    );
  });
  await check("administrator can manage a fixture role through the live RPC", async () => {
    const r = await api("/rest/v1/rpc/set_role", {
      token: admin.token,
      method: "POST",
      body: { p_user: bob.id, p_role: "staff" },
    });
    assert.ok(r.ok);
    assert.equal(
      (await db.query("select role from profiles where id=$1", [bob.id])).rows[0].role,
      "staff",
    );
  });
  await check("launch gate rejects otherwise authenticated booking attempts", async () => {
    await denied(
      await api("/rest/v1/rpc/submit_booking", {
        token: alice.token,
        method: "POST",
        body: {
          p_service: "svc-enigma-meeting",
          p_start: new Date(Date.now() + 14 * 86400000).toISOString(),
          p_duration: 60,
          p_attendees: 1,
          p_key: randomUUID(),
          p_policy_versions: {},
        },
      }),
    );
  });
  console.log(`${checks} live HTTP/Auth permission checks passed.`);
} catch (error) {
  console.error(error);
  failed = true;
} finally {
  try {
    // Exact run-owned UUIDs only. Do not truncate or delete existing app records.
    if (bookings.length)
      await db.query("delete from public.bookings where id=any($1::uuid[])", [bookings]);
    if (users.length)
      await db.query("delete from public.audit_events where actor_id=any($1::uuid[])", [users]);
    for (const id of users) {
      const r = await api(`/auth/v1/admin/users/${id}`, { token: serviceKey, method: "DELETE" });
      assert.ok(r.ok, `Fixture account cleanup failed: ${id}`);
    }
    if (before) assert.deepEqual(await snapshot(), before, "Application snapshot must be restored");
    console.log(
      "Removed temporary accounts/bookings/audit entries; business configuration and notification counts unchanged.",
    );
  } catch (error) {
    console.error("Cleanup/verification failed:", error);
    failed = true;
  }
  await db.end();
  process.exitCode = failed ? 1 : 0;
}
