// src/react-app/App.tsx

import { useState, useEffect, FormEvent } from "react";
import "./App.css"; // Style layout khusus login ada di sini
import "./SimpleOverride.css"; // Style global
// Impor SEMUA dashboard
import DashboardAdminPerizinan from "./DashboardAdminPerizinan";
import DashboardAdminDataSantri from "./DashboardAdminDataSantri";
import DashboardNdalem from "./DashboardNdalem";

// ===================================================================
// Tipe dan Helper Keamanan
// ===================================================================
type UserData = {
  id: number;
  username: string;
  peran: string;
  nama_lengkap?: string;
};

const getToken = (): string | null => localStorage.getItem("token");

const decodeToken = (token: string): UserData | null => {
  try {
    if (!token || typeof token !== "string" || token.split(".").length !== 3) return null;
    const payloadBase64 = token.split(".")[1];
    const decodedPayload = JSON.parse(atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/")));
    if (
      typeof decodedPayload !== "object" ||
      typeof decodedPayload.username !== "string" ||
      typeof decodedPayload.id !== "number"
    ) {
      return null;
    }
    return decodedPayload;
  } catch (e) {
    return null;
  }
};

// RegEx username: hanya huruf, angka, underscore, min 3 max 32
const isValidUsername = (v: string) => /^[a-zA-Z0-9_]{3,32}$/.test(v);
// Password check sederhana di frontend
const isValidPassword = (v: string) => /^[ -~]{8,32}$/.test(v);

function escapeInput(str: string): string {
  return str.replace(/[<>&'"`]/g, "");
}

// Daftar Banner (Pastikan file ini ada di folder /public)
const BANNERS = [
  "/banner1.jpg",
  "/banner2.jpg",
  "/banner3.jpg",
  "/banner4.jpg",
  "/banner5.jpg"
];

// ===============================================
function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggedInUser, setLoggedInUser] = useState<UserData | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [retryDelay, setRetryDelay] = useState(0);
  const [waiting, setWaiting] = useState(false);
  
  // State untuk slider gambar
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  useEffect(() => {
    const token = getToken();
    if (token) {
      const user = decodeToken(token);
      if (user) {
        setLoggedInUser(user);
      } else {
        localStorage.removeItem("token");
      }
    }
  }, []);

  // Efek Slider Otomatis (Ganti tiap 5 detik)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % BANNERS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Rate limit logic
  useEffect(() => {
    if (retryDelay > 0) {
      setWaiting(true);
      const t = setTimeout(() => {
        setWaiting(false);
        setRetryDelay(0);
      }, retryDelay * 1000);
      return () => clearTimeout(t);
    }
  }, [retryDelay]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (waiting) return;
    if (!isValidUsername(username)) return setError("Username tidak valid (hanya huruf/angka/_, 3-32 char)");
    if (!isValidPassword(password)) return setError("Password minimal 8 karakter");
    
    setIsLoading(true);
    setError("");
    
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      });
      const data = await response.json();
      
      if (!response.ok) {
        const nextDelay = Math.min((loginAttempts + 1), 10);
        setRetryDelay(nextDelay);
        setLoginAttempts(a => a + 1);
        throw new Error(data.error || data.message || `Login gagal (${nextDelay}s)`);
      }

      // Login Sukses
      localStorage.setItem("token", data.data.token);
      const user = decodeToken(data.data.token);
      if (!user) throw new Error("Token tidak valid");
      
      setLoggedInUser(user);
      setUsername("");
      setPassword("");
      setLoginAttempts(0);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan koneksi");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setLoggedInUser(null);
    setError("");
  };

  // --- TAMPILAN LOGGED OUT (LOGIN SCREEN SPLIT) ---
  if (!loggedInUser) {
    return (
      <div className="login-split-container">
        
        {/* KIRI (60%) - IMAGE SLIDER */}
        <div className="login-banner-side">
          {BANNERS.map((src, index) => (
            <div
              key={index}
              className={`banner-slide ${index === currentBannerIndex ? "active" : ""}`}
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}
          <div className="banner-overlay">
            <div className="overlay-content">
              <h1>E-NAJAH</h1>
              <p>Sistem Informasi Manajemen Pesantren</p>
              <div className="slider-indicators">
                {BANNERS.map((_, idx) => (
                  <span 
                    key={idx} 
                    className={`indicator ${idx === currentBannerIndex ? 'active' : ''}`}
                    onClick={() => setCurrentBannerIndex(idx)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* KANAN (40%) - FORM LOGIN */}
        <div className="login-form-side">
          <div className="form-wrapper">
            <div className="form-header">
              <h2>Selamat Datang</h2>
              <p>Silakan masuk ke akun Anda</p>
            </div>

            <form onSubmit={handleSubmit} autoComplete="off">
              {error && <div className="alert error">{error}</div>}
              {waiting && retryDelay > 0 && (
                <div className="alert warning">
                  Tunggu {retryDelay} detik lagi...
                </div>
              )}

              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={e => setUsername(escapeInput(e.target.value.replace(/[^\w]/g, "")))}
                  placeholder="Masukkan username"
                  required
                  disabled={isLoading || waiting}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={e => setPassword(escapeInput(e.target.value))}
                  placeholder="Masukkan password"
                  required
                  disabled={isLoading || waiting}
                />
              </div>

              <button
                type="submit"
                className="login-button full-width"
                disabled={isLoading || waiting || !username || !password}
              >
                {isLoading ? "Memuat..." : waiting ? "Tunggu..." : "Masuk"}
              </button>
            </form>
            
            <div className="form-footer">
              <p>&copy; {new Date().getFullYear()} E-NAJAH System</p>
            </div>
          </div>
        </div>

      </div>
    );
  }

  // --- TAMPILAN LOGGED IN (DASHBOARD) ---
  return (
    <div className="app-container">
      {loggedInUser.peran === "admin_perizinan" && (
        <DashboardAdminPerizinan loggedInUser={loggedInUser} handleLogout={handleLogout} />
      )}
      {loggedInUser.peran === "admin_datasantri" && (
        <DashboardAdminDataSantri loggedInUser={loggedInUser} handleLogout={handleLogout} />
      )}
      {loggedInUser.peran === "ndalem" && (
        <DashboardNdalem loggedInUser={loggedInUser} handleLogout={handleLogout} />
      )}
      {/* Fallback jika role tidak dikenali */}
      {(loggedInUser.peran !== "admin_perizinan" &&
        loggedInUser.peran !== "admin_datasantri" &&
        loggedInUser.peran !== "ndalem") && (
          <div className="unauthorized">
             <p>Role tidak dikenali. <button onClick={handleLogout}>Logout</button></p>
          </div>
      )}
    </div>
  );
}

export default App;