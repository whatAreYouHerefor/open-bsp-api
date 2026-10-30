import { fileURLToPath } from "node:url";
import { PGlite } from "npm:@electric-sql/pglite@0.5.13";
import { readFile } from "node:fs/promises";
const db = new PGlite();
await db.exec(`create role authenticated; create role anon; create schema auth;
create table auth.users(id uuid primary key); create table public.organizations(id uuid primary key);
create table public.test_membership(user_id uuid, organization_id uuid);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function public.get_authorized_orgs(text) returns setof uuid language sql stable security definer set search_path=public as $$ select organization_id from public.test_membership where user_id=auth.uid() $$;
create function public.moddatetime() returns trigger language plpgsql as $$ begin new.updated_at=clock_timestamp(); return new; end $$;
grant usage on schema auth, public to authenticated;
insert into auth.users values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
insert into organizations values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');
insert into test_membership values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111'),('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','22222222-2222-2222-2222-222222222222');`);
const root = fileURLToPath(new URL("../", import.meta.url));
const sql = (await readFile(
  root + "supabase/schemas/03_models/03-15_workspace_chats.sql",
  "utf8",
)) + "\n" +
  (await readFile(
    root + "supabase/schemas/05_rls/05-15_workspace_chats_rls.sql",
    "utf8",
  ));
await db.exec(sql);
const asUser = async (user) =>
  db.exec(
    `reset role; set role authenticated; set "request.jwt.claim.sub"='${user}';`,
  );
const a = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  b = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  org = "11111111-1111-1111-1111-111111111111";
let passed = 0;
const assert = (x, label) => {
  if (!x) throw Error(label);
  passed++;
  console.log("PASS " + label);
};
const rejects = async (sql, label) => {
  try {
    await db.exec(sql);
  } catch (e) {
    if (e.code === "42501") {
      assert(true, label);
      return;
    }
    throw e;
  }
  throw Error("Unexpected permission: " + label);
};
await asUser(a);
const created = await db.query(
  `insert into workspace_chats(organization_id,user_id,title,turns) values ($1,$2,'Carlos','[{"role":"user","content":"What did Carlos say?"}]') returning id,updated_at`,
  [org, a],
);
const id = created.rows[0].id, version = created.rows[0].updated_at;
assert(created.rows.length === 1, "owner can save chat");
await asUser(b);
assert(
  (await db.query("select * from workspace_chats")).rows.length === 0,
  "another user and tenant cannot read saved chat",
);
await rejects(
  `insert into workspace_chats(organization_id,user_id,title) values ('${org}','${b}','intrusion')`,
  "cannot save into another tenant",
);
await asUser(a);
assert(
  (await db.query("select * from workspace_chats where id=$1", [id])).rows[0]
    .title === "Carlos",
  "owner can reopen saved chat",
);
await db.query("update workspace_chats set title=$1 where id=$2", [
  "Updated",
  id,
]);
assert(
  (await db.query(
    "update workspace_chats set title=$1 where id=$2 and updated_at=$3 returning id",
    ["Stale", id, version],
  )).rows.length === 0,
  "stale save cannot overwrite current history",
);
await rejects(
  `update workspace_chats set organization_id='22222222-2222-2222-2222-222222222222' where id='${id}'`,
  "tenant identity is immutable",
);
await db.exec(`reset role; delete from test_membership where user_id='${a}'`);
await asUser(a);
assert(
  (await db.query("select * from workspace_chats")).rows.length === 0,
  "revoked membership removes history access",
);
await db.exec("reset role; set role anon;");
await rejects(
  "select * from workspace_chats",
  "anonymous history access denied",
);
console.log(`${passed} database behavior checks passed`);
await db.close();
