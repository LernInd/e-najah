-- SCHEMA UNTUK E-NAJAH DB (D1)

-- 1. Tabel Pengguna (User Login)
CREATE TABLE IF NOT EXISTS pengguna (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  peran TEXT NOT NULL CHECK(peran IN ('admin_perizinan', 'admin_datasantri', 'ndalem')),
  nama_lengkap TEXT
);
CREATE INDEX IF NOT EXISTS idx_pengguna_username ON pengguna (username);

-- 2. Tabel Santri
CREATE TABLE IF NOT EXISTS santri (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama_santri TEXT NOT NULL,
  foto TEXT,
  jenis_kelamin TEXT CHECK(jenis_kelamin IN ('L','P')),
  alamat TEXT,
  nama_ibu TEXT,
  kontak_ibu TEXT,
  nama_ayah TEXT,
  kontak_ayah TEXT,
  nama_wali TEXT,
  kontak_wali TEXT,
  status_santri TEXT CHECK(status_santri IN ('santri','alumni','pengurus','pengabdi'))
);
CREATE INDEX IF NOT EXISTS idx_santri_nama ON santri (nama_santri);

-- 3. Tabel Pengajuan Izin
CREATE TABLE IF NOT EXISTS pengajuan (
  ID_Pengajuan INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_santri INTEGER NOT NULL,
  nama_pengajuan TEXT NOT NULL,
  keterangan TEXT,
  pengaju TEXT NOT NULL,
  keputusan TEXT DEFAULT 'menunggu' CHECK(keputusan IN ('menunggu', 'disetujui', 'ditolak')),
  disetujui_oleh TEXT,
  FOREIGN KEY(ID_santri) REFERENCES santri(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pengajuan_id_santri ON pengajuan (ID_santri);

-- 4. Tabel Perizinan Aktif
CREATE TABLE IF NOT EXISTS perizinan (
  ID_Perizinan INTEGER PRIMARY KEY AUTOINCREMENT,
  ID_Santri INTEGER NOT NULL,
  ID_Pengajuan INTEGER NOT NULL,
  Tanggal_Kembali TEXT NOT NULL,
  Keterlambatan_Jam INTEGER,
  FOREIGN KEY(ID_Santri) REFERENCES santri(id) ON DELETE CASCADE,
  FOREIGN KEY(ID_Pengajuan) REFERENCES pengajuan(ID_Pengajuan) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_perizinan_id_santri ON perizinan (ID_Santri);

-- 5. Tabel Sanksi
CREATE TABLE IF NOT EXISTS sanksi (
  ID_Sanksi INTEGER PRIMARY KEY AUTOINCREMENT,
  Min_Keterlambatan_Jam INTEGER NOT NULL,
  Keterangan_Sanksi TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- SEED untuk Testing 3 Role
INSERT OR IGNORE INTO pengguna (username, password, peran, nama_lengkap) VALUES
  ('adminizin1', 'password123', 'admin_perizinan', 'Admin Izin Demo'),
  ('datasantri1', 'password123', 'admin_datasantri', 'Admin Santri Demo'),
  ('ndalem1',     'password123', 'ndalem',           'Ndalem Demo');
