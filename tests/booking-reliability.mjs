import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { createServer } from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";

// Hosted mode creates a separate database; never run fixtures in the app database.
const hosted = process.argv.includes("--hosted");
let control;
let hostedSnapshot;
let createdHostedDatabase = false;
const testDatabase = `cc_reliability_${randomUUID().replaceAll("-", "")}`;
let hostedConfig;
if (hosted) {
  assert.equal(
    new URL(process.env.VITE_SUPABASE_URL).hostname,
    "ekdtgzjpuaakvymsfvsh.supabase.co",
    "Unexpected hosted project",
  );
  const url = new URL(process.env.POSTGRES_URL_NON_POOLING);
  url.searchParams.delete("sslmode");
  hostedConfig = {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
    statement_timeout: 15000,
  };
}
const directory = await mkdtemp(join(tmpdir(), "cc-booking-reliability-"));
const listener = createServer();
await new Promise((resolve) => listener.listen(0, "127.0.0.1", resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const password = randomUUID();
const logs = [];
const server = new EmbeddedPostgres({
  databaseDir: directory,
  port,
  user: "postgres",
  password,
  persistent: false,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: (line) => logs.push(String(line)),
  onError: (line) => logs.push(String(line)),
});
const clients = [];
async function connect() {
  const config = hosted
    ? (() => {
        const url = new URL(hostedConfig.connectionString);
        url.pathname = `/${testDatabase}`;
        return { ...hostedConfig, connectionString: url.toString() };
      })()
    : {
        host: "127.0.0.1",
        port,
        user: "postgres",
        password,
        database: "postgres",
        statement_timeout: 10000,
      };
  const c = new pg.Client(config);
  await c.connect();
  clients.push(c);
  return c;
}
const alice = randomUUID(),
  bob = randomUUID(),
  staff = randomUUID();
const policies = Object.fromEntries(
  ["cancellation", "refund", "no_show", "late_arrival", "house_rules", "privacy", "terms"].map(
    (x) => [x, 1],
  ),
);
let admin, a, b;
let passed = 0;
let failed = false;
async function check(name, task) {
  await task();
  passed++;
  console.log(`PASS ${name}`);
}
async function actor(c, id) {
  await c.query("reset role");
  await c.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await c.query("set role authenticated");
}
const day = new Date();
day.setUTCDate(day.getUTCDate() + 14);
while (day.getUTCDay() !== 1) day.setUTCDate(day.getUTCDate() + 1);
const at = (hour = 10) => `${day.toISOString().slice(0, 10)}T${hour}:00:00-05:00`;
async function reserve(
  c,
  service = "svc-enigma-meeting",
  hour = 10,
  key = randomUUID(),
  extras = [],
) {
  return (
    await c.query("select * from submit_booking($1,$2,60,1,$3,$4,$5,null,true)", [
      service,
      at(hour),
      key,
      policies,
      extras,
    ])
  ).rows[0];
}
async function clear() {
  await a.query("rollback");
  await b.query("rollback");
  await admin.query(
    "truncate notification_jobs,audit_events,internal_notes,payments,allocations,change_requests,quotes,enquiries,bookings cascade",
  );
  await admin.query("delete from closures; update settings set buffer_minutes=0");
  await actor(a, alice);
  await actor(b, bob);
}
// Prove real contention: the second backend must wait on a PostgreSQL lock
// while the first reservation is still uncommitted.
async function contend(first, second, { retry = false, expectedBookings = 1, expectedError } = {}) {
  await a.query("begin");
  const winner = await first();
  const pid = (await b.query("select pg_backend_pid() pid")).rows[0].pid;
  const pending = second().then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  let waiting = false;
  for (let i = 0; i < 100; i++) {
    const state = (
      await admin.query("select wait_event_type from pg_stat_activity where pid=$1", [pid])
    ).rows[0];
    if (state?.wait_event_type === "Lock") {
      waiting = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await a.query("commit");
  const outcome = await pending;
  assert.ok(waiting, "second request must actually contend with the uncommitted first request");
  if (retry) {
    assert.ifError(outcome.error);
    assert.equal(outcome.value.id, winner.id);
  } else if (expectedError) {
    assert.match(outcome.error?.message ?? "Both requests succeeded", expectedError);
  } else {
    assert.equal(outcome.error?.code, "23P01", outcome.error?.message ?? "both requests succeeded");
  }
  assert.equal(
    Number((await admin.query("select count(*) n from bookings")).rows[0].n),
    expectedBookings,
    "losing transaction must leave no orphan booking",
  );
  return winner;
}
try {
  if (hosted) {
    control = new pg.Client(hostedConfig);
    await control.connect();
    hostedSnapshot = (
      await control.query(
        "select jsonb_build_object('settings',(select to_jsonb(s) from public.settings s),'services',(select jsonb_agg(to_jsonb(s) order by id) from public.services s),'resources',(select jsonb_agg(to_jsonb(r) order by id) from public.resources r),'policies',(select jsonb_agg(to_jsonb(p) order by id) from public.policies p),'bookings',(select count(*) from public.bookings),'users',(select count(*) from auth.users),'notifications',(select count(*) from public.notification_jobs)) snapshot",
      )
    ).rows[0].snapshot;
    await control.query(`create database ${testDatabase}`);
    createdHostedDatabase = true;
    console.log(`Hosted isolated database: ${testDatabase}`);
  } else {
    await server.initialise();
    await server.start();
  }
  admin = await connect();
  a = await connect();
  b = await connect();
  console.log((await admin.query("select version() version")).rows[0].version);
  if (!hosted)
    await admin.query(
      "create role anon; create role authenticated; create role service_role bypassrls;",
    );
  await admin.query(`create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated,service_role;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid,bucket_id text); alter table storage.objects enable row level security;`);
  for (const file of (await readdir("supabase/migrations"))
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await admin.query(await readFile(join("supabase/migrations", file), "utf8"));
  if (hosted) {
    const definitions =
      "select p.oid::regprocedure::text signature, pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any($1) order by 1";
    const names = [
      "submit_booking",
      "allocate_booking",
      "validate_session",
      "available_slots",
      "accept_quote",
      "request_change",
      "review_change",
      "review_hourly_change",
      "offer_rental_change",
      "accept_rental_change",
      "record_payment",
      "transition_booking",
      "add_note",
    ];
    const deployed = (await control.query(definitions, [names])).rows;
    const isolated = (await admin.query(definitions, [names])).rows;
    const hash = (rows) => createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    assert.equal(
      hash(isolated),
      hash(deployed),
      "Test RPC definitions must exactly match deployed functions",
    );
    console.log(
      `Verified ${deployed.length} deployed RPC definitions match (SHA-256 ${hash(deployed)}).`,
    );
  }
  for (const [id, email] of [
    [alice, "alice@example.invalid"],
    [bob, "bob@example.invalid"],
    [staff, "staff@example.invalid"],
  ])
    await admin.query("insert into auth.users values($1,$2,now(),$3)", [
      id,
      email,
      { full_name: "Reliability fixture", phone: "8760000000" },
    ]);
  await admin.query("update profiles set role='administrator' where id=$1", [staff]);
  await admin.query(`update settings set launch_approved=true,tax_basis_points=1500;
    update policies set approved=true; update resources set approved=true;
    update services set approved=true,document=jsonb_set(jsonb_set(document,'{bookableHourly}','true'),'{hourlyRateMinor}','500000') where id in ('svc-enigma-meeting','svc-enigma-booth','svc-studio-rental','svc-studio-lounge','svc-studio-recording-booth');`);

  await check("same space: concurrent requests yield exactly one reservation", async () => {
    await clear();
    await contend(
      () => reserve(a),
      () => reserve(b),
    );
  });
  await check("different Studio D services sharing one room cannot overlap", async () => {
    await clear();
    await contend(
      () => reserve(a, "svc-studio-rental"),
      () => reserve(b, "svc-studio-lounge"),
    );
  });
  await check("same-customer concurrent retry returns the original booking", async () => {
    await clear();
    await actor(b, alice);
    const key = randomUUID();
    await contend(
      () => reserve(a, undefined, 10, key),
      () => reserve(b, undefined, 10, key),
      { retry: true },
    );
  });
  await check("adjacent bookings are allowed without a buffer", async () => {
    await clear();
    await Promise.all([reserve(a), reserve(b, undefined, 11)]);
  });
  await check("independent spaces can be booked simultaneously", async () => {
    await clear();
    await Promise.all([reserve(a), reserve(b, "svc-enigma-booth")]);
  });
  await check("buffers block otherwise adjacent bookings", async () => {
    await clear();
    await admin.query("update settings set buffer_minutes=15");
    await reserve(a);
    await assert.rejects(reserve(b, undefined, 11), { code: "23P01" });
  });
  await check("cancellation releases inventory", async () => {
    await clear();
    const original = await reserve(a);
    await actor(a, staff);
    await a.query("select transition_booking($1,'cancelled')", [original.id]);
    await reserve(b);
  });
  await check("expired requests release inventory before the next booking", async () => {
    await clear();
    const original = await reserve(a);
    await admin.query("update bookings set expires_at=now()-interval '1 second' where id=$1", [
      original.id,
    ]);
    await reserve(b);
    assert.equal(
      (await admin.query("select booking_state from bookings where id=$1", [original.id])).rows[0]
        .booking_state,
      "expired",
    );
  });
  await check("shared equipment blocks bookings across different rooms", async () => {
    await clear();
    await admin.query(`update services set document=jsonb_set(document,'{addons}','[{"id":"test-equipment","name":"Equipment","description":"Fixture","basis":"per-booking","amountMinor":100,"status":"published"}]') where id='svc-enigma-meeting';
      insert into extra_resources values('svc-enigma-meeting','test-equipment','res-enigma-booth');`);
    await contend(
      () => reserve(a, undefined, 10, randomUUID(), ["test-equipment"]),
      () => reserve(b, "svc-enigma-booth"),
    );
  });
  await check(
    "equipment closures reject the whole booking without orphan allocations",
    async () => {
      await clear();
      await admin.query(
        "insert into closures(resource_id,starts_at,ends_at,reason) values('res-enigma-booth',$1,$2,'Test closure')",
        [at(), at(11)],
      );
      await assert.rejects(reserve(a, undefined, 10, randomUUID(), ["test-equipment"]), /closed/);
      assert.equal(Number((await admin.query("select count(*) n from bookings")).rows[0].n), 0);
    },
  );
  await check("failed reschedule preserves original dates and allocations", async () => {
    await clear();
    const original = await reserve(a);
    await reserve(b, undefined, 12);
    const change = (
      await a.query("select * from request_change($1,'reschedule',$2,$3,'Conflict test')", [
        original.id,
        at(12),
        at(13),
      ])
    ).rows[0];
    await actor(a, staff);
    await assert.rejects(a.query("select review_change($1,true,575000)", [change.id]), {
      code: "23P01",
    });
    assert.equal(
      (
        await admin.query("select starts_at from bookings where id=$1", [original.id])
      ).rows[0].starts_at.toISOString(),
      new Date(at()).toISOString(),
    );
    assert.equal(
      Number(
        (await admin.query("select count(*) n from allocations where booking_id=$1", [original.id]))
          .rows[0].n,
      ),
      1,
    );
    assert.equal(
      (await admin.query("select state from change_requests where id=$1", [change.id])).rows[0]
        .state,
      "pending",
    );
  });
  await check("simultaneous reschedules into one slot preserve the losing original", async () => {
    await clear();
    const originalA = await reserve(a);
    const originalB = await reserve(b, undefined, 11);
    const requestA = (
      await a.query("select * from request_change($1,'reschedule',$2,$3,'Move A')", [
        originalA.id,
        at(14),
        at(15),
      ])
    ).rows[0];
    const requestB = (
      await b.query("select * from request_change($1,'reschedule',$2,$3,'Move B')", [
        originalB.id,
        at(14),
        at(15),
      ])
    ).rows[0];
    await actor(a, staff);
    await actor(b, staff);
    await contend(
      async () =>
        (await a.query("select * from review_change($1,true,575000)", [requestA.id])).rows[0],
      async () =>
        (await b.query("select * from review_change($1,true,575000)", [requestB.id])).rows[0],
      { expectedBookings: 2 },
    );
    assert.equal(
      (
        await admin.query("select starts_at from bookings where id=$1", [originalB.id])
      ).rows[0].starts_at.toISOString(),
      new Date(at(11)).toISOString(),
    );
  });
  await check("concurrent quote acceptance rechecks shared Studio D availability", async () => {
    await clear();
    const enquiries = [];
    for (const [client, email, service] of [
      [a, "alice@example.invalid", "svc-studio-rental"],
      [b, "bob@example.invalid", "svc-studio-lounge"],
    ]) {
      enquiries.push(
        (
          await client.query(
            "select submit_enquiry($1,'Test customer',$2,'8760000000',$3::date,$3::date,'daily',1,'Shared room quote') id",
            [service, email, day.toISOString().slice(0, 10)],
          )
        ).rows[0].id,
      );
    }
    await actor(a, staff);
    const quotes = [];
    for (const enquiry of enquiries)
      quotes.push(
        (
          await a.query(
            "select * from create_quote($1,$2,$3,$4,now()+interval '1 hour','Test only')",
            [
              enquiry,
              at(),
              at(12),
              JSON.stringify([{ label: "Long rental", amountMinor: 1000000 }]),
            ],
          )
        ).rows[0].id,
      );
    await actor(a, alice);
    await contend(
      async () =>
        (await a.query("select * from accept_quote($1,$2)", [quotes[0], policies])).rows[0],
      async () =>
        (await b.query("select * from accept_quote($1,$2)", [quotes[1], policies])).rows[0],
    );
    assert.equal(
      (await admin.query("select state from quotes where id=$1", [quotes[1]])).rows[0].state,
      "offered",
    );
  });
  await check("simultaneous partial payments cannot exceed the booking total", async () => {
    await clear();
    const booking = await reserve(a);
    await actor(a, staff);
    await actor(b, staff);
    const payment = async (client, key) =>
      (
        await client.query(
          "select * from record_payment($1,400000,'payment','cash','Concurrent payment',$2)",
          [booking.id, key],
        )
      ).rows[0];
    await contend(
      () => payment(a, randomUUID()),
      () => payment(b, randomUUID()),
      { expectedError: /Payment exceeds balance/ },
    );
    assert.equal(
      Number(
        (await admin.query("select paid_minor from bookings where id=$1", [booking.id])).rows[0]
          .paid_minor,
      ),
      400000,
    );
    assert.equal(
      Number(
        (await admin.query("select count(*) n from payments where booking_id=$1", [booking.id]))
          .rows[0].n,
      ),
      1,
    );
  });
  await check("simultaneous retries record one payment and one audit entry", async () => {
    await clear();
    const booking = await reserve(a);
    await actor(a, staff);
    await actor(b, staff);
    const key = randomUUID();
    const payment = async (client) =>
      (
        await client.query(
          "select * from record_payment($1,200000,'payment','cash','Same receipt',$2)",
          [booking.id, key],
        )
      ).rows[0];
    await contend(
      () => payment(a),
      () => payment(b),
      { retry: true },
    );
    assert.equal(
      Number(
        (await admin.query("select count(*) n from payments where booking_id=$1", [booking.id]))
          .rows[0].n,
      ),
      1,
    );
    assert.equal(
      Number(
        (
          await admin.query(
            "select count(*) n from audit_events where booking_id=$1 and action='payment'",
            [booking.id],
          )
        ).rows[0].n,
      ),
      1,
    );
  });
  await check("simultaneous refunds cannot exceed the paid balance", async () => {
    await clear();
    const booking = await reserve(a);
    await actor(a, staff);
    await actor(b, staff);
    await a.query("select record_payment($1,575000,'payment','cash','Full payment',$2)", [
      booking.id,
      randomUUID(),
    ]);
    const refund = async (client) =>
      (
        await client.query(
          "select * from record_payment($1,400000,'refund','cash','Refund receipt',$2)",
          [booking.id, randomUUID()],
        )
      ).rows[0];
    await contend(
      () => refund(a),
      () => refund(b),
      { expectedError: /Refund exceeds recorded payments/ },
    );
    assert.equal(
      Number(
        (await admin.query("select paid_minor from bookings where id=$1", [booking.id])).rows[0]
          .paid_minor,
      ),
      175000,
    );
    assert.equal(
      Number(
        (
          await admin.query(
            "select count(*) n from payments where booking_id=$1 and kind='refund'",
            [booking.id],
          )
        ).rows[0].n,
      ),
      1,
    );
  });
  await check("no overlapping resource allocations remain", async () => {
    const overlaps = await admin.query(
      "select a.id from allocations a join allocations b on a.id<b.id and a.resource_id=b.resource_id and a.occupied && b.occupied",
    );
    assert.equal(overlaps.rowCount, 0);
  });
  console.log(`${passed} booking reliability checks passed.`);
} catch (error) {
  console.error(error);
  if (!admin) console.error(logs.slice(-10).join("\n"));
  failed = true;
} finally {
  await Promise.allSettled(clients.map((c) => c.end()));
  if (hosted) {
    if (createdHostedDatabase) {
      assert.match(testDatabase, /^cc_reliability_[a-f0-9]{32}$/);
      // Session poolers may retain backend connections after clients disconnect.
      // FORCE targets only this run's disposable database, never the app database.
      await control.query(`drop database ${testDatabase} with (force)`);
      console.log("Removed isolated test database.");
    }
    if (control) {
      try {
        const after = (
          await control.query(
            "select jsonb_build_object('settings',(select to_jsonb(s) from public.settings s),'services',(select jsonb_agg(to_jsonb(s) order by id) from public.services s),'resources',(select jsonb_agg(to_jsonb(r) order by id) from public.resources r),'policies',(select jsonb_agg(to_jsonb(p) order by id) from public.policies p),'bookings',(select count(*) from public.bookings),'users',(select count(*) from auth.users),'notifications',(select count(*) from public.notification_jobs)) snapshot",
          )
        ).rows[0].snapshot;
        assert.deepEqual(
          after,
          hostedSnapshot,
          "Application data/configuration changed during testing",
        );
        console.log("Verified application configuration, account and booking counts unchanged.");
      } catch (error) {
        console.error(error);
        failed = true;
      } finally {
        await control.end();
      }
    }
  } else await server.stop();
  process.exitCode = failed ? 1 : 0;
}
