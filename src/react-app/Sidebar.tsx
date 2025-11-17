// src/react-app/Sidebar.tsx
import React from "react";
import "./DashboardLayout.css"; 

type NavLink = {
  key: string;
  label: string;
};

interface SidebarProps {
  isOpen: boolean; 
  activeView: string;
  onNavigate: (view: string) => void;
  navLinks: NavLink[]; 
  handleLogout: () => void; 
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  activeView,
  onNavigate,
  navLinks,
  // handleLogout, // Prop ini tidak lagi dipakai di visual sidebar, tapi biarkan di interface agar tidak error di parent
}) => {

  return (
    <>
      <nav className={`sidebar ${isOpen ? "open" : ""}`}>
        
        {/* Logo / Judul Sidebar */}
        <div className="sidebar-header-title">
          E-NAJAH
        </div>

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

        {/* BAGIAN TOMBOL LOGOUT DIHAPUS DI SINI */}
        
      </nav>
    </>
  );
};