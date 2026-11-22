// Tes otomatis untuk 03_exam_server_grading.sql (Postgres in-memory).
// Jalankan: npm i --no-save @electric-sql/pglite && node supabase/security/03_exam_server_grading.test.mjs
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'fs'

const db = new PGlite()
const q = (sql, p) => db.query(sql, p)
const ex = (sql) => db.exec(sql)

// --- Minimal stand-in for the production schema ---------------------------
await ex(`
create role anon; create role authenticated;
create schema auth; create schema extensions;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create table public.users (id uuid primary key default gen_random_uuid(), auth_id uuid, nim_nip text, role text, status text default 'active', password text);
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
create policy "Allow all access" on public.soal for all using (true);
create policy "Allow all access" on public.hasil_ujian for all using (true);
create schema private;
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
`)

await ex(readFileSync(new URL('./03_exam_server_grading.sql', import.meta.url), 'utf8'))

// --- Data -------------------------------------------------------------------
const M = '11111111-1111-1111-1111-111111111111'
const C = '22222222-2222-2222-2222-222222222222'
const ids = {}
const one = async (sql, p) => (await q(sql, p)).rows[0]
const mhsAuth = '33333333-3333-3333-3333-333333333333'
const dosenAuth = '44444444-4444-4444-4444-444444444444'
const mhs = (await one(`insert into users (auth_id, nim_nip, role) values ($1,'2501','mahasiswa') returning id`, [mhsAuth])).id
const mhs2Auth = '55555555-5555-5555-5555-555555555555'
const mhs2 = (await one(`insert into users (auth_id, nim_nip, role) values ($1,'2502','mahasiswa') returning id`, [mhs2Auth])).id
await one(`insert into users (auth_id, nim_nip, role) values ($1,'D1','dosen') returning id`, [dosenAuth])
const J = (await one(`insert into jadwal_ujian (matkul_id, tipe, status, tahun_akademik) values ($1,'UTS','ongoing','2026/2027 Ganjil') returning id`, [M])).id
const JU = (await one(`insert into jadwal_ujian (matkul_id, tipe, status, tahun_akademik, parent_jadwal_id) values ($1,'ULANG','ongoing','2026/2027 Ganjil',$2) returning id`, [M, J])).id
const JC = (await one(`insert into jadwal_ujian (matkul_id, tipe, status, tahun_akademik) values ($1,'UAS','completed','2026/2027 Ganjil') returning id`, [M])).id
const add = async (name, tipe_soal, jb, bobot, cluster = null, ta = '2026/2027 Ganjil', tu = 'UTS') => {
  ids[name] = (await one(`insert into soal (matkul_id, tipe_ujian, tipe_soal, pertanyaan, pilihan, jawaban_benar, bobot, cluster_id, tahun_akademik)
    values ($1,$2,$3,$4,'["a","b","c","d"]',$5,$6,$7,$8) returning id`, [M, tu, tipe_soal, name, JSON.stringify(jb), bobot, cluster, ta])).id
}
await add('pg_num', 'pilihan_ganda', 2, 10)
await add('pg_letter', 'pilihan_ganda', 'B', 10)
await add('bs', 'benar_salah', true, 10)
await add('essay', 'uraian', null, 20)
await add('clA', 'pilihan_ganda', 0, 10, C)
await add('clB', 'pilihan_ganda', 1, 10, C)
await add('other_year', 'pilihan_ganda', 0, 10, null, '2025/2026 Genap')
await add('uas', 'pilihan_ganda', 0, 10, null, '2026/2027 Ganjil', 'UAS')

const as = async (authId, role, fn) => {
  await ex(`set test.uid = '${authId || ''}'`)
  await ex(`set role ${role}`)
  try { return await fn() } finally { await ex('reset role') }
}
let fails = 0
const check = (label, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${label} ${extra}`); if (!cond) fails++ }
const throws = async (label, fn) => { try { await fn(); check(label, false, '(no error)') } catch (e) { check(label, true, `-> ${e.message}`) } }

// 1. Student gets questions without answer key, only in-scope
const qs = await as(mhsAuth, 'authenticated', () => q(`select * from exam_questions($1)`, [J]))
check('exam_questions returns 6 UTS questions of this year', qs.rows.length === 6, `(got ${qs.rows.length})`)
check('no jawaban_benar column returned', !('jawaban_benar' in qs.rows[0]))
const qsC = await as(mhsAuth, 'authenticated', () => q(`select * from exam_questions($1)`, [JC]))
check('no questions when jadwal not ongoing', qsC.rows.length === 0)
const qsAnon = await as(null, 'anon', () => q(`select count(*)::int n from soal`).catch(e => ({ err: e.message })))
check('anon cannot read soal', !!qsAnon.err, qsAnon.err ? `-> ${qsAnon.err}` : '')
const soalMhs = await as(mhsAuth, 'authenticated', () => q(`select count(*)::int n from soal`))
check('student sees 0 rows of soal table', soalMhs.rows[0].n === 0)
const soalDosen = await as(dosenAuth, 'authenticated', () => q(`select count(*)::int n from soal`))
check('dosen sees all soal', soalDosen.rows[0].n === 8)

// 2. Student starts exam (in_progress row), cannot set grades
await as(mhsAuth, 'authenticated', () => q(`insert into hasil_ujian (jadwal_id, mahasiswa_id, status, waktu_mulai) values ($1,$2,'in_progress', now())
  on conflict (jadwal_id, mahasiswa_id) do update set status = excluded.status, waktu_mulai = excluded.waktu_mulai`, [J, mhs]))
check('student can start exam (upsert in_progress)', true)
await as(mhsAuth, 'authenticated', () => q(`insert into hasil_ujian (jadwal_id, mahasiswa_id, status, waktu_mulai) values ($1,$2,'in_progress', now())
  on conflict (jadwal_id, mahasiswa_id) do update set status = excluded.status, waktu_mulai = excluded.waktu_mulai`, [J, mhs]))
check('student can re-run start upsert', true)
await as(mhsAuth, 'authenticated', () => q(`update hasil_ujian set answers_detail='[]', jumlah_pelanggaran=1, violation_log='[]' where jadwal_id=$1 and mahasiswa_id=$2`, [J, mhs]))
check('student can autosave answers & violations', true)
await throws('student cannot set nilai_total', () => as(mhsAuth, 'authenticated', () => q(`update hasil_ujian set nilai_total=100 where jadwal_id=$1 and mahasiswa_id=$2`, [J, mhs])))
await throws('student cannot set status graded', () => as(mhsAuth, 'authenticated', () => q(`update hasil_ujian set status='graded' where jadwal_id=$1 and mahasiswa_id=$2`, [J, mhs])))
await throws('student cannot insert graded row', () => as(mhsAuth, 'authenticated', () => q(`insert into hasil_ujian (jadwal_id, mahasiswa_id, status, nilai_total) values ($1,$2,'graded',100)`, [JU, mhs])))
await throws('student cannot insert for another student', () => as(mhsAuth, 'authenticated', () => q(`insert into hasil_ujian (jadwal_id, mahasiswa_id, status) values ($1,$2,'in_progress')`, [JU, mhs2])))
const upd2 = await as(mhsAuth, 'authenticated', () => q(`update hasil_ujian set answers_detail='[]' where mahasiswa_id=$1`, [mhs2]))
check('student update on other student row affects 0 rows', upd2.affectedRows === 0)
const del = await as(mhsAuth, 'authenticated', () => q(`delete from hasil_ujian where mahasiswa_id=$1`, [mhs]))
check('student delete removes 0 rows', del.affectedRows === 0 && (await q(`select count(*)::int n from hasil_ujian where mahasiswa_id=$1`, [mhs])).rows[0].n === 1)
await throws('anon cannot write hasil_ujian', () => as(null, 'anon', () => q(`update hasil_ujian set nilai_total=1`)))

// 3. Submit: grading on server
// pg_num correct (2), pg_letter correct (1 == 'B'), bs wrong (false), essay answered, clA chosen & correct (0), plus a bogus id and an out-of-scope id
const answers = [
  { questionId: ids.pg_num, answer: 2 },
  { questionId: ids.pg_letter, answer: 1 },
  { questionId: ids.bs, answer: false },
  { questionId: ids.essay, answer: 'jawaban esai' },
  { questionId: ids.clA, answer: 0 },
  { questionId: ids.other_year, answer: 0 },
  { questionId: 'not-a-uuid', answer: 0 },
]
const res = (await as(mhsAuth, 'authenticated', () => q(`select submit_exam($1, $2::jsonb, 'manual') r`, [J, JSON.stringify(answers)]))).rows[0].r
// earned: 10+10+0+10 = 30 ; max: 10+10+10+20+10 = 60 -> 50.00
check('score = 30/60 -> 50', Number(res.nilai_total) === 50 && Number(res.skor) === 30 && Number(res.skor_maks) === 60, JSON.stringify(res))
check('status submitted (has essay)', res.status === 'submitted')
check('jumlah_benar 3, salah 1, kosong 0', res.jumlah_benar === 3 && res.jumlah_salah === 1 && res.jumlah_kosong === 0)
const row = (await q(`select * from hasil_ujian where jadwal_id=$1 and mahasiswa_id=$2`, [J, mhs])).rows[0]
check('answers_detail has 5 items, no correctAnswer', row.answers_detail.length === 5 && !JSON.stringify(row.answers_detail).includes('correctAnswer'))
check('answers_detail in presented order', row.answers_detail[0].questionId === ids.pg_num && row.answers_detail[4].questionId === ids.clA)
const again = (await as(mhsAuth, 'authenticated', () => q(`select submit_exam($1, '[]'::jsonb) r`, [J]))).rows[0].r
check('second submit returns existing result, no change', again.already_submitted === true && Number(again.nilai_total) === 50)
await throws('student cannot autosave after submit', () => as(mhsAuth, 'authenticated', () => q(`update hasil_ujian set answers_detail='[]' where jadwal_id=$1 and mahasiswa_id=$2`, [J, mhs])))

// 4. Omitting questions does not raise the percentage
const res2 = (await as(mhs2Auth, 'authenticated', () => q(`select submit_exam($1, $2::jsonb, 'auto') r`, [J, JSON.stringify([{ questionId: ids.pg_num, answer: 2 }])]))).rows[0].r
// earned 10; max = 10 + missing standalone (pg_letter 10, bs 10, essay 20) + missing cluster (max 10) = 60
check('omitted questions still count in max (10/60)', Number(res2.skor_maks) === 60 && Number(res2.nilai_total) === 16.67, JSON.stringify(res2))

// 5. ULANG uses parent tipe and caps at 70
const all = [ids.pg_num, ids.pg_letter, ids.bs, ids.clB].map((id, i) => ({ questionId: id, answer: [2, 'B', true, 1][i] }))
all.push({ questionId: ids.essay, answer: null })
await q(`update soal set tipe_soal='pilihan_ganda', jawaban_benar='0' where id=$1`, [ids.essay])
all[4].answer = 0
const res3 = (await as(mhs2Auth, 'authenticated', () => q(`select submit_exam($1, $2::jsonb) r`, [JU, JSON.stringify(all)]))).rows[0].r
check('ULANG: 100% capped to 70, graded', Number(res3.nilai_total) === 100 && Number(res3.nilai_final) === 70 && res3.status === 'graded', JSON.stringify(res3))

// 6. Cheating submit
await throws('dosen cannot call submit_exam', () => as(dosenAuth, 'authenticated', () => q(`select submit_exam($1, '[]'::jsonb)`, [J])))
await throws('anon cannot call submit_exam', () => as(null, 'anon', () => q(`select submit_exam($1, '[]'::jsonb)`, [J])))

// 7. Staff can still edit grades (KoreksiUjian)
await as(dosenAuth, 'authenticated', () => q(`update hasil_ujian set nilai_total=80, status='graded' where jadwal_id=$1 and mahasiswa_id=$2`, [J, mhs]))
check('dosen can regrade', (await q(`select nilai_total from hasil_ujian where jadwal_id=$1 and mahasiswa_id=$2`, [J, mhs])).rows[0].nilai_total == 80)
const seeOwn = await as(mhsAuth, 'authenticated', () => q(`select count(*)::int n from hasil_ujian`))
check('student sees only own hasil rows', seeOwn.rows[0].n === 1, `(got ${seeOwn.rows[0].n})`)

console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED')
process.exit(fails ? 1 : 0)
