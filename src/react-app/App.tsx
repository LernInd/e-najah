// src/react-app/App.tsx

import React, { useState, useEffect, FormEvent } from "react";
import "./App.css";
import "./SimpleOverride.css";
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
    // Validasi struktur tipe hasil parse
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
// Password: min 8, ada angka dan huruf (simple front-end check, hardening server-side!)
const isValidPassword = (v: string) => /^[ -~]{8,32}$/.test(v);

// Fungsi escape input sederhana untuk anti XSS
function escapeInput(str: string): string {
  return str.replace(/[<>&'"`]/g, "");
}

// ===============================================
function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggedInUser, setLoggedInUser] = useState<UserData | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [retryDelay, setRetryDelay] = useState(0); // in seconds
  const [waiting, setWaiting] = useState(false);

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

  // Rate limit simple: delay naik tiap gagal (max 10s)
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
    if (waiting) return; // blok FORM cuma pas delay, bukan blok total
    if (!isValidUsername(username)) return setError("Username hanya boleh huruf/angka/underscore (3-32 karakter)");
    if (!isValidPassword(password)) return setError("Password minimal 8 karakter (boleh angka/huruf)");
    setIsLoading(true);
    setError("");
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Content-Type-Options": "nosniff"
        },
        credentials: "same-origin",
        body: JSON.stringify({
          username: username.trim(),
          password
        })
      });
      const data = await response.json();
      if (!response.ok) {
        // Naikkan retry delay (eksponen, max 10s), reset jika sukses
        const nextDelay = Math.min((loginAttempts + 1), 10);
        setRetryDelay(nextDelay);
        setLoginAttempts(a => a + 1);
        throw new Error(data.error || data.message || `Login gagal (${nextDelay}s)`);
      }
      localStorage.removeItem("token");
      localStorage.setItem("token", data.token);
      const user = decodeToken(data.token);
      if (!user) {
        throw new Error("Token tidak valid");
      }
      setLoggedInUser(user);
      setUsername("");
      setPassword("");
      setLoginAttempts(0);
      setRetryDelay(0);
    } catch (err: any) {
      setError(err.message || "Login error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setLoggedInUser(null);
    setError("");
  };

  // --- Tampilan logged out ---
  if (!loggedInUser) {
    return (
      <div className="login-container">
        <div className="form-panel">
          <form className="login-form" onSubmit={handleSubmit} autoComplete="off">
            <h2>Selamat Datang</h2>
            <p>Silakan login menggunakan kredensial resmi.</p>
            {error && <p className="error-message" role="alert">{error}</p>}
            {waiting && retryDelay > 0 && (
              <div className="error-message" style={{color:'#f59e42',borderColor:'#f59e42',background:'#fff8eb'}}>
                Tunggu {retryDelay} detik sebelum mencoba login lagi (rate limit).
              </div>
            )}
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                type="text"
                id="username"
                value={username}
                autoComplete="username"
                onChange={e => setUsername(escapeInput(e.target.value.replace(/[^\w]/g, "")))}
                minLength={3} maxLength={32}
                required
                disabled={isLoading || waiting}
                aria-invalid={!isValidUsername(username)}
                aria-describedby="usernameHelp"
              />
              <small id="usernameHelp" style={{color:'#888'}}>Hanya huruf, angka, underscore. (3-32 karakter)</small>
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                value={password}
                autoComplete="current-password"
                onChange={e => setPassword(escapeInput(e.target.value))}
                required
                minLength={8} maxLength={32}
                disabled={isLoading || waiting}
                aria-invalid={!isValidPassword(password)}
              />
              <small style={{color:'#888'}}>Minimal 8 karakter. Password diamankan di server.</small>
            </div>
            <button
              type="submit"
              className="login-button"
              disabled={isLoading||waiting||!isValidUsername(username)||!isValidPassword(password)}
            >
              {isLoading ? "Loading..." : waiting ? `Tunggu... (${retryDelay}s)` : "Login"}
            </button>
          </form>
        </div>
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
      {loggedInUser.peran === "ndalem" && (
        <DashboardNdalem
          loggedInUser={loggedInUser}
          handleLogout={handleLogout}
        />
      )}
      {(loggedInUser.peran !== "admin_perizinan" &&
        loggedInUser.peran !== "admin_datasantri" &&
        loggedInUser.peran !== "ndalem") && handleLogout()}
    </div>
  );
}

export default App;