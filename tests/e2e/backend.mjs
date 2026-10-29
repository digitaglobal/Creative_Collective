// Test-only Supabase HTTP facade: production database functions run unchanged in
// PGlite; auth sessions are fixtures, not a substitute for staging Supabase Auth.
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const db = new PGlite({ extensions: { btree_gist, pgcrypto } });
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create schema storage;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid,bucket_id text); alter table storage.objects enable row level security;`);
for (const file of readdirSync("supabase/migrations").sort())
  await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
const accounts = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    email: "customer@example.invalid",
    full_name: "Test Customer",
    phone: "8761111111",
    role: "customer",
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    email: "staff@example.invalid",
    full_name: "Test Staff",
    phone: "8762222222",
    role: "administrator",
  },
];
for (const a of accounts) {
  await db.query("insert into auth.users values($1,$2,now(),$3)", [
    a.id,
    a.email,
    JSON.stringify({ full_name: a.full_name, phone: a.phone }),
  ]);
  await db.query("update profiles set role=$2 where id=$1", [a.id, a.role]);
}
await db.exec(`grant usage on schema public to anon,authenticated;
grant select on all tables in schema public to anon,authenticated;
update settings set launch_approved=true,tax_basis_points=1500;
update policies set approved=true;
update resources set approved=true;
update services set approved=true;`);
// Past confirmed fixture exercises the no-show screen without changing the clock.
await db.query(
  `insert into bookings(id,reference,customer_id,customer_email,customer_name,service_id,service_name,brand,starts_at,ends_at,attendees,total_minor,price_snapshot,booking_state,policy_snapshot,idempotency_key)
 values('40000000-0000-0000-0000-000000000001','CC-TEST-NOSHOW',$1,'customer@example.invalid','Test Customer','svc-enigma-meeting','Meeting room','enigma',now()-interval '2 days',now()-interval '2 days'+interval '1 hour',1,575000,'{"lines":[],"currency":"JMD"}','confirmed','{}','40000000-0000-0000-0000-000000000002')`,
  [accounts[0].id],
);
const users = accounts.map((a) => ({
  id: a.id,
  email: a.email,
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: new Date().toISOString(),
  confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: a.full_name, phone: a.phone },
  identities: [],
}));
const jwt = (user) =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(
      JSON.stringify({
        sub: user.id,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url"),
    "test-signature",
  ].join(".");
const tokens = new Map(users.map((u) => [u.id, jwt(u)]));
let chain = Promise.resolve();
createServer((request, response) => {
  // Serialize fixture connections because PGlite uses one PostgreSQL connection.
  chain = chain
    .then(async () => {
      response.setHeader("Access-Control-Allow-Origin", "http://localhost:3001");
      response.setHeader("Access-Control-Allow-Headers", "*");
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
      response.setHeader("Content-Type", "application/json");
      if (request.method === "OPTIONS") {
        response.end();
        return;
      }
      const url = new URL(request.url, "http://localhost:54330");
      let raw = "";
      for await (const chunk of request) raw += chunk;
      const body = raw ? JSON.parse(raw) : {};
      const token = request.headers.authorization?.replace("Bearer ", "");
      const user = users.find((u) => tokens.get(u.id) === token);
      const send = (data) => response.end(JSON.stringify(data));
      try {
        if (url.pathname === "/health") {
          send({ ok: true });
          return;
        }
        if (url.pathname === "/auth/v1/token") {
          const u = users.find((u) => u.email === body.email);
          if (!u || body.password !== "testpassword") {
            response.statusCode = 400;
            send({ msg: "Invalid credentials" });
            return;
          }
          send({
            access_token: tokens.get(u.id),
            refresh_token: "fixture-refresh",
            expires_in: 3600,
            token_type: "bearer",
            user: u,
          });
          return;
        }
        if (url.pathname === "/auth/v1/user") {
          if (!user) {
            response.statusCode = 401;
            send({ msg: "Unauthorized" });
          } else send(user);
          return;
        }
        if (url.pathname === "/auth/v1/logout") {
          send({});
          return;
        }
        await db.exec("reset role;");
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user?.id ?? ""]);
        await db.exec(`set role ${user ? "authenticated" : "anon"};`);
        if (url.pathname.startsWith("/rest/v1/rpc/")) {
          const name = url.pathname.split("/").at(-1);
          const funcs = await db.query(
            "select proname from pg_proc join pg_namespace n on n.oid=pronamespace where n.nspname='public' and proname=$1",
            [name],
          );
          if (!funcs.rows.length) throw new Error("Unknown function");
          const entries = Object.entries(body);
          if (entries.some(([k]) => !/^p_[a-z_]+$/.test(k))) throw new Error("Invalid argument");
          const args = entries.map(([k], i) => `${k}=>$${i + 1}`).join(",");
          const result = await db.query(
            `select * from public.${name}(${args})`,
            entries.map(([, v]) =>
              v && typeof v === "object" && !Array.isArray(v) ? JSON.stringify(v) : v,
            ),
          );
          if (
            [
              "public_catalog",
              "available_slots",
              "submit_enquiry",
              "preview_change",
              "booking_funnel_report",
            ].includes(name)
          )
            send(result.rows[0]?.[name]);
          else if (
            [
              "submit_booking",
              "transition_booking",
              "record_payment",
              "request_change",
              "review_change",
              "create_quote",
              "accept_quote",
            ].includes(name)
          )
            send(result.rows[0]);
          else send(result.rows);
          return;
        }
        const table = url.pathname.split("/").at(-1);
        const allowed = [
          "profiles",
          "bookings",
          "payments",
          "change_requests",
          "quotes",
          "enquiries",
          "notification_jobs",
          "allocations",
          "resources",
          "internal_notes",
          "audit_events",
          "settings",
          "brands",
          "services",
          "service_resources",
          "extra_resources",
          "closures",
          "policies",
        ];
        if (!allowed.includes(table)) throw new Error("Unknown table");
        const params = [];
        const conditions = [];
        for (const [key, value] of url.searchParams)
          if (value.startsWith("eq.")) {
            if (!/^[a-z_]+$/.test(key)) throw new Error("Invalid filter");
            params.push(value.slice(3));
            conditions.push(`${key}=$${params.length}`);
          }
        const where = conditions.length ? ` where ${conditions.join(" and ")}` : "";
        const selection = url.searchParams.get("select") ?? "*";
        if (!/^[a-z_,*]+$/.test(selection)) throw new Error("Invalid selection");
        let sql;
        if (request.method === "POST") {
          const keys = Object.keys(body);
          if (keys.some((k) => !/^[a-z_]+$/.test(k))) throw new Error("Invalid field");
          const conflict =
            table === "service_resources"
              ? ["service_id", "resource_id"]
              : table === "extra_resources"
                ? ["service_id", "extra_id", "resource_id"]
                : ["id"];
          const columns = keys.join(",");
          const placeholders = keys.map((_, i) => "$" + (i + 1)).join(",");
          const updates = keys
            .filter((k) => !conflict.includes(k))
            .map((k) => `${k}=excluded.${k}`)
            .join(",");
          sql = `insert into ${table}(${columns}) values(${placeholders}) on conflict(${conflict.join(",")}) do ${updates ? "update set " + updates : "nothing"} returning *`;
          params.push(
            ...keys.map((k) =>
              body[k] && typeof body[k] === "object" ? JSON.stringify(body[k]) : body[k],
            ),
          );
        } else if (request.method === "PATCH") {
          const fields = Object.entries(body);
          const updates = fields.map(([k, v]) => {
            if (!/^[a-z_]+$/.test(k)) throw new Error("Invalid field");
            params.push(v);
            return `${k}=$${params.length}`;
          });
          sql = `update ${table} set ${updates.join(",")}${where} returning *`;
        } else {
          const order = url.searchParams.get("order");
          if (order && !/^[a-z_]+\.(asc|desc)$/.test(order)) throw new Error("Invalid order");
          sql = `select ${selection} from ${table}${where}${order ? " order by " + order.replace(".", " ") : ""}`;
        }
        const result = await db.query(sql, params);
        send(
          request.headers.accept?.includes("application/vnd.pgrst.object+json")
            ? result.rows[0]
            : result.rows,
        );
      } catch (error) {
        response.statusCode = 400;
        send({ message: error.message, code: error.code ?? "TEST_ERROR" });
      }
    })
    .catch((error) => {
      console.error(error);
      response.statusCode = 500;
      response.end("{}");
    });
}).listen(54330, "127.0.0.1");
