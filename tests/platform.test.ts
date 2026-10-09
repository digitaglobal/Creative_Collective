import { parseMoneyMinor } from "../src/lib/money";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { calendarText, venueDate } from "../src/lib/booking";

let db: PGlite;
const alice = "10000000-0000-0000-0000-000000000001";
const bob = "10000000-0000-0000-0000-000000000002";
const staff = "10000000-0000-0000-0000-000000000003";
let start: string;
let booking: string;
const key = "20000000-0000-0000-0000-000000000001";
const policies =
  '{"cancellation":1,"refund":1,"no_show":1,"late_arrival":1,"house_rules":1,"privacy":1,"terms":1}';
async function actor(id: string, role = "authenticated") {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${id}',false); set role ${role};`,
  );
}
async function reserve(at = start, idempotency = key) {
  return db.query<{ id: string; total_minor: number }>(
    `select * from public.submit_booking('svc-enigma-meeting',$1::timestamptz,60,2,$2::uuid,$3::jsonb)`,
    [at, idempotency, policies],
  );
}
beforeAll(async () => {
  db = new PGlite({ extensions: { btree_gist, pgcrypto } });
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key, email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to anon,authenticated,service_role;
  grant execute on function auth.uid() to anon,authenticated,service_role;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid,bucket_id text); alter table storage.objects enable row level security;`);
  for (const file of readdirSync("supabase/migrations").sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  // Match Supabase's table grants; RLS must enforce isolation even with these grants.
  await db.exec(`grant usage on schema public to anon,authenticated,service_role;
   grant select on all tables in schema public to anon,authenticated;
   grant select,insert,update,delete on all tables in schema public to service_role;
   revoke update on profiles from anon,authenticated; grant update(full_name,phone) on profiles to authenticated;
   insert into auth.users values
   ('${alice}','alice@example.invalid',now(),'{"full_name":"Alice","phone":"8761111111"}'),
   ('${bob}','bob@example.invalid',now(),'{"full_name":"Bob","phone":"8762222222"}'),
   ('${staff}','staff@example.invalid',now(),'{"full_name":"Staff","phone":"8763333333"}');
   update profiles set role='administrator' where id='${staff}';`);
  const result = await db.query<{ start: string }>(
    `select (((now() at time zone 'America/Jamaica')::date + 7 + ((8-extract(dow from (now() at time zone 'America/Jamaica')::date+7)::integer)%7))::text || 'T10:00:00-05:00') as start`,
  );
  start = result.rows[0]!.start;
});
afterAll(async () => {
  await db.close();
});

describe("database-backed booking platform", () => {
  it("installs all migrations and disables booking until approved", async () => {
    await actor(alice);
    await expect(reserve()).rejects.toThrow(/approval|approved/);
    await db.exec(
      "reset role; update settings set launch_approved=true,tax_basis_points=1500; update policies set approved=true; update resources set approved=true; update services set approved=true;",
    );
  });
  it("creates an immutable server-priced reservation and retries exactly once", async () => {
    await actor(alice);
    const first = await reserve();
    booking = first.rows[0]!.id;
    expect(Number(first.rows[0]!.total_minor)).toBe(575000);
    const retry = await reserve();
    expect(retry.rows[0]!.id).toBe(booking);
    const { rows } = await db.query("select * from allocations");
    expect(rows).toHaveLength(0); // customer cannot read internal allocations
  });
  it("rejects overlapping reservations but allows adjacent intervals", async () => {
    await actor(bob);
    await expect(reserve(start, "20000000-0000-0000-0000-000000000002")).rejects.toThrow(
      /just reserved/,
    );
    const adjacent = start.replace("T10:", "T11:");
    expect((await reserve(adjacent, "20000000-0000-0000-0000-000000000003")).rows).toHaveLength(1);
  });
  it("denies cross-customer reads, writes, role escalation and internal RPCs", async () => {
    await actor(bob);
    expect((await db.query("select * from bookings where id=$1", [booking])).rows).toHaveLength(0);
    await expect(
      db.query("update bookings set total_minor=1 where id=$1 returning id", [booking]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.exec(`update profiles set role='administrator' where id='${bob}'`),
    ).rejects.toThrow(/permission denied/);
    await expect(db.query("select transition_booking($1,'confirmed')", [booking])).rejects.toThrow(
      /Staff access/,
    );
    await expect(db.exec("select expire_reservations() ")).rejects.toThrow(/permission denied/);
  });
  it("rejects invalid duration, notice, capacity, policies and extras", async () => {
    await actor(alice);
    for (const [duration, attendees] of [
      [-60, 1],
      [65, 1],
      [60, 99],
    ]) {
      await expect(
        db.query("select submit_booking('svc-enigma-meeting',$1, $2, $3, gen_random_uuid(),$4)", [
          start,
          duration,
          attendees,
          policies,
        ]),
      ).rejects.toThrow();
    }
    await expect(
      db.query("select submit_booking('svc-enigma-meeting',now(),60,1,gen_random_uuid(),$1)", [
        policies,
      ]),
    ).rejects.toThrow(/notice/);
    await expect(
      db.query("select submit_booking('svc-enigma-meeting',$1,60,1,gen_random_uuid(),'{}')", [
        start,
      ]),
    ).rejects.toThrow(/policies/);
    await expect(
      db.query(
        "select submit_booking('svc-enigma-meeting',$1,60,1,gen_random_uuid(),$2,array['unknown'])",
        [start, policies],
      ),
    ).rejects.toThrow(/Unknown extra/);
  });
  it("approves and records retry-safe partial payments and separate refunds", async () => {
    await actor(staff);
    await db.query("select transition_booking($1,'confirmed')", [booking]);
    const paymentKey = "30000000-0000-0000-0000-000000000001";
    for (let i = 0; i < 2; i++)
      await db.query("select record_payment($1,100000,'payment','cash','receipt-1',$2)", [
        booking,
        paymentKey,
      ]);
    const paid = await db.query<{ paid_minor: number }>(
      "select paid_minor from bookings where id=$1",
      [booking],
    );
    expect(Number(paid.rows[0]!.paid_minor)).toBe(100000);
    await db.query("select transition_booking($1,'cancelled')", [booking]);
    const stillPaid = await db.query<{ paid_minor: number }>(
      "select paid_minor from bookings where id=$1",
      [booking],
    );
    expect(Number(stillPaid.rows[0]!.paid_minor)).toBe(100000);
    await expect(
      db.query("select record_payment($1,100001,'refund','cash','refund',gen_random_uuid())", [
        booking,
      ]),
    ).rejects.toThrow(/exceeds/);
    await db.query("select record_payment($1,100000,'refund','cash','refund',gen_random_uuid())", [
      booking,
    ]);
  });
  it("keeps the original booking when a reschedule conflicts and atomically moves it when approved", async () => {
    await actor(alice);
    const created = await reserve(start, "20000000-0000-0000-0000-000000000004");
    const id = created.rows[0]!.id;
    const at = start.replace("T10:", "T11:");
    const ending = start.replace("T10:", "T12:");
    const change = await db.query<{ id: string }>(
      "select * from request_change($1,'reschedule',$2,$3,'New time please')",
      [id, at, ending],
    );
    await actor(staff);
    const request = change.rows[0]!.id;
    expect(
      (
        await db.query<{ preview_change: { totalMinor: number } }>("select preview_change($1)", [
          request,
        ])
      ).rows[0]!.preview_change.totalMinor,
    ).toBe(575000);
    await expect(db.query("select review_change($1,true,575000)", [request])).rejects.toThrow(
      /just reserved/,
    );
    expect(
      (
        await db.query<{ starts_at: Date }>("select starts_at from bookings where id=$1", [id])
      ).rows[0]!.starts_at.toISOString(),
    ).toBe(new Date(start).toISOString());
    await db.exec("reset role;");
    await db.query("update change_requests set proposed_start=$2,proposed_end=$3 where id=$1", [
      request,
      start.replace("T10:", "T13:"),
      start.replace("T10:", "T14:"),
    ]);
    await actor(staff);
    await db.query("select review_change($1,true,575000)", [request]);
    expect(
      (
        await db.query<{ starts_at: Date }>("select starts_at from bookings where id=$1", [id])
      ).rows[0]!.starts_at.toISOString(),
    ).toBe(new Date(start.replace("T10:", "T13:")).toISOString());
  });
  it("offers versioned long-rental quotes without allocating space, then accepts once", async () => {
    await actor(alice);
    const enquiry = await db.query<{ id: string }>(
      "select submit_enquiry('svc-enigma-meeting','Alice','alice@example.invalid','8761111111',$1::date,$1::date,'daily',2,'Long rental') as id",
      [start.slice(0, 10)],
    );
    await actor(staff);
    const id = enquiry.rows[0]!.id;
    const qs = start.replace("T10:", "T15:");
    const qe = start.replace("T10:", "T17:");
    const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const first = await db.query<{ id: string }>(
      'select * from create_quote($1,$2,$3,\'[{"label":"Long rental","amountMinor":1000000}]\',$4,\'Pay on arrival\')',
      [id, qs, qe, expiry],
    );
    const second = await db.query<{ id: string; version: number }>(
      'select * from create_quote($1,$2,$3,\'[{"label":"Long rental","amountMinor":1000000}]\',$4,\'Pay on arrival\')',
      [id, qs, qe, expiry],
    );
    expect(second.rows[0]!.version).toBe(2);
    expect(
      (
        await db.query("select * from allocations where occupied && tstzrange($1,$2,'[)')", [
          qs,
          qe,
        ])
      ).rows,
    ).toHaveLength(0);
    await actor(alice);
    await expect(
      db.query("select accept_quote($1,$2)", [first.rows[0]!.id, policies]),
    ).rejects.toThrow(/superseded/);
    const accepted = await db.query<{ id: string; total_minor: number }>(
      "select * from accept_quote($1,$2)",
      [second.rows[0]!.id, policies],
    );
    expect(Number(accepted.rows[0]!.total_minor)).toBe(1150000);
    expect(
      (
        await db.query<{ id: string }>("select * from accept_quote($1,$2)", [
          second.rows[0]!.id,
          policies,
        ])
      ).rows[0]!.id,
    ).toBe(accepted.rows[0]!.id);
  });
  it("expires pending requests and frees resources", async () => {
    await db.exec("reset role;");
    await db.exec(
      "update bookings set expires_at=now()-interval '1 second' where booking_state='pending_confirmation'; select expire_reservations();",
    );
    const expired = await db.query("select * from allocations");
    expect(expired.rows).toHaveLength(0);
  });
  it("claims notification work once and keeps jobs private", async () => {
    await actor(staff, "service_role");
    const first = await db.query("select * from claim_notifications(25)");
    expect(first.rows.length).toBeGreaterThan(0);
    const second = await db.query("select * from claim_notifications(25)");
    expect(second.rows).toHaveLength(0);
    await actor(alice);
    expect((await db.query("select * from notification_jobs")).rows).toHaveLength(0);
  });
  it("rejects unverified accounts and enforces the service acknowledgement on the server", async () => {
    await db.exec("reset role;");
    const unverified = "10000000-0000-0000-0000-000000000004";
    await db.query(
      `insert into auth.users values($1,'unverified@example.invalid',null,'{"full_name":"Unverified","phone":"8764444444"}')`,
      [unverified],
    );
    await actor(unverified);
    await expect(reserve(start, "20000000-0000-0000-0000-000000000099")).rejects.toThrow(
      /Verify your email/,
    );
    await actor(alice);
    await expect(
      db.query("select submit_booking('svc-enigma-booth',$1,60,1,gen_random_uuid(),$2)", [
        start,
        policies,
      ]),
    ).rejects.toThrow(/acknowledgement/);
  });
  it("enforces closures, setup buffers and server-priced equipment extras", async () => {
    await db.exec("reset role;");
    await db.query(
      "insert into closures(resource_id,starts_at,ends_at,reason) values('res-enigma-meeting',$1,$2,'Maintenance')",
      [start, start.replace("T10:", "T11:")],
    );
    await actor(alice);
    await expect(reserve(start, "20000000-0000-0000-0000-000000000090")).rejects.toThrow(/closed/);
    await db.exec("reset role; delete from closures; update settings set buffer_minutes=15;");
    await actor(alice);
    const first = await reserve(start, "20000000-0000-0000-0000-000000000091");
    await expect(
      reserve(start.replace("T10:", "T11:"), "20000000-0000-0000-0000-000000000092"),
    ).rejects.toThrow(/just reserved/);
    await actor(staff);
    await db.query("select transition_booking($1,'cancelled')", [first.rows[0]!.id]);
    await db.exec("reset role; update settings set buffer_minutes=0;");
    await db.exec(`update services set document=jsonb_set(document,'{addons}','[{"id":"test-extra","name":"Equipment","description":"Test equipment","basis":"per-hour","amountMinor":100000,"status":"published"}]') where id='svc-enigma-meeting';
    insert into extra_resources values('svc-enigma-meeting','test-extra','res-enigma-booth');`);
    await actor(alice);
    const withExtra = await db.query<{ id: string; total_minor: number }>(
      "select * from submit_booking('svc-enigma-meeting',$1,120,1,gen_random_uuid(),$2,array['test-extra'])",
      [start, policies],
    );
    expect(Number(withExtra.rows[0]!.total_minor)).toBe(1380000);
    const occupied = await db.query<{ available_slots: { start: string; available: boolean }[] }>(
      "select available_slots('svc-enigma-booth',$1::date,60)",
      [start.slice(0, 10)],
    );
    expect(occupied.rows[0]!.available_slots.find((s) => s.start === "10:00")?.available).toBe(
      false,
    );
    await actor(staff);
    await db.query("select transition_booking($1,'cancelled')", [withExtra.rows[0]!.id]);
  });
  it("requires policy version increments and records configuration changes", async () => {
    await actor(staff);
    await expect(
      db.exec("update policies set body='Changed wording' where id='terms'"),
    ).rejects.toThrow(/Increase the policy version/);
    await db.exec("update policies set body='Changed wording',version=2 where id='terms'");
    expect(
      (await db.query("select * from audit_events where action='configuration_update'")).rows
        .length,
    ).toBeGreaterThan(0);
    await actor(alice);
    await expect(reserve(start, "20000000-0000-0000-0000-000000000098")).rejects.toThrow(
      /policies/,
    );
  });
});

it("uses Jamaica's date near the UTC boundary and escapes calendar text", () => {
  expect(venueDate(new Date("2026-10-09T02:00:00Z"))).toBe("2026-10-08");
  const text = calendarText({
    id: "one",
    service_name: "Room, one;two",
    reference: "CC-1",
    starts_at: "2026-10-09T15:00:00Z",
    ends_at: "2026-10-09T16:00:00Z",
    arrival_instructions: "Line\nTwo",
  } as never);
  expect(text).toContain("DTSTART:20261009T150000Z");
  expect(text).toContain("Room\\, one\\;two");
  expect(text).toContain("Line\\nTwo");
});

it("converts JMD amounts without fractional-cent rounding or unsafe integers", () => {
  expect(parseMoneyMinor("5750.25")).toBe(575025);
  expect(parseMoneyMinor("0.01")).toBe(1);
  for (const value of ["1.001", "-1", "NaN", "1e5", "999999999999999999999"])
    expect(() => parseMoneyMinor(value)).toThrow();
});
