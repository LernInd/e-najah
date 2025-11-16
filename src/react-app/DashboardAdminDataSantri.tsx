// src/react-app/DashboardAdminDataSantri.tsx

import React, { useState, useEffect, FormEvent } from "react";
import "./App.css";
import "./DashboardAdminDataSantri.css";

// --- Tipe Data ---
type UserData = {
  id: number;
  username: string;
  peran: string;
};
type SantriStats = {
  putra: number;
  putri: number;
  totalSantri: number;
  totalAlumni: number;
  totalPengurus: number;
  totalPengabdi: number;
};
type SantriStatus = 'santri' | 'alumni' | 'pengurus' | 'pengabdi';
type SantriSearchResult = {
  id: number;
  nama_santri: string;
  jenis_kelamin: "L" | "P";
};
type SantriDataLengkap = {
  id: number;
  nama_santri: string;
  foto: string | null; // Foto bisa null
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

// Props dari App.tsx
interface DashboardAdminDataSantriProps {
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
  activeView: View;
  onNavigate: (view: View) => void;
}
const Navbar: React.FC<NavbarProps> = ({ loggedInUser, handleLogout, activeView, onNavigate }) => {
  return (
    <nav className="dashboard-navbar">
      <div className="navbar-brand">E-Najah</div>
      <div className="navbar-links">
        <button className={activeView === 'dashboard' ? 'active' : ''} onClick={() => onNavigate('dashboard')}>
          Dashboard
        </button>
        <button className={activeView === 'tambah' ? 'active' : ''} onClick={() => onNavigate('tambah')}>
          Tambah Santri
        </button>
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
// "Halaman" Dashboard (Statistik + Pencarian) (Tidak Berubah)
// =======================================================
interface DashboardViewProps {
  onShowDetail: (id: number) => void;
}
const DashboardView: React.FC<DashboardViewProps> = ({ onShowDetail }) => {
  // ... (Semua state dan fungsi di sini tidak berubah)
  const [stats, setStats] = useState<SantriStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState<SantriSearchResult[] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoadingStats(true);
    setStatsError("");
    try {
      const token = getToken();
      const response = await fetch("/api/admin/santri/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Gagal memuat statistik");
      const data: SantriStats = await response.json();
      setStats(data);
    } catch (err: any) {
      setStatsError(err.message);
    } finally {
      setIsLoadingStats(false);
    }
  };
  
  const fetchSearchResults = async (query: string, page: number) => {
    setIsSearching(true);
    setSearchError("");
    try {
      const token = getToken();
      const response = await fetch(`/api/admin/santri/search?q=${encodeURIComponent(query)}&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mencari data");
      setSearchResults(data.results);
      setTotalPages(data.totalPages);
      setCurrentPage(data.currentPage);
    } catch (err: any) {
      setSearchError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setTotalPages(0);
      return;
    }
    fetchSearchResults(searchQuery, 1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === currentPage) {
      return;
    }
    fetchSearchResults(searchQuery, newPage);
  };

  return (
    <div className="login-form">
      <h2>Ringkasan Data Santri</h2>
      {statsError && <p className="error-message">{statsError}</p>}
      <div className="stats-container">
        <div className="stat-card"> <h3>{isLoadingStats ? "..." : stats?.totalSantri}</h3> <p>Santri Aktif</p> </div>
        <div className="stat-card"> <h3>{isLoadingStats ? "..." : stats?.putra}</h3> <p>Putra Aktif</p> </div>
        <div className="stat-card"> <h3>{isLoadingStats ? "..." : stats?.putri}</h3> <p>Putri Aktif</p> </div>
        <div className="stat-card"> <h3>{isLoadingStats ? "..." : stats?.totalPengurus}</h3> <p>Pengurus</p> </div>
        <div className="stat-card"> <h3>{isLoadingStats ? "..." : stats?.totalPengabdi}</h3> <p>Pengabdi</p> </div>
        <div className="stat-card"> <h3>{isLoadingStats ? "..." : stats?.totalAlumni}</h3> <p>Alumni</p> </div>
      </div>
      <div className="search-section">
        <h2 style={{ marginTop: '3rem' }}>Cari Data Santri</h2>
        <form onSubmit={handleSearchSubmit}>
          <div className="search-bar">
            <input type="text" placeholder="Cari berdasarkan nama santri..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} disabled={isSearching} />
            <button type="submit" className="login-button" disabled={isSearching}>
              {isSearching ? "..." : "Cari"}
            </button>
          </div>
        </form>
        {isSearching && <p style={{ textAlign: 'center', marginTop: '2rem' }}>Mencari...</p>}
        {searchError && <p className="error-message">{searchError}</p>}
        {searchResults && <SearchResultsList results={searchResults} onDetailClick={onShowDetail} />}
        {searchResults && totalPages > 1 && <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />}
      </div>
    </div>
  );
};

// =======================================================
// Komponen Tabel Hasil Pencarian (Tidak Berubah)
// =======================================================
interface SearchResultsListProps {
  results: SantriSearchResult[];
  onDetailClick: (id: number) => void;
}
const SearchResultsList: React.FC<SearchResultsListProps> = ({ results, onDetailClick }) => {
  // ... (Tidak ada perubahan)
  if (results.length === 0) {
    return <p style={{ textAlign: 'center', color: '#888', marginTop: '2rem' }}>Tidak ada data santri yang ditemukan.</p>;
  }
  return (
    <div className="search-results-container">
      <table className="results-table">
        <thead> <tr> <th>Nama Santri</th> <th>L/P</th> <th>Aksi</th> </tr> </thead>
        <tbody>
          {results.map((santri) => (
            <tr key={santri.id}>
              <td>{santri.nama_santri}</td>
              <td>{santri.jenis_kelamin}</td>
              <td>
                <button className="detail-button" onClick={() => onDetailClick(santri.id)}>
                  Lihat Detail
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// =======================================================
// Komponen Kontrol Pagination (Tidak Berubah)
// =======================================================
interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}
const PaginationControls: React.FC<PaginationControlsProps> = ({ currentPage, totalPages, onPageChange }) => {
  // ... (Tidak ada perubahan)
  return (
    <div className="pagination-controls">
      <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage <= 1}>
        &larr; Sebelumnya
      </button>
      <span> Halaman {currentPage} dari {totalPages} </span>
      <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= totalPages}>
        Selanjutnya &rarr;
      </button>
    </div>
  );
};

// =======================================================
// "Halaman" Tambah Santri (Form) (DIPERBARUI)
// =======================================================
const TambahSantriView = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // State Form
  const [namaSantri, setNamaSantri] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [jenisKelamin, setJenisKelamin] = useState<"L" | "P">("L");
  const [statusSantri, setStatusSantri] = useState<SantriStatus>('santri');
  const [alamat, setAlamat] = useState("");
  const [namaIbu, setNamaIbu] = useState("");
  const [kontakIbu, setKontakIbu] = useState("");
  const [namaAyah, setNamaAyah] = useState("");
  const [kontakAyah, setKontakAyah] = useState("");
  const [namaWali, setNamaWali] = useState("");
  const [kontakWali, setKontakWali] = useState("");
  
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // HAPUS validasi foto
    // if (!foto) {
    //   setError("Foto santri wajib diisi.");
    //   return;
    // }
    setIsLoading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("nama_santri", namaSantri);
    
    // HANYA append foto jika ada
    if (foto) {
      formData.append("foto", foto);
    }
    
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
      const token = getToken();
      const response = await fetch("/api/admin/santri/create", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || data.message || "Gagal membuat santri");
      }
      setSuccess("Santri baru berhasil ditambahkan!");
      (e.target as HTMLFormElement).reset();
      // Reset semua state
      setFoto(null);
      setNamaSantri("");
      setJenisKelamin("L");
      setStatusSantri("santri");
      setAlamat("");
      setNamaIbu("");
      setKontakIbu("");
      setNamaAyah("");
      setKontakAyah("");
      setNamaWali("");
      setKontakWali("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-form" style={{ maxWidth: '600px' }}>
      <h2>Tambah Data Santri Baru</h2>
      {error && <p className="error-message">{error}</p>}
      {success && <p className="success-message">{success}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-group form-span-2"> <label htmlFor="nama_santri">Nama Santri *</label> <input type="text" id="nama_santri" required value={namaSantri} onChange={(e) => setNamaSantri(e.target.value)} /> </div>
          <div className="form-group"> <label htmlFor="jenis_kelamin">Jenis Kelamin *</label> <select id="jenis_kelamin" required value={jenisKelamin} onChange={(e) => setJenisKelamin(e.target.value as "L" | "P")}> <option value="L">Laki-laki (L)</option> <option value="P">Perempuan (P)</option> </select> </div>
          <div className="form-group"> <label htmlFor="status_santri">Status Santri *</label> <select id="status_santri" required value={statusSantri} onChange={(e) => setStatusSantri(e.target.value as SantriStatus)}> <option value="santri">Santri Aktif</option> <option value="alumni">Alumni</option> <option value="pengurus">Pengurus</option> <option value="pengabdi">Pengabdi</option> </select> </div>
          
          {/* Input foto HAPUS 'required' */}
          <div className="form-group form-span-2">
            <label htmlFor="foto">Foto Santri (Opsional)</label>
            <input type="file" id="foto" accept="image/png, image/jpeg" onChange={(e) => setFoto(e.target.files ? e.target.files[0] : null)} />
          </div>

          <div className="form-group form-span-2"> <label htmlFor="alamat">Alamat</label> <textarea id="alamat" value={alamat} onChange={(e) => setAlamat(e.target.value)} /> </div>
          <div className="form-group"> <label htmlFor="nama_ayah">Nama Ayah</label> <input type="text" id="nama_ayah" value={namaAyah} onChange={(e) => setNamaAyah(e.target.value)} /> </div>
          <div className="form-group"> <label htmlFor="kontak_ayah">Kontak Ayah</label> <input type="text" id="kontak_ayah" value={kontakAyah} onChange={(e) => setKontakAyah(e.target.value)} /> </div>
          <div className="form-group"> <label htmlFor="nama_ibu">Nama Ibu</label> <input type="text" id="nama_ibu" value={namaIbu} onChange={(e) => setNamaIbu(e.target.value)} /> </div>
          <div className="form-group"> <label htmlFor="kontak_ibu">Kontak Ibu</label> <input type="text" id="kontak_ibu" value={kontakIbu} onChange={(e) => setKontakIbu(e.target.value)} /> </div>
          <div className="form-group"> <label htmlFor="nama_wali">Nama Wali (jika ada)</label> <input type="text" id="nama_wali" value={namaWali} onChange={(e) => setNamaWali(e.target.value)} /> </div>
          <div className="form-group"> <label htmlFor="kontak_wali">Kontak Wali</label> <input type="text" id="kontak_wali" value={kontakWali} onChange={(e) => setKontakWali(e.target.value)} /> </div>
        </div>
        <button type="submit" className="login-button" disabled={isLoading} style={{marginTop: '1rem'}}>
          {isLoading ? "Menyimpan..." : "Simpan Data Santri"}
        </button>
      </form>
    </div>
  );
};

// =======================================================
// "Halaman" Detail Santri (DIPERBARUI)
// =======================================================
interface DetailSantriViewProps {
  santriId: number;
  onBack: () => void;
}
const DetailSantriView: React.FC<DetailSantriViewProps> = ({ santriId, onBack }) => {
  const [santri, setSantri] = useState<SantriDataLengkap | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchDetail = async () => {
      // ... (Fungsi fetchDetail - tidak berubah)
      setIsLoading(true);
      setError("");
      try {
        const token = getToken();
        const response = await fetch(`/api/admin/santri/${santriId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Gagal mengambil detail");
        }
        const data: SantriDataLengkap = await response.json();
        setSantri(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [santriId]);

  return (
    <div className="login-form" style={{ maxWidth: '700px' }}>
      <button onClick={onBack} className="back-button">
        &larr; Kembali ke Hasil Pencarian
      </button>
      <h2>Detail Data Santri</h2>
      
      {isLoading && <p>Memuat data...</p>}
      {error && <p className="error-message">{error}</p>}
      
      {santri && (
        <div className="detail-view-container">
          {/* --- TAMPILAN FOTO (DIPERBARUI) --- */}
          <div className="detail-photo">
            {santri.foto ? (
              <img src={`/api/images/${santri.foto}`} alt={santri.nama_santri} />
            ) : (
              <div className="photo-placeholder">
                <span>Foto Tidak Tersedia</span>
              </div>
            )}
          </div>
          
          <div className="detail-info-grid">
            <div className="detail-item detail-span-2"> <label>Nama Lengkap</label> <p>{santri.nama_santri}</p> </div>
            <div className="detail-item"> <label>Jenis Kelamin</label> <p>{santri.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</p> </div>
            <div className="detail-item"> <label>Status Santri</label> <p className={`status-badge ${santri.status_santri}`}> {santri.status_santri} </p> </div>
            <div className="detail-item detail-span-2"> <label>Alamat</label> <p>{santri.alamat || "-"}</p> </div>
            <div className="detail-item"> <label>Nama Ayah</label> <p>{santri.nama_ayah || "-"}</p> </div>
            <div className="detail-item"> <label>Kontak Ayah</label> <p>{santri.kontak_ayah || "-"}</p> </div>
            <div className="detail-item"> <label>Nama Ibu</label> <p>{santri.nama_ibu || "-"}</p> </div>
            <div className="detail-item"> <label>Kontak Ibu</label> <p>{santri.kontak_ibu || "-"}</p> </div>
            <div className="detail-item"> <label>Nama Wali</label> <p>{santri.nama_wali || "-"}</p> </div>
            <div className="detail-item"> <label>Kontak Wali</label> <p>{santri.kontak_wali || "-"}</p> </div>
          </div>
        </div>
      )}
    </div>
  );
};


// =======================================================
// Komponen Utama Dashboard (Router Internal) (Tidak Berubah)
// =======================================================
const DashboardAdminDataSantri: React.FC<DashboardAdminDataSantriProps> = ({
  loggedInUser,
  handleLogout,
}) => {
  // ... (Tidak ada perubahan)
  const [view, setView] = useState<View>("dashboard");
  const [selectedSantriId, setSelectedSantriId] = useState<number | null>(null);

  const handleShowDetail = (id: number) => {
    setSelectedSantriId(id);
    setView("detail");
  };

  const handleBackToDashboard = () => {
    setSelectedSantriId(null);
    setView("dashboard");
  };

  return (
    <div className="dashboard-layout">
      <Navbar 
        loggedInUser={loggedInUser}
        handleLogout={handleLogout}
        activeView={view}
        onNavigate={(v) => {
          setView(v);
          setSelectedSantriId(null);
        }}
      />
      <main className="dashboard-content">
        {view === 'dashboard' && <DashboardView onShowDetail={handleShowDetail} />}
        {view === 'tambah' && <TambahSantriView />} 
        {view === 'detail' && selectedSantriId && (
          <DetailSantriView 
            santriId={selectedSantriId} 
            onBack={handleBackToDashboard} 
          />
        )}
      </main>
    </div>
  );
};

export default DashboardAdminDataSantri;