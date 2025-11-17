import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sign, jwt } from "hono/jwt";

// Tipe payload JWT
type JwtPayload = {
  id: number;
  username: string;
  peran: string;
  nama_lengkap?: string; // <-- TAMBAHKAN INI
  iat: number;
  exp: number;
};

const app = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>();

// =======================================================
// --- Rute Publik ---
// =======================================================
app.post("/api/login", async (c) => {
  // ---- BACKEND SECURITY BEST PRACTICE ----
  // 1. Validasi input lebih ketat (panjang, regex, filter!)
  function sanitizeInput(str: string) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[<>&'"`]/g, '').slice(0, 1000); // prevent XSS & payload
  }
  // 2. Rate limit login endpoint per IP (sederhana, in-memory, NOT for prod)
  const loginAttemptsByIp = {};
  const ip = c.req.header("CF-Connecting-IP") || "local";
  loginAttemptsByIp[ip] = loginAttemptsByIp[ip] || { count: 0, last: 0 };
  const now = Date.now();
  if (loginAttemptsByIp[ip].count > 8 && now - loginAttemptsByIp[ip].last < 60000) {
    return c.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 1 menit." }, 429);
  }
  loginAttemptsByIp[ip].last = now;

  // Validasi input:
  const { username, password } = await c.req.json();
  if (!username || !password) {
    throw new HTTPException(400, { message: "Username dan password diperlukan" });
  }
  if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
    throw new HTTPException(400, { message: "Format username tidak valid" });
  }
  if (password.length < 8 || password.length > 32) {
    throw new HTTPException(400, { message: "Password tidak valid" });
  }
  // --- BATAS PERUBAHAN ---

  // Ambil juga nama_lengkap
  const stmt = c.env.DB.prepare(
    "SELECT id, username, password, peran, nama_lengkap FROM pengguna WHERE username = ?"
  );
  const user = await stmt.bind(username).first<any>();
  // --- BATAS PERUBAHAN ---

  if (!user) {
    loginAttemptsByIp[ip].count++;
    return c.json({ error: "Username tidak ditemukan" }, 404);
  }
  if (user.password !== password) {
    loginAttemptsByIp[ip].count++;
    return c.json({ error: "Password salah" }, 401);
  }
  loginAttemptsByIp[ip].count = 0;

  // --- UBAH DISINI ---
  // Masukkan nama_lengkap ke payload token
  const payload = {
    id: user.id,
    username: user.username,
    peran: user.peran,
    nama_lengkap: user.nama_lengkap, // <-- TAMBAHKAN INI
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8, // 8 jam
  };
  // --- BATAS PERUBAHAN ---

  const token = await sign(payload, c.env.JWT_SECRET);
  return c.json({ token });
});

app.get("/api/images/:key", async (c) => {
  // ... (Kode menyajikan gambar R2 - tidak berubah)
  const key = c.req.param("key");
  try {
    const obj = await c.env.MY_BUCKET.get(key);
    if (!obj) {
      return c.notFound();
    }
    c.header("Cache-Control", "public, max-age=3600");
    const contentType = obj.httpMetadata?.contentType || "image/png";
    c.header("Content-Type", contentType);
    return new Response(obj.body, {
      headers: c.res.headers,
    });
  } catch (e: any) {
    return c.json({ error: `Could not fetch image: ${e.message}` }, 500);
  }
});

// =======================================================
// --- Grup Rute Terproteksi (Admin) ---
// =======================================================
const adminApi = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>();

// Middleware JWT
adminApi.use("*", async (c, next) => {
  const jwtMiddleware = jwt({ 
    secret: c.env.JWT_SECRET,
  });
  return jwtMiddleware(c, next);
});

// ... (Endpoint /profile, /santri/stats, /santri/create, /santri/search, /santri/:id, /perizinan/search-santri, /perizinan/create, /perizinan/pending, /perizinan/update-status, /perizinan/all, /perizinan/aktif, /perizinan/tandai-kembali, /sanksi/* - TIDAK BERUBAH) ...

// Endpoint [GET] /api/admin/profile
adminApi.get("/profile", (c) => {
  const payload = c.get("jwtPayload");
  return c.json({ user: payload });
});

// Endpoint [GET] /api/admin/santri/stats
adminApi.get("/santri/stats", async (c) => {
  try {
    const [
      putra, putri, totalSantri, totalAlumni, totalPengurus, totalPengabdi
    ] = await Promise.all([
      c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE jenis_kelamin = 'L' AND status_santri = 'santri'").first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE jenis_kelamin = 'P' AND status_santri = 'santri'").first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE status_santri = 'santri'").first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE status_santri = 'alumni'").first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE status_santri = 'pengurus'").first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE status_santri = 'pengabdi'").first<{ count: number }>()
    ]);
    return c.json({
      putra: putra?.count ?? 0,
      putri: putri?.count ?? 0,
      totalSantri: totalSantri?.count ?? 0,
      totalAlumni: totalAlumni?.count ?? 0,
      totalPengurus: totalPengurus?.count ?? 0,
      totalPengabdi: totalPengabdi?.count ?? 0,
    });
  } catch (e: any) {
    console.error(e);
    return c.json({ error: "Gagal mengambil statistik", message: e.message }, 500);
  }
});

// Endpoint [POST] /api/admin/santri/create
adminApi.post("/santri/create", async (c) => {
  try {
    const formData = await c.req.formData();
    const foto = formData.get("foto") as File | null;
    const nama_santri = formData.get("nama_santri") as string;
    if (!nama_santri) {
      throw new HTTPException(400, { message: "Nama santri diperlukan" });
    }
    let fotoKey: string | null = null;
    if (foto && foto.size > 0) {
      fotoKey = `santri/${crypto.randomUUID()}-${foto.name}`;
      await c.env.MY_BUCKET.put(fotoKey, foto.stream(), {
        httpMetadata: { contentType: foto.type },
      });
    }
    const sql = `
      INSERT INTO santri (
        nama_santri, foto, jenis_kelamin, alamat, 
        nama_ibu, kontak_ibu, nama_ayah, kontak_ayah, 
        nama_wali, kontak_wali, status_santri
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    await c.env.DB.prepare(sql).bind(
      nama_santri, fotoKey, formData.get("jenis_kelamin"), formData.get("alamat"),
      formData.get("nama_ibu"), formData.get("kontak_ibu"), formData.get("nama_ayah"), formData.get("kontak_ayah"),
      formData.get("nama_wali"), formData.get("kontak_wali"), formData.get("status_santri")
    ).run();
    return c.json({ message: "Santri berhasil ditambahkan!" }, 201);
  } catch (e: any) {
    if (e instanceof HTTPException) return e.getResponse();
    console.error(e);
    return c.json({ error: "Gagal menambahkan santri", message: e.message }, 500);
  }
});

// Endpoint [GET] /api/admin/santri/search
adminApi.get("/santri/search", async (c) => {
  try {
    const query = c.req.query("q") || "";
    const page = parseInt(c.req.query("page") || "1");
    const limit = 5;
    const offset = (page - 1) * limit;
    const searchTerm = `%${query}%`;
    const countStmt = c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE nama_santri LIKE ?1");
    const totalResult = await countStmt.bind(searchTerm).first<{ count: number }>();
    const totalCount = totalResult?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);
    const resultsStmt = c.env.DB.prepare("SELECT id, nama_santri, jenis_kelamin, status_santri FROM santri WHERE nama_santri LIKE ?1 LIMIT ?2 OFFSET ?3");
    const { results } = await resultsStmt.bind(searchTerm, limit, offset).all();
    return c.json({ results, totalPages, currentPage: page });
  } catch (e: any) {
    console.error(e);
    return c.json({ error: "Gagal melakukan pencarian", message: e.message }, 500);
  }
});

// Endpoint [GET] /api/admin/santri/:id
adminApi.get("/santri/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const stmt = c.env.DB.prepare("SELECT * FROM santri WHERE id = ?");
    const santri = await stmt.bind(id).first();
    if (!santri) {
      throw new HTTPException(404, { message: "Santri tidak ditemukan" });
    }
    return c.json(santri);
  } catch (e: any) {
    if (e instanceof HTTPException) return e.getResponse();
    console.error(e);
    return c.json({ error: "Gagal mengambil data santri", message: e.message }, 500);
  }
});

// Endpoint [GET] /api/admin/perizinan/search-santri
adminApi.get("/perizinan/search-santri", async (c) => {
  try {
    const query = c.req.query("q") || "";
    if (!query) {
      return c.json({ results: [] });
    }
    const searchTerm = `%${query}%`;
    const sqlQuery = `
      SELECT id, nama_santri, status_santri, jenis_kelamin
      FROM santri 
      WHERE 
        nama_santri LIKE ?1 AND
        status_santri IN ('santri', 'pengurus', 'pengabdi')
      LIMIT 10;
    `;
    const { results } = await c.env.DB.prepare(sqlQuery).bind(searchTerm).all();
    return c.json({ results });
  } catch (e: any) {
    console.error(e);
    return c.json({ error: "Gagal melakukan pencarian", message: e.message }, 500);
  }
});

// Endpoint [POST] /api/admin/perizinan/create
adminApi.post("/perizinan/create", async (c) => {
  try {
    const { 
      santriId, 
      namaPengajuan, 
      keterangan 
    } = await c.req.json(); 
    const pengaju = c.get("jwtPayload").username;
    if (!santriId || !namaPengajuan) {
      throw new HTTPException(400, { message: "Santri ID dan Nama Pengajuan diperlukan" });
    }
    const pengajuanStmt = c.env.DB.prepare(
      "INSERT INTO pengajuan (ID_santri, nama_pengajuan, keterangan, pengaju) VALUES (?, ?, ?, ?)"
    );
    const { meta } = await pengajuanStmt.bind(
      santriId, 
      namaPengajuan, 
      keterangan, 
      pengaju
    ).run();
    const newPengajuanId = meta.last_row_id;
    if (!newPengajuanId) {
      throw new Error("Gagal mendapatkan ID pengajuan baru");
    }
    return c.json({ message: "Pengajuan izin berhasil dibuat!", pengajuanId: newPengajuanId }, 201);
  } catch (e: any) {
    if (e instanceof HTTPException) return e.getResponse();
    console.error(e);
    return c.json({ error: "Gagal membuat pengajuan izin", message: e.message }, 500);
  }
});


// Endpoint [GET] /api/admin/perizinan/pending
adminApi.get("/perizinan/pending", async (c) => {
  try {
    const sqlQuery = `
      SELECT 
        p.ID_Pengajuan, p.nama_pengajuan, p.keterangan, p.pengaju,
        s.nama_santri, s.status_santri
      FROM pengajuan p
      JOIN santri s ON p.ID_santri = s.id
      WHERE p.keputusan = 'menunggu'
      ORDER BY p.ID_Pengajuan DESC;
    `;
    const { results } = await c.env.DB.prepare(sqlQuery).all();
    return c.json({ results });
  } catch (e: any) {
    console.error(e);
    return c.json({ error: "Gagal mengambil data pengajuan", message: e.message }, 500);
  }
});

// Endpoint [POST] /api/admin/perizinan/update-status
adminApi.post("/perizinan/update-status", async (c) => {
  try {
    const { pengajuanId, newStatus, tanggalKembali } = await c.req.json();
    const approverUsername = c.get("jwtPayload").username;
    if (!pengajuanId || !newStatus || !['disetujui', 'ditolak'].includes(newStatus)) {
      throw new HTTPException(400, { message: "ID Pengajuan dan status ('disetujui'/'ditolak') diperlukan" });
    }
    const updateStmt = c.env.DB.prepare(
      "UPDATE pengajuan SET keputusan = ?, disetujui_oleh = ? WHERE ID_Pengajuan = ?"
    );
    await updateStmt.bind(
      newStatus, 
      (newStatus === 'disetujui' ? approverUsername : null),
      pengajuanId
    ).run();
    if (newStatus === 'disetujui') {
      if (!tanggalKembali) {
        throw new HTTPException(400, { message: "Tanggal Kembali diperlukan untuk menyetujui izin" });
      }
      const pengajuan = await c.env.DB.prepare("SELECT ID_santri FROM pengajuan WHERE ID_Pengajuan = ?")
        .bind(pengajuanId)
        .first<{ ID_santri: number }>();
      if (!pengajuan) {
        throw new HTTPException(404, { message: "Pengajuan tidak ditemukan" });
      }
      const perizinanStmt = c.env.DB.prepare(
        "INSERT INTO perizinan (ID_Santri, ID_Pengajuan, Tanggal_Kembali) VALUES (?, ?, ?)"
      );
      await perizinanStmt.bind(
        pengajuan.ID_santri, 
        pengajuanId,
        tanggalKembali
      ).run();
    }
    return c.json({ message: `Status berhasil diubah menjadi ${newStatus}` });
  } catch (e: any) {
    if (e instanceof HTTPException) return e.getResponse();
    console.error(e);
    return c.json({ error: "Gagal memperbarui status", message: e.message }, 500);
  }
});

// Endpoint [GET] /api/admin/perizinan/all
adminApi.get("/perizinan/all", async (c) => {
  try {
    const sqlQuery = `
      SELECT 
        p.ID_Pengajuan, p.nama_pengajuan, p.keterangan, p.pengaju, p.keputusan, p.disetujui_oleh,
        s.nama_santri, s.foto, s.alamat,
        i.ID_Perizinan, i.Tanggal_Kembali,
        i.Keterlambatan_Jam
      FROM pengajuan p
      JOIN santri s ON p.ID_santri = s.id
      LEFT JOIN perizinan i ON p.ID_Pengajuan = i.ID_Pengajuan
      ORDER BY p.ID_Pengajuan DESC;
    `;
    const { results } = await c.env.DB.prepare(sqlQuery).all();
    return c.json({ results });
  } catch (e: any) {
    console.error(e);
    return c.json({ error: "Gagal mengambil semua data pengajuan", message: e.message }, 500);
  }
});

// Endpoint [GET] /api/admin/perizinan/aktif
adminApi.get("/perizinan/aktif", async (c) => {
  try {
    const sqlQuery = `
      SELECT 
        i.ID_Perizinan, i.Tanggal_Kembali,
        s.nama_santri,
        p.nama_pengajuan
      FROM perizinan i
      JOIN santri s ON i.ID_Santri = s.id
      JOIN pengajuan p ON i.ID_Pengajuan = p.ID_Pengajuan
      WHERE i.Status_Kembali = 'Belum Kembali'
      ORDER BY i.Tanggal_Kembali ASC;
    `;
    const { results } = await c.env.DB.prepare(sqlQuery).all();
    return c.json({ results });
  } catch (e: any) {
    console.error(e);
    return c.json({ error: "Gagal mengambil data izin aktif", message: e.message }, 500);
  }
});

// Endpoint [POST] /api/admin/perizinan/tandai-kembali
adminApi.post("/perizinan/tandai-kembali", async (c) => {
  try {
    const { perizinanId, statusKembali, keterlambatanHari, keterlambatanJam } = await c.req.json();
    const actualReturnTime = new Date().toISOString();

    if (!perizinanId || !statusKembali || !['Tepat Waktu', 'Terlambat'].includes(statusKembali)) {
      throw new HTTPException(400, { message: "ID Perizinan dan Status Kembali ('Tepat Waktu'/'Terlambat') diperlukan" });
    }
    
    let totalKeterlambatanJam = 0;
    if (statusKembali === 'Terlambat') {
      const hari = Math.max(0, parseInt(keterlambatanHari) || 0);
      const jam = Math.max(0, parseInt(keterlambatanJam) || 0);
      totalKeterlambatanJam = (hari * 24) + jam;
    }

    const updateStmt = c.env.DB.prepare(
      "UPDATE perizinan SET Status_Kembali = ?, Tanggal_Aktual_Kembali = ?, Keterlambatan_Jam = ? WHERE ID_Perizinan = ?"
    );
    await updateStmt.bind(
      statusKembali, 
      actualReturnTime, 
      totalKeterlambatanJam, 
      perizinanId
    ).run();

    return c.json({ 
      message: "Kepulangan santri berhasil dicatat.",
      status: statusKembali,
      keterlambatanJam: totalKeterlambatanJam
    });

  } catch (e: any) {
    if (e instanceof HTTPException) return e.getResponse();
    console.error(e);
    return c.json({ error: "Gagal mencatat kepulangan", message: e.message }, 500);
  }
});


// --- Endpoint CRUD Sanksi ---
adminApi.get("/sanksi/list", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM sanksi_aturan WHERE is_active = 1 ORDER BY Min_Keterlambatan_Jam ASC"
    ).all();
    return c.json({ results });
  } catch (e: any) {
    console.error(e);
    return c.json({ error: "Gagal mengambil daftar sanksi", message: e.message }, 500);
  }
});
adminApi.post("/sanksi/create", async (c) => {
  try {
    const { minJam, keterangan } = await c.req.json();
    if (!minJam || !keterangan) {
      throw new HTTPException(400, { message: "Jam minimal dan keterangan diperlukan" });
    }
    await c.env.DB.prepare(
      "INSERT INTO sanksi_aturan (Min_Keterlambatan_Jam, Keterangan_Sanksi) VALUES (?, ?)"
    ).bind(minJam, keterangan).run();
    return c.json({ message: "Aturan sanksi berhasil dibuat" }, 201);
  } catch (e: any) {
    if (e instanceof HTTPException) return e.getResponse();
    console.error(e);
    return c.json({ error: "Gagal membuat sanksi", message: e.message }, 500);
  }
});
adminApi.put("/sanksi/update/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { minJam, keterangan } = await c.req.json();
    if (!minJam || !keterangan) {
      throw new HTTPException(400, { message: "Jam minimal dan keterangan diperlukan" });
    }
    await c.env.DB.prepare(
      "UPDATE sanksi_aturan SET Min_Keterlambatan_Jam = ?, Keterangan_Sanksi = ? WHERE ID_Sanksi = ?"
    ).bind(minJam, keterangan, id).run();
    return c.json({ message: "Aturan sanksi berhasil diperbarui" });
  } catch (e: any) {
    if (e instanceof HTTPException) return e.getResponse();
    console.error(e);
    return c.json({ error: "Gagal memperbarui sanksi", message: e.message }, 500);
  }
});
adminApi.delete("/sanksi/delete/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare(
      "UPDATE sanksi_aturan SET is_active = 0 WHERE ID_Sanksi = ?"
    ).bind(id).run();
    return c.json({ message: "Aturan sanksi berhasil dihapus" });
  } catch (e: any) {
    console.error(e);
    return c.json({ error: "Gagal menghapus sanksi", message: e.message }, 500);
  }
});


// "Mount" rute admin ke rute utama
app.route("/api/admin", adminApi);

export default app;