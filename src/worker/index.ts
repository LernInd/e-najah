// src/worker/index.ts

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sign, jwt } from "hono/jwt";

// ... (BAGIAN ATAS TIDAK BERUBAH, SALIN DARI KODE SEBELUMNYA SAMPAI BARIS API PUBLIC) ...
// AGAR LEBIH CEPAT, SAYA HANYA MENAMPILKAN BAGIAN YANG PERLU DITAMBAH/DIUBAH.
// PASTIKAN ANDA TETAP MENYERTAKAN SEMUA FUNGSI UTILITY DAN KONSTANTA SEBELUMNYA.
// JIKA RAGU, GUNAKAN KODE FULL DI BAWAH INI:

// =======================================================
// --- FULL CODE UPDATED ---
// =======================================================

type JwtPayload = {
  id: number;
  username: string;
  peran: string;
  nama_lengkap?: string;
  iat: number;
  exp: number;
};

const JWT_EXPIRY_HOURS = 8;
const JWT_EXPIRY_SECONDS = JWT_EXPIRY_HOURS * 60 * 60;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 32;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/;
const LOGIN_ATTEMPT_LIMIT = 8;
const LOGIN_ATTEMPT_WINDOW_MS = 60000; 
const MAX_INPUT_LENGTH = 1000;
const IMAGE_CACHE_MAX_AGE = 3600;
const SEARCH_RESULT_LIMIT = 10;
const PAGINATION_LIMIT = 5;

function sanitizeInput(str: string, maxLength: number = MAX_INPUT_LENGTH): string {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[<>&'"`]/g, '').slice(0, maxLength).trim();
}

function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH;
}

function getClientIp(headers: any): string {
  return headers.get("CF-Connecting-IP") || "local";
}

function maskSensitiveData(obj: any): any {
  if (!obj) return obj;
  const masked = { ...obj };
  delete masked.password; 
  delete masked.JWT_SECRET; 
  return masked;
}

interface RateLimitEntry {
  count: number;
  lastAttempt: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();

function checkRateLimit(ip: string): { allowed: boolean; message?: string } {
  if (loginAttempts.size > 5000) loginAttempts.clear();
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true };
  }
  const timePassed = now - entry.lastAttempt;
  if (timePassed > LOGIN_ATTEMPT_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true };
  }
  if (entry.count >= LOGIN_ATTEMPT_LIMIT) {
    return { allowed: false, message: `Terlalu banyak percobaan. Coba lagi nanti.` };
  }
  entry.count++;
  entry.lastAttempt = now;
  return { allowed: true };
}

function incrementFailedAttempt(ip: string): void {
  const entry = loginAttempts.get(ip);
  if (entry) entry.count++;
}

function resetRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

function isValidId(id: any): boolean {
  const parsed = parseInt(id);
  return !isNaN(parsed) && parsed > 0;
}

function isValidFileUpload(file: File | null): boolean {
  if (!file) return true; 
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  return file.size > 0 && file.size <= MAX_FILE_SIZE;
}

function handleError(error: any, defaultMessage: string = "Terjadi kesalahan") {
  console.error("[ERROR]", error);
  if (error instanceof HTTPException) return error.getResponse();
  return { error: defaultMessage };
}

const app = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>();

app.onError((err, c) => {
  console.error("[API ERROR]", err);
  if (err instanceof HTTPException) return err.getResponse();
  return c.json({ error: "Internal Server Error" }, 500);
});

app.post("/api/login", async (c) => {
  try {
    const clientIp = getClientIp(c.req.raw.headers);
    const rateLimitCheck = checkRateLimit(clientIp);
    if (!rateLimitCheck.allowed) return c.json({ error: rateLimitCheck.message }, 429);

    const body = await c.req.json().catch(() => ({}));
    let { username, password } = body;

    if (!username || !password) {
      incrementFailedAttempt(clientIp);
      throw new HTTPException(400, { message: "Username dan password diperlukan" });
    }

    username = sanitizeInput(username);
    password = sanitizeInput(password);

    if (!isValidUsername(username) || !isValidPassword(password)) {
      incrementFailedAttempt(clientIp);
      throw new HTTPException(400, { message: "Format kredensial tidak valid" });
    }

    const user = await c.env.DB.prepare("SELECT * FROM pengguna WHERE username = ?").bind(username).first<any>();

    if (!user || user.password !== password) {
      incrementFailedAttempt(clientIp);
      return c.json({ error: "Username atau password salah" }, 401);
    }

    resetRateLimit(clientIp);

    const now = Math.floor(Date.now() / 1000);
    const payload: JwtPayload = {
      id: user.id,
      username: user.username,
      peran: user.peran,
      nama_lengkap: user.nama_lengkap,
      iat: now,
      exp: now + JWT_EXPIRY_SECONDS
    };

    const token = await sign(payload, c.env.JWT_SECRET);

    return c.json({
      data: { token, user: maskSensitiveData(user) },
      message: "Login berhasil"
    }, 200);

  } catch (error: any) {
    return c.json(handleError(error, "Gagal login"), 500);
  }
});

app.get("/api/images/:key", async (c) => {
  try {
    const key = sanitizeInput(c.req.param("key"));
    if (!key || key.includes("..") || key.includes("//")) return c.json({ error: "Invalid key" }, 400);

    const obj = await c.env.MY_BUCKET.get(key);
    if (!obj) return c.notFound();

    c.header("Cache-Control", `public, max-age=${IMAGE_CACHE_MAX_AGE}`);
    c.header("Content-Type", obj.httpMetadata?.contentType || "image/png");

    return new Response(obj.body, { headers: c.res.headers });
  } catch (error: any) {
    return c.json(handleError(error), 500);
  }
});

const adminApi = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>();

adminApi.use("*", async (c, next) => {
  try {
    const jwtMiddleware = jwt({ secret: c.env.JWT_SECRET });
    return jwtMiddleware(c, next);
  } catch (error) {
    return c.json({ error: "Unauthorized" }, 401);
  }
});

adminApi.get("/profile", (c) => {
  return c.json({ data: maskSensitiveData(c.get("jwtPayload")), message: "OK" }, 200);
});

// ... (Route Santri Stats, Create, Search, Detail tetap sama seperti sebelumnya) ...
adminApi.get("/santri/stats", async (c) => {
  // ... (Logika stats sama)
  try {
    const [putra, putri, totalSantri, totalAlumni, totalPengurus, totalPengabdi] = await Promise.all([
      c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE jenis_kelamin = 'L' AND status_santri = 'santri'").first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE jenis_kelamin = 'P' AND status_santri = 'santri'").first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE status_santri = 'santri'").first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE status_santri = 'alumni'").first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE status_santri = 'pengurus'").first<{ count: number }>(),
      c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE status_santri = 'pengabdi'").first<{ count: number }>()
    ]);

    return c.json({
      data: {
        putra: putra?.count ?? 0,
        putri: putri?.count ?? 0,
        totalSantri: totalSantri?.count ?? 0,
        totalAlumni: totalAlumni?.count ?? 0,
        totalPengurus: totalPengurus?.count ?? 0,
        totalPengabdi: totalPengabdi?.count ?? 0
      },
      message: "Statistik berhasil"
    }, 200);
  } catch (e) { return c.json(handleError(e), 500); }
});

adminApi.post("/santri/create", async (c) => {
  // ... (Logika create santri sama)
  try {
    const formData = await c.req.formData();
    const nama_santri = sanitizeInput(formData.get("nama_santri") as string);
    const foto = formData.get("foto") as File | null;

    if (!nama_santri) throw new HTTPException(400, { message: "Nama wajib" });
    if (!isValidFileUpload(foto)) throw new HTTPException(400, { message: "File invalid" });

    let fotoKey: string | null = null;
    if (foto && foto.size > 0) {
      const fileName = sanitizeInput(foto.name.replace(/[^a-zA-Z0-9.-]/g, ''));
      fotoKey = `${crypto.randomUUID()}-${fileName}`;
      await c.env.MY_BUCKET.put(fotoKey, foto.stream(), {
        httpMetadata: { contentType: foto.type || "application/octet-stream" }
      });
    }

    await c.env.DB.prepare(`INSERT INTO santri (nama_santri, foto, jenis_kelamin, alamat, nama_ibu, kontak_ibu, nama_ayah, kontak_ayah, nama_wali, kontak_wali, status_santri) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(
      nama_santri, fotoKey,
      sanitizeInput(formData.get("jenis_kelamin") as string),
      sanitizeInput(formData.get("alamat") as string),
      sanitizeInput(formData.get("nama_ibu") as string),
      sanitizeInput(formData.get("kontak_ibu") as string),
      sanitizeInput(formData.get("nama_ayah") as string),
      sanitizeInput(formData.get("kontak_ayah") as string),
      sanitizeInput(formData.get("nama_wali") as string),
      sanitizeInput(formData.get("kontak_wali") as string),
      sanitizeInput(formData.get("status_santri") as string)
    ).run();

    return c.json({ message: "Berhasil" }, 201);
  } catch (e) { return c.json(handleError(e), 500); }
});

adminApi.get("/santri/search", async (c) => {
  // ... (Logika search santri sama)
  try {
    const query = sanitizeInput(c.req.query("q") || "");
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const limit = PAGINATION_LIMIT;
    const offset = (page - 1) * limit;
    const searchTerm = `%${query}%`;

    const countRes = await c.env.DB.prepare("SELECT COUNT(*) as count FROM santri WHERE nama_santri LIKE ?").bind(searchTerm).first<{ count: number }>();
    const totalCount = countRes?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);

    const { results } = await c.env.DB.prepare("SELECT * FROM santri WHERE nama_santri LIKE ? LIMIT ? OFFSET ?").bind(searchTerm, limit, offset).all();

    return c.json({
      data: { results: results || [], pagination: { currentPage: page, totalPages, totalCount, limit } },
      message: "OK"
    }, 200);
  } catch (e) { return c.json(handleError(e), 500); }
});

adminApi.get("/santri/:id", async (c) => {
  // ... (Logika detail santri sama)
  try {
    const id = c.req.param("id");
    if (!isValidId(id)) throw new HTTPException(400);
    const santri = await c.env.DB.prepare("SELECT * FROM santri WHERE id = ?").bind(id).first();
    if (!santri) throw new HTTPException(404);
    return c.json({ data: santri, message: "OK" }, 200);
  } catch (e) { return c.json(handleError(e), 500); }
});

adminApi.get("/perizinan/search-santri", async (c) => {
  // ... (Logika search perizinan sama)
  try {
    const query = sanitizeInput(c.req.query("q") || "");
    if (!query) return c.json({ data: { results: [] }, message: "Empty" }, 200);
    const { results } = await c.env.DB.prepare("SELECT id, nama_santri, status_santri, jenis_kelamin FROM santri WHERE nama_santri LIKE ? AND status_santri IN ('santri','pengurus','pengabdi') LIMIT ?").bind(`%${query}%`, SEARCH_RESULT_LIMIT).all();
    return c.json({ data: { results: results || [] }, message: "OK" }, 200);
  } catch (e) { return c.json(handleError(e), 500); }
});

adminApi.post("/perizinan/create", async (c) => {
  // ... (Logika create perizinan sama)
  try {
    const body = await c.req.json().catch(() => ({}));
    const { santriId, namaPengajuan, keterangan } = body;
    const pengaju = c.get("jwtPayload").username;

    if (!isValidId(santriId) || !namaPengajuan) throw new HTTPException(400);

    const { meta } = await c.env.DB.prepare("INSERT INTO pengajuan (ID_santri, nama_pengajuan, keterangan, pengaju) VALUES (?, ?, ?, ?)").bind(santriId, sanitizeInput(namaPengajuan), sanitizeInput(keterangan||""), pengaju).run();
    
    return c.json({ data: { pengajuanId: meta.last_row_id }, message: "OK" }, 201);
  } catch (e) { return c.json(handleError(e), 500); }
});

adminApi.get("/perizinan/pending", async (c) => {
  // ... (Logika pending sama)
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT p.ID_Pengajuan, p.nama_pengajuan, p.keterangan, p.pengaju, s.nama_santri, s.status_santri
      FROM pengajuan p JOIN santri s ON p.ID_santri = s.id
      WHERE p.keputusan = 'menunggu' ORDER BY p.ID_Pengajuan DESC
    `).all();
    return c.json({ data: { results: results || [] }, message: "OK" }, 200);
  } catch (e) { return c.json(handleError(e), 500); }
});

adminApi.post("/perizinan/update-status", async (c) => {
  // ... (Logika update status sama)
  try {
    const body = await c.req.json().catch(() => ({}));
    const { pengajuanId, newStatus, tanggalKembali } = body;
    const approverUsername = c.get("jwtPayload").username;

    if (!isValidId(pengajuanId) || !newStatus) throw new HTTPException(400);

    await c.env.DB.prepare("UPDATE pengajuan SET keputusan = ?, disetujui_oleh = ? WHERE ID_Pengajuan = ?").bind(newStatus, newStatus==='disetujui'?approverUsername:null, pengajuanId).run();

    if (newStatus === 'disetujui') {
      const p = await c.env.DB.prepare("SELECT ID_santri FROM pengajuan WHERE ID_Pengajuan = ?").bind(pengajuanId).first<{ID_santri:number}>();
      if(p) await c.env.DB.prepare("INSERT INTO perizinan (ID_Santri, ID_Pengajuan, Tanggal_Kembali) VALUES (?, ?, ?)").bind(p.ID_santri, pengajuanId, tanggalKembali).run();
    }
    return c.json({ message: "OK" }, 200);
  } catch (e) { return c.json(handleError(e), 500); }
});

adminApi.get("/perizinan/all", async (c) => {
  // ... (Logika all sama)
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        p.ID_Pengajuan, p.nama_pengajuan, p.keterangan, p.pengaju, p.keputusan, p.disetujui_oleh,
        pg.nama_lengkap AS nama_penyetuju,
        s.nama_santri, s.foto, s.alamat,
        i.ID_Perizinan, i.Tanggal_Kembali, i.Keterlambatan_Jam
      FROM pengajuan p
      JOIN santri s ON p.ID_santri = s.id
      LEFT JOIN perizinan i ON p.ID_Pengajuan = i.ID_Pengajuan
      LEFT JOIN pengguna pg ON p.disetujui_oleh = pg.username
      ORDER BY p.ID_Pengajuan DESC
    `).all();
    return c.json({ data: { results: results || [] }, message: "OK" }, 200);
  } catch (e) { return c.json(handleError(e), 500); }
});

adminApi.get("/perizinan/aktif", async (c) => {
  // ... (Logika aktif sama)
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT i.ID_Perizinan, i.Tanggal_Kembali, s.nama_santri, p.nama_pengajuan
      FROM perizinan i JOIN santri s ON i.ID_Santri = s.id JOIN pengajuan p ON i.ID_Pengajuan = p.ID_Pengajuan
      WHERE i.Status_Kembali = 'Belum Kembali' ORDER BY i.Tanggal_Kembali ASC
    `).all();
    return c.json({ data: { results: results || [] }, message: "OK" }, 200);
  } catch (e) { return c.json(handleError(e), 500); }
});

adminApi.post("/perizinan/tandai-kembali", async (c) => {
  // ... (Logika tandai kembali sama)
  try {
    const body = await c.req.json().catch(() => ({}));
    const { perizinanId } = body;
    if (!isValidId(perizinanId)) throw new HTTPException(400, { message: "ID Invalid" });

    const izin = await c.env.DB.prepare("SELECT Tanggal_Kembali FROM perizinan WHERE ID_Perizinan = ?").bind(perizinanId).first<{ Tanggal_Kembali: string }>();
    if (!izin) throw new HTTPException(404, { message: "Data tidak ditemukan" });

    const jadwal = new Date(izin.Tanggal_Kembali).getTime();
    const aktual = Date.now();
    
    let status = 'Tepat Waktu';
    let telatJam = 0;

    if (aktual > jadwal) {
      status = 'Terlambat';
      telatJam = Math.ceil((aktual - jadwal) / (1000 * 60 * 60));
    }

    const aktualStr = new Date(aktual).toISOString();

    await c.env.DB.prepare(
      "UPDATE perizinan SET Status_Kembali = ?, Tanggal_Aktual_Kembali = ?, Keterlambatan_Jam = ? WHERE ID_Perizinan = ?"
    ).bind(status, aktualStr, telatJam, perizinanId).run();

    return c.json({ 
      message: "OK", 
      data: { status, keterlambatan: telatJam, waktu: aktualStr }
    }, 200);

  } catch (e) { return c.json(handleError(e), 500); }
});

// --- FITUR BARU: DATA SANKSI ---

// GET: List Santri Terlambat + Sanksi yang Harus Dilakukan
adminApi.get("/perizinan/terlambat", async (c) => {
  try {
    // Query ini menggabungkan data santri yang terlambat ('Terlambat')
    // dengan aturan sanksi yang sesuai berdasarkan jumlah jam keterlambatan.
    const query = `
      SELECT
        i.ID_Perizinan,
        i.Tanggal_Aktual_Kembali,
        i.Keterlambatan_Jam,
        i.Status_Sanksi,
        s.id as ID_Santri,
        s.nama_santri,
        s.foto,
        s.status_santri,
        (
          SELECT Keterangan_Sanksi 
          FROM sanksi 
          WHERE is_active = 1 AND Min_Keterlambatan_Jam <= i.Keterlambatan_Jam 
          ORDER BY Min_Keterlambatan_Jam DESC 
          LIMIT 1
        ) as Sanksi_Deskripsi
      FROM perizinan i
      JOIN santri s ON i.ID_Santri = s.id
      WHERE i.Status_Kembali = 'Terlambat'
      ORDER BY i.Tanggal_Aktual_Kembali DESC
    `;

    const { results } = await c.env.DB.prepare(query).all();

    return c.json({ 
      data: { results: results || [] }, 
      message: "Data sanksi berhasil diambil" 
    }, 200);

  } catch (e) { return c.json(handleError(e), 500); }
});

// POST: Tandai Sanksi Selesai
adminApi.post("/perizinan/sanksi-selesai", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { perizinanId } = body;
    
    if (!isValidId(perizinanId)) throw new HTTPException(400, { message: "ID Invalid" });

    await c.env.DB.prepare(
      "UPDATE perizinan SET Status_Sanksi = 'Selesai' WHERE ID_Perizinan = ?"
    ).bind(perizinanId).run();

    return c.json({ message: "Sanksi berhasil diselesaikan" }, 200);
  } catch (e) { return c.json(handleError(e), 500); }
});

// ... (Route sanksi CRUD tetap sama) ...
adminApi.get("/sanksi/list", async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM sanksi WHERE is_active = 1").all();
    return c.json({ data: { results: results || [] }, message: "OK" }, 200);
  } catch (e) { return c.json(handleError(e), 500); }
});

adminApi.post("/sanksi/create", async (c) => {
  try {
    const { minJam, keterangan } = await c.req.json().catch(() => ({}));
    if (!minJam || !keterangan) throw new HTTPException(400);
    await c.env.DB.prepare("INSERT INTO sanksi (Min_Keterlambatan_Jam, Keterangan_Sanksi) VALUES (?, ?)").bind(minJam, sanitizeInput(keterangan)).run();
    return c.json({ message: "OK" }, 201);
  } catch (e) { return c.json(handleError(e), 500); }
});

adminApi.put("/sanksi/update/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const { minJam, keterangan } = await c.req.json().catch(() => ({}));
    if (!isValidId(id) || !minJam) throw new HTTPException(400);
    await c.env.DB.prepare("UPDATE sanksi SET Min_Keterlambatan_Jam = ?, Keterangan_Sanksi = ? WHERE ID_Sanksi = ?").bind(minJam, sanitizeInput(keterangan), id).run();
    return c.json({ message: "OK" }, 200);
  } catch (e) { return c.json(handleError(e), 500); }
});

adminApi.delete("/sanksi/delete/:id", async (c) => {
  try {
    const id = c.req.param("id");
    if (!isValidId(id)) throw new HTTPException(400);
    await c.env.DB.prepare("UPDATE sanksi SET is_active = 0 WHERE ID_Sanksi = ?").bind(id).run();
    return c.json({ message: "OK" }, 200);
  } catch (e) { return c.json(handleError(e), 500); }
});

app.route("/api/admin", adminApi);

export default app;