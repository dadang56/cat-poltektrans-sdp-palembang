import { supabase, isSupabaseConfigured } from '../lib/supabase'

// ============================================
// User Service
// ============================================
export const userService = {
    // Get all users
    async getAll(filters = {}) {
        let query = supabase
            .from('users')
            .select(`
        *,
        prodi:prodi_id(id, nama, kode),
        kelas:kelas_id(id, nama)
      `)
            .order('nama')

        if (filters.role) query = query.eq('role', filters.role)
        if (filters.prodi_id) query = query.eq('prodi_id', filters.prodi_id)
        if (filters.status) query = query.eq('status', filters.status)

        const { data, error } = await query
        if (error) throw error
        return data
    },

    // Get user by ID
    async getById(id) {
        const { data, error } = await supabase
            .from('users')
            .select(`
        *,
        prodi:prodi_id(id, nama, kode),
        kelas:kelas_id(id, nama)
      `)
            .eq('id', id)
            .single()

        if (error) throw error
        return data
    },

    // Get user by NIM/NIP
    async getByNimNip(nimNip) {
        const { data, error } = await supabase
            .from('users')
            .select(`
        *,
        prodi:prodi_id(id, nama, kode),
        kelas:kelas_id(id, nama)
      `)
            .ilike('nim_nip', nimNip)
            .maybeSingle()

        if (error && error.code !== 'PGRST116') throw error
        return data
    },

    // Create user - simple insert to public.users with password
    async create(userData) {
        // Ensure password is set (default to 123456 if not provided)
        const userWithDefaults = {
            ...userData,
            password: userData.password || '123456',
            status: userData.status || 'active'
        }

        const { data, error } = await supabase
            .from('users')
            .insert([userWithDefaults])
            .select()
            .single()

        if (error) throw error
        return data
    },

    // Update user
    async update(id, userData) {
        const { data, error } = await supabase
            .from('users')
            .update({ ...userData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    },

    // Delete user
    async delete(id) {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    },

    // Get users by role
    async getByRole(role) {
        const { data, error } = await supabase
            .from('users')
            .select(`
                *,
                prodi:prodi_id(id, nama, kode),
                kelas:kelas_id(id, nama)
            `)
            .eq('role', role)
            .order('nama')

        if (error) throw error
        return data || []
    },

    // Bulk create users
    async bulkCreate(users) {
        const { data, error } = await supabase
            .from('users')
            .insert(users)
            .select()

        if (error) throw error
        return data
    }
}

// ============================================
// Prodi Service
// ============================================
export const prodiService = {
    async getAll() {
        const { data, error } = await supabase
            .from('prodi')
            .select('*')
            .order('nama')

        if (error) throw error
        return data
    },

    async getById(id) {
        const { data, error } = await supabase
            .from('prodi')
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw error
        return data
    },

    async create(prodiData) {
        const { data, error } = await supabase
            .from('prodi')
            .insert([prodiData])
            .select()
            .single()

        if (error) throw error
        return data
    },

    async update(id, prodiData) {
        const { data, error } = await supabase
            .from('prodi')
            .update({ ...prodiData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    },

    async delete(id) {
        const { error } = await supabase
            .from('prodi')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }
}

// ============================================
// Kelas Service
// ============================================
export const kelasService = {
    async getAll(filters = {}) {
        let query = supabase
            .from('kelas')
            .select(`
        *,
        prodi:prodi_id(id, nama, kode)
      `)
            .order('nama')

        if (filters.prodi_id) query = query.eq('prodi_id', filters.prodi_id)

        const { data, error } = await query
        if (error) throw error
        return data
    },

    async create(kelasData) {
        const { data, error } = await supabase
            .from('kelas')
            .insert([kelasData])
            .select()
            .single()

        if (error) throw error
        return data
    },

    async update(id, kelasData) {
        const { data, error } = await supabase
            .from('kelas')
            .update({ ...kelasData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    },

    async delete(id) {
        const { error } = await supabase
            .from('kelas')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }
}

// ============================================
// Mata Kuliah Service
// ============================================
export const matkulService = {
    async getAll(filters = {}) {
        let query = supabase
            .from('mata_kuliah')
            .select(`
        *,
        prodi:prodi_id(id, nama, kode)
      `)
            .order('nama')

        if (filters.prodi_id) query = query.eq('prodi_id', filters.prodi_id)

        const { data, error } = await query
        if (error) throw error
        return data
    },

    async create(matkulData) {
        const { data, error } = await supabase
            .from('mata_kuliah')
            .insert([matkulData])
            .select()
            .single()

        if (error) throw error
        return data
    },

    async update(id, matkulData) {
        const { data, error } = await supabase
            .from('mata_kuliah')
            .update({ ...matkulData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    },

    async delete(id) {
        const { error } = await supabase
            .from('mata_kuliah')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }
}

// ============================================
// Jadwal Ujian Service
// ============================================
export const jadwalService = {
    async getAll(filters = {}) {
        let query = supabase
            .from('jadwal_ujian')
            .select(`
        *,
        matkul:matkul_id(id, nama, kode),
        kelas:kelas_id(id, nama),
        ruangan:ruangan_id(id, nama),
        dosen:dosen_id(id, nama),
        pengawas:pengawas_id(id, nama)
      `)
            .order('tanggal', { ascending: false })

        if (filters.tipe) query = query.eq('tipe', filters.tipe)
        if (filters.status) query = query.eq('status', filters.status)
        if (filters.tanggal) query = query.eq('tanggal', filters.tanggal)
        if (filters.tahun_akademik) query = query.eq('tahun_akademik', filters.tahun_akademik)

        const { data, error } = await query
        if (error) throw error
        return data
    },

    async getById(id) {
        const { data, error } = await supabase
            .from('jadwal_ujian')
            .select(`
        *,
        matkul:matkul_id(id, nama, kode),
        kelas:kelas_id(id, nama),
        ruangan:ruangan_id(id, nama),
        dosen:dosen_id(id, nama),
        pengawas:pengawas_id(id, nama)
      `)
            .eq('id', id)
            .single()

        if (error) throw error
        return data
    },

    async create(jadwalData) {
        const { data, error } = await supabase
            .from('jadwal_ujian')
            .insert([jadwalData])
            .select()
            .single()

        if (error) throw error
        return data
    },

    async update(id, jadwalData) {
        const { data, error } = await supabase
            .from('jadwal_ujian')
            .update({ ...jadwalData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    },

    async delete(id) {
        const { error } = await supabase
            .from('jadwal_ujian')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }
}

// ============================================
// Soal Service
// ============================================
export const soalService = {
    async getAll(filters = {}) {
        let query = supabase
            .from('soal')
            .select(`
        *,
        matkul:matkul_id(id, nama, kode),
        dosen:dosen_id(id, nama)
      `)
            .order('created_at', { ascending: false })

        if (filters.matkul_id) query = query.eq('matkul_id', filters.matkul_id)
        if (filters.tipe_ujian) query = query.eq('tipe_ujian', filters.tipe_ujian)
        if (filters.tipe_soal) query = query.eq('tipe_soal', filters.tipe_soal)
        if (filters.dosen_id) query = query.eq('dosen_id', filters.dosen_id)
        if (filters.tahun_akademik) query = query.eq('tahun_akademik', filters.tahun_akademik)

        const { data, error } = await query
        if (error) throw error
        return data
    },

    async getByJadwal(jadwalId) {
        // Get matkul_id from jadwal first, then get soal
        const jadwal = await jadwalService.getById(jadwalId)
        if (!jadwal) return []

        const { data, error } = await supabase
            .from('soal')
            .select('*')
            .eq('matkul_id', jadwal.matkul_id)
            .eq('tipe_ujian', jadwal.tipe)
            .order('created_at')

        if (error) throw error
        return data
    },

    async create(soalData) {
        const { data, error } = await supabase
            .from('soal')
            .insert([soalData])
            .select()
            .single()

        if (error) throw error
        return data
    },

    async update(id, soalData) {
        const { data, error } = await supabase
            .from('soal')
            .update({ ...soalData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    },

    async delete(id) {
        const { error } = await supabase
            .from('soal')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }
}

// ============================================
// Kehadiran Service
// ============================================
export const kehadiranService = {
    async getByJadwal(jadwalId) {
        const { data, error } = await supabase
            .from('kehadiran')
            .select(`
        *,
        mahasiswa:mahasiswa_id(id, nama, nim_nip)
      `)
            .eq('jadwal_id', jadwalId)

        if (error) throw error
        return data
    },

    async upsert(kehadiranData) {
        const { data, error } = await supabase
            .from('kehadiran')
            .upsert(kehadiranData, {
                onConflict: 'jadwal_id,mahasiswa_id'
            })
            .select()

        if (error) throw error
        return data
    },

    async updateStatus(jadwalId, mahasiswaId, status, keterangan = null) {
        const { data, error } = await supabase
            .from('kehadiran')
            .upsert({
                jadwal_id: jadwalId,
                mahasiswa_id: mahasiswaId,
                status,
                keterangan,
                waktu_hadir: status === 'hadir' ? new Date().toISOString() : null,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'jadwal_id,mahasiswa_id'
            })
            .select()
            .single()

        if (error) throw error
        return data
    }
}

// ============================================
// Hasil Ujian Service
// ============================================
export const hasilUjianService = {
    async getAll(filters = {}) {
        let query = supabase
            .from('hasil_ujian')
            .select(`
                *,
                mahasiswa:mahasiswa_id(
                    id, 
                    nama, 
                    nim_nip,
                    kelas:kelas_id(
                        id, 
                        nama,
                        prodi:prodi_id(id, nama)
                    )
                ),
                jadwal:jadwal_id(
                    id,
                    tanggal,
                    tipe,
                    matkul:matkul_id(id, nama, kode),
                    dosen:dosen_id(id, nama)
                )
            `)
            .order('created_at', { ascending: false })

        if (filters.prodi_id) {
            // This needs to filter through nested relations
            query = query.not('mahasiswa', 'is', null)
        }

        const { data, error } = await query
        if (error) throw error
        return data
    },

    async getByJadwal(jadwalId) {
        const { data, error } = await supabase
            .from('hasil_ujian')
            .select(`
        *,
        mahasiswa:mahasiswa_id(id, nama, nim_nip, kelas:kelas_id(nama))
      `)
            .eq('jadwal_id', jadwalId)

        if (error) throw error
        return data
    },

    async getByMahasiswa(mahasiswaId) {
        const { data, error } = await supabase
            .from('hasil_ujian')
            .select(`
        *,
        jadwal:jadwal_id(*, matkul:matkul_id(nama, kode))
      `)
            .eq('mahasiswa_id', mahasiswaId)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data
    },

    // Get results for a specific Dosen's classes
    async getByDosen(dosenId) {
        // Method 1: Get jadwal where dosen_id is set directly
        const { data: jadwalDirect, error: jadwalError1 } = await supabase
            .from('jadwal_ujian')
            .select('id')
            .eq('dosen_id', dosenId)

        if (jadwalError1) console.error('Error fetching jadwal by dosen_id:', jadwalError1)

        // Method 2: Get jadwal via matkul_id from soal created by this dosen
        const { data: soalData, error: soalError } = await supabase
            .from('soal')
            .select('matkul_id')
            .eq('dosen_id', dosenId)

        if (soalError) console.error('Error fetching soal by dosen_id:', soalError)

        let jadwalFromSoal = []
        if (soalData && soalData.length > 0) {
            const matkulIds = [...new Set(soalData.map(s => s.matkul_id).filter(Boolean))]
            if (matkulIds.length > 0) {
                const { data: jadwalData2, error: jadwalError2 } = await supabase
                    .from('jadwal_ujian')
                    .select('id')
                    .in('matkul_id', matkulIds)

                if (!jadwalError2 && jadwalData2) {
                    jadwalFromSoal = jadwalData2
                }
            }
        }

        // Combine jadwal IDs from both methods
        const allJadwalIds = [
            ...(jadwalDirect || []).map(j => j.id),
            ...jadwalFromSoal.map(j => j.id)
        ]
        const uniqueJadwalIds = [...new Set(allJadwalIds)]

        if (uniqueJadwalIds.length === 0) {
            console.log('[getByDosen] No jadwal found for dosen:', dosenId)
            return []
        }

        console.log('[getByDosen] Found', uniqueJadwalIds.length, 'jadwal for dosen')

        // Fetch results for those schedules
        const { data, error } = await supabase
            .from('hasil_ujian')
            .select(`
                *,
                mahasiswa:mahasiswa_id(
                    id, 
                    nama, 
                    nim_nip,
                    kelas:kelas_id(
                        id, 
                        nama,
                        prodi:prodi_id(id, nama)
                    )
                ),
                jadwal:jadwal_id(
                    id,
                    tanggal,
                    tipe,
                    matkul_id,
                    matkul:matkul_id(id, nama, kode, sks_praktek, sks_teori),
                    dosen:dosen_id(id, nama)
                )
            `)
            .in('jadwal_id', uniqueJadwalIds)
            .order('created_at', { ascending: false })

        if (error) throw error
        console.log('[getByDosen] Returning', data?.length || 0, 'results')
        return data || []
    },

    async upsert(hasilData) {
        console.log('[hasilUjianService] Upserting:', hasilData)

        // Try upsert first
        const { data, error } = await supabase
            .from('hasil_ujian')
            .upsert(hasilData, {
                onConflict: 'jadwal_id,mahasiswa_id',
                ignoreDuplicates: false
            })
            .select()
            .single()

        if (error) {
            console.error('[hasilUjianService] Upsert failed:', error.message, error.details)

            // If upsert fails, try direct insert
            const { data: insertData, error: insertError } = await supabase
                .from('hasil_ujian')
                .insert([hasilData])
                .select()
                .single()

            if (insertError) {
                console.error('[hasilUjianService] Insert also failed:', insertError.message)
                throw insertError
            }

            console.log('[hasilUjianService] Insert succeeded:', insertData)
            return insertData
        }

        console.log('[hasilUjianService] Upsert succeeded:', data)
        return data
    },

    async getByJadwalAndMahasiswa(jadwalId, mahasiswaId) {
        const { data, error } = await supabase
            .from('hasil_ujian')
            .select('*')
            .eq('jadwal_id', jadwalId)
            .eq('mahasiswa_id', mahasiswaId)
            .maybeSingle()

        if (error) throw error
        return data
    },

    async update(id, hasilData) {
        const { data, error } = await supabase
            .from('hasil_ujian')
            .update({ ...hasilData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    }
}

// ============================================
// Ruang Ujian Service
// ============================================
export const ruangService = {
    async getAll() {
        const { data, error } = await supabase
            .from('ruang_ujian')
            .select('*')
            .order('nama')

        if (error) throw error
        return data
    },

    async create(ruangData) {
        const { data, error } = await supabase
            .from('ruang_ujian')
            .insert([ruangData])
            .select()
            .single()

        if (error) throw error
        return data
    },

    async update(id, ruangData) {
        const { data, error } = await supabase
            .from('ruang_ujian')
            .update({ ...ruangData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    },

    async delete(id) {
        const { error } = await supabase
            .from('ruang_ujian')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }
}

// ============================================
// Jawaban Mahasiswa Service
// ============================================
export const jawabanMahasiswaService = {
    async getByJadwalAndMahasiswa(jadwalId, mahasiswaId) {
        const { data, error } = await supabase
            .from('jawaban_mahasiswa')
            .select(`
                *,
                soal:soal_id(id, pertanyaan, tipe_soal, pilihan, jawaban_benar, bobot)
            `)
            .eq('jadwal_id', jadwalId)
            .eq('mahasiswa_id', mahasiswaId)

        if (error) throw error
        return data
    },

    async getByJadwal(jadwalId) {
        const { data, error } = await supabase
            .from('jawaban_mahasiswa')
            .select(`
                *,
                mahasiswa:mahasiswa_id(id, nama, nim_nip),
                soal:soal_id(id, pertanyaan, tipe_soal)
            `)
            .eq('jadwal_id', jadwalId)

        if (error) throw error
        return data
    },

    async upsert(jawabanData) {
        const { data, error } = await supabase
            .from('jawaban_mahasiswa')
            .upsert(jawabanData, {
                onConflict: 'jadwal_id,mahasiswa_id,soal_id'
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    async bulkUpsert(jawabanArray) {
        const { data, error } = await supabase
            .from('jawaban_mahasiswa')
            .upsert(jawabanArray, {
                onConflict: 'jadwal_id,mahasiswa_id,soal_id'
            })
            .select()

        if (error) throw error
        return data
    },

    async delete(id) {
        const { error } = await supabase
            .from('jawaban_mahasiswa')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }
}

// ============================================
// Berita Acara Service
// ============================================
export const beritaAcaraService = {
    async getAll(filters = {}) {
        let query = supabase
            .from('berita_acara')
            .select(`
                *,
                jadwal:jadwal_id(
                    id, tanggal, waktu_mulai, waktu_selesai, tipe,
                    matkul:matkul_id(id, nama, kode),
                    kelas:kelas_id(id, nama),
                    ruangan:ruangan_id(id, nama)
                ),
                pengawas:pengawas_id(id, nama, nim_nip)
            `)
            .order('created_at', { ascending: false })

        if (filters.jadwal_id) query = query.eq('jadwal_id', filters.jadwal_id)
        if (filters.pengawas_id) query = query.eq('pengawas_id', filters.pengawas_id)

        const { data, error } = await query
        if (error) throw error
        return data
    },

    async getByJadwal(jadwalId) {
        const { data, error } = await supabase
            .from('berita_acara')
            .select(`
                *,
                jadwal:jadwal_id(*),
                pengawas:pengawas_id(id, nama, nim_nip)
            `)
            .eq('jadwal_id', jadwalId)
            .single()

        if (error && error.code !== 'PGRST116') throw error
        return data
    },

    async create(beritaAcaraData) {
        const { data, error } = await supabase
            .from('berita_acara')
            .insert([beritaAcaraData])
            .select()
            .single()

        if (error) throw error
        return data
    },

    async upsert(beritaAcaraData) {
        const { data, error } = await supabase
            .from('berita_acara')
            .upsert(beritaAcaraData, {
                onConflict: 'jadwal_id'
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    async update(id, beritaAcaraData) {
        const { data, error } = await supabase
            .from('berita_acara')
            .update({ ...beritaAcaraData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return data
    },

    async delete(id) {
        const { error } = await supabase
            .from('berita_acara')
            .delete()
            .eq('id', id)

        if (error) throw error
        return true
    }
}

// ============================================
// App Settings Service
// ============================================
export const appSettingsService = {
    async getAll() {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')

        if (error) throw error

        // Convert array to object for easier access
        const settings = {}
        data?.forEach(item => {
            settings[item.key] = item.value
        })
        return settings
    },

    async get(key) {
        const { data, error } = await supabase
            .from('app_settings')
            .select('*')
            .eq('key', key)
            .single()

        if (error && error.code !== 'PGRST116') throw error
        return data?.value
    },

    async set(key, value) {
        const { data, error } = await supabase
            .from('app_settings')
            .upsert({
                key,
                value,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'key'
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    async delete(key) {
        const { error } = await supabase
            .from('app_settings')
            .delete()
            .eq('key', key)

        if (error) throw error
        return true
    }
}

// ============================================
// Nilai Pusbangkatar Service
// Per Tahun Akademik storage for NK/NS
// ============================================
export const nilaiPusbangkatarService = {
    // Get all nilai for a tahun akademik
    async getByTA(tahunAkademik) {
        const { data, error } = await supabase
            .from('nilai_pusbangkatar')
            .select(`
                *,
                mahasiswa:mahasiswa_id(
                    id, nama, nim_nip,
                    prodi:prodi_id(id, nama, kode),
                    kelas:kelas_id(id, nama)
                )
            `)
            .eq('tahun_akademik', tahunAkademik)
            .order('created_at', { ascending: false })

        if (error) throw error
        return data || []
    },

    // Get nilai for a specific mahasiswa in a TA
    async getByMahasiswa(mahasiswaId, tahunAkademik) {
        const { data, error } = await supabase
            .from('nilai_pusbangkatar')
            .select('*')
            .eq('mahasiswa_id', mahasiswaId)
            .eq('tahun_akademik', tahunAkademik)
            .maybeSingle()

        if (error) throw error
        return data
    },

    // Get all nilai for a specific mahasiswa (across all TA)
    async getAllByMahasiswa(mahasiswaId) {
        const { data, error } = await supabase
            .from('nilai_pusbangkatar')
            .select('*')
            .eq('mahasiswa_id', mahasiswaId)
            .order('tahun_akademik', { ascending: false })

        if (error) throw error
        return data || []
    },

    // Upsert nilai (insert or update)
    async upsert(mahasiswaId, tahunAkademik, nilai) {
        const { data, error } = await supabase
            .from('nilai_pusbangkatar')
            .upsert({
                mahasiswa_id: mahasiswaId,
                tahun_akademik: tahunAkademik,
                ...nilai,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'mahasiswa_id,tahun_akademik'
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    // Bulk upsert
    async bulkUpsert(records) {
        const { data, error } = await supabase
            .from('nilai_pusbangkatar')
            .upsert(
                records.map(r => ({
                    mahasiswa_id: r.mahasiswa_id,
                    tahun_akademik: r.tahun_akademik,
                    nilai_kondite: r.nilai_kondite,
                    nilai_semapta: r.nilai_semapta,
                    updated_at: new Date().toISOString()
                })),
                { onConflict: 'mahasiswa_id,tahun_akademik' }
            )
            .select()

        if (error) throw error
        return data || []
    }
}

// ============================================
// Export check function
// ============================================
export { isSupabaseConfigured }
