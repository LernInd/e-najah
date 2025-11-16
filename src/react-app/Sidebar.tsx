// src/react-app/Sidebar.tsx
import React from "react";
import "./DashboardLayout.css"; // Impor CSS layout

// Tipe data yang dibutuhkan
type NavLink = {
  key: string;
  label: string;
};

interface SidebarProps {
  isOpen: boolean; 
  activeView: string;
  onNavigate: (view: string) => void;
  navLinks: NavLink[]; 
  handleLogout: () => void; // <-- Prop untuk logout
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  activeView,
  onNavigate,
  navLinks,
  handleLogout, // <-- Ambil prop
}) => {

  return (
    <>
      {/* Sidebar Utama */}
      <nav className={`sidebar ${isOpen ? "open" : ""}`}>
        
        <div className="sidebar-nav">
          {navLinks.map((link) => (
            <button
              key={link.key}
              className={activeView === link.key ? "active" : ""}
              onClick={() => onNavigate(link.key)}
            >
              {link.label}
            </button>
          ))}
        </div>

        {/* Tombol Logout di bawah sidebar */}
        <div className="sidebar-user-info">
           <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </nav>
    </>
  );
};