// src/react-app/DashboardAdminDataSantri.tsx

import React, { useState, useEffect, FormEvent, useRef } from "react";
import "./App.css";
import "./DashboardAdminDataSantri.css";
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
type SantriStats = {
  putra: number;
  putri: number;
  totalSantri: number;
  totalAlumni: number;
  totalPengurus: number;
  totalPengabdi: number;
};
type SantriStatus = "santri" | "alumni" | "pengurus" | "pengabdi";
type SantriSearchResult = {
  id: number;
  nama_santri: string;
  jenis_kelamin: "L" | "P";
};
type SantriDataLengkap = {
  id: number;
  nama_santri: string;
  foto: string | null;
  jenis_kelamin: "L" | "P";
  status_santri: SantriStatus;
  alamat: string | null;
  nama_ibu: string | null;
  kontak_ibu: string | null;
  nama_ayah: string | null;
  kontak_ayah: string | null;
  nama_wali: string | null;
  kontak_wali: string | null;
};
type View = "dashboard" | "tambah" | "detail";

interface DashboardAdminDataSantriProps {
  loggedInUser: UserData;
  handleLogout: () => void;
}

// Helper
const getToken = (): string | null => localStorage.getItem("token");
function escapeInput(str: string): string { return str.replace(/[<>&'"`]/g, ""); }

// Component Header
const PageHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="page-header-clean">
    <h2>{title}</h2>
    <p>{subtitle}</p>
  </div>
);

// =======================================================
// View: Dashboard (Stats + Search)
// =======================================================
interface DashboardViewProps {
  onShowDetail: (id: number) => void;
}
const DashboardView: React.FC<DashboardViewProps> = ({ onShowDetail }) => {
  const [stats, setStats] = useState<SantriStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SantriSearchResult[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const token = getToken();
      const response = await fetch("/api/admin/santri/stats", { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (err) { console.error(err); } finally { setIsLoadingStats(false); }
  };

  const fetchSearchResults = async (query: string, page: number) => {
    setIsSearching(true);
    try {
      const token = getToken();
      const response = await fetch(`/api/admin/santri/search?q=${encodeURIComponent(query)}&page=${page}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) {
        setSearchResults(data.data.results);
        setTotalPages(data.data.pagination.totalPages);
        setCurrentPage(data.data.pagination.currentPage);
      }
    } catch (err) { console.error(err); } finally { setIsSearching(false); }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) { setSearchResults(null); setTotalPages(0); return; }
    fetchSearchResults(searchQuery, 1);
  };

  return (
    <>
      <PageHeader title="Dashboard Santri" subtitle="Ringkasan statistik dan pencarian data santri" />
      
      <div className="stats-container">
        <div className="stat-card"><h3>{isLoadingStats ? "..." : stats?.totalSantri || 0}</h3><p>Santri Aktif</p></div>
        <div className="stat-card"><h3>{isLoadingStats ? "..." : stats?.putra || 0}</h3><p>Putra</p></div>
        <div className="stat-card"><h3>{isLoadingStats ? "..." : stats?.putri || 0}</h3><p>Putri</p></div>
        <div className="stat-card"><h3>{isLoadingStats ? "..." : stats?.totalPengurus || 0}</h3><p>Pengurus</p></div>
        <div className="stat-card"><h3>{isLoadingStats ? "..." : stats?.totalPengabdi || 0}</h3><p>Pengabdi</p></div>
        <div className="stat-card"><h3>{isLoadingStats ? "..." : stats?.totalAlumni || 0}</h3><p>Alumni</p></div>
      </div>

      <div className="search-wrapper-clean">
        <form onSubmit={handleSearchSubmit} className="search-bar-clean">
          <input
            type="text"
            placeholder="Cari nama santri..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(escapeInput(e.target.value))}
            disabled={isSearching}
          />
          <button type="submit" disabled={isSearching}>
            <svg xmlns="http://www.w3.org/2000/svg" className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            {isSearching ? "..." : "Cari"}
          </button>
        </form>
      </div>

      {searchResults && (
        <>
          <SearchResultsList results={searchResults} onDetailClick={onShowDetail} />
          {totalPages > 1 && (
            <div className="pagination-controls">
              <button onClick={() => fetchSearchResults(searchQuery, currentPage - 1)} disabled={currentPage <= 1}>&larr; Prev</button>
              <span>Hal {currentPage} / {totalPages}</span>
              <button onClick={() => fetchSearchResults(searchQuery, currentPage + 1)} disabled={currentPage >= totalPages}>Next &rarr;</button>
            </div>
          )}
        </>
      )}
    </>
  );
};

const SearchResultsList: React.FC<{ results: SantriSearchResult[]; onDetailClick: (id: number) => void }> = ({ results, onDetailClick }) => {
  if (results.length === 0) return <p style={{textAlign:'center', color:'#888', marginTop:'2rem'}}>Tidak ditemukan data.</p>;
  return (
    <div className="table-card">
      <table className="results-table">
        <thead>
          <tr><th>Nama Santri</th><th>L/P</th><th>Aksi</th></tr>
        </thead>
        <tbody>
          {results.map((santri) => (
            <tr key={santri.id}>
              <td data-label="Nama">{santri.nama_santri}</td>
              <td data-label="L/P">{santri.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</td>
              <td data-label="Aksi">
                <button className="detail-button" onClick={() => onDetailClick(santri.id)}>Detail</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// =======================================================
// View: Tambah Santri (FIXED PREVIEW)
// =======================================================
const TambahSantriView = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // State Form
  const [namaSantri, setNamaSantri] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [jenisKelamin, setJenisKelamin] = useState<"L" | "P">("L");
  const [statusSantri, setStatusSantri] = useState<SantriStatus>("santri");
  const [alamat, setAlamat] = useState("");
  const [namaIbu, setNamaIbu] = useState("");
  const [kontakIbu, setKontakIbu] = useState("");
  const [namaAyah, setNamaAyah] = useState("");
  const [kontakAyah, setKontakAyah] = useState("");
  const [namaWali, setNamaWali] = useState("");
  const [kontakWali, setKontakWali] = useState("");

  // Ref untuk input file agar bisa di-reset
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup memory preview saat komponen unmount atau foto berubah
  useEffect(() => {
    return () => {
      if (fotoPreview) {
        URL.revokeObjectURL(fotoPreview);
      }
    };
  }, [fotoPreview]);

  // Handle Image Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    if (file) {
      // Validasi Tipe File (JPG/JPEG Only)
      // Gunakan regex untuk cek ekstensi juga sebagai cadangan
      const isJpg = file.type === "image/jpeg" || file.type === "image/jpg" || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg');
      
      if (!isJpg) {
        alert("Hanya file JPG/JPEG yang diperbolehkan.");
        // Reset input file
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      
      setFoto(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true); setError(""); setSuccess("");
    
    const formData = new FormData();
    formData.append("nama_santri", namaSantri);
    if (foto) formData.append("foto", foto);
    formData.append("jenis_kelamin", jenisKelamin);
    formData.append("status_santri", statusSantri);
    formData.append("alamat", alamat);
    formData.append("nama_ibu", namaIbu);
    formData.append("kontak_ibu", kontakIbu);
    formData.append("nama_ayah", namaAyah);
    formData.append("kontak_ayah", kontakAyah);
    formData.append("nama_wali", namaWali);
    formData.append("kontak_wali", kontakWali);

    try {
      const res = await fetch("/api/admin/santri/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal");
      setSuccess("Santri berhasil ditambahkan!");
      
      // Reset Form Total
      setNamaSantri(""); setFoto(null); setFotoPreview(null); 
      setAlamat(""); setNamaIbu(""); setKontakIbu(""); 
      setNamaAyah(""); setKontakAyah(""); setNamaWali(""); setKontakWali("");
      
      // Reset Input File Fisik
      if (fileInputRef.current) fileInputRef.current.value = "";

    } catch (err: any) { 
      setError(err.message); 
    } finally { 
      setIsLoading(false); 
    }
  };

  return (
    <>
      <PageHeader title="Tambah Santri" subtitle="Input data santri baru ke sistem" />
      <div className="form-card-clean">
        <div className="form-header-split">
          <div className="form-title"><h3>Formulir Data Diri</h3></div>
        </div>
        
        {success && <div className="success-message">{success}</div>}
        {error && <p className="error-message">{error}</p>}

        <form onSubmit={handleSubmit} className="form-layout-with-photo">
          
          {/* KOLOM KIRI: INPUT DATA */}
          <div className="form-inputs-section">
            <div className="form-grid">
              <div className="form-group form-span-2">
                <label>Nama Santri *</label>
                <input type="text" required value={namaSantri} onChange={(e) => setNamaSantri(escapeInput(e.target.value))} placeholder="Nama Lengkap" />
              </div>
              <div className="form-group">
                <label>Jenis Kelamin *</label>
                <select required value={jenisKelamin} onChange={(e) => setJenisKelamin(e.target.value as "L"|"P")}>
                  <option value="L">Laki-laki (L)</option>
                  <option value="P">Perempuan (P)</option>
                </select>
              </div>
              <div className="form-group">
                <label>Status Santri *</label>
                <select required value={statusSantri} onChange={(e) => setStatusSantri(e.target.value as SantriStatus)}>
                  <option value="santri">Santri Aktif</option>
                  <option value="alumni">Alumni</option>
                  <option value="pengurus">Pengurus</option>
                  <option value="pengabdi">Pengabdi</option>
                </select>
              </div>
              <div className="form-group form-span-2">
                <label>Alamat</label>
                <textarea value={alamat} onChange={(e) => setAlamat(escapeInput(e.target.value))} rows={3} />
              </div>
              {/* Data Ortu */}
              <div className="form-group"><label>Nama Ayah</label><input type="text" value={namaAyah} onChange={e => setNamaAyah(escapeInput(e.target.value))} /></div>
              <div className="form-group"><label>Kontak Ayah</label><input type="text" value={kontakAyah} onChange={e => setKontakAyah(escapeInput(e.target.value))} /></div>
              <div className="form-group"><label>Nama Ibu</label><input type="text" value={namaIbu} onChange={e => setNamaIbu(escapeInput(e.target.value))} /></div>
              <div className="form-group"><label>Kontak Ibu</label><input type="text" value={kontakIbu} onChange={e => setKontakIbu(escapeInput(e.target.value))} /></div>
              <div className="form-group"><label>Nama Wali (Opsional)</label><input type="text" value={namaWali} onChange={e => setNamaWali(escapeInput(e.target.value))} /></div>
              <div className="form-group"><label>Kontak Wali</label><input type="text" value={kontakWali} onChange={e => setKontakWali(escapeInput(e.target.value))} /></div>
            </div>
            
            <button type="submit" className="login-button" disabled={isLoading} style={{marginTop:'2rem', width:'100%'}}>
              {isLoading ? "Menyimpan..." : "Simpan Data Santri"}
            </button>
          </div>

          {/* KOLOM KANAN: FOTO */}
          <div className="form-photo-section">
            <label>Foto Santri</label>
            <label htmlFor="foto-upload" className="photo-uploader">
              {fotoPreview ? (
                <img src={fotoPreview} alt="Preview" className="photo-preview-img" />
              ) : (
                <div className="photo-placeholder-text">
                  <p>Klik untuk upload</p>
                  <small style={{fontSize:'0.7rem', display:'block', marginTop:'0.5rem', color:'#999'}}>(Wajib JPG/JPEG, Rasio 3:4)</small>
                </div>
              )}
            </label>
            <input 
              type="file" 
              id="foto-upload" 
              accept=".jpg, .jpeg, image/jpeg" 
              className="photo-input-hidden" 
              onChange={handleFileChange}
              ref={fileInputRef} 
            />
            <label htmlFor="foto-upload" className="photo-upload-btn">
              {foto ? "Ganti Foto" : "Pilih Foto"}
            </label>
          </div>

        </form>
      </div>
    </>
  );
};

// =======================================================
// View: Detail Santri
// =======================================================
const DetailSantriView: React.FC<{ santriId: number; onBack: () => void }> = ({ santriId, onBack }) => {
  const [santri, setSantri] = useState<SantriDataLengkap | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetch(`/api/admin/santri/${santriId}`, { headers: { Authorization: `Bearer ${getToken()}` } });
        const data = await res.json();
        if (res.ok) setSantri(data.data);
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    fetchDetail();
  }, [santriId]);

  if (isLoading) return <p style={{textAlign:'center'}}>Memuat...</p>;
  if (!santri) return <p style={{textAlign:'center'}}>Data tidak ditemukan.</p>;

  return (
    <>
      <button onClick={onBack} className="back-link">&larr; Kembali</button>
      <div className="form-card-clean">
        <div className="detail-view-container">
          <div className="detail-photo">
            {santri.foto ? (
              <img src={`/api/images/${santri.foto}`} alt={santri.nama_santri} />
            ) : (
              <div className="photo-placeholder">Foto Kosong</div>
            )}
          </div>
          <div className="detail-info-grid">
            <div className="detail-item detail-span-2">
              <label>Nama Lengkap</label><p>{santri.nama_santri}</p>
            </div>
            <div className="detail-item">
              <label>Jenis Kelamin</label><p>{santri.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</p>
            </div>
            <div className="detail-item">
              <label>Status</label><p className={`status-badge ${santri.status_santri}`}>{santri.status_santri}</p>
            </div>
            <div className="detail-item detail-span-2">
              <label>Alamat</label><p>{santri.alamat || "-"}</p>
            </div>
            <div className="detail-item"><label>Ayah</label><p>{santri.nama_ayah || "-"}</p></div>
            <div className="detail-item"><label>Kontak Ayah</label><p>{santri.kontak_ayah || "-"}</p></div>
            <div className="detail-item"><label>Ibu</label><p>{santri.nama_ibu || "-"}</p></div>
            <div className="detail-item"><label>Kontak Ibu</label><p>{santri.kontak_ibu || "-"}</p></div>
          </div>
        </div>
      </div>
    </>
  );
};

// =======================================================
// Main Component
// =======================================================
const DashboardAdminDataSantri: React.FC<DashboardAdminDataSantriProps> = ({ loggedInUser, handleLogout }) => {
  const [view, setView] = useState<View>("dashboard");
  const [selectedSantriId, setSelectedSantriId] = useState<number | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navLinks = [
    { key: "dashboard", label: "Dashboard" },
    { key: "tambah", label: "Tambah Santri" },
  ];

  return (
    <div className="sidebar-layout">
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
      <Header loggedInUser={loggedInUser} handleLogout={handleLogout} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <Sidebar
        isOpen={isSidebarOpen}
        activeView={view === "detail" ? "dashboard" : view}
        onNavigate={(v) => { setView(v as View); setSelectedSantriId(null); setIsSidebarOpen(false); }}
        navLinks={navLinks}
        handleLogout={handleLogout}
      />
      <div className="dashboard-content-main">
        <main className="dashboard-content">
          {view === "dashboard" && <DashboardView onShowDetail={(id) => { setSelectedSantriId(id); setView("detail"); }} />}
          {view === "tambah" && <TambahSantriView />}
          {view === "detail" && selectedSantriId && <DetailSantriView santriId={selectedSantriId} onBack={() => setView("dashboard")} />}
        </main>
      </div>
    </div>
  );
};

export default DashboardAdminDataSantri;