// src/react-app/DashboardAdminPerizinan.tsx

import React, { useState, useEffect, FormEvent, useMemo, useRef } from "react";
import { useReactToPrint } from "react-to-print"; // <-- IMPOR BARU
import "./App.css";
import "./DashboardAdminPerizinan.css";
import { SuratIzinA5, SuratIzinData } from "./SuratIzinA5"; // <-- IMPOR BARU

// --- Tipe Data ---
type UserData = {
  id: number;
  username: string;
  peran: string;
};
type PerizinanView = "dashboard" | "pengajuan" | "status" | "surat" | "buat_pengajuan_form";
type SantriStatus = 'santri' | 'alumni' | 'pengurus' | 'pengabdi';
type KeputusanStatus = 'menunggu' | 'disetujui' | 'ditolak';

type SantriPerizinanSearchResult = {
  id: number;
  nama_santri: string;
  status_santri: SantriStatus;
  jenis_kelamin: "L" | "P";
};
type SantriDataLengkap = {
  id: number;
  nama_santri: string;
  foto: string | null;
  jenis_kelamin: "L" | "P";
  status_santri: SantriStatus;
  alamat: string | null;
  // ... (info ortu)
};

// Tipe BARU untuk data di halaman Status & Surat
type SemuaPengajuanData = {
  ID_Pengajuan: number;
  nama_pengajuan: string;
  keterangan: string | null;
  pengaju: string;
  keputusan: KeputusanStatus;
  disetujui_oleh: string | null; // <-- FIELD BARU
  nama_santri: string;
  foto: string | null; // <-- FIELD BARU
  alamat: string | null; // <-- FIELD BARU
  Tanggal_Kembali: string | null;
};


// Helper
const getToken = (): string | null => localStorage.getItem("token");

// Props dari App.tsx
interface DashboardAdminPerizinanProps {
  loggedInUser: UserData;
  handleLogout: () => void;
}

// =======================================================
// Komponen Navbar (Tidak Berubah)
// =======================================================
interface NavbarProps {
  loggedInUser: UserData;
  handleLogout: () => void;
  activeView: PerizinanView;
  onNavigate: (view: PerizinanView) => void;
}
const PerizinanNavbar: React.FC<NavbarProps> = ({ loggedInUser, handleLogout, activeView, onNavigate }) => {
  // ... (Tidak ada perubahan)
  const getActiveViewForNav = () => {
    if (activeView === 'buat_pengajuan_form') return 'pengajuan';
    return activeView;
  }
  const navActiveView = getActiveViewForNav();
  return (
    <nav className="dashboard-navbar">
      <div className="navbar-brand">E-Najah (Perizinan)</div>
      <div className="navbar-links">
        <button className={navActiveView === "dashboard" ? "active" : ""} onClick={() => onNavigate("dashboard")}> Dashboard </button>
        <button className={navActiveView === "pengajuan" ? "active" : ""} onClick={() => onNavigate("pengajuan")}> Pengajuan </button>
        <button className={navActiveView === "status" ? "active" : ""} onClick={() => onNavigate("status")}> Status </button>
        <button className={navActiveView === "surat" ? "active" : ""} onClick={() => onNavigate("surat")}> Surat </button>
      </div>
      <div className="navbar-user">
        <span>Halo, {loggedInUser.username}</span>
        <button onClick={handleLogout} className="logout-button"> Logout </button>
      </div>
    </nav>
  );
};

// =======================================================
// Komponen Modal Detail Santri (Tidak Berubah)
// =======================================================
interface SantriDetailModalProps {
  santri: SantriDataLengkap;
  onClose: () => void;
  onBuatPengajuan: () => void;
}
const SantriDetailModal: React.FC<SantriDetailModalProps> = ({ santri, onClose, onBuatPengajuan }) => {
  // ... (Tidak ada perubahan)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>&times;</button>
        <h2>Detail Data Santri</h2>
        <div className="detail-view-container">
          <div className="detail-photo">
            {santri.foto ? ( <img src={`/api/images/${santri.foto}`} alt={santri.nama_santri} /> ) : ( <div className="photo-placeholder"><span>Foto Tidak Tersedia</span></div> )}
          </div>
          <div className="detail-info-grid">
            <div className="detail-item detail-span-2"> <label>Nama Lengkap</label> <p>{santri.nama_santri}</p> </div>
            <div className="detail-item"> <label>Jenis Kelamin</label> <p>{santri.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</p> </div>
            <div className="detail-item"> <label>Status Santri</label> <p className={`status-badge ${santri.status_santri}`}> {santri.status_santri} </p> </div>
            <div className="detail-item detail-span-2"> <label>Alamat</label> <p>{santri.alamat || "-"}</p> </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="login-button" onClick={onBuatPengajuan}>
            Buat Pengajuan Izin
          </button>
        </div>
      </div>
    </div>
  );
};

// =======================================================
// Halaman Pengajuan (Pencarian) (Tidak Berubah)
// =======================================================
interface PengajuanViewProps {
  onSantriSelected: (santri: SantriDataLengkap) => void;
}
const PengajuanView: React.FC<PengajuanViewProps> = ({ onSantriSelected }) => {
  // ... (Tidak ada perubahan)
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState<SantriPerizinanSearchResult[]>([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSantri, setSelectedSantri] = useState<SantriDataLengkap | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const handleSearchSubmit = async (e: FormEvent) => { e.preventDefault(); if (!searchQuery.trim()) { setSearchResults([]); return; } setIsSearching(true); setSearchError(""); setSuccessMessage(""); try { const token = getToken(); const response = await fetch(`/api/admin/perizinan/search-santri?q=${encodeURIComponent(searchQuery)}`, { headers: { Authorization: `Bearer ${token}` }, }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Gagal mencari data"); setSearchResults(data.results); } catch (err: any) { setSearchError(err.message); } finally { setIsSearching(false); } };
  const handleDetailClick = async (id: number) => { setIsLoadingDetail(true); setDetailError(""); setIsModalOpen(true); try { const token = getToken(); const response = await fetch(`/api/admin/santri/${id}`, { headers: { Authorization: `Bearer ${token}` }, }); if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Gagal mengambil detail"); } const data: SantriDataLengkap = await response.json(); setSelectedSantri(data); } catch (err: any) { setDetailError(err.message); } finally { setIsLoadingDetail(false); } };
  const closeModal = () => { setIsModalOpen(false); setSelectedSantri(null); }
  const handleBuatPengajuanClick = () => { if (!selectedSantri) return; onSantriSelected(selectedSantri); closeModal(); }
  return (
    <>
      <div className="placeholder-page">
        <h2>Pengajuan Izin</h2>
        <p>Cari santri (aktif, pengurus, atau pengabdi) untuk membuat pengajuan izin baru.</p>
        {successMessage && <p className="success-message">{successMessage}</p>}
        <form onSubmit={handleSearchSubmit}>
          <div className="search-bar">
            <input type="text" placeholder="Ketik nama santri..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} disabled={isSearching} />
            <button type="submit" className="login-button" disabled={isSearching}> {isSearching ? "..." : "Cari"} </button>
          </div>
        </form>
        {isSearching && <p>Mencari...</p>}
        {searchError && <p className="error-message">{searchError}</p>}
        {searchResults.length > 0 && (
          <div className="search-results-container">
            <table className="results-table">
              <thead> <tr> <th>Nama Santri</th> <th>Status</th> <th>Aksi</th> </tr> </thead>
              <tbody>
                {searchResults.map((santri) => (
                  <tr key={santri.id}>
                    <td>{santri.nama_santri}</td>
                    <td> <span className={`status-badge-small ${santri.status_santri}`}> {santri.status_santri} </span> </td>
                    <td> <button className="detail-button" onClick={() => handleDetailClick(santri.id)}> Pilih & Detail </button> </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {isModalOpen && (
        <>
          {isLoadingDetail && <div className="modal-overlay"><p style={{color: "white", fontSize: "2rem"}}>Memuat...</p></div>}
          {detailError && <div className="modal-overlay"><p className="error-message">{detailError}</p></div>}
          {selectedSantri && ( <SantriDetailModal santri={selectedSantri} onClose={closeModal} onBuatPengajuan={handleBuatPengajuanClick} /> )}
        </>
      )}
    </>
  );
};

// =======================================================
// "Halaman" Form Pengajuan (Tidak Berubah)
// =======================================================
interface BuatPengajuanFormViewProps {
  santri: SantriDataLengkap;
  onBack: () => void;
  onSubmitSuccess: () => void;
}
const BuatPengajuanFormView: React.FC<BuatPengajuanFormViewProps> = ({ santri, onBack, onSubmitSuccess }) => {
  // ... (Tidak ada perubahan)
  const [namaPengajuan, setNamaPengajuan] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const handleSubmit = async (e: FormEvent) => { e.preventDefault(); setIsLoading(true); setError(""); try { const token = getToken(); const response = await fetch("/api/admin/perizinan/create", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ santriId: santri.id, namaPengajuan, keterangan, }), }); const data = await response.json(); if (!response.ok) { throw new Error(data.error || "Gagal membuat pengajuan"); } alert("Pengajuan izin baru berhasil dibuat!"); onSubmitSuccess(); } catch (err: any) { setError(err.message); } finally { setIsLoading(false); } };
  return (
    <div className="placeholder-page">
      <button onClick={onBack} className="back-button"> &larr; Kembali ke Pencarian </button>
      <h2>Buat Pengajuan Izin</h2>
      <div className="detail-view-container simple">
        <div className="detail-photo">
          {santri.foto ? ( <img src={`/api/images/${santri.foto}`} alt={santri.nama_santri} /> ) : ( <div className="photo-placeholder"><span>Foto Tidak Tersedia</span></div> )}
        </div>
        <div className="detail-info-grid">
          <div className="detail-item detail-span-2"> <label>Nama Santri</label> <p>{santri.nama_santri}</p> </div>
          <div className="detail-item"> <label>Jenis Kelamin</label> <p>{santri.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</p> </div>
          <div className="detail-item"> <label>Status Santri</label> <p className={`status-badge ${santri.status_santri}`}> {santri.status_santri} </p> </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="modal-actions">
        {error && <p className="error-message">{error}</p>}
        <div className="form-grid">
          <div className="form-group form-span-2"> <label htmlFor="nama_pengajuan">Nama Pengajuan / Alasan *</label> <input type="text" id="nama_pengajuan" required value={namaPengajuan} onChange={(e) => setNamaPengajuan(e.target.value)} /> </div>
          <div className="form-group form-span-2"> <label htmlFor="keterangan">Keterangan (Opsional)</label> <textarea id="keterangan" value={keterangan} onChange={(e) => setKeterangan(e.target.value)} /> </div>
        </div>
        <button type="submit" className="login-button" disabled={isLoading}>
          {isLoading ? "Menyimpan..." : "Simpan Pengajuan (Status: Menunggu)"}
        </button>
      </form>
    </div>
  );
};

// =======================================================
// Halaman Placeholder Lainnya
// =======================================================
const DashboardView: React.FC = () => {
  return (
    <div className="placeholder-page">
      <h2>Dashboard Perizinan</h2>
      <p>Selamat datang. Area ini akan menampilkan statistik dan ringkasan perizinan.</p>
    </div>
  );
};

// =======================================================
// "Halaman" Status Izin (DIPERBARUI)
// =======================================================
const StatusView: React.FC = () => {
  const [allPengajuan, setAllPengajuan] = useState<SemuaPengajuanData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<KeputusanStatus>("menunggu");

  useEffect(() => {
    fetchAllPengajuan();
  }, []);

  const fetchAllPengajuan = async () => {
    setIsLoading(true);
    setError("");
    try {
      const token = getToken();
      const response = await fetch("/api/admin/perizinan/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal mengambil data");
      }
      setAllPengajuan(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredList = useMemo(() => {
    return allPengajuan.filter(p => p.keputusan === activeTab);
  }, [allPengajuan, activeTab]);

  return (
    <div className="placeholder-page">
      <h2>Status Semua Pengajuan Izin</h2>
      <p>Lihat semua pengajuan izin berdasarkan status persetujuan.</p>
      <div className="status-tabs">
        <button className={activeTab === 'menunggu' ? 'active' : ''} onClick={() => setActiveTab('menunggu')}> Menunggu </button>
        <button className={activeTab === 'disetujui' ? 'active' : ''} onClick={() => setActiveTab('disetujui')}> Disetujui </button>
        <button className={activeTab === 'ditolak' ? 'active' : ''} onClick={() => setActiveTab('ditolak')}> Ditolak </button>
      </div>
      {isLoading && <p>Memuat data...</p>}
      {error && <p className="error-message">{error}</p>}
      {!isLoading && (
        <StatusTable list={filteredList} />
      )}
    </div>
  );
};

const StatusTable: React.FC<{ list: SemuaPengajuanData[] }> = ({ list }) => {
  if (list.length === 0) {
    return <p style={{ textAlign: 'center', color: '#888', marginTop: '2rem' }}>Tidak ada data.</p>;
  }
  return (
    <div className="search-results-container">
      <table className="results-table">
        <thead>
          <tr>
            <th>Nama Santri</th>
            <th>Pengajuan</th>
            <th>Status</th>
            <th>Tgl. Kembali</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.ID_Pengajuan}>
              <td>{p.nama_santri}</td>
              <td>{p.nama_pengajuan}</td>
              <td> <span className={`status-badge-small ${p.keputusan}`}> {p.keputusan} </span> </td>
              <td>{p.Tanggal_Kembali ? new Date(p.Tanggal_Kembali).toLocaleDateString('id-ID') : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// =======================================================
// "Halaman" Surat (DIPERBARUI)
// =======================================================
const SuratView: React.FC = () => {
  const [approvedList, setApprovedList] = useState<SemuaPengajuanData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // State untuk pencetakan
  const [dataToPrint, setDataToPrint] = useState<SuratIzinData | null>(null);
  const componentToPrintRef = useRef<HTMLDivElement>(null);

  // Fungsi print
  const handlePrint = useReactToPrint({
    contentRef: componentToPrintRef,
    onAfterPrint: () => setDataToPrint(null), // Kosongkan data setelah print
  });

  // Ambil semua data dan filter di client
  useEffect(() => {
    const fetchApproved = async () => {
      setIsLoading(true);
      setError("");
      try {
        const token = getToken();
        const response = await fetch("/api/admin/perizinan/all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Gagal mengambil data");
        }
        // Filter HANYA yang disetujui
        setApprovedList(data.results.filter((p: SemuaPengajuanData) => p.keputusan === 'disetujui'));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchApproved();
  }, []);

  // Fungsi yang dipanggil saat tombol "Cetak" diklik
  const triggerPrint = (data: SemuaPengajuanData) => {
    const suratData: SuratIzinData = {
      ID_Pengajuan: data.ID_Pengajuan,
      nama_santri: data.nama_santri,
      alamat: data.alamat,
      foto: data.foto,
      Tanggal_Kembali: data.Tanggal_Kembali,
      disetujui_oleh: data.disetujui_oleh,
    };
    setDataToPrint(suratData);
  };
  
  // Memicu print secara otomatis setelah dataToPrint di-set
  useEffect(() => {
    if (dataToPrint) {
      handlePrint();
    }
  }, [dataToPrint, handlePrint]);

  return (
    <div className="placeholder-page">
      <h2>Cetak Surat Izin</h2>
      <p>Cetak surat izin resmi untuk santri yang telah disetujui.</p>

      {isLoading && <p>Memuat data...</p>}
      {error && <p className="error-message">{error}</p>}

      {!isLoading && (
        <div className="search-results-container">
          <table className="results-table">
            <thead>
              <tr>
                <th>Nama Santri</th>
                <th>Pengajuan</th>
                <th>Disetujui Oleh</th>
                <th>Tgl. Kembali</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {approvedList.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: '#888' }}>
                    Belum ada pengajuan yang disetujui.
                  </td>
                </tr>
              )}
              {approvedList.map((p) => (
                <tr key={p.ID_Pengajuan}>
                  <td>{p.nama_santri}</td>
                  <td>{p.nama_pengajuan}</td>
                  <td>{p.disetujui_oleh || "-"}</td>
                  <td>{p.Tanggal_Kembali ? new Date(p.Tanggal_Kembali).toLocaleDateString('id-ID') : '-'}</td>
                  <td>
                    <button 
                      className="print-button"
                      onClick={() => triggerPrint(p)}
                    >
                      Cetak
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Komponen surat yang disembunyikan */}
      {dataToPrint && (
        <SuratIzinA5 ref={componentToPrintRef} data={dataToPrint} />
      )}
    </div>
  );
};

// =======================================================
// Komponen Utama Dashboard (Router Internal) (Tidak Berubah)
// =======================================================
const DashboardAdminPerizinan: React.FC<DashboardAdminPerizinanProps> = ({
  loggedInUser,
  handleLogout,
}) => {
  // ... (Tidak ada perubahan)
  const [view, setView] = useState<PerizinanView>("dashboard");
  const [selectedSantri, setSelectedSantri] = useState<SantriDataLengkap | null>(null);
  const handleGoToPengajuanForm = (santri: SantriDataLengkap) => { setSelectedSantri(santri); setView("buat_pengajuan_form"); };
  const handleReturnToDashboard = () => { setSelectedSantri(null); setView("dashboard"); };
  const renderView = () => {
    switch (view) {
      case "dashboard": return <DashboardView />;
      case "pengajuan": return <PengajuanView onSantriSelected={handleGoToPengajuanForm} />;
      case "status": return <StatusView />;
      case "surat": return <SuratView />;
      case "buat_pengajuan_form":
        return <BuatPengajuanFormView santri={selectedSantri!} onBack={() => setView('pengajuan')} onSubmitSuccess={handleReturnToDashboard} />;
      default: return <DashboardView />;
    }
  };
  return (
    <div className="dashboard-layout">
      <PerizinanNavbar loggedInUser={loggedInUser} handleLogout={handleLogout} activeView={view} onNavigate={(v) => { setView(v); setSelectedSantri(null); }} />
      <main className="dashboard-content">
        {view === 'buat_pengajuan_form' && !selectedSantri ? <PengajuanView onSantriSelected={handleGoToPengajuanForm} /> : renderView()}
      </main>
    </div>
  );
};

export default DashboardAdminPerizinan;