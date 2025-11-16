// src/react-app/App.tsx

import { useState, useEffect, FormEvent } from "react";
import "./App.css";
// Impor SEMUA dashboard
import DashboardAdminPerizinan from "./DashboardAdminPerizinan";
import DashboardAdminDataSantri from "./DashboardAdminDataSantri";
import DashboardNdalem from "./DashboardNdalem"; // <-- IMPORT BARU

// ===================================================================
// Tipe dan Fungsi Helper
// ===================================================================
type UserData = {
  id: number;
  username: string;
  peran: string;
};

const getToken = (): string | null => localStorage.getItem("token");

const decodeToken = (token: string): UserData | null => {
  try {
    const payloadBase64 = token.split(".")[1];
    const decodedPayload = atob(payloadBase64);
    return JSON.parse(decodedPayload);
  } catch (e) {
    console.error("Gagal decode token:", e);
    return null;
  }
};


// ===================================================================
// Komponen SliderPanel (Terisolasi)
// ===================================================================
const bannerImages = [
  "banner1.JPG",
  "banner2.JPG",
  "banner3.JPG",
  "banner4.jpg",
  "banner5.jpg",
];

function SliderPanel() {
  // ... (Kode SliderPanel - tidak berubah)
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % bannerImages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="slider-panel">
      {bannerImages.map((imageKey, index) => (
        <img
          key={imageKey}
          src={`/api/images/${imageKey}`}
          alt="Banner"
          className={`slide ${index === currentImageIndex ? "active" : ""}`}
        />
      ))}
    </div>
  );
}

// ===================================================================
// Komponen LoginForm (Tidak berubah)
// ===================================================================
interface LoginFormProps {
  username: string;
  password: string;
  isLoading: boolean;
  error: string;
  setUsername: (val: string) => void;
  setPassword: (val: string) => void;
  handleSubmit: (e: FormEvent) => void;
}
function LoginForm(props: LoginFormProps) {
  // ... (Kode LoginForm - tidak berubah)
  const {
    username,
    password,
    isLoading,
    error,
    setUsername,
    setPassword,
    handleSubmit,
  } = props;
  return (
    <div className="form-panel">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Selamat Datang</h2>
        <p>Silakan login untuk melanjutkan.</p>
        {error && <p className="error-message">{error}</p>}
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} required disabled={isLoading} />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isLoading} />
        </div>
        <button type="submit" className="login-button" disabled={isLoading}>
          {isLoading ? "Loading..." : "Login"}
        </button>
      </form>
    </div>
  );
}


// ===================================================================
// Komponen App Utama (Container State) (DIPERBARUI)
// ===================================================================
function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggedInUser, setLoggedInUser] = useState<UserData | null>(null);

  useEffect(() => {
    const token = getToken();
    if (token) {
      const user = decodeToken(token);
      setLoggedInUser(user);
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    // ... (Fungsi handleSubmit Anda - tidak berubah)
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || "Login gagal");
      }
      localStorage.setItem("token", data.token);
      const user = decodeToken(data.token);
      setLoggedInUser(user);
      setUsername("");
      setPassword("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    // ... (Fungsi handleLogout Anda - tidak berubah)
    localStorage.removeItem("token");
    setLoggedInUser(null);
    setError("");
  };

  // --- Logika Render Utama (DIPERBARUI) ---

  if (!loggedInUser) {
    // --- TAMPILAN LOGGED OUT ---
    return (
      <div className="login-container">
        <SliderPanel />
        <LoginForm
          username={username}
          password={password}
          isLoading={isLoading}
          error={error}
          setUsername={setUsername}
          setPassword={setPassword}
          handleSubmit={handleSubmit}
        />
      </div>
    );
  }

  // --- TAMPILAN LOGGED IN ---
  return (
    <div className="app-container">
      {loggedInUser.peran === "admin_perizinan" && (
        <DashboardAdminPerizinan
          loggedInUser={loggedInUser}
          handleLogout={handleLogout}
        />
      )}
      
      {loggedInUser.peran === "admin_datasantri" && (
        <DashboardAdminDataSantri
          loggedInUser={loggedInUser}
          handleLogout={handleLogout}
        />
      )}
      
      {/* --- CASE BARU UNTUK NDALEM --- */}
      {loggedInUser.peran === "ndalem" && (
        <DashboardNdalem
          loggedInUser={loggedInUser}
          handleLogout={handleLogout}
        />
      )}
      
      {/* Fallback jika peran tidak cocok (auto-logout) */}
      {loggedInUser.peran !== "admin_perizinan" &&
        loggedInUser.peran !== "admin_datasantri" &&
        loggedInUser.peran !== "ndalem" && ( // <-- Tambahkan cek ndalem
          <>{handleLogout()}</>
      )}
    </div>
  );
}

export default App;