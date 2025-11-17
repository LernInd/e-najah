// src/react-app/DashboardNdalem.tsx

import React, { useState, useEffect, FormEvent } from "react";
import "./App.css";
import "./DashboardNdalem.css";
import "./DashboardLayout.css";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";

// --- Tipe Data ---
type UserData = {
  id: number;
  username: string;
  peran: string;
  nama_lengkap?: string;
};
type NdalemView = "persetujuan" | "atur_sanksi";
type SantriStatus = "santri" | "alumni" | "pengurus" | "pengabdi";
type PengajuanData = {
  ID_Pengajuan: number;
  nama_pengajuan: string;
  keterangan: string;
  pengaju: string;
  nama_santri: string;
  status_santri: SantriStatus;
};
// Tipe BARU untuk Aturan Sanksi
type SanksiAturan = {
  ID_Sanksi: number;
  Min_Keterlambatan_Jam: number;
  Keterangan_Sanksi: string;
  is_active: number; // 1 atau 0
};

// Props dari App.tsx
interface DashboardNdalemProps {
  loggedInUser: UserData;
  handleLogout: () => void;
}

// Helper
const getToken = (): string | null => localStorage.getItem("token");

function escapeInput(str: string): string {
  return str.replace(/[<>&'"`]/g, "");
}

// =======================================================
// Komponen Header Halaman
// =======================================================
const PageHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="page-header-clean">
    <h2>{title}</h2>
    <p>{subtitle}</p>
  </div>
);

// =======================================================
// Komponen Modal Persetujuan
// =======================================================
interface PersetujuanModalProps {
  pengajuan: PengajuanData;
  onClose: () => void;
  onSubmitSuccess: () => void;
}
const PersetujuanModal: React.FC<PersetujuanModalProps> = ({
  pengajuan,
  onClose,
  onSubmitSuccess,
}) => {
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
          newStatus: "disetujui",
          tanggalKembali: tanggalKembali,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal menyetujui pengajuan");
      }
      alert("Pengajuan berhasil disetujui!");
      onSubmitSuccess();
      onClose();
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
        <div className="detail-info-grid">
          <div className="detail-item">
            <label>Nama Santri</label> <p>{pengajuan.nama_santri}</p>
          </div>
          <div className="detail-item">
            <label>Status</label> <p>{pengajuan.status_santri}</p>
          </div>
          <div className="detail-item">
            <label>Keperluan</label> <p>{pengajuan.nama_pengajuan}</p>
          </div>
          <div className="detail-item">
            <label>Keterangan</label> <p>{pengajuan.keterangan || "-"}</p>
          </div>
        </div>
        
        <hr style={{border:'0', borderTop:'1px solid #eee', margin:'1.5rem 0'}}/>
        
        <form onSubmit={handleSubmit}>
          {error && <p className="error-message">{error}</p>}
          <div className="form-group">
            <label htmlFor="tanggal_kembali">
              Tentukan Tanggal Kembali *
            </label>
            <input
              type="date"
              id="tanggal_kembali"
              required
              value={tanggalKembali}
              onChange={(e) => setTanggalKembali(escapeInput(e.target.value))}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
            style={{width:'100%'}}
          >
            {isLoading ? "Menyimpan..." : "Setujui & Simpan"}
          </button>
        </form>
      </div>
    </div>
  );
};

// =======================================================
// View: Persetujuan
// =======================================================
const PersetujuanView: React.FC = () => {
  const [pengajuanList, setPengajuanList] = useState<PengajuanData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPengajuan, setSelectedPengajuan] = useState<PengajuanData | null>(null);

  const fetchPendingPengajuan = async () => {
    setIsLoading(true);
    setError("");
    try {
      const token = getToken();
      const response = await fetch("/api/admin/perizinan/pending", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      // FIX: Akses data.data.results
      if (response.ok) {
        setPengajuanList(data.data?.results || []);
      } else {
        throw new Error(data.error || "Gagal mengambil data");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingPengajuan();
  }, []);

  const handleSetujuiClick = (pengajuan: PengajuanData) => {
    setSelectedPengajuan(pengajuan);
    setIsModalOpen(true);
  };

  const handleTolakClick = async (id: number) => {
    if (!window.confirm("Anda yakin ingin MENOLAK pengajuan ini?")) return;
    try {
      const token = getToken();
      const response = await fetch("/api/admin/perizinan/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pengajuanId: id, newStatus: "ditolak" }),
      });
      if (!response.ok) throw new Error("Gagal menolak pengajuan");
      alert("Pengajuan berhasil ditolak.");
      fetchPendingPengajuan();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <>
      <PageHeader title="Persetujuan Izin" subtitle="Tinjau pengajuan izin santri yang menunggu persetujuan" />
      
      {error && <p className="error-message" style={{textAlign:'center'}}>{error}</p>}
      
      {isLoading ? <p style={{textAlign:'center', color:'#888'}}>Memuat data...</p> : (
        <div className="table-card">
          <table className="results-table">
            <thead>
              <tr>
                <th>Nama Santri</th>
                <th>Keperluan</th>
                <th>Keterangan</th>
                <th>Pengaju</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pengajuanList.length === 0 && (
                <tr><td colSpan={5} style={{textAlign:'center', padding:'3rem', color:'#999'}}>Tidak ada pengajuan baru.</td></tr>
              )}
              {pengajuanList.map((p) => (
                <tr key={p.ID_Pengajuan}>
                  <td data-label="Nama">{p.nama_santri} <small style={{color:'#666'}}>({p.status_santri})</small></td>
                  <td data-label="Keperluan">{p.nama_pengajuan}</td>
                  <td data-label="Keterangan">{p.keterangan || "-"}</td>
                  <td data-label="Pengaju">{p.pengaju}</td>
                  <td data-label="Aksi">
                    <div className="action-buttons">
                      <button className="approve-button" onClick={() => handleSetujuiClick(p)}>Setujui</button>
                      <button className="reject-button" onClick={() => handleTolakClick(p.ID_Pengajuan)}>Tolak</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && selectedPengajuan && (
        <PersetujuanModal
          pengajuan={selectedPengajuan}
          onClose={() => setIsModalOpen(false)}
          onSubmitSuccess={fetchPendingPengajuan}
        />
      )}
    </>
  );
};

// =======================================================
// View: Atur Sanksi
// =======================================================
const AturSanksiView: React.FC = () => {
  const [sanksiList, setSanksiList] = useState<SanksiAturan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setError] = useState("");

  // State untuk Form
  const [minJam, setMinJam] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSanksi = async () => {
    setIsLoading(true);
    setError("");
    try {
      const token = getToken();
      const response = await fetch("/api/admin/sanksi/list", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      // FIX: Akses data.data.results
      if (response.ok) {
        setSanksiList(data.data?.results || []);
      } else {
        throw new Error(data.error || "Gagal mengambil data");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSanksi();
  }, []);

  const resetForm = () => {
    setMinJam("");
    setKeterangan("");
    setEditingId(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");

    const endpoint = editingId
      ? `/api/admin/sanksi/update/${editingId}`
      : "/api/admin/sanksi/create";
    const method = editingId ? "PUT" : "POST";

    try {
      const token = getToken();
      const response = await fetch(endpoint, {
        method: method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ minJam: parseInt(minJam), keterangan }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan sanksi");

      alert(data.message);
      resetForm();
      fetchSanksi();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (sanksi: SanksiAturan) => {
    setEditingId(sanksi.ID_Sanksi);
    setMinJam(String(sanksi.Min_Keterlambatan_Jam));
    setKeterangan(sanksi.Keterangan_Sanksi);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = async (id: number) => {
    if (!window.confirm("Anda yakin ingin menghapus aturan sanksi ini?")) return;
    try {
      const token = getToken();
      const response = await fetch(`/api/admin/sanksi/delete/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Gagal menghapus sanksi");
      fetchSanksi();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <>
      <PageHeader title="Atur Sanksi" subtitle="Kelola aturan sanksi keterlambatan santri" />

      {/* FORM SANKSI (Clean Card Style) */}
      <div className="form-card-clean">
        <h3 className="form-section-title">{editingId ? "Edit Aturan Sanksi" : "Buat Aturan Baru"}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="min_jam">Minimal Terlambat (Jam)</label>
              <input
                type="number"
                id="min_jam"
                value={minJam}
                onChange={(e) => setMinJam(escapeInput(e.target.value))}
                placeholder="Contoh: 6"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="keterangan_sanksi">Bentuk Sanksi</label>
              <input
                type="text"
                id="keterangan_sanksi"
                value={keterangan}
                onChange={(e) => setKeterangan(escapeInput(e.target.value))}
                placeholder="Contoh: Bersih lingkungan..."
                required
              />
            </div>
          </div>
          
          <div className="form-actions">
            {editingId && (
              <button type="button" className="reject-button" onClick={resetForm}>Batal</button>
            )}
            <button type="submit" className="login-button" disabled={isSaving}>
              {isSaving ? "Menyimpan..." : editingId ? "Update Aturan" : "Simpan Aturan"}
            </button>
          </div>
        </form>
      </div>

      {/* DAFTAR SANKSI (Table Card Style) */}
      <div className="table-card">
        <table className="results-table">
          <thead>
            <tr>
              <th>Min. Keterlambatan</th>
              <th>Bentuk Sanksi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={3} style={{textAlign:'center', padding:'2rem'}}>Memuat...</td></tr>}
            {!isLoading && sanksiList.length === 0 && (
              <tr><td colSpan={3} style={{textAlign:'center', padding:'2rem'}}>Belum ada aturan.</td></tr>
            )}
            {sanksiList.map((s) => (
              <tr key={s.ID_Sanksi}>
                <td data-label="Min Jam">{s.Min_Keterlambatan_Jam} Jam</td>
                <td data-label="Sanksi" style={{ whiteSpace: "normal" }}>{s.Keterangan_Sanksi}</td>
                <td data-label="Aksi">
                  <div className="action-buttons">
                    <button className="detail-button" onClick={() => handleEditClick(s)}>Edit</button>
                    <button className="reject-button" onClick={() => handleDeleteClick(s.ID_Sanksi)}>Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

// =======================================================
// Main Component
// =======================================================
const DashboardNdalem: React.FC<DashboardNdalemProps> = ({ loggedInUser, handleLogout }) => {
  const [view, setView] = useState<NdalemView>("persetujuan");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 

  const navLinks = [
    { key: "persetujuan", label: "Persetujuan Izin" },
    { key: "atur_sanksi", label: "Atur Sanksi" },
  ];

  return (
    <div className="sidebar-layout">
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
      <Header loggedInUser={loggedInUser} handleLogout={handleLogout} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <Sidebar
        isOpen={isSidebarOpen}
        activeView={view}
        onNavigate={(v) => { setView(v as NdalemView); setIsSidebarOpen(false); }}
        navLinks={navLinks}
        handleLogout={handleLogout}
      />
      <div className="dashboard-content-main">
        <main className="dashboard-content">
          {view === "persetujuan" && <PersetujuanView />}
          {view === "atur_sanksi" && <AturSanksiView />}
        </main>
      </div>
    </div>
  );
};

export default DashboardNdalem;