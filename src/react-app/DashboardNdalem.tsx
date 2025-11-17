// src/react-app/DashboardNdalem.tsx

import React, { useState, useEffect, FormEvent } from "react";
import "./App.css";
import "./DashboardNdalem.css";
import "./DashboardLayout.css"; // <-- CSS BARU
import { Sidebar } from "./Sidebar"; // <-- KOMPONEN BARU
import { Header } from "./Header"; // <-- KOMPONEN BARU

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
        <button className="modal-close-button" onClick={onClose}>
          &times;
        </button>
        <h2>Setujui Pengajuan Izin</h2>
        <div className="detail-info-grid simple-grid">
          <div className="detail-item">
            <label>Nama Santri</label> <p>{pengajuan.nama_santri}</p>
          </div>
          <div className="detail-item">
            <label>Status Santri</label> <p>{pengajuan.status_santri}</p>
          </div>
          <div className="detail-item detail-span-2">
            <label>Nama Pengajuan</label> <p>{pengajuan.nama_pengajuan}</p>
          </div>
          <div className="detail-item detail-span-2">
            <label>Keterangan</label> <p>{pengajuan.keterangan || "-"}</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
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
          >
            {isLoading ? "Menyimpan..." : "Setujui & Simpan"}
          </button>
        </form>
      </div>
    </div>
  );
};

// =======================================================
// "Halaman" Persetujuan
// =======================================================
interface PersetujuanViewProps {
  // Props tidak diperlukan karena data diambil di dalam
}
const PersetujuanView: React.FC<PersetujuanViewProps> = () => {
  const [pengajuanList, setPengajuanList] = useState<PengajuanData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPengajuan, setSelectedPengajuan] =
    useState<PengajuanData | null>(null);

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

  useEffect(() => {
    fetchPendingPengajuan();
  }, []);

  const handleSetujuiClick = (pengajuan: PengajuanData) => {
    setSelectedPengajuan(pengajuan);
    setIsModalOpen(true);
  };

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
        body: JSON.stringify({ pengajuanId: id, newStatus: "ditolak" }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal menolak pengajuan");
      }
      alert("Pengajuan berhasil ditolak.");
      fetchPendingPengajuan();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <>
      <div className="content-page">
        <h2>Daftar Pengajuan Izin (Menunggu)</h2>
        <p>Tinjau dan setujui atau tolak pengajuan izin yang masuk.</p>
        {error && <p className="error-message">{error}</p>}
        {isLoading && <p>Memuat data pengajuan...</p>}
        {!isLoading && pengajuanList.length === 0 && (
          <p
            style={{
              textAlign: "center",
              color: "var(--color-text-secondary)",
              marginTop: "2rem",
            }}
          >
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
                    <td>
                      {p.nama_santri} ({p.status_santri})
                    </td>
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
// "Halaman" Atur Sanksi
// =======================================================
const AturSanksiView: React.FC = () => {
  const [sanksiList, setSanksiList] = useState<SanksiAturan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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
      if (!response.ok) throw new Error(data.error || "Gagal mengambil data");
      setSanksiList(data.results);
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
      fetchSanksi(); // Muat ulang daftar
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
  };

  const handleDeleteClick = async (id: number) => {
    if (
      !window.confirm(
        "Anda yakin ingin menghapus aturan sanksi ini? (Arsip tidak akan terpengaruh)"
      )
    ) {
      return;
    }
    setError("");
    try {
      const token = getToken();
      const response = await fetch(`/api/admin/sanksi/delete/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Gagal menghapus sanksi");

      alert(data.message);
      fetchSanksi(); // Muat ulang daftar
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="content-page">
      <h2>Atur Aturan Sanksi Keterlambatan</h2>
      <p>Buat aturan sanksi berdasarkan jumlah jam keterlambatan santri.</p>

      {/* Form Sanksi */}
      <form onSubmit={handleSubmit} className="sanksi-form">
        <h3>{editingId ? "Edit Aturan Sanksi" : "Buat Aturan Baru"}</h3>
        {error && <p className="error-message">{error}</p>}
        <div className="form-grid">
          <div className="form-group">
            <label htmlFor="min_jam">Minimal Keterlambatan (Jam)</label>
            <input
              type="number"
              id="min_jam"
              value={minJam}
              onChange={(e) => setMinJam(escapeInput(e.target.value))}
              placeholder="Contoh: 6"
              required
            />
          </div>
          <div className="form-group form-span-2">
            <label htmlFor="keterangan_sanksi">Keterangan Sanksi</label>
            <input
              type="text"
              id="keterangan_sanksi"
              value={keterangan}
              onChange={(e) => setKeterangan(escapeInput(e.target.value))}
              placeholder="Contoh: Membersihkan area kamar mandi"
              required
            />
          </div>
        </div>
        <div className="sanksi-form-actions">
          {editingId && (
            <button
              type="button"
              className="reject-button"
              onClick={resetForm}
            >
              Batal
            </button>
          )}
          <button
            type="submit"
            className="login-button"
            disabled={isSaving}
          >
            {isSaving
              ? "Menyimpan..."
              : editingId
              ? "Update Sanksi"
              : "Simpan Sanksi"}
          </button>
        </div>
      </form>

      {/* Daftar Sanksi */}
      <h3 style={{ marginTop: "2.5rem" }}>Daftar Sanksi Aktif</h3>
      {isLoading && <p>Memuat daftar sanksi...</p>}
      <div className="approval-table">
        <table className="results-table">
          <thead>
            <tr>
              <th>Min. Keterlambatan</th>
              <th>Keterangan Sanksi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && sanksiList.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  style={{ textAlign: "center", color: "#888" }}
                >
                  Belum ada aturan sanksi.
                </td>
              </tr>
            )}
            {sanksiList.map((s) => (
              <tr key={s.ID_Sanksi}>
                <td>{s.Min_Keterlambatan_Jam} jam</td>
                <td style={{ whiteSpace: "normal" }}>
                  {s.Keterangan_Sanksi}
                </td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="detail-button"
                      onClick={() => handleEditClick(s)}
                    >
                      Edit
                    </button>
                    <button
                      className="reject-button"
                      onClick={() => handleDeleteClick(s.ID_Sanksi)}
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =======================================================
// Komponen Utama Dashboard (Router Internal) (DIPERBARUI)
// =======================================================
const DashboardNdalem: React.FC<DashboardNdalemProps> = ({
  loggedInUser,
  handleLogout,
}) => {
  const [view, setView] = useState<NdalemView>("persetujuan");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 

  const renderView = () => {
    switch (view) {
      case "persetujuan":
        return <PersetujuanView />;
      case "atur_sanksi":
        return <AturSanksiView />;
      default:
        return <PersetujuanView />;
    }
  };

  // --- Definisikan Navigasi untuk Sidebar ---
  const navLinks = [
    { key: "persetujuan", label: "Persetujuan Izin" },
    { key: "atur_sanksi", label: "Atur Sanksi" },
  ];

  return (
    // Gunakan layout baru
    <div className="sidebar-layout">
      {/* Overlay untuk mobile */}
      {isSidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      <Header
        loggedInUser={loggedInUser}
        handleLogout={handleLogout}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        activeView={view}
        onNavigate={(v) => {
          setView(v as NdalemView);
          setIsSidebarOpen(false);
        }}
        navLinks={navLinks}
        handleLogout={handleLogout}
      />
      
      <div className="dashboard-content-main">
        <main className="dashboard-content">{renderView()}</main>
      </div>
    </div>
  );
};

export default DashboardNdalem;
