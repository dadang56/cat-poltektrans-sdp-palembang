// Tes otomatis untuk 04_password_vault_and_users_rls.sql (Postgres in-memory).
// Jalankan: npm i --no-save @electric-sql/pglite && node supabase/security/04_password_vault_and_users_rls.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'fs'

const DIR = process.argv[2] || new URL('.', import.meta.url).pathname
const db = new PGlite({ extensions: { pgcrypto } })
const q = (sql, p) => db.query(sql, p)
const ex = (sql) => db.exec(sql)
const one = async (sql, p) => (await q(sql, p)).rows[0]

// --- Stand-in for Supabase: roles, auth, vault, extensions ------------------
await ex(`
create role anon; create role authenticated;
create schema auth; create schema extensions; create schema vault;
create extension pgcrypto schema extensions;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table auth.users (instance_id uuid, id uuid primary key, aud text, role text, email text unique,
  encrypted_password text, email_confirmed_at timestamptz, banned_until timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz,
  confirmation_token text, recovery_token text, email_change_token_new text, email_change text);
create table auth.identities (id uuid primary key, user_id uuid references auth.users on delete cascade,
  provider_id text, provider text, identity_data jsonb, last_sign_in_at timestamptz,
  created_at timestamptz, updated_at timestamptz);
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text);
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(s text, n text, d text) returns uuid language sql as
  $$ insert into vault.secrets (name, secret, description) values (n, s, d) returning id $$;

create table public.users (id uuid primary key default gen_random_uuid(), auth_id uuid, nim_nip varchar not null,
  username varchar, nip varchar, nama varchar not null default 'x', email varchar, password varchar, role varchar,
  prodi_id uuid, kelas_id uuid, prodi_ids jsonb, kelas_ids jsonb, matkul_ids jsonb, status varchar default 'active',
  photo text, created_at timestamptz default now(), updated_at timestamptz, nilai_kondite numeric, nilai_semapta numeric,
  no_hp varchar, avatar_url text, is_active bool, session_token text, dosen_utama_id uuid, ttd_qr_enabled bool);
create table public.jadwal_ujian (id uuid primary key default gen_random_uuid(), matkul_id uuid, tipe varchar, status varchar, tahun_akademik varchar, parent_jadwal_id uuid);
create table public.soal (id uuid primary key default gen_random_uuid(), matkul_id uuid, dosen_id uuid, tipe_ujian varchar, tipe_soal varchar,
  pertanyaan text, pilihan jsonb, jawaban_benar jsonb, bobot int, gambar text, kelas_ids uuid[], created_at timestamptz default now(),
  updated_at timestamptz, tahun_akademik varchar, cluster_id uuid, cluster_label varchar, is_bank_soal bool, bank_soal_ref uuid,
  math_keyboard bool, pedoman_jawaban text);
create table public.hasil_ujian (id uuid primary key default gen_random_uuid(), jadwal_id uuid, mahasiswa_id uuid, nilai_total numeric,
  jumlah_benar int, jumlah_salah int, jumlah_kosong int, waktu_mulai timestamptz, waktu_selesai timestamptz, status varchar,
  answers_detail jsonb, nilai_tugas numeric, nilai_praktek numeric, created_at timestamptz default now(), updated_at timestamptz,
  nilai_uts numeric, nilai_uas numeric, jumlah_pelanggaran int, violation_log jsonb, nilai_final numeric, is_ulang bool,
  tambahan_waktu int, submit_type varchar, unique (jadwal_id, mahasiswa_id));
create table public.audit_logs (id uuid primary key default gen_random_uuid(), user_id uuid, action varchar, table_name varchar,
  record_id uuid, old_values jsonb, new_values jsonb, ip_address inet, user_agent text, extra_data jsonb, created_at timestamptz);
create table public.staff_accounts (id uuid primary key default gen_random_uuid(), username text, password text);
create policy "Allow all access" on public.users for all using (true);
create policy audit_all_access on public.audit_logs for all using (true) with check (true);
create policy "Staff accounts can be accessed by everyone" on public.staff_accounts for all using (true);
create schema backup_20261122;
create schema private;
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
`)

// Existing users with plaintext passwords (as in production before 04)
await ex(`
insert into public.users (nim_nip, username, role, password, nama) values
 ('2501', 'taruna.a', 'mahasiswa', 'rahasia1', 'Taruna A'),
 ('2502', null, 'mahasiswa', '123456', 'Taruna B'),
 ('D01', 'dosen.x', 'dosen', 'dosenpw', 'Dosen X'),
 ('AP1', 'adminprodi', 'admin_prodi', 'adminpw', 'Admin Prodi'),
 ('SA1', 'super', 'superadmin', 'superpw', 'Super Admin'),
 ('PB1', 'pusb', 'pusbangkatar', 'pusbpw', 'Pusbangkatar');
create table backup_20261122.users as table public.users;
insert into public.staff_accounts (username, password) values ('x', 'plain');
`)
// Users already migrated to Supabase Auth by step 01/02 (simulate)
await ex(`
do $$ declare r record; a uuid; begin
  for r in select * from public.users loop
    a := gen_random_uuid();
    insert into auth.users (id, email, encrypted_password) values (a, lower(r.nim_nip)||'@cat.poltektrans.local',
      extensions.crypt(r.password, extensions.gen_salt('bf', 4)));
    insert into auth.identities (id, user_id, provider, identity_data) values (gen_random_uuid(), a, 'email', '{}');
    update public.users set auth_id = a where id = r.id;
  end loop;
end $$;`)

await ex(readFileSync(`${DIR}/01_login_email_and_auth_sync.sql`, 'utf8'))
await ex(readFileSync(`${DIR}/03_exam_server_grading.sql`, 'utf8'))
await ex(readFileSync(`${DIR}/04_password_vault_and_users_rls.sql`, 'utf8'))

const uid = async (nim) => (await one(`select id, auth_id from public.users where nim_nip=$1`, [nim]))
const as = async (authId, role, fn) => {
  await ex(`set test.uid = '${authId || ''}'`)
  await ex(`set role ${role}`)
  try { return await fn() } finally { await ex('reset role') }
}
let fails = 0
const check = (label, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label} ${extra}`); if (!cond) fails++ }
const throws = async (label, fn) => { try { await fn(); check(label, false, '(no error)') } catch (e) { check(label, true, `-> ${e.message}`) } }
const authPwOk = async (nim, pw) => (await one(`select a.encrypted_password = extensions.crypt($2, a.encrypted_password) ok
   from public.users u join auth.users a on a.id = u.auth_id where u.nim_nip = $1`, [nim, pw]))?.ok === true

const A = await uid('2501'), B = await uid('2502'), D = await uid('D01'), AP = await uid('AP1'), SA = await uid('SA1'), PB = await uid('PB1')

// --- Migration result -------------------------------------------------------
check('no plaintext left in users.password', (await one(`select count(*)::int n from public.users where password is not null`)).n === 0)
check('no plaintext left in backup users', (await one(`select count(*)::int n from backup_20261122.users where password is not null`)).n === 0)
check('vault has 6 encrypted passwords', (await one(`select count(*)::int n from private.password_vault`)).n === 6)
check('vault content is not plaintext', !(await one(`select encode(enc,'escape') e from private.password_vault limit 1`)).e.includes('rahasia'))
check('existing login still works (same password)', await authPwOk('2501', 'rahasia1'))

// --- Superadmin views passwords --------------------------------------------
const seen = await as(SA.auth_id, 'authenticated', () => q(`select * from admin_view_passwords($1)`, [[A.id, B.id]]))
const byId = Object.fromEntries(seen.rows.map(r => [r.user_id, r.password]))
check('superadmin sees original passwords', byId[A.id] === 'rahasia1' && byId[B.id] === '123456', JSON.stringify(byId))
check('viewing is written to audit_logs', (await one(`select count(*)::int n from public.audit_logs where action='VIEW_PASSWORD'`)).n === 1)
await throws('admin_prodi cannot view passwords', () => as(AP.auth_id, 'authenticated', () => q(`select * from admin_view_passwords($1)`, [[A.id]])))
await throws('mahasiswa cannot view passwords', () => as(A.auth_id, 'authenticated', () => q(`select * from admin_view_passwords($1)`, [[A.id]])))
await throws('anon cannot view passwords', () => as(null, 'anon', () => q(`select * from admin_view_passwords($1)`, [[A.id]])))
await throws('nobody reads vault table directly', () => as(SA.auth_id, 'authenticated', () => q(`select * from private.password_vault`)))

// --- Admin creates a user / resets a password (apps write users.password) ---
const created = await as(AP.auth_id, 'authenticated', () => q(`insert into public.users (nim_nip, nama, role, password) values ('2599','Baru','mahasiswa','pwbaru1') returning id, auth_id, password`))
const nr = created.rows[0]
check('new user: password column stays empty', nr.password === null)
check('new user: Supabase Auth account created', !!nr.auth_id)
check('new user can log in with given password', await authPwOk('2599', 'pwbaru1'))
check('new user password is in vault', (await as(SA.auth_id, 'authenticated', () => q(`select * from admin_view_passwords($1)`, [[nr.id]]))).rows[0]?.password === 'pwbaru1')
await as(AP.auth_id, 'authenticated', () => q(`update public.users set password='reset99' where id=$1`, [B.id]))
check('admin reset: new password works', await authPwOk('2502', 'reset99'))
await as(AP.auth_id, 'authenticated', () => q(`update public.users set nama='B2', password='' where id=$1`, [B.id]))
check('edit with empty password keeps password', await authPwOk('2502', 'reset99'))
await as(AP.auth_id, 'authenticated', () => q(`update public.users set status='inactive' where id=$1`, [B.id]))
check('deactivate -> auth banned', (await one(`select banned_until from auth.users where id=$1`, [B.auth_id])).banned_until !== null)
await as(AP.auth_id, 'authenticated', () => q(`update public.users set status='active' where id=$1`, [B.id]))
check('reactivate -> auth unbanned', (await one(`select banned_until from auth.users where id=$1`, [B.auth_id])).banned_until === null)

// --- Self service ------------------------------------------------------------
await as(A.auth_id, 'authenticated', () => q(`update public.users set session_token='tok', no_hp='0812', nama='Taruna A2' where id=$1`, [A.id]))
check('student can update own profile/session token', true)
await as(A.auth_id, 'authenticated', () => q(`update public.users set password='baruku' where id=$1`, [A.id]))
check('student can change own password', await authPwOk('2501', 'baruku'))
await throws('student cannot make self superadmin', () => as(A.auth_id, 'authenticated', () => q(`update public.users set role='superadmin' where id=$1`, [A.id])))
await throws('student cannot change own role to dosen', () => as(A.auth_id, 'authenticated', () => q(`update public.users set role='dosen' where id=$1`, [A.id])))
await throws('student cannot change own NIM', () => as(A.auth_id, 'authenticated', () => q(`update public.users set nim_nip='9999' where id=$1`, [A.id])))
const other = await as(A.auth_id, 'authenticated', () => q(`update public.users set password='hack' where id=$1`, [B.id]))
check('student cannot reset another user password (0 rows)', other.affectedRows === 0 && await authPwOk('2502', 'reset99'))
await throws('student cannot insert users', () => as(A.auth_id, 'authenticated', () => q(`insert into public.users (nim_nip, nama, role, password) values ('x1','x','mahasiswa','x')`)))
const del = await as(A.auth_id, 'authenticated', () => q(`delete from public.users where id=$1`, [B.id]))
check('student cannot delete users (0 rows)', del.affectedRows === 0)
await as(D.auth_id, 'authenticated', () => q(`update public.users set nip='1987', ttd_qr_enabled=true where id=$1`, [D.id]))
check('dosen can update own NIP / TTD QR', true)

// --- Pusbangkatar -------------------------------------------------------------
await as(PB.auth_id, 'authenticated', () => q(`update public.users set nilai_kondite=88 where id=$1`, [A.id]))
check('pusbangkatar can set nilai_kondite', (await one(`select nilai_kondite from public.users where id=$1`, [A.id])).nilai_kondite == 88)
await throws('pusbangkatar cannot reset student password', () => as(PB.auth_id, 'authenticated', () => q(`update public.users set password='x' where id=$1`, [A.id])))

// --- Superadmin protection ----------------------------------------------------
await throws('admin_prodi cannot reset superadmin password', () => as(AP.auth_id, 'authenticated', () => q(`update public.users set password='takeover' where id=$1`, [SA.id])))
await throws('admin_prodi cannot create a superadmin', () => as(AP.auth_id, 'authenticated', () => q(`insert into public.users (nim_nip, nama, role, password) values ('SA9','x','superadmin','x')`)))
await throws('admin_prodi cannot promote someone to superadmin', () => as(AP.auth_id, 'authenticated', () => q(`update public.users set role='superadmin' where id=$1`, [D.id])))
await as(SA.auth_id, 'authenticated', () => q(`update public.users set password='superpw2' where id=$1`, [SA.id]))
check('superadmin can change own password', await authPwOk('SA1', 'superpw2'))

// --- Anon / reads -------------------------------------------------------------
await throws('anon cannot read users', () => as(null, 'anon', () => q(`select count(*) from public.users`)))
await throws('anon cannot update users', () => as(null, 'anon', () => q(`update public.users set password='x'`)))
check('logged-in user can list users', (await as(A.auth_id, 'authenticated', () => q(`select count(*)::int n from public.users`))).rows[0].n === 7)
check('login_email still resolves by NIM and username', (await as(null, 'anon', () => q(`select login_email('2501') a, login_email('dosen.x') b`))).rows[0].b === 'd01@cat.poltektrans.local')
await throws('staff_accounts locked', () => as(SA.auth_id, 'authenticated', () => q(`select * from public.staff_accounts`)))
check('audit_logs: student cannot read', (await as(A.auth_id, 'authenticated', () => q(`select count(*)::int n from public.audit_logs`))).rows[0].n === 0)
await as(A.auth_id, 'authenticated', () => q(`insert into public.audit_logs (action) values ('LOGIN')`))
check('audit_logs: student can write a log entry', true)
await throws('audit_logs: nobody can delete', () => as(SA.auth_id, 'authenticated', () => q(`delete from public.audit_logs`)))

// --- Delete user cleans up auth + vault ------------------------------------
await as(AP.auth_id, 'authenticated', () => q(`delete from public.users where id=$1`, [nr.id]))
check('deleting user removes auth account and vault entry',
  (await one(`select count(*)::int n from auth.users where id=$1`, [nr.auth_id])).n === 0 &&
  (await one(`select count(*)::int n from private.password_vault where user_id=$1`, [nr.id])).n === 0)

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
process.exit(fails ? 1 : 0)
