// src/react-app/DashboardAdminPerizinan.tsx

import React, { useState, useEffect, FormEvent, useMemo, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import "./App.css";
import "./DashboardAdminPerizinan.css";
import "./DashboardLayout.css";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { SuratIzinA5, SuratIzinData } from "./SuratIzinA5";

// --- Tipe Data ---
type UserData = {
  id: number;
  username: string;
  peran: string;
  nama_lengkap?: string;
};
type PerizinanView =
  | "dashboard"
  | "pengajuan"
  | "status"
  | "surat"
  | "kembali"
  | "buat_pengajuan_form";
type SantriStatus = "santri" | "alumni" | "pengurus" | "pengabdi";
type KeputusanStatus = "menunggu" | "disetujui" | "ditolak";
type StatusKembali = "Tepat Waktu" | "Terlambat";

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
};
type SemuaPengajuanData = {
  ID_Pengajuan: number;
  ID_Perizinan: number | null;
  nama_pengajuan: string;
  keterangan: string | null;
  pengaju: string;
  keputusan: KeputusanStatus;
  disetujui_oleh: string | null;
  nama_santri: string;
  foto: string | null;
  alamat: string | null;
  Tanggal_Kembali: string | null;
  Keterlambatan_Jam: number | null;
};
type IzinAktifData = {
  ID_Perizinan: number;
  Tanggal_Kembali: string;
  nama_santri: string;
  nama_pengajuan: string;
};

// Helper
const getToken = (): string | null => localStorage.getItem("token");
const formatKeterlambatan = (totalJam: number | null): string => {
  if (totalJam === null || totalJam <= 0) return "-";
  if (totalJam < 24) return `${totalJam} jam`;
  const hari = Math.floor(totalJam / 24);
  const jam = totalJam % 24;
  return `${hari} hari ${jam} jam`;
};

function escapeInput(str: string): string {
  return str.replace(/[<>&'"`]/g, "");
}

interface DashboardAdminPerizinanProps {
  loggedInUser: UserData;
  handleLogout: () => void;
}

// --- Component Header ---
const PageHeader: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <div className="page-header-clean">
    <h2>{title}</h2>
    <p>{subtitle}</p>
  </div>
);

// --- Modal Detail ---
interface SantriDetailModalProps {
  santri: SantriDataLengkap;
  onClose: () => void;
  onBuatPengajuan: () => void;
}
const SantriDetailModal: React.FC<SantriDetailModalProps> = ({
  santri,
  onClose,
  onBuatPengajuan,
}) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-button" onClick={onClose}>&times;</button>
        <h3>Detail Santri</h3>
        <div className="detail-view-container">
          <div className="detail-photo">
            {santri.foto ? (
              <img src={`/api/images/${santri.foto}`} alt={santri.nama_santri} />
            ) : (
              <div className="photo-placeholder"><span>No Foto</span></div>
            )}
          </div>
          <div className="detail-info-grid simple-grid">
            <div className="detail-item">
              <label>Nama Lengkap</label> <p>{santri.nama_santri}</p>
            </div>
            <div className="detail-item">
              <label>Status</label> 
              <p><span className={`status-badge ${santri.status_santri}`}>{santri.status_santri}</span></p>
            </div>
            <div className="detail-item detail-span-2">
              <label>Alamat</label> <p>{santri.alamat || "-"}</p>
            </div>
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
// View: Pengajuan (Search)
// =======================================================
interface PengajuanViewProps {
  onSantriSelected: (santri: SantriDataLengkap) => void;
}
const PengajuanView: React.FC<PengajuanViewProps> = ({ onSantriSelected }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState<SantriPerizinanSearchResult[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSantri, setSelectedSantri] = useState<SantriDataLengkap | null>(null);

  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setSearchError("");
    try {
      const token = getToken();
      const response = await fetch(
        `/api/admin/perizinan/search-santri?q=${encodeURIComponent(searchQuery)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mencari data");
      setSearchResults(data.data?.results || []);
    } catch (err: any) {
      setSearchError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDetailClick = async (id: number) => {
    try {
      const token = getToken();
      const response = await fetch(`/api/admin/santri/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSelectedSantri(data.data); 
      setIsModalOpen(true);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <>
      <PageHeader title="Buat Pengajuan Izin" subtitle="Cari santri untuk memulai proses perizinan" />
      
      <div className="search-wrapper-clean">
        <form onSubmit={handleSearchSubmit} className="search-bar-clean">
          <input
            type="text"
            placeholder="Ketik nama santri..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(escapeInput(e.target.value))}
            disabled={isSearching}
          />
          <button type="submit" disabled={isSearching}>
            {/* Ikon Pencarian SVG */}
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="search-icon" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            {isSearching ? "Mencari..." : "Cari Data"}
          </button>
        </form>
      </div>

      {searchError && <p className="error-message" style={{textAlign: 'center'}}>{searchError}</p>}

      {searchResults.length > 0 && (
        <div className="table-card">
          <table className="results-table">
            <thead>
              <tr>
                <th>Nama Santri</th> <th>Status</th> <th>Jenis Kelamin</th> <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((santri) => (
                <tr key={santri.id}>
                  <td data-label="Nama">{santri.nama_santri}</td>
                  <td data-label="Status"><span className={`status-badge ${santri.status_santri}`}>{santri.status_santri}</span></td>
                  <td data-label="L/P">{santri.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</td>
                  <td data-label="Aksi">
                    <button className="detail-button" onClick={() => handleDetailClick(santri.id)}>
                      Pilih
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {!isSearching && searchResults.length === 0 && searchQuery && !searchError && (
        <div className="empty-state"><p>Tidak ditemukan data.</p></div>
      )}

      {!isSearching && searchResults.length === 0 && !searchQuery && (
        <div className="empty-state"><p>Silakan cari nama santri di atas.</p></div>
      )}

      {isModalOpen && selectedSantri && (
        <SantriDetailModal
          santri={selectedSantri}
          onClose={() => setIsModalOpen(false)}
          onBuatPengajuan={() => {
            onSantriSelected(selectedSantri);
            setIsModalOpen(false);
          }}
        />
      )}
    </>
  );
};

// =======================================================
// View: Form Pengajuan
// =======================================================
interface BuatPengajuanFormViewProps {
  santri: SantriDataLengkap;
  onBack: () => void;
  onSubmitSuccess: () => void;
}
const BuatPengajuanFormView: React.FC<BuatPengajuanFormViewProps> = ({
  santri,
  onBack,
  onSubmitSuccess,
}) => {
  const [namaPengajuan, setNamaPengajuan] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const token = getToken();
      const response = await fetch("/api/admin/perizinan/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          santriId: santri.id,
          namaPengajuan: escapeInput(namaPengajuan),
          keterangan: escapeInput(keterangan),
        }),
      });
      if (!response.ok) throw new Error("Gagal membuat pengajuan");
      alert("Pengajuan berhasil!");
      onSubmitSuccess();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button onClick={onBack} className="back-link"> &larr; Kembali </button>
      <div className="form-card-clean">
        <div className="form-header-split">
          <div>
             <h3>Form Izin Baru</h3>
             <p className="santri-name-highlight">{santri.nama_santri}</p>
          </div>
          <div className="mini-status">
            <span className={`status-badge ${santri.status_santri}`}>{santri.status_santri}</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Keperluan / Alasan Izin *</label>
            <input
              type="text"
              required
              value={namaPengajuan}
              onChange={(e) => setNamaPengajuan(escapeInput(e.target.value))}
              placeholder="Contoh: Pulang sakit, Acara keluarga..."
            />
          </div>
          <div className="form-group">
            <label>Keterangan Tambahan (Opsional)</label>
            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(escapeInput(e.target.value))}
              placeholder="Detail tambahan..."
              rows={3}
            />
          </div>
          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? "Menyimpan..." : "Kirim Pengajuan"}
          </button>
        </form>
      </div>
    </>
  );
};

// =======================================================
// View: Status Izin
// =======================================================
const StatusView: React.FC = () => {
  const [allPengajuan, setAllPengajuan] = useState<SemuaPengajuanData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<KeputusanStatus>("menunggu");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = getToken();
        const response = await fetch("/api/admin/perizinan/all", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        // FIX: Akses data.data.results
        if (response.ok) setAllPengajuan(data.data?.results || []);
      } catch (e) {
        console.error("Fetch error:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredList = useMemo(() => {
    if (!allPengajuan) return [];
    return allPengajuan.filter((p) => p.keputusan === activeTab);
  }, [allPengajuan, activeTab]);

  return (
    <>
      <PageHeader title="Status Izin" subtitle="Monitor status persetujuan pengajuan izin" />
      
      <div className="tabs-clean-container">
        {(["menunggu", "disetujui", "ditolak"] as KeputusanStatus[]).map((status) => (
          <button
            key={status}
            className={`tab-clean ${activeTab === status ? "active" : ""}`}
            onClick={() => setActiveTab(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            <span className="count-badge">
              {allPengajuan ? allPengajuan.filter(p => p.keputusan === status).length : 0}
            </span>
          </button>
        ))}
      </div>

      {isLoading ? <p className="empty-state">Memuat data...</p> : (
        <div className="table-card">
          <table className="results-table">
            <thead>
              <tr>
                <th>Nama Santri</th> <th>Keperluan</th> <th>Tanggal Kembali</th> <th>Ket.</th>
              </tr>
            </thead>
            <tbody>
              {filteredList.length === 0 ? (
                <tr><td colSpan={4} style={{textAlign:'center', padding:'2rem', color:'#888'}}>Tidak ada data</td></tr>
              ) : (
                filteredList.map((p) => (
                  <tr key={p.ID_Pengajuan}>
                    <td data-label="Nama">{p.nama_santri}</td>
                    <td data-label="Keperluan">{p.nama_pengajuan}</td>
                    <td data-label="Tgl Kembali">{p.Tanggal_Kembali ? new Date(p.Tanggal_Kembali).toLocaleDateString('id-ID') : "-"}</td>
                    <td data-label="Ket." className={p.Keterlambatan_Jam && p.Keterlambatan_Jam > 0 ? "text-late" : ""}>
                      {formatKeterlambatan(p.Keterlambatan_Jam)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

// =======================================================
// View: Surat (Cetak)
// =======================================================
const SuratView: React.FC = () => {
  const [list, setList] = useState<SemuaPengajuanData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataToPrint, setDataToPrint] = useState<SuratIzinData | null>(null);
  const componentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    onAfterPrint: () => setDataToPrint(null),
  });

  useEffect(() => {
    const fetch = async () => {
      try {
        const token = getToken();
        const res = await window.fetch("/api/admin/perizinan/all", { headers: { Authorization: `Bearer ${token}` }});
        const data = await res.json();
        if (res.ok) {
          const results = data.data?.results || [];
          setList(results.filter((p: any) => p.keputusan === "disetujui"));
        }
      } catch (e) {
        console.error(e);
      } finally { 
        setIsLoading(false); 
      }
    };
    fetch();
  }, []);

  useEffect(() => { if (dataToPrint) handlePrint(); }, [dataToPrint, handlePrint]);

  return (
    <>
      <PageHeader title="Cetak Surat" subtitle="Cetak surat jalan untuk santri yang disetujui" />
      <div className="table-card">
        <table className="results-table">
          <thead>
            <tr>
              <th>Nama Santri</th> <th>Keperluan</th> <th>Disetujui Oleh</th> <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {!isLoading && list.length === 0 && (
               <tr><td colSpan={4} style={{textAlign:'center', padding:'2rem', color:'#888'}}>Belum ada data disetujui</td></tr>
            )}
            {!isLoading && list.map((p) => (
              <tr key={p.ID_Pengajuan}>
                <td data-label="Nama">{p.nama_santri}</td>
                <td data-label="Keperluan">{p.nama_pengajuan}</td>
                <td data-label="Oleh">{p.disetujui_oleh || "-"}</td>
                <td data-label="Aksi">
                  <button className="print-button" onClick={() => {
                     if (!p.ID_Perizinan) return alert("Data perizinan belum lengkap");
                     setDataToPrint({
                       ID_Perizinan: p.ID_Perizinan,
                       nama_santri: p.nama_santri,
                       alamat: p.alamat,
                       foto: p.foto,
                       Tanggal_Kembali: p.Tanggal_Kembali,
                       disetujui_oleh: p.disetujui_oleh
                     });
                  }}>Cetak</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dataToPrint && <SuratIzinA5 ref={componentRef} data={dataToPrint} />}
    </>
  );
};

// =======================================================
// View: Kembali
// =======================================================
const KembaliView: React.FC = () => {
  const [list, setList] = useState<IzinAktifData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIzin, setSelectedIzin] = useState<IzinAktifData | null>(null);
  const [status, setStatus] = useState<StatusKembali>("Tepat Waktu");
  const [hari, setHari] = useState("0");
  const [jam, setJam] = useState("0");

  const fetchActive = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/perizinan/aktif", { headers: { Authorization: `Bearer ${getToken()}` }});
      const data = await res.json();
      if (res.ok) setList(data.data?.results || []);
    } catch (e) {
      console.error(e);
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => { fetchActive(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedIzin) return;
    try {
      const res = await fetch("/api/admin/perizinan/tandai-kembali", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          perizinanId: selectedIzin.ID_Perizinan,
          statusKembali: status,
          keterlambatanHari: parseInt(hari) || 0,
          keterlambatanJam: parseInt(jam) || 0
        })
      });
      if (res.ok) {
        alert("Berhasil dicatat");
        setSelectedIzin(null);
        fetchActive();
      } else {
        alert("Gagal menyimpan");
      }
    } catch (e) { alert("Gagal menyimpan"); }
  };

  return (
    <>
      <PageHeader title="Konfirmasi Kembali" subtitle="Catat kepulangan santri ke pondok" />
      <div className="table-card">
        <table className="results-table">
          <thead>
            <tr><th>Nama</th><th>Izin</th><th>Harus Kembali</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {!isLoading && list.length === 0 && (
               <tr><td colSpan={4} style={{textAlign:'center', padding:'2rem', color:'#888'}}>Tidak ada santri izin aktif</td></tr>
            )}
            {list.map((item) => (
              <tr key={item.ID_Perizinan}>
                <td data-label="Nama">{item.nama_santri}</td>
                <td data-label="Izin">{item.nama_pengajuan}</td>
                <td data-label="Jadwal" className={new Date(item.Tanggal_Kembali) < new Date() ? "text-late" : ""}>
                  {new Date(item.Tanggal_Kembali).toLocaleDateString('id-ID')}
                </td>
                <td data-label="Aksi">
                  <button className="mark-returned-button" onClick={() => setSelectedIzin(item)}>
                    Tandai
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedIzin && (
        <div className="modal-overlay" onClick={() => setSelectedIzin(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Catat Kepulangan: {selectedIzin.nama_santri}</h3>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as StatusKembali)}>
                  <option value="Tepat Waktu">Tepat Waktu</option>
                  <option value="Terlambat">Terlambat</option>
                </select>
              </div>
              {status === "Terlambat" && (
                <div className="keterlambatan-inputs">
                  <div className="form-group">
                    <label>Hari</label>
                    <input type="number" min="0" value={hari} onChange={e => setHari(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Jam</label>
                    <input type="number" min="0" max="23" value={jam} onChange={e => setJam(e.target.value)} />
                  </div>
                </div>
              )}
              <div className="modal-actions">
                 <button type="submit" className="login-button">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

// =======================================================
// Main Component
// =======================================================
const DashboardAdminPerizinan: React.FC<DashboardAdminPerizinanProps> = ({ loggedInUser, handleLogout }) => {
  const [view, setView] = useState<PerizinanView>("pengajuan");
  const [selectedSantri, setSelectedSantri] = useState<SantriDataLengkap | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navLinks = [
    { key: "pengajuan", label: "Buat Izin" },
    { key: "status", label: "Status" },
    { key: "surat", label: "Cetak Surat" },
    { key: "kembali", label: "Konfirmasi Kembali" },
  ];

  return (
    <div className="sidebar-layout">
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
      <Header loggedInUser={loggedInUser} handleLogout={handleLogout} onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
      <Sidebar
        isOpen={isSidebarOpen}
        activeView={view === "buat_pengajuan_form" ? "pengajuan" : view}
        onNavigate={(v) => { setView(v as PerizinanView); setSelectedSantri(null); setIsSidebarOpen(false); }}
        navLinks={navLinks}
        handleLogout={handleLogout}
      />
      <div className="dashboard-content-main">
        <main className="dashboard-content">
          {view === "pengajuan" && <PengajuanView onSantriSelected={(s) => { setSelectedSantri(s); setView("buat_pengajuan_form"); }} />}
          {view === "buat_pengajuan_form" && selectedSantri && (
            <BuatPengajuanFormView santri={selectedSantri} onBack={() => setView("pengajuan")} onSubmitSuccess={() => setView("status")} />
          )}
          {view === "status" && <StatusView />}
          {view === "surat" && <SuratView />}
          {view === "kembali" && <KembaliView />}
          {/* Fallback */}
          {view === "dashboard" && <PengajuanView onSantriSelected={(s) => { setSelectedSantri(s); setView("buat_pengajuan_form"); }} />}
        </main>
      </div>
    </div>
  );
};

export default DashboardAdminPerizinan;