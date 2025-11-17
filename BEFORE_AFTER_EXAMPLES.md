# 📝 Contoh Sebelum & Sesudah Refactoring

## 1️⃣ Login Endpoint

### SEBELUM ❌
```typescript
app.post("/api/login", async (c) => {
  function sanitizeInput(str: string) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/[<>&'"`]/g, '').slice(0, 1000);
  }
  
  // Rate limit di dalam function (tidak reusable)
  const loginAttemptsByIp = {};
  const ip = c.req.header("CF-Connecting-IP") || "local";
  loginAttemptsByIp[ip] = loginAttemptsByIp[ip] || { count: 0, last: 0 };
  const now = Date.now();
  if (loginAttemptsByIp[ip].count > 8 && now - loginAttemptsByIp[ip].last < 60000) {
    return c.json({ error: "Terlalu banyak percobaan. Coba lagi dalam 1 menit." }, 429);
  }
  
  const { username, password } = await c.req.json();
  if (!username || !password) {
    throw new HTTPException(400, { message: "Username dan password diperlukan" });
  }
  
  // Reveal user existence
  if (!user) {
    return c.json({ error: "Username tidak ditemukan" }, 404);
  }
  
  const token = await sign(payload, c.env.JWT_SECRET);
  return c.json({ token }); // Response tidak konsisten
});
```

**Masalah:**
- ❌ Rate limit function tidak reusable
- ❌ Tidak cleanup expired attempts
- ❌ Username enumeration vulnerability
- ❌ Response format tidak konsisten
- ❌ Magic numbers hardcoded

### SESUDAH ✅
```typescript
app.post("/api/login", async (c) => {
  try {
    const clientIp = getClientIp(c.req.raw.headers);
    
    // Gunakan reusable function
    const rateLimitCheck = checkRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      return c.json(
        { error: rateLimitCheck.message },
        429
      );
    }

    // Safe JSON parsing
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

    // Validasi format dengan dedicated functions
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

    const user = await c.env.DB.prepare(
      "SELECT id, username, password, peran, nama_lengkap FROM pengguna WHERE username = ?"
    ).bind(username).first<any>();

    if (!user) {
      incrementFailedAttempt(clientIp);
      // Generic message untuk prevent user enumeration
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

    // Reset pada successful login
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

    // Consistent response format
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
```

**Perbaikan:**
- ✅ Rate limit reusable & global
- ✅ Auto cleanup dengan setInterval
- ✅ Generic error messages
- ✅ Consistent response format
- ✅ Constants di top level
- ✅ Dedicated validation functions

---

## 2️⃣ Search Endpoint

### SEBELUM ❌
```typescript
adminApi.get("/santri/search", async (c) => {
  try {
    const query = c.req.query("q") || "";
    const page = parseInt(c.req.query("page") || "1");
    const limit = 5; // Hardcoded
    const offset = (page - 1) * limit;
    const searchTerm = `%${query}%`;
    
    // Raw query tanpa placeholders
    const countStmt = c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM santri WHERE nama_santri LIKE ?1"
    );
    const totalResult = await countStmt.bind(searchTerm).first<{ count: number }>();
    const totalCount = totalResult?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);
    
    const resultsStmt = c.env.DB.prepare(
      "SELECT id, nama_santri, jenis_kelamin, status_santri FROM santri WHERE nama_santri LIKE ?1 LIMIT ?2 OFFSET ?3"
    );
    const { results } = await resultsStmt.bind(searchTerm, limit, offset).all();
    
    // Response tidak konsisten
    return c.json({ results, totalPages, currentPage: page });
  } catch (e: any) {
    console.error(e);
    // Expose error message
    return c.json({ error: "Gagal melakukan pencarian", message: e.message }, 500);
  }
});
```

**Masalah:**
- ❌ Tidak sanitasi query input
- ❌ Magic number hardcoded (limit: 5)
- ❌ Response format tidak konsisten
- ❌ Page validation tidak ada
- ❌ Error message terlalu detail

### SESUDAH ✅
```typescript
adminApi.get("/santri/search", async (c) => {
  try {
    // Sanitasi input
    const query = sanitizeInput(c.req.query("q") || "");
    // Validasi & default page
    const page = Math.max(1, parseInt(c.req.query("page") || "1"));
    // Gunakan constant
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

    // Consistent response format
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
```

**Perbaikan:**
- ✅ Input di-sanitasi
- ✅ Constants untuk magic values
- ✅ Page validation (min 1)
- ✅ Consistent response dengan pagination info
- ✅ Safe error handling

---

## 3️⃣ File Upload

### SEBELUM ❌
```typescript
const formData = await c.req.formData();
const foto = formData.get("foto") as File | null;
const nama_santri = formData.get("nama_santri") as string;

if (foto && foto.size > 0) {
  // Filename tidak sanitasi → risk
  fotoKey = `santri/${crypto.randomUUID()}-${foto.name}`;
  await c.env.MY_BUCKET.put(fotoKey, foto.stream(), {
    httpMetadata: { contentType: foto.type },
  });
}
```

**Masalah:**
- ❌ Filename tidak sanitasi (bisa XSS)
- ❌ File size tidak ada limit
- ❌ Content-type tidak validated

### SESUDAH ✅
```typescript
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
  fotoKey = `santri/${crypto.randomUUID()}-${fileName}`;
  
  await c.env.MY_BUCKET.put(fotoKey, foto.stream(), {
    httpMetadata: { contentType: foto.type || "application/octet-stream" }
  });
}
```

**Perbaikan:**
- ✅ Filename di-sanitasi (remove special chars)
- ✅ File size di-validate (max 5MB)
- ✅ Content-type safe default
- ✅ Random UUID prevent collision
- ✅ Validation function reusable

---

## 4️⃣ Error Handling

### SEBELUM ❌
```typescript
} catch (e: any) {
  if (e instanceof HTTPException) return e.getResponse();
  console.error(e);
  // Expose internal error details
  return c.json({ error: "Gagal mengambil data", message: e.message }, 500);
}
```

### SESUDAH ✅
```typescript
} catch (error: any) {
  return c.json(handleError(error, "Gagal mengambil data"), 500);
}

// Centralized handling
function handleError(error: any, defaultMessage: string = "Terjadi kesalahan") {
  console.error("[ERROR]", error);
  
  if (error instanceof HTTPException) {
    return error.getResponse();
  }

  return {
    error: defaultMessage
  };
}
```

**Perbaikan:**
- ✅ Centralized error handling
- ✅ Consistent error response
- ✅ Tidak expose internal error details

---

## 📊 Comparison

| Aspek | Sebelum | Sesudah |
|-------|---------|---------|
| **Input Validation** | Basic | Comprehensive |
| **Rate Limiting** | In-function | Global & reusable |
| **SQL Injection** | OK (parameterized) | Enhanced validation |
| **File Security** | Minimal | Filename sanitasi + size limit |
| **Error Handling** | Scattered | Centralized |
| **Response Format** | Inconsistent | Consistent |
| **Constants** | Hardcoded | Top-level |
| **Code Organization** | Mixed | Organized sections |
| **Documentation** | Minimal | Detailed comments |
| **Maintainability** | Moderate | High |

---

**Kesimpulan:** ✅ Code lebih aman, terstruktur, dan maintainable
