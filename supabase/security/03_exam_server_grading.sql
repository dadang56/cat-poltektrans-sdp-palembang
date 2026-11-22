-- =============================================================================
-- SECURITY FIX TAHAP 2a — integritas ujian CAT
--
-- 1. Kunci jawaban (soal.jawaban_benar) tidak lagi dikirim ke HP peserta.
--    Peserta mengambil soal lewat RPC exam_questions() tanpa kunci jawaban.
-- 2. Nilai dihitung di server lewat RPC submit_exam(), bukan di HP peserta.
-- 3. Peserta tidak bisa mengubah nilai/status hasil_ujian, dan hanya bisa
--    membaca hasil miliknya sendiri.
-- 4. Tabel soal dan hasil_ujian tertutup untuk anon (tanpa login).
--
-- Jalankan SETELAH versi CAT yang memakai exam_questions/submit_exam
-- ter-deploy. Pengguna dengan sesi lama (sebelum login lewat Supabase Auth)
-- diminta login ulang oleh versi baru ketiga aplikasi.
-- =============================================================================

grant usage on schema private to anon, authenticated;

-- Helper: user aplikasi yang sedang login ----------------------------------------
create or replace function private.app_user_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.users where auth_id = auth.uid() limit 1
$$;

create or replace function private.app_role()
returns text language sql stable security definer set search_path = '' as $$
  select role::text from public.users where auth_id = auth.uid() limit 1
$$;

-- Boleh membuat/membaca bank soal (dengan kunci jawaban)
create or replace function private.is_soal_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.app_role() in
    ('superadmin', 'admin', 'admin_prodi', 'dosen', 'asisten_dosen'), false)
$$;

-- Semua peran selain mahasiswa (dosen, pengawas, admin, pusbangkatar, ...)
create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.app_role() is not null and private.app_role() <> 'mahasiswa', false)
$$;

revoke all on function private.app_user_id(), private.app_role(),
  private.is_soal_staff(), private.is_staff() from public;
grant execute on function private.app_user_id(), private.app_role(),
  private.is_soal_staff(), private.is_staff() to anon, authenticated;

-- Soal yang termasuk satu jadwal ujian ------------------------------------------
-- Sama dengan logika TakeExam: matkul jadwal, tipe ujian (ULANG memakai tipe
-- jadwal induk), dan tahun akademik jadwal.
create or replace function private.exam_soal(p_jadwal_id uuid)
returns setof public.soal language sql stable security definer set search_path = '' as $$
  select s.*
    from public.jadwal_ujian j
    left join public.jadwal_ujian p on p.id = j.parent_jadwal_id
    join public.soal s
      on s.matkul_id = j.matkul_id
     and upper(s.tipe_ujian) = upper(case when upper(j.tipe) = 'ULANG' and p.id is not null
                                          then p.tipe else j.tipe end)
     and s.tahun_akademik = j.tahun_akademik
   where j.id = p_jadwal_id
$$;
revoke all on function private.exam_soal(uuid) from public, anon, authenticated;

-- RPC: soal untuk peserta, TANPA kunci jawaban & pedoman --------------------------
create or replace function public.exam_questions(p_jadwal_id uuid)
returns table (
  id uuid, tipe_soal text, tipe_ujian text, pertanyaan text, pilihan jsonb,
  bobot integer, gambar text, cluster_id uuid, math_keyboard boolean
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    return;
  end if;
  -- Peserta hanya mendapat soal saat jadwal sedang berlangsung
  if not private.is_staff() and not exists (
    select 1 from public.jadwal_ujian j where j.id = p_jadwal_id and j.status = 'ongoing'
  ) then
    return;
  end if;

  return query
    select s.id, s.tipe_soal::text, s.tipe_ujian::text, s.pertanyaan, s.pilihan,
           s.bobot, s.gambar, s.cluster_id, s.math_keyboard
      from private.exam_soal(p_jadwal_id) s
     order by s.created_at;
end;
$$;
revoke all on function public.exam_questions(uuid) from public;
grant execute on function public.exam_questions(uuid) to authenticated;

-- Normalisasi jawaban pilihan ganda: "A".."E" -> 0..4, angka -> angka
create or replace function private.pg_index(v jsonb)
returns numeric language sql immutable set search_path = '' as $$
  select case
    when v is null or jsonb_typeof(v) = 'null' then null
    when (v #>> '{}') ~ '^[A-Ea-e]$' then ascii(upper(v #>> '{}')) - 65
    when (v #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then (v #>> '{}')::numeric
    else null
  end
$$;

-- RPC: kumpulkan ujian & hitung nilai di server ----------------------------------
-- p_answers: [{ "questionId": "<uuid>", "answer": <jawaban> }, ...] untuk
-- SEMUA soal yang ditampilkan ke peserta (jawaban kosong = null).
create or replace function public.submit_exam(
  p_jadwal_id   uuid,
  p_answers     jsonb,
  p_submit_type text default 'manual',
  p_cheating    boolean default false,
  p_violations  integer default null,
  p_waktu_mulai timestamptz default null
)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user     uuid := private.app_user_id();
  v_role     text := private.app_role();
  v_jadwal   public.jadwal_ujian;
  v_existing public.hasil_ujian;
  v_details  jsonb := '[]'::jsonb;
  v_earned   numeric := 0;
  v_max      numeric := 0;
  v_benar    int := 0;
  v_salah    int := 0;
  v_kosong   int := 0;
  v_essay    boolean := false;
  v_nilai    numeric;
  v_final    numeric;
  v_status   text;
  v_is_ulang boolean;
  r          record;
begin
  if v_user is null or v_role <> 'mahasiswa' then
    raise exception 'Hanya peserta yang bisa mengumpulkan ujian' using errcode = '42501';
  end if;

  select * into v_jadwal from public.jadwal_ujian where id = p_jadwal_id;
  if not found then
    raise exception 'Jadwal ujian tidak ditemukan';
  end if;

  select * into v_existing from public.hasil_ujian
   where jadwal_id = p_jadwal_id and mahasiswa_id = v_user;

  -- Sudah dikumpulkan: kembalikan hasil lama (aman untuk kirim ulang)
  if found and v_existing.status in ('submitted', 'graded', 'cheating_submitted') then
    return jsonb_build_object(
      'status', v_existing.status, 'nilai_total', v_existing.nilai_total,
      'nilai_final', v_existing.nilai_final, 'already_submitted', true);
  end if;

  -- Nilai setiap soal yang ditampilkan (urutan sesuai yang dikirim)
  for r in
    with sent as (
      select (e->>'questionId')::uuid as qid, e->'answer' as answer, ord
        from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) with ordinality as t(e, ord)
       where (e->>'questionId') ~ '^[0-9a-fA-F-]{36}$'
    ),
    scope as (select * from private.exam_soal(p_jadwal_id))
    select distinct on (s.id) s.id, s.tipe_soal, s.bobot, s.jawaban_benar, sent.answer, sent.ord
      from sent join scope s on s.id = sent.qid
     order by s.id, sent.ord
  loop
    declare
      v_points  numeric := coalesce(r.bobot, 10);
      v_ans     jsonb := case when r.answer is null or jsonb_typeof(r.answer) = 'null' then null else r.answer end;
      v_manual  boolean := r.tipe_soal in ('essay', 'uraian');
      v_correct boolean := false;
    begin
      v_max := v_max + v_points;
      if v_ans is null then v_kosong := v_kosong + 1; end if;

      if r.tipe_soal = 'pilihan_ganda' and v_ans is not null then
        v_correct := private.pg_index(v_ans) is not null
                 and private.pg_index(v_ans) = private.pg_index(r.jawaban_benar);
      elsif r.tipe_soal = 'benar_salah' and v_ans is not null then
        v_correct := (v_ans #>> '{}') = (r.jawaban_benar #>> '{}');
      end if;

      if v_manual then
        v_essay := true;
      else
        if v_correct then
          v_earned := v_earned + v_points;
          v_benar := v_benar + 1;
        else
          v_salah := v_salah + 1;
        end if;
      end if;

      v_details := v_details || jsonb_build_object(
        '_ord', r.ord,
        'questionId', r.id,
        'type', r.tipe_soal,
        'answer', coalesce(v_ans, 'null'::jsonb),
        'maxPoints', v_points,
        'earnedPoints', case when v_manual then null else case when v_correct then v_points else 0 end end,
        'isCorrect', case when v_manual then null else v_correct end,
        'needsManualGrading', v_manual);
    end;
  end loop;

  -- Soal yang seharusnya tampil tapi tidak dikirim tetap masuk nilai maksimum
  -- (agar menghapus soal dari daftar tidak menaikkan persentase).
  v_max := v_max
    + coalesce((select sum(coalesce(s.bobot, 10)) from private.exam_soal(p_jadwal_id) s
                 where s.cluster_id is null
                   and not exists (select 1 from jsonb_array_elements(v_details) d
                                    where (d->>'questionId')::uuid = s.id)), 0)
    + coalesce((select sum(m) from (
                 select max(coalesce(s.bobot, 10)) m
                   from private.exam_soal(p_jadwal_id) s
                  where s.cluster_id is not null
                  group by s.cluster_id
                 having not exists (
                   select 1 from jsonb_array_elements(v_details) d
                     join private.exam_soal(p_jadwal_id) s2 on s2.id = (d->>'questionId')::uuid
                    where s2.cluster_id = s.cluster_id)) x), 0);

  -- Urutkan kembali sesuai urutan tampil, buang penanda urutan
  select coalesce(jsonb_agg(d - '_ord' order by (d->>'_ord')::int), '[]'::jsonb)
    into v_details from jsonb_array_elements(v_details) d;

  v_nilai := case when v_max > 0 then round(v_earned / v_max * 100, 2) else 0 end;
  v_is_ulang := upper(coalesce(v_jadwal.tipe, '')) = 'ULANG';
  v_final := case when v_is_ulang and v_nilai >= 70 then 70 else v_nilai end;
  v_status := case when p_cheating then 'cheating_submitted'
                   when v_essay then 'submitted' else 'graded' end;

  insert into public.hasil_ujian as h (
    jadwal_id, mahasiswa_id, nilai_total, nilai_final, is_ulang,
    jumlah_benar, jumlah_salah, jumlah_kosong, waktu_mulai, waktu_selesai,
    status, submit_type, jumlah_pelanggaran, answers_detail, updated_at)
  values (
    p_jadwal_id, v_user, v_nilai, v_final, v_is_ulang,
    v_benar, v_salah, v_kosong,
    coalesce(v_existing.waktu_mulai, p_waktu_mulai, now()), now(),
    v_status, case when p_submit_type = 'auto' then 'auto' else 'manual' end,
    case when p_cheating then p_violations else v_existing.jumlah_pelanggaran end,
    v_details, now())
  on conflict (jadwal_id, mahasiswa_id) do update set
    nilai_total = excluded.nilai_total, nilai_final = excluded.nilai_final,
    is_ulang = excluded.is_ulang, jumlah_benar = excluded.jumlah_benar,
    jumlah_salah = excluded.jumlah_salah, jumlah_kosong = excluded.jumlah_kosong,
    waktu_mulai = coalesce(h.waktu_mulai, excluded.waktu_mulai),
    waktu_selesai = excluded.waktu_selesai, status = excluded.status,
    submit_type = excluded.submit_type,
    jumlah_pelanggaran = coalesce(excluded.jumlah_pelanggaran, h.jumlah_pelanggaran),
    answers_detail = excluded.answers_detail, updated_at = now();

  return jsonb_build_object(
    'status', v_status, 'nilai_total', v_nilai, 'nilai_final', v_final,
    'skor', v_earned, 'skor_maks', v_max,
    'jumlah_benar', v_benar, 'jumlah_salah', v_salah, 'jumlah_kosong', v_kosong);
end;
$$;
revoke all on function public.submit_exam(uuid, jsonb, text, boolean, integer, timestamptz) from public;
grant execute on function public.submit_exam(uuid, jsonb, text, boolean, integer, timestamptz) to authenticated;

-- Penjaga hasil_ujian: peserta tidak bisa mengubah nilai/status ------------------
-- SECURITY INVOKER (sengaja): current_user = peran pemanggil. Di dalam
-- submit_exam (SECURITY DEFINER) current_user adalah pemilik fungsi -> lolos.
create or replace function private.trg_hasil_ujian_guard()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_role text;
begin
  if current_user not in ('anon', 'authenticated') then
    return coalesce(new, old);   -- fungsi server / SQL Editor
  end if;

  v_role := private.app_role();
  if v_role is not null and v_role <> 'mahasiswa' then
    return coalesce(new, old);   -- staf
  end if;

  if v_role is null then
    raise exception 'Silakan login ulang' using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Peserta tidak boleh menghapus hasil ujian' using errcode = '42501';
  end if;

  if new.mahasiswa_id is distinct from private.app_user_id() then
    raise exception 'Hanya hasil ujian sendiri' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'in_progress'
       or new.nilai_total is not null or new.nilai_final is not null
       or new.jumlah_benar is not null or new.jumlah_salah is not null
       or new.nilai_uts is not null or new.nilai_uas is not null
       or new.nilai_tugas is not null or new.nilai_praktek is not null
       or coalesce(new.tambahan_waktu, 0) <> 0 then
      raise exception 'Data mulai ujian tidak valid' using errcode = '42501';
    end if;
    return new;
  end if;

  -- UPDATE: hanya selama ujian berjalan, dan hanya kolom jawaban/waktu/pelanggaran
  if old.status not in ('in_progress', 'kicked', 'needs_approval') then
    raise exception 'Ujian sudah dikumpulkan' using errcode = '42501';
  end if;
  if new.jadwal_id is distinct from old.jadwal_id
     or new.mahasiswa_id is distinct from old.mahasiswa_id
     or new.nilai_total is distinct from old.nilai_total
     or new.nilai_final is distinct from old.nilai_final
     or new.jumlah_benar is distinct from old.jumlah_benar
     or new.jumlah_salah is distinct from old.jumlah_salah
     or new.jumlah_kosong is distinct from old.jumlah_kosong
     or new.nilai_uts is distinct from old.nilai_uts
     or new.nilai_uas is distinct from old.nilai_uas
     or new.nilai_tugas is distinct from old.nilai_tugas
     or new.nilai_praktek is distinct from old.nilai_praktek
     or new.is_ulang is distinct from old.is_ulang
     or new.tambahan_waktu is distinct from old.tambahan_waktu
     or new.submit_type is distinct from old.submit_type then
    raise exception 'Peserta tidak boleh mengubah nilai' using errcode = '42501';
  end if;
  -- Status: peserta boleh tetap sama, atau (upsert mulai ujian) in_progress -> in_progress
  if new.status is distinct from old.status then
    raise exception 'Peserta tidak boleh mengubah status ujian' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists hasil_ujian_guard on public.hasil_ujian;
create trigger hasil_ujian_guard
  before insert or update or delete on public.hasil_ujian
  for each row execute function private.trg_hasil_ujian_guard();

-- RLS soal: hanya dosen/admin --------------------------------------------------
alter table public.soal enable row level security;
drop policy if exists "Allow all access" on public.soal;
drop policy if exists soal_staff_all on public.soal;
create policy soal_staff_all on public.soal
  for all to authenticated
  using (private.is_soal_staff()) with check (private.is_soal_staff());
revoke all on public.soal from anon;

-- RLS hasil_ujian: staf semua, peserta hanya miliknya ----------------------------
alter table public.hasil_ujian enable row level security;
drop policy if exists "Allow all access" on public.hasil_ujian;
drop policy if exists hasil_ujian_staff_all on public.hasil_ujian;
drop policy if exists hasil_ujian_own_select on public.hasil_ujian;
drop policy if exists hasil_ujian_own_insert on public.hasil_ujian;
drop policy if exists hasil_ujian_own_update on public.hasil_ujian;
create policy hasil_ujian_staff_all on public.hasil_ujian
  for all to authenticated using (private.is_staff()) with check (private.is_staff());
create policy hasil_ujian_own_select on public.hasil_ujian
  for select to authenticated using (mahasiswa_id = private.app_user_id());
create policy hasil_ujian_own_insert on public.hasil_ujian
  for insert to authenticated with check (mahasiswa_id = private.app_user_id());
create policy hasil_ujian_own_update on public.hasil_ujian
  for update to authenticated
  using (mahasiswa_id = private.app_user_id()) with check (mahasiswa_id = private.app_user_id());
revoke all on public.hasil_ujian from anon;
