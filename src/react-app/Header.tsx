// src/react-app/Header.tsx
import React from "react";
import "./DashboardLayout.css";

// Tipe data yang dibutuhkan oleh Header
type UserData = {
  username: string;
  nama_lengkap?: string; // Tambahkan nama_lengkap (opsional)
};

interface HeaderProps {
  loggedInUser: UserData;
  handleLogout: () => void;
  onToggleSidebar: () => void; // Fungsi untuk toggle sidebar
  // brandName prop DIHAPUS
}

export const Header: React.FC<HeaderProps> = ({
  loggedInUser,
  handleLogout,
  onToggleSidebar,
}) => {
  return (
    <header className="dashboard-header">
      {/* Tombol Hamburger (SEKARANG DI KIRI) */}
      <button
        className="mobile-nav-toggle"
        onClick={onToggleSidebar}
        aria-label="Buka navigasi"
      >
        {/* Ikon Hamburger (garis tiga) */}
        &#9776;
      </button>

      {/* Brand (DIHAPUS) */}

      {/* User Info (TETAP DI KANAN) */}
      <div className="header-right-side">
        <div className="header-user-info">
          <span>
            Halo, {loggedInUser.nama_lengkap || loggedInUser.username}
          </span>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};