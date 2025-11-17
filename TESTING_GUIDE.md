# 🧪 Testing Guide - Keamanan & Fungsionalitas

## 1. Rate Limiting Test

### Test Case 1.1: Normal Login
```bash
curl -X POST http://localhost:8787/api/login \
  -H "Content-Type: application/json" \
  -H "CF-Connecting-IP: 192.168.1.100" \
  -d '{"username": "admin", "password": "password123"}'
```

**Expected:** Status 200, token returned

---

### Test Case 1.2: Rate Limit Exceeded
```bash
# Loop 9 times dengan IP yang sama
for i in {1..9}; do
  curl -X POST http://localhost:8787/api/login \
    -H "Content-Type: application/json" \
    -H "CF-Connecting-IP: 192.168.1.100" \
    -d '{"username": "admin", "password": "wrongpass"}'
  sleep 0.1
done
```

**Expected:** 
- First 8 attempts: Status 401 "Username atau password salah"
- 9th attempt: Status 429 "Terlalu banyak percobaan. Coba lagi dalam X detik."

---

### Test Case 1.3: Rate Limit Reset After 1 Minute
```bash
# Wait 61 seconds, then try again
sleep 61
curl -X POST http://localhost:8787/api/login \
  -H "Content-Type: application/json" \
  -H "CF-Connecting-IP: 192.168.1.100" \
  -d '{"username": "admin", "password": "password123"}'
```

**Expected:** Status 200 (rate limit reset)

---

## 2. Input Validation Tests

### Test Case 2.1: XSS Prevention
```bash
curl -X POST http://localhost:8787/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "<script>alert(1)</script>", "password": "password123"}'
```

**Expected:** Status 400 "Format username tidak valid"

---

### Test Case 2.2: SQL Injection in Search
```bash
curl "http://localhost:8787/api/admin/santri/search?q=' OR '1'='1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** Search bekerja normal (tidak exposed data), tidak ada error SQL

---

### Test Case 2.3: Invalid Username Format
```bash
curl -X POST http://localhost:8787/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "ab", "password": "password123"}'
```

**Expected:** Status 400 "Format username tidak valid"

---

### Test Case 2.4: Short Password
```bash
curl -X POST http://localhost:8787/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "short"}'
```

**Expected:** Status 400 "Password harus 8-32 karakter"

---

### Test Case 2.5: Long Input (>1000 chars)
```bash
# Generate string dengan 2000 'a'
LONG_STRING=$(printf 'a%.0s' {1..2000})
curl "http://localhost:8787/api/admin/santri/search?q=${LONG_STRING}" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** Query di-truncate ke 1000 chars, search normal

---

## 3. Path Traversal Prevention

### Test Case 3.1: Directory Traversal Attack
```bash
curl "http://localhost:8787/api/images/../../etc/passwd"
```

**Expected:** Status 400 "Invalid image key"

---

### Test Case 3.2: Double Slash Attack
```bash
curl "http://localhost:8787/api/images/foo//bar/image.png"
```

**Expected:** Status 400 "Invalid image key"

---

### Test Case 3.3: Valid Image Request
```bash
curl "http://localhost:8787/api/images/santri/valid-uuid-filename.jpg"
```

**Expected:** Image returned atau 404 (jika tidak ada)

---

## 4. Data Protection Tests

### Test Case 4.1: Password Not Returned
```bash
curl -X POST http://localhost:8787/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password123"}'
```

**Check Response:** Password field TIDAK ada dalam response

```json
{
  "data": {
    "token": "...",
    "user": {
      "id": 1,
      "username": "admin",
      "peran": "admin",
      "nama_lengkap": "Admin Name"
      // ❌ TIDAK ADA PASSWORD
    }
  },
  "message": "Login berhasil"
}
```

---

### Test Case 4.2: Username Enumeration Prevention
```bash
# Try existing user with wrong password
curl -X POST http://localhost:8787/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "wrongpass"}'
```

**Check:** Error message = "Username atau password salah"

```bash
# Try non-existing user
curl -X POST http://localhost:8787/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "nonexistent", "password": "password123"}'
```

**Check:** Error message SAMA = "Username atau password salah"

---

## 5. File Upload Security

### Test Case 5.1: File Size Limit
```bash
# Create file >5MB
dd if=/dev/zero of=largefile.bin bs=1M count=10

curl -X POST http://localhost:8787/api/admin/santri/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "nama_santri=Test" \
  -F "foto=@largefile.bin"
```

**Expected:** Status 400 "File tidak valid atau terlalu besar"

---

### Test Case 5.2: Valid File Upload
```bash
curl -X POST http://localhost:8787/api/admin/santri/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "nama_santri=Test Student" \
  -F "jenis_kelamin=L" \
  -F "status_santri=santri" \
  -F "foto=@valid_image.jpg"
```

**Expected:** Status 201 "Santri berhasil ditambahkan"

---

### Test Case 5.3: Filename Sanitization
- Upload file dengan nama: `../../etc/passwd.jpg`
- Check di R2 bucket: Filename di-sanitasi (tanpa `../`)

---

## 6. JWT & Authentication

### Test Case 6.1: Missing Token
```bash
curl "http://localhost:8787/api/admin/profile"
```

**Expected:** Status 401 "Token tidak valid atau sudah expired"

---

### Test Case 6.2: Invalid Token
```bash
curl "http://localhost:8787/api/admin/profile" \
  -H "Authorization: Bearer invalid.token.here"
```

**Expected:** Status 401 "Token tidak valid atau sudah expired"

---

### Test Case 6.3: Expired Token
```bash
# Create token with exp: now - 1 hour
# Then try to access protected endpoint
curl "http://localhost:8787/api/admin/profile" \
  -H "Authorization: Bearer EXPIRED_TOKEN"
```

**Expected:** Status 401 "Token tidak valid atau sudah expired"

---

### Test Case 6.4: Valid Token
```bash
curl "http://localhost:8787/api/admin/profile" \
  -H "Authorization: Bearer VALID_TOKEN"
```

**Expected:** Status 200 dengan user profile

---

## 7. API Response Format Consistency

### Test Case 7.1: Successful Response
```bash
curl "http://localhost:8787/api/admin/santri/stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Format:**
```json
{
  "data": {
    "putra": 10,
    "putri": 15,
    // ... other fields
  },
  "message": "Statistik santri berhasil diambil"
}
```

---

### Test Case 7.2: Error Response
```bash
curl "http://localhost:8787/api/admin/santri/999999" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Format:**
```json
{
  "error": "Santri tidak ditemukan"
}
```

---

## 8. Database Injection Prevention

### Test Case 8.1: Parameterized Query Verification
```bash
# Search dengan LIKE injection
curl "http://localhost:8787/api/admin/santri/search?q=%' OR '1'='1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** Normal search results, tidak ada error atau data leak

---

## 9. Pagination & Limit Tests

### Test Case 9.1: Valid Pagination
```bash
curl "http://localhost:8787/api/admin/santri/search?q=test&page=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** Status 200 dengan pagination info

```json
{
  "data": {
    "results": [...],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalCount": 25,
      "limit": 5
    }
  }
}
```

---

### Test Case 9.2: Invalid Page Number
```bash
curl "http://localhost:8787/api/admin/santri/search?q=test&page=0" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** Page di-adjust ke 1 (min value)

---

### Test Case 9.3: Negative Page Number
```bash
curl "http://localhost:8787/api/admin/santri/search?q=test&page=-5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:** Page di-adjust ke 1

---

## 🎯 Automated Test Script (Optional)

```bash
#!/bin/bash

BASE_URL="http://localhost:8787"
TOKEN="your_token_here"

echo "🧪 Running Security Tests..."

# Test 1: Rate Limit
echo "Test 1: Rate Limiting"
for i in {1..9}; do
  curl -s -X POST $BASE_URL/api/login \
    -H "Content-Type: application/json" \
    -H "CF-Connecting-IP: 192.168.1.200" \
    -d '{"username": "admin", "password": "wrong"}' | jq '.error'
done

# Test 2: XSS Prevention
echo "Test 2: XSS Prevention"
curl -s -X POST $BASE_URL/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "<script>alert(1)</script>", "password": "test"}' | jq '.error'

# Test 3: Path Traversal
echo "Test 3: Path Traversal Prevention"
curl -s "$BASE_URL/api/images/../../etc/passwd" | jq '.error'

# Test 4: Valid Request
echo "Test 4: Valid Request"
curl -s "$BASE_URL/api/admin/profile" \
  -H "Authorization: Bearer $TOKEN" | jq '.message'

echo "✅ All tests completed!"
```

---

## 📝 Checklist Hasil Testing

- [ ] Rate limiting berfungsi dengan baik
- [ ] Input sanitasi mencegah XSS
- [ ] Path traversal di-block
- [ ] Password tidak di-return
- [ ] Username enumeration di-prevent
- [ ] File upload size di-limit
- [ ] JWT validation bekerja
- [ ] Response format konsisten
- [ ] SQL injection di-prevent
- [ ] Error messages aman (tidak expose detail)

---

**Status:** Ready untuk testing ✅
