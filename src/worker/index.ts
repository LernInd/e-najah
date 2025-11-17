// src/worker/index.ts

import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { sign, jwt } from "hono/jwt";

// =======================================================
// --- TYPES & INTERFACES ---
// =======================================================
type JwtPayload = {
  id: number;
  username: string;
  peran: string;
  nama_lengkap?: string;
  iat: number;
  exp: number;
};

// =======================================================
// --- CONSTANTS & CONFIG ---
// =======================================================
const JWT_EXPIRY_HOURS = 8;
const JWT_EXPIRY_SECONDS = JWT_EXPIRY_HOURS * 60 * 60;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 32;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/;
const LOGIN_ATTEMPT_LIMIT = 8;
const LOGIN_ATTEMPT_WINDOW_MS = 60000; // 1 menit
const MAX_INPUT_LENGTH = 1000;
const IMAGE_CACHE_MAX_AGE = 3600;
const SEARCH_RESULT_LIMIT = 10;
const PAGINATION_LIMIT = 5;

// =======================================================
// --- SECURITY UTILITIES ---
// =======================================================

/**
 * Sanitasi input string untuk mencegah XSS dan injection
 */
function sanitizeInput(str: string, maxLength: number = MAX_INPUT_LENGTH): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[<>&'"`]/g, '') // Hapus karakter berbahaya
    .slice(0, maxLength)
    .trim();
}

/**
 * Validasi username
 */
function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

/**
 * Validasi password
 */
function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && 
         password.length <= PASSWORD_MAX_LENGTH;
}

/**
 * Ekstrak IP client dari header Cloudflare
 */
function getClientIp(headers: any): string {
  return headers.get("CF-Connecting-IP") || "local";
}

/**
 * Mask data sensitif di response (hindari data leakage)
 */
function maskSensitiveData(obj: any): any {
  if (!obj) return obj;
  const masked = { ...obj };
  delete masked.password; // Jangan pernah return password
  delete masked.JWT_SECRET; // Jangan expose secrets
  return masked;
}

// =======================================================
// --- RATE LIMITING (In-Memory) ---
// =======================================================
interface RateLimitEntry {
  count: number;
  lastAttempt: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();

/**
 * Validasi rate limit untuk login
 */
function checkRateLimit(ip: string): { allowed: boolean; message?: string } {
  // Memory Guard Sederhana
  if (loginAttempts.size > 5000) {
    loginAttempts.clear();
  }

  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry) {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  const timePassed = now - entry.lastAttempt;
  
  if (timePassed > LOGIN_ATTEMPT_WINDOW_MS) {
    // Reset jika sudah lewat 1 menit
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
    return { allowed: true };
  }

  if (entry.count >= LOGIN_ATTEMPT_LIMIT) {
    return {
      allowed: false,
      message: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil((LOGIN_ATTEMPT_WINDOW_MS - timePassed) / 1000)} detik.`
    };
  }

  entry.count++;
  entry.lastAttempt = now;
  return { allowed: true };
}

/**
 * Increment rate limit counter untuk failed attempt
 */
function incrementFailedAttempt(ip: string): void {
  const entry = loginAttempts.get(ip);
  if (entry) {
    entry.count++;
  }
}

/**
 * Reset rate limit counter untuk successful attempt
 */
function resetRateLimit(ip: string): void {
  loginAttempts.delete(ip);
}

// =======================================================
// --- DATABASE UTILITIES ---
// =======================================================

/**
 * Validasi parameter ID (basic SQL injection prevention)
 */
function isValidId(id: any): boolean {
  const parsed = parseInt(id);
  return !isNaN(parsed) && parsed > 0;
}

/**
 * Validasi file upload
 */
function isValidFileUpload(file: File | null): boolean {
  if (!file) return true; // File opsional
  // Batasi ukuran file (misal: 5MB)
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  return file.size > 0 && file.size <= MAX_FILE_SIZE;
}

// =======================================================
// --- ERROR HANDLING ---
// =======================================================

/**
 * Handle error dan return response yang konsisten
 */
function handleError(error: any, defaultMessage: string = "Terjadi kesalahan") {
  console.error("[ERROR]", error);
  
  if (error instanceof HTTPException) {
    return error.getResponse();
  }

  return {
    error: defaultMessage
  };
}

// =======================================================
// --- APP SETUP ---
// =======================================================
const app = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>();

// Global error handler
app.onError((err, c) => {
  console.error("[API ERROR]", {
    path: c.req.path,
    method: c.req.method,
    error: err.message,
    timestamp: new Date().toISOString()
  });

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  return c.json(
    { error: "Internal Server Error" },
    500
  );
});

// =======================================================
// --- PUBLIC ROUTES ---
// =======================================================

/**
 * POST /api/login - Login endpoint dengan rate limiting
 */
app.post("/api/login", async (c) => {
  try {
    const clientIp = getClientIp(c.req.raw.headers);
    
    // Rate limit check
    const rateLimitCheck = checkRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      return c.json(
        { error: rateLimitCheck.message },
        429
      );
    }

    // Parse & validate input
    const body = await c.req.json().catch(() => ({}));
    let { username, password } = body;

    if (!username || !password) {
      incrementFailedAttempt(clientIp);
      throw new HTTPException(400, { 
        message: "Username dan password diperlukan" 
      });
    }

    // Sanitasi input
    username = sanitizeInput(username);
    password = sanitizeInput(password);

    // Validasi format
    if (!isValidUsername(username)) {
      incrementFailedAttempt(clientIp);
      throw new HTTPException(400, { 
        message: "Format username tidak valid (3-32 karakter, alphanumeric & underscore)" 
      });
    }

    if (!isValidPassword(password)) {
      incrementFailedAttempt(clientIp);
      throw new HTTPException(400, { 
        message: `Password harus ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} karakter` 
      });
    }

    // Query database dengan parameterized query
    const user = await c.env.DB.prepare(
      "SELECT id, username, password, peran, nama_lengkap FROM pengguna WHERE username = ?"
    ).bind(username).first<any>();

    if (!user) {
      incrementFailedAttempt(clientIp);
      // Generic message untuk mencegah username enumeration
      return c.json(
        { error: "Username atau password salah" },
        401
      );
    }

    if (user.password !== password) {
      incrementFailedAttempt(clientIp);
      return c.json(
        { error: "Username atau password salah" },
        401
      );
    }

    // Reset rate limit on successful login
    resetRateLimit(clientIp);

    // Generate JWT
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

    return c.json(
      {
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            peran: user.peran,
            nama_lengkap: user.nama_lengkap
          }
        },
        message: "Login berhasil"
      },
      200
    );

  } catch (error: any) {
    return c.json(handleError(error, "Gagal login"), 500);
  }
});

/**
 * GET /api/images/:key - Serve images dari R2 bucket
 */
app.get("/api/images/:key", async (c) => {
  try {
    const key = sanitizeInput(c.req.param("key"));

    if (!key) {
      return c.json(
        { error: "Image key diperlukan" },
        400
      );
    }

    // Prevent path traversal
    if (key.includes("..") || key.includes("//")) {
      return c.json(
        { error: "Invalid image key" },
        400
      );
    }

    const obj = await c.env.MY_BUCKET.get(key);

    if (!obj) {
      return c.notFound();
    }

    // Set cache headers
    c.header("Cache-Control", `public, max-age=${IMAGE_CACHE_MAX_AGE}`);
    c.header("Content-Type", obj.httpMetadata?.contentType || "image/png");

    return new Response(obj.body, {
      headers: c.res.headers
    });

  } catch (error: any) {
    return c.json(
      handleError(error, "Gagal mengambil gambar"),
      500
    );
  }
});

// =======================================================
// --- PROTECTED ROUTES (Admin API) ---
// =======================================================
const adminApi = new Hono<{ Bindings: Env; Variables: { jwtPayload: JwtPayload } }>();

// JWT Middleware - Verify token
adminApi.use("*", async (c, next) => {
  try {
    const jwtMiddleware = jwt({
      secret: c.env.JWT_SECRET
    });
    return jwtMiddleware(c, next);
  } catch (error) {
    return c.json(
      { error: "Token tidak valid atau sudah expired" },
      401
    );
  }
});

/**
 * GET /api/admin/profile - Get current user profile
 */
adminApi.get("/profile", (c) => {
  try {
    const payload = c.get("jwtPayload");
    
    return c.json(
      {
        data: maskSensitiveData(payload),
        message: "Profile berhasil diambil"
      },
      200
    );
  } catch (error: any) {
    return c.json(handleError(error, "Gagal mengambil profile"), 500);
  }
});

/**
 * GET /api/admin/santri/stats - Get santri statistics
 */
adminApi.get("/santri/stats", async (c) => {
  try {
    const [
      putra,
      putri,
      totalSantri,
      totalAlumni,
      totalPengurus,
      totalPengabdi
    ] = await Promise.all([
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM santri WHERE jenis_kelamin = 'L' AND status_santri = 'santri'"
      ).first<{ count: number }>(),
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM santri WHERE jenis_kelamin = 'P' AND status_santri = 'santri'"
      ).first<{ count: number }>(),
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM santri WHERE status_santri = 'santri'"
      ).first<{ count: number }>(),
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM santri WHERE status_santri = 'alumni'"
      ).first<{ count: number }>(),
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM santri WHERE status_santri = 'pengurus'"
      ).first<{ count: number }>(),
      c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM santri WHERE status_santri = 'pengabdi'"
      ).first<{ count: number }>()
    ]);

    return c.json(
      {
        data: {
          putra: putra?.count ?? 0,
          putri: putri?.count ?? 0,
          totalSantri: totalSantri?.count ?? 0,
          totalAlumni: totalAlumni?.count ?? 0,
          totalPengurus: totalPengurus?.count ?? 0,
          totalPengabdi: totalPengabdi?.count ?? 0
        },
        message: "Statistik santri berhasil diambil"
      },
      200
    );
  } catch (error: any) {
    return c.json(
      handleError(error, "Gagal mengambil statistik santri"),
      500
    );
  }
});

/**
 * POST /api/admin/santri/create - Create new santri
 */
adminApi.post("/santri/create", async (c) => {
  try {
    const formData = await c.req.formData();
    const nama_santri = sanitizeInput(formData.get("nama_santri") as string);
    const foto = formData.get("foto") as File | null;

    // Validasi required fields
    if (!nama_santri) {
      throw new HTTPException(400, { message: "Nama santri diperlukan" });
    }

    // Validasi file upload
    if (!isValidFileUpload(foto)) {
      throw new HTTPException(400, { message: "File tidak valid atau terlalu besar" });
    }

    let fotoKey: string | null = null;
    
    // Upload foto jika ada
    if (foto && foto.size > 0) {
      // Sanitasi nama file
      const fileName = sanitizeInput(foto.name.replace(/[^a-zA-Z0-9.-]/g, ''));
      // PERBAIKAN: Simpan langsung tanpa folder 'santri/' untuk fleksibilitas
      fotoKey = `${crypto.randomUUID()}-${fileName}`;
      
      await c.env.MY_BUCKET.put(fotoKey, foto.stream(), {
        httpMetadata: { contentType: foto.type || "application/octet-stream" }
      });
    }

    // Extract & sanitize form data
    const sql = `
      INSERT INTO santri (
        nama_santri, foto, jenis_kelamin, alamat,
        nama_ibu, kontak_ibu, nama_ayah, kontak_ayah,
        nama_wali, kontak_wali, status_santri
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await c.env.DB.prepare(sql).bind(
      nama_santri,
      fotoKey,
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

    return c.json(
      { message: "Santri berhasil ditambahkan" },
      201
    );

  } catch (error: any) {
    return c.json(handleError(error, "Gagal menambahkan santri"), 500);
  }
});

/**
 * GET /api/admin/santri/search - Search santri
 */
adminApi.get("/santri/search", async (c) => {
  try {
    const query = sanitizeInput(c.req.query("q") || "");
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    const limit = PAGINATION_LIMIT;
    const offset = (page - 1) * limit;
    const searchTerm = `%${query}%`;

    // Get total count
    const countResult = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM santri WHERE nama_santri LIKE ?"
    ).bind(searchTerm).first<{ count: number }>();

    const totalCount = countResult?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);

    // Get paginated results
    const { results } = await c.env.DB.prepare(
      "SELECT id, nama_santri, jenis_kelamin, status_santri FROM santri WHERE nama_santri LIKE ? LIMIT ? OFFSET ?"
    ).bind(searchTerm, limit, offset).all();

    return c.json(
      {
        data: {
          results: results || [],
          pagination: {
            currentPage: page,
            totalPages,
            totalCount,
            limit
          }
        },
        message: "Pencarian santri berhasil"
      },
      200
    );

  } catch (error: any) {
    return c.json(handleError(error, "Gagal melakukan pencarian santri"), 500);
  }
});

/**
 * GET /api/admin/santri/:id - Get santri detail
 */
adminApi.get("/santri/:id", async (c) => {
  try {
    const id = c.req.param("id");

    if (!isValidId(id)) {
      throw new HTTPException(400, { message: "ID santri tidak valid" });
    }

    const santri = await c.env.DB.prepare(
      "SELECT * FROM santri WHERE id = ?"
    ).bind(id).first();

    if (!santri) {
      throw new HTTPException(404, { message: "Santri tidak ditemukan" });
    }

    return c.json(
      { data: santri, message: "Data santri berhasil diambil" },
      200
    );

  } catch (error: any) {
    return c.json(handleError(error, "Gagal mengambil data santri"), 500);
  }
});

/**
 * GET /api/admin/perizinan/search-santri - Search santri untuk perizinan
 */
adminApi.get("/perizinan/search-santri", async (c) => {
  try {
    const query = sanitizeInput(c.req.query("q") || "");

    if (!query) {
      return c.json({ data: { results: [] }, message: "Query kosong" }, 200);
    }

    const searchTerm = `%${query}%`;
    const { results } = await c.env.DB.prepare(`
      SELECT id, nama_santri, status_santri, jenis_kelamin
      FROM santri
      WHERE
        nama_santri LIKE ?
        AND status_santri IN ('santri', 'pengurus', 'pengabdi')
      LIMIT ?
    `).bind(searchTerm, SEARCH_RESULT_LIMIT).all();

    return c.json(
      { data: { results: results || [] }, message: "Pencarian berhasil" },
      200
    );

  } catch (error: any) {
    return c.json(handleError(error, "Gagal melakukan pencarian santri"), 500);
  }
});

/**
 * POST /api/admin/perizinan/create - Create new perizinan (pengajuan)
 */
adminApi.post("/perizinan/create", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { santriId, namaPengajuan, keterangan } = body;
    const pengaju = c.get("jwtPayload").username;

    // Validasi input
    if (!santriId || !namaPengajuan) {
      throw new HTTPException(400, {
        message: "Santri ID dan Nama Pengajuan diperlukan"
      });
    }

    if (!isValidId(santriId)) {
      throw new HTTPException(400, { message: "ID santri tidak valid" });
    }

    // Sanitasi input
    const sanitizedNamaPengajuan = sanitizeInput(namaPengajuan);
    const sanitizedKeterangan = sanitizeInput(keterangan || "");

    // Insert dengan parameterized query
    const { meta } = await c.env.DB.prepare(
      "INSERT INTO pengajuan (ID_santri, nama_pengajuan, keterangan, pengaju) VALUES (?, ?, ?, ?)"
    ).bind(
      santriId,
      sanitizedNamaPengajuan,
      sanitizedKeterangan,
      pengaju
    ).run();

    const newPengajuanId = meta.last_row_id;

    if (!newPengajuanId) {
      throw new Error("Gagal mendapatkan ID pengajuan");
    }

    return c.json(
      {
        data: { pengajuanId: newPengajuanId },
        message: "Pengajuan izin berhasil dibuat"
      },
      201
    );

  } catch (error: any) {
    return c.json(handleError(error, "Gagal membuat pengajuan izin"), 500);
  }
});

/**
 * GET /api/admin/perizinan/pending - Get pending perizinan
 */
adminApi.get("/perizinan/pending", async (c) => {
  try {
    const sqlQuery = `
      SELECT
        p.ID_Pengajuan, p.nama_pengajuan, p.keterangan, p.pengaju,
        s.nama_santri, s.status_santri
      FROM pengajuan p
      JOIN santri s ON p.ID_santri = s.id
      WHERE p.keputusan = 'menunggu'
      ORDER BY p.ID_Pengajuan DESC
    `;

    const { results } = await c.env.DB.prepare(sqlQuery).all();

    return c.json(
      {
        data: { results: results || [] },
        message: "Data pengajuan pending berhasil diambil"
      },
      200
    );

  } catch (error: any) {
    return c.json(
      handleError(error, "Gagal mengambil data pengajuan pending"),
      500
    );
  }
});

/**
 * POST /api/admin/perizinan/update-status - Update pengajuan status
 */
adminApi.post("/perizinan/update-status", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { pengajuanId, newStatus, tanggalKembali } = body;
    const approverUsername = c.get("jwtPayload").username;

    // Validasi input
    if (!pengajuanId || !newStatus) {
      throw new HTTPException(400, {
        message: "ID Pengajuan dan status diperlukan"
      });
    }

    if (!isValidId(pengajuanId)) {
      throw new HTTPException(400, { message: "ID pengajuan tidak valid" });
    }

    const validStatuses = ['disetujui', 'ditolak'];
    if (!validStatuses.includes(newStatus)) {
      throw new HTTPException(400, {
        message: `Status harus salah satu dari: ${validStatuses.join(', ')}`
      });
    }

    // Update pengajuan status
    await c.env.DB.prepare(
      "UPDATE pengajuan SET keputusan = ?, disetujui_oleh = ? WHERE ID_Pengajuan = ?"
    ).bind(
      newStatus,
      newStatus === 'disetujui' ? approverUsername : null,
      pengajuanId
    ).run();

    // Jika disetujui, create perizinan record
    if (newStatus === 'disetujui') {
      if (!tanggalKembali) {
        throw new HTTPException(400, {
          message: "Tanggal Kembali diperlukan untuk menyetujui izin"
        });
      }

      const pengajuan = await c.env.DB.prepare(
        "SELECT ID_santri FROM pengajuan WHERE ID_Pengajuan = ?"
      ).bind(pengajuanId).first<{ ID_santri: number }>();

      if (!pengajuan) {
        throw new HTTPException(404, { message: "Pengajuan tidak ditemukan" });
      }

      await c.env.DB.prepare(
        "INSERT INTO perizinan (ID_Santri, ID_Pengajuan, Tanggal_Kembali) VALUES (?, ?, ?)"
      ).bind(pengajuan.ID_santri, pengajuanId, tanggalKembali).run();
    }

    return c.json(
      { message: `Status berhasil diubah menjadi ${newStatus}` },
      200
    );

  } catch (error: any) {
    return c.json(handleError(error, "Gagal memperbarui status pengajuan"), 500);
  }
});

/**
 * GET /api/admin/perizinan/all - Get all perizinan
 */
adminApi.get("/perizinan/all", async (c) => {
  try {
    const sqlQuery = `
      SELECT
        p.ID_Pengajuan, p.nama_pengajuan, p.keterangan, p.pengaju, p.keputusan, p.disetujui_oleh,
        s.nama_santri, s.foto, s.alamat,
        i.ID_Perizinan, i.Tanggal_Kembali, i.Keterlambatan_Jam
      FROM pengajuan p
      JOIN santri s ON p.ID_santri = s.id
      LEFT JOIN perizinan i ON p.ID_Pengajuan = i.ID_Pengajuan
      ORDER BY p.ID_Pengajuan DESC
    `;

    const { results } = await c.env.DB.prepare(sqlQuery).all();

    return c.json(
      {
        data: { results: results || [] },
        message: "Semua data pengajuan berhasil diambil"
      },
      200
    );

  } catch (error: any) {
    return c.json(
      handleError(error, "Gagal mengambil semua data pengajuan"),
      500
    );
  }
});

/**
 * GET /api/admin/perizinan/aktif - Get active perizinan
 */
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
      ORDER BY i.Tanggal_Kembali ASC
    `;

    const { results } = await c.env.DB.prepare(sqlQuery).all();

    return c.json(
      {
        data: { results: results || [] },
        message: "Data izin aktif berhasil diambil"
      },
      200
    );

  } catch (error: any) {
    return c.json(handleError(error, "Gagal mengambil data izin aktif"), 500);
  }
});

/**
 * POST /api/admin/perizinan/tandai-kembali - Mark perizinan as returned
 */
adminApi.post("/perizinan/tandai-kembali", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { perizinanId, statusKembali, keterlambatanHari, keterlambatanJam } = body;

    // Validasi input
    if (!perizinanId || !statusKembali) {
      throw new HTTPException(400, {
        message: "ID Perizinan dan Status Kembali diperlukan"
      });
    }

    if (!isValidId(perizinanId)) {
      throw new HTTPException(400, { message: "ID perizinan tidak valid" });
    }

    const validStatuses = ['Tepat Waktu', 'Terlambat'];
    if (!validStatuses.includes(statusKembali)) {
      throw new HTTPException(400, {
        message: `Status harus salah satu dari: ${validStatuses.join(', ')}`
      });
    }

    // Calculate keterlambatan
    let totalKeterlambatanJam = 0;
    if (statusKembali === 'Terlambat') {
      const hari = Math.max(0, parseInt(keterlambatanHari) || 0);
      const jam = Math.max(0, parseInt(keterlambatanJam) || 0);
      totalKeterlambatanJam = (hari * 24) + jam;
    }

    const actualReturnTime = new Date().toISOString();

    // Update perizinan record
    await c.env.DB.prepare(
      "UPDATE perizinan SET Status_Kembali = ?, Tanggal_Aktual_Kembali = ?, Keterlambatan_Jam = ? WHERE ID_Perizinan = ?"
    ).bind(
      statusKembali,
      actualReturnTime,
      totalKeterlambatanJam,
      perizinanId
    ).run();

    return c.json(
      {
        message: "Kepulangan santri berhasil dicatat",
        data: {
          status: statusKembali,
          keterlambatanJam: totalKeterlambatanJam
        }
      },
      200
    );

  } catch (error: any) {
    return c.json(handleError(error, "Gagal mencatat kepulangan santri"), 500);
  }
});

/**
 * GET /api/admin/sanksi/list - Get semua aturan sanksi
 */
adminApi.get("/sanksi/list", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM sanksi_aturan WHERE is_active = 1 ORDER BY Min_Keterlambatan_Jam ASC"
    ).all();

    return c.json(
      {
        data: { results: results || [] },
        message: "Daftar sanksi berhasil diambil"
      },
      200
    );

  } catch (error: any) {
    return c.json(handleError(error, "Gagal mengambil daftar sanksi"), 500);
  }
});

/**
 * POST /api/admin/sanksi/create - Create new aturan sanksi
 */
adminApi.post("/sanksi/create", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { minJam, keterangan } = body;

    // Validasi input
    if (!minJam || !keterangan) {
      throw new HTTPException(400, {
        message: "Jam minimal dan keterangan diperlukan"
      });
    }

    const minJamNum = parseInt(minJam);
    if (isNaN(minJamNum) || minJamNum < 0) {
      throw new HTTPException(400, { message: "Jam minimal harus angka positif" });
    }

    const sanitizedKeterangan = sanitizeInput(keterangan);

    await c.env.DB.prepare(
      "INSERT INTO sanksi_aturan (Min_Keterlambatan_Jam, Keterangan_Sanksi) VALUES (?, ?)"
    ).bind(minJamNum, sanitizedKeterangan).run();

    return c.json(
      { message: "Aturan sanksi berhasil dibuat" },
      201
    );

  } catch (error: any) {
    return c.json(handleError(error, "Gagal membuat aturan sanksi"), 500);
  }
});

/**
 * PUT /api/admin/sanksi/update/:id - Update aturan sanksi
 */
adminApi.put("/sanksi/update/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const { minJam, keterangan } = body;

    // Validasi ID
    if (!isValidId(id)) {
      throw new HTTPException(400, { message: "ID sanksi tidak valid" });
    }

    // Validasi input
    if (!minJam || !keterangan) {
      throw new HTTPException(400, {
        message: "Jam minimal dan keterangan diperlukan"
      });
    }

    const minJamNum = parseInt(minJam);
    if (isNaN(minJamNum) || minJamNum < 0) {
      throw new HTTPException(400, { message: "Jam minimal harus angka positif" });
    }

    const sanitizedKeterangan = sanitizeInput(keterangan);

    await c.env.DB.prepare(
      "UPDATE sanksi_aturan SET Min_Keterlambatan_Jam = ?, Keterangan_Sanksi = ? WHERE ID_Sanksi = ?"
    ).bind(minJamNum, sanitizedKeterangan, id).run();

    return c.json(
      { message: "Aturan sanksi berhasil diperbarui" },
      200
    );

  } catch (error: any) {
    return c.json(handleError(error, "Gagal memperbarui aturan sanksi"), 500);
  }
});

/**
 * DELETE /api/admin/sanksi/delete/:id - Soft delete aturan sanksi
 */
adminApi.delete("/sanksi/delete/:id", async (c) => {
  try {
    const id = c.req.param("id");

    if (!isValidId(id)) {
      throw new HTTPException(400, { message: "ID sanksi tidak valid" });
    }

    await c.env.DB.prepare(
      "UPDATE sanksi_aturan SET is_active = 0 WHERE ID_Sanksi = ?"
    ).bind(id).run();

    return c.json(
      { message: "Aturan sanksi berhasil dihapus" },
      200
    );

  } catch (error: any) {
    return c.json(handleError(error, "Gagal menghapus aturan sanksi"), 500);
  }
});

// =======================================================
// --- MOUNT ROUTES ---
// =======================================================
app.route("/api/admin", adminApi);

export default app;