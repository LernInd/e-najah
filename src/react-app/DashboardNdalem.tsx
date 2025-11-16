// src/react-app/DashboardNdalem.tsx

import React, { useState, useEffect, FormEvent } from "react";
import "./App.css";
import "./DashboardNdalem.css";

// --- Tipe Data ---
type UserData = {
  id: number;
  username: string;
  peran: string;
};
type SantriStatus = 'santri' | 'alumni' | 'pengurus' | 'pengabdi';
type PengajuanData = {
  ID_Pengajuan: number;
  nama_pengajuan: string;
  keterangan: string;
  pengaju: string;
  nama_santri: string;
  status_santri: SantriStatus;
};

// Props dari App.tsx
interface DashboardNdalemProps {
  loggedInUser: UserData;
  handleLogout: () => void;
}

// Helper
const getToken = (): string | null => localStorage.getItem("token");

// =======================================================
// Komponen Navbar (Tidak Berubah)
// =======================================================
interface NavbarProps {
  loggedInUser: UserData;
  handleLogout: () => void;
}
const NdalemNavbar: React.FC<NavbarProps> = ({ loggedInUser, handleLogout }) => {
  return (
    <nav className="dashboard-navbar">
      <div className="navbar-brand">E-Najah (Ndalem)</div>
      <div className="navbar-links">
        <button className="active">Persetujuan</button>
      </div>
      <div className="navbar-user">
        <span>Halo, {loggedInUser.username}</span>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>
    </nav>
  );
};

// =======================================================
// Komponen Modal Persetujuan (BARU)
// =======================================================
interface PersetujuanModalProps {
  pengajuan: PengajuanData;
  onClose: () => void;
  onSubmitSuccess: () => void;
}
const PersetujuanModal: React.FC<PersetujuanModalProps> = ({ pengajuan, onClose, onSubmitSuccess }) => {
  const [tanggalKembali, setTanggalKembali] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const token = getToken();
      const response = await fetch("/api/admin/perizinan/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pengajuanId: pengajuan.ID_Pengajuan,
          newStatus: 'disetujui',
          tanggalKembali: tanggalKembali
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal menyetujui pengajuan");
      }
      
      alert("Pengajuan berhasil disetujui!");
      onSubmitSuccess(); // Muat ulang data di parent
      onClose(); // Tutup modal

    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>&times;</button>
        <h2>Setujui Pengajuan Izin</h2>
        
        {/* Info Pengajuan */}
        <div className="detail-info-grid simple-grid">
          <div className="detail-item">
            <label>Nama Santri</label>
            <p>{pengajuan.nama_santri}</p>
          </div>
          <div className="detail-item">
            <label>Status Santri</label>
            <p>{pengajuan.status_santri}</p>
          </div>
          <div className="detail-item detail-span-2">
            <label>Nama Pengajuan</label>
            <p>{pengajuan.nama_pengajuan}</p>
          </div>
          <div className="detail-item detail-span-2">
            <label>Keterangan</label>
            <p>{pengajuan.keterangan || "-"}</p>
          </div>
        </div>

        {/* Form Input Tanggal Kembali */}
        <form onSubmit={handleSubmit} className="modal-form">
          {error && <p className="error-message">{error}</p>}
          <div className="form-group">
            <label htmlFor="tanggal_kembali">Tentukan Tanggal Kembali *</label>
            <input 
              type="date" 
              id="tanggal_kembali" 
              required 
              value={tanggalKembali}
              onChange={(e) => setTanggalKembali(e.target.value)}
              // Set tanggal minimum ke hari ini
              min={new Date().toISOString().split('T')[0]} 
            />
          </div>
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? "Menyimpan..." : "Setujui & Simpan"}
          </button>
        </form>
      </div>
    </div>
  );
};


// =======================================================
// Komponen Utama Dashboard (DIPERBARUI)
// =======================================================
const DashboardNdalem: React.FC<DashboardNdalemProps> = ({
  loggedInUser,
  handleLogout,
}) => {
  const [pengajuanList, setPengajuanList] = useState<PengajuanData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // State untuk modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPengajuan, setSelectedPengajuan] = useState<PengajuanData | null>(null);

  // Fungsi untuk mengambil data
  const fetchPendingPengajuan = async () => {
    setIsLoading(true);
    setError("");
    try {
      const token = getToken();
      const response = await fetch("/api/admin/perizinan/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal mengambil data");
      }
      setPengajuanList(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Ambil data saat komponen dimuat
  useEffect(() => {
    fetchPendingPengajuan();
  }, []);

  // Fungsi untuk BUKA MODAL PERSETUJUAN
  const handleSetujuiClick = (pengajuan: PengajuanData) => {
    setSelectedPengajuan(pengajuan);
    setIsModalOpen(true);
  };

  // Fungsi untuk TOLAK
  const handleTolakClick = async (id: number) => {
    if (!window.confirm("Anda yakin ingin MENOLAK pengajuan ini?")) {
      return;
    }

    try {
      const token = getToken();
      const response = await fetch("/api/admin/perizinan/update-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pengajuanId: id, newStatus: 'ditolak' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal menolak pengajuan");
      }
      
      alert("Pengajuan berhasil ditolak.");
      fetchPendingPengajuan(); // Muat ulang data

    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="dashboard-layout">
      <NdalemNavbar
        loggedInUser={loggedInUser}
        handleLogout={handleLogout}
      />
      <main className="dashboard-content">
        <div className="content-page">
          <h2>Daftar Pengajuan Izin (Menunggu)</h2>
          <p>Tinjau dan setujui atau tolak pengajuan izin yang masuk.</p>

          {error && <p className="error-message">{error}</p>}
          {isLoading && <p>Memuat data pengajuan...</p>}

          {!isLoading && pengajuanList.length === 0 && (
            <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginTop: '2rem' }}>
              Tidak ada pengajuan yang menunggu persetujuan.
            </p>
          )}

          {!isLoading && pengajuanList.length > 0 && (
            <div className="approval-table">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Nama Santri</th>
                    <th>Pengajuan</th>
                    <th>Keterangan</th>
                    <th>Oleh Admin</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pengajuanList.map((p) => (
                    <tr key={p.ID_Pengajuan}>
                      <td>{p.nama_santri} ({p.status_santri})</td>
                      <td>{p.nama_pengajuan}</td>
                      <td>{p.keterangan || "-"}</td>
                      <td>{p.pengaju}</td>
                      <td>
                        <div className="action-buttons">
                          <button 
                            className="approve-button"
                            onClick={() => handleSetujuiClick(p)}
                          >
                            Setujui...
                          </button>
                          <button 
                            className="reject-button"
                            onClick={() => handleTolakClick(p.ID_Pengajuan)}
                          >
                            Tolak
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
      
      {/* Render Modal jika isModalOpen true */}
      {isModalOpen && selectedPengajuan && (
        <PersetujuanModal
          pengajuan={selectedPengajuan}
          onClose={() => setIsModalOpen(false)}
          onSubmitSuccess={() => {
            fetchPendingPengajuan(); // Muat ulang data setelah sukses
          }}
        />
      )}
    </div>
  );
};

export default DashboardNdalem;