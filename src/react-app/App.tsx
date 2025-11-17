// src/react-app/App.tsx

import { useState, useEffect, FormEvent } from "react";
import "./App.css"; 
import "./SimpleOverride.css"; 
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

const isValidUsername = (v: string) => /^[a-zA-Z0-9_]{3,32}$/.test(v);
// Validasi sederhana di frontend

function escapeInput(str: string): string {
  return str.replace(/[<>&'"`]/g, "");
}

// --- KONFIGURASI BANNER (DARI R2 BUCKET) ---
// Menggunakan endpoint API yang sudah terhubung ke R2
const BANNERS = [
  "/api/images/banner1.jpg",
  "/api/images/banner2.jpg",
  "/api/images/banner3.jpg",
  "/api/images/banner4.jpg",
  "/api/images/banner5.jpg"
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

  // State Slider Banner
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  // Cek Token saat load
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

  // Auto Slide Banner (5 detik)
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % BANNERS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Rate Limit Timer
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
    if (!isValidUsername(username)) return setError("Format username salah (huruf/angka/_, 3-32 char)");
    
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password })
      });
      
      const data = await response.json();

      if (!response.ok) {
        const nextDelay = Math.min((loginAttempts + 1) * 2, 10); 
        setRetryDelay(nextDelay);
        setLoginAttempts(prev => prev + 1);
        throw new Error(data.error || "Login gagal");
      }

      // Login Sukses
      const token = data.data?.token;
      if (!token) throw new Error("Token tidak ditemukan dalam respons");

      localStorage.setItem("token", token);
      const user = decodeToken(token);
      if (!user) throw new Error("Token tidak valid");

      setLoggedInUser(user);
      setUsername("");
      setPassword("");
      setLoginAttempts(0);
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setLoggedInUser(null);
    setError("");
  };

  // --- TAMPILAN LOGIN (SPLIT SCREEN) ---
  if (!loggedInUser) {
    return (
      <div className="login-split-container">
        
        {/* KIRI (60%) - GAMBAR / BANNER DARI BUCKET */}
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
              <p>Silakan masuk untuk melanjutkan</p>
            </div>

            <form onSubmit={handleSubmit} autoComplete="off">
              {error && (
                <div className="alert error" style={{background:'#FEF2F2', color:'#991B1B', padding:'0.8rem', borderRadius:'8px', marginBottom:'1rem', border:'1px solid #FECACA'}}>
                  {error}
                </div>
              )}
              {waiting && (
                <div className="alert warning" style={{background:'#FFFBEB', color:'#92400E', padding:'0.8rem', borderRadius:'8px', marginBottom:'1rem', border:'1px solid #FDE68A'}}>
                  Mohon tunggu {retryDelay} detik...
                </div>
              )}

              <div className="form-group">
                <label htmlFor="username">Username</label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={e => setUsername(escapeInput(e.target.value.replace(/[^\w]/g, "")))}
                  placeholder="Username"
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
                  placeholder="Password"
                  required
                  disabled={isLoading || waiting}
                />
              </div>

              <button
                type="submit"
                className="login-button full-width"
                disabled={isLoading || waiting || !username || !password}
                style={{marginTop:'1.5rem', height:'48px', fontSize:'1rem'}}
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

  // --- TAMPILAN DASHBOARD (LOGGED IN) ---
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
      
      {/* Fallback jika peran tidak dikenali */}
      {(!["admin_perizinan", "admin_datasantri", "ndalem"].includes(loggedInUser.peran)) && (
        <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', flexDirection:'column'}}>
           <h3>Akses Ditolak</h3>
           <p>Peran pengguna <strong>{loggedInUser.peran}</strong> tidak memiliki dashboard.</p>
           <button onClick={handleLogout} className="login-button" style={{width:'auto', marginTop:'1rem'}}>Logout</button>
        </div>
      )}
    </div>
  );
}

export default App;