// src/react-app/Sidebar.tsx
import React, { useState } from "react";
import "./DashboardLayout.css"; // Impor CSS yang baru kita buat

// Tipe data yang dibutuhkan oleh Sidebar
type UserData = {
  username: string;
};
type NavLink = {
  key: string;
  label: string;
};

interface SidebarProps {
  loggedInUser: UserData;
  handleLogout: () => void;
  activeView: string;
  onNavigate: (view: string) => void;
  navLinks: NavLink[]; // Daftar link navigasi
  brandName: string; // Judul sidebar
}

export const Sidebar: React.FC<SidebarProps> = ({
  loggedInUser,
  handleLogout,
  activeView,
  onNavigate,
  navLinks,
  brandName,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavClick = (view: string) => {
    onNavigate(view);
    setIsOpen(false); // Tutup sidebar setelah diklik (untuk mobile)
  };

  return (
    <>
      {/* Tombol Hamburger (hanya tampil di mobile) */}
      <button
        className="mobile-nav-toggle"
        onClick={() => setIsOpen(true)}
        aria-label="Buka navigasi"
      >
        {/* Ikon Hamburger (garis tiga) */}
        &#9776;
      </button>

      {/* Overlay (hanya tampil di mobile saat sidebar terbuka) */}
      {isOpen && (
        <div className="sidebar-overlay" onClick={() => setIsOpen(false)}></div>
      )}

      {/* Sidebar Utama */}
      <nav className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header">{brandName}</div>

        <div className="sidebar-nav">
          {navLinks.map((link) => (
            <button
              key={link.key}
              className={activeView === link.key ? "active" : ""}
              onClick={() => handleNavClick(link.key)}
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="sidebar-user-info">
          <span>Halo, {loggedInUser.username}</span>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </nav>
    </>
  );
};