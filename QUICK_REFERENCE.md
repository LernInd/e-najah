# 🚀 Quick Reference - Refactored API

## 📍 File yang Direfactor
```
d:\Koding\cloudflare\e-najah\src\worker\index.ts
```

---

## 🔑 Utility Functions

### Security
| Function | Input | Output | Kegunaan |
|----------|-------|--------|----------|
| `sanitizeInput(str, max)` | string | string | Hapus XSS chars |
| `isValidUsername(user)` | string | boolean | Check format 3-32 alphanumeric |
| `isValidPassword(pass)` | string | boolean | Check length 8-32 |
| `isValidId(id)` | any | boolean | Check numeric ID > 0 |
| `isValidFileUpload(file)` | File\|null | boolean | Check size ≤ 5MB |
| `maskSensitiveData(obj)` | object | object | Delete password & secrets |
| `getClientIp(headers)` | Headers | string | Extract IP dari CF header |

### Rate Limiting
| Function | Purpose |
|----------|---------|
| `checkRateLimit(ip)` | Check if IP exceeded 8 attempts/min |
| `incrementFailedAttempt(ip)` | +1 failed attempt |
| `resetRateLimit(ip)` | Clear attempt counter |

### Error Handling
| Function | Purpose |
|----------|---------|
| `handleError(error, msg)` | Centralized error handler |

---

## 📊 Constants

```typescript
const JWT_EXPIRY_SECONDS = 28800;           // 8 hours
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 32;
const LOGIN_ATTEMPT_LIMIT = 8;              // per minute
const LOGIN_ATTEMPT_WINDOW_MS = 60000;      // 1 minute
const MAX_INPUT_LENGTH = 1000;
const MAX_FILE_SIZE = 5242880;              // 5MB
const IMAGE_CACHE_MAX_AGE = 3600;           // 1 hour
const PAGINATION_LIMIT = 5;
const SEARCH_RESULT_LIMIT = 10;
```

---

## 🔓 Public Routes

### Login
```
POST /api/login
```
**Headers:** None (public)

**Body:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Success (200):**
```json
{
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": 1,
      "username": "admin",
      "peran": "admin",
      "nama_lengkap": "Administrator"
    }
  },
  "message": "Login berhasil"
}
```

**Errors:**
- 400: Username & password diperlukan
- 400: Format username tidak valid
- 400: Password harus 8-32 karakter
- 401: Username atau password salah
- 429: Terlalu banyak percobaan

---

### Get Image
```
GET /api/images/:key
```
**Headers:** None (public)

**Example:**
```
GET /api/images/santri/uuid-filename.jpg
```

**Success (200):** Image file

**Errors:**
- 400: Image key diperlukan
- 400: Invalid image key (.. atau //)
- 404: Image not found

---

## 🔒 Protected Routes

**Headers Required:**
```
Authorization: Bearer JWT_TOKEN
```

### Profile
```
GET /api/admin/profile
```
**Response:**
```json
{
  "data": {
    "id": 1,
    "username": "admin",
    "peran": "admin",
    "nama_lengkap": "Admin",
    "iat": 1234567890,
    "exp": 1234595690
  },
  "message": "Profile berhasil diambil"
}
```

### Santri Stats
```
GET /api/admin/santri/stats
```
**Response:**
```json
{
  "data": {
    "putra": 10,
    "putri": 15,
    "totalSantri": 25,
    "totalAlumni": 5,
    "totalPengurus": 3,
    "totalPengabdi": 2
  },
  "message": "Statistik santri berhasil diambil"
}
```

### Search Santri
```
GET /api/admin/santri/search?q=nama&page=1
```
**Response:**
```json
{
  "data": {
    "results": [
      {
        "id": 1,
        "nama_santri": "Ahmad",
        "jenis_kelamin": "L",
        "status_santri": "santri"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 25,
      "limit": 5
    }
  },
  "message": "Pencarian santri berhasil"
}
```

### Create Santri
```
POST /api/admin/santri/create
Content-Type: multipart/form-data
```
**Form Data:**
- nama_santri (required)
- jenis_kelamin
- alamat
- nama_ibu, kontak_ibu
- nama_ayah, kontak_ayah
- nama_wali, kontak_wali
- status_santri
- foto (file, optional, ≤5MB)

**Response (201):**
```json
{
  "message": "Santri berhasil ditambahkan"
}
```

### Get Santri Detail
```
GET /api/admin/santri/:id
```
**Response:**
```json
{
  "data": {
    "id": 1,
    "nama_santri": "Ahmad",
    "jenis_kelamin": "L",
    "alamat": "Jl. Merdeka",
    "foto": "santri/uuid-filename.jpg",
    ...
  },
  "message": "Data santri berhasil diambil"
}
```

### Search Santri untuk Perizinan
```
GET /api/admin/perizinan/search-santri?q=nama
```

### Create Pengajuan Izin
```
POST /api/admin/perizinan/create
```
**Body:**
```json
{
  "santriId": 1,
  "namaPengajuan": "Izin Keluar",
  "keterangan": "Keperluan keluarga"
}
```

### Get Pending Pengajuan
```
GET /api/admin/perizinan/pending
```

### Update Pengajuan Status
```
POST /api/admin/perizinan/update-status
```
**Body:**
```json
{
  "pengajuanId": 1,
  "newStatus": "disetujui",
  "tanggalKembali": "2025-11-20"
}
```

### Get All Perizinan
```
GET /api/admin/perizinan/all
```

### Get Active Perizinan
```
GET /api/admin/perizinan/aktif
```

### Mark Kembali
```
POST /api/admin/perizinan/tandai-kembali
```
**Body:**
```json
{
  "perizinanId": 1,
  "statusKembali": "Tepat Waktu",
  "keterlambatanHari": 0,
  "keterlambatanJam": 0
}
```

### Sanksi Routes
```
GET /api/admin/sanksi/list
POST /api/admin/sanksi/create
PUT /api/admin/sanksi/update/:id
DELETE /api/admin/sanksi/delete/:id
```

---

## 🔄 Response Format Template

### All Success Responses:
```json
{
  "data": { /* response data */ },
  "message": "Success description"
}
```

### All Error Responses:
```json
{
  "error": "Error description"
}
```

### HTTP Status Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized / Invalid Token |
| 404 | Not Found |
| 429 | Too Many Requests (Rate Limited) |
| 500 | Server Error |

---

## 🧪 Quick Test Commands

### Login
```bash
curl -X POST http://localhost:8787/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'
```

### Get Profile
```bash
curl http://localhost:8787/api/admin/profile \
  -H "Authorization: Bearer TOKEN"
```

### Search Santri
```bash
curl "http://localhost:8787/api/admin/santri/search?q=ahmad&page=1" \
  -H "Authorization: Bearer TOKEN"
```

### Create Santri
```bash
curl -X POST http://localhost:8787/api/admin/santri/create \
  -H "Authorization: Bearer TOKEN" \
  -F "nama_santri=Ahmad" \
  -F "jenis_kelamin=L" \
  -F "status_santri=santri" \
  -F "foto=@photo.jpg"
```

---

## ⚡ Performance Notes

- ✅ Parameterized queries: No SQL compilation overhead
- ✅ Input sanitization: Minimal overhead (regex only for username)
- ✅ Rate limiting: O(1) Map lookup
- ✅ Auto cleanup: Every 5 minutes (background)
- ✅ Caching: Image cache-control: 3600s

---

## 🔐 Security Checklist

- [x] Input sanitization (XSS)
- [x] SQL injection prevention
- [x] Rate limiting (brute force)
- [x] Password protection
- [x] Data masking (no secrets)
- [x] Path traversal prevention
- [x] File upload limits
- [x] JWT validation
- [x] Error message safety
- [x] Parameterized queries

---

## 📚 Documentation Files

| File | Konten |
|------|--------|
| `CHANGES_SUMMARY.md` | Ringkasan singkat perbaikan |
| `REFACTORING_NOTES.md` | Dokumentasi detail (6 sections) |
| `BEFORE_AFTER_EXAMPLES.md` | 4 contoh sebelum-sesudah |
| `TESTING_GUIDE.md` | 30+ test cases |
| `REFACTORING_COMPLETE.md` | Status & checklist |
| `QUICK_REFERENCE.md` | File ini |

---

**Last Updated:** November 17, 2025  
**Status:** ✅ Production Ready
