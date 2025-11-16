// src/react-app/DashboardAdminPerizinan.tsx

import React, { useState, useEffect, FormEvent, useMemo, useRef } from "react";
import { useReactToPrint } from "react-to-print";
import "./App.css";
import "./DashboardAdminPerizinan.css";
import "./DashboardLayout.css"; // CSS Layout
import { Sidebar } from "./Sidebar"; // Sidebar baru
import { Header } from "./Header"; // Header baru
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
  // ... info ortu
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
  if (totalJam === null || totalJam <= 0) {
    return "-";
  }
  if (totalJam < 24) {
    return `${totalJam} jam`;
  }
  const hari = Math.floor(totalJam / 24);
  const jam = totalJam % 24;
  return `${hari} hari ${jam} jam`;
};

// Props dari App.tsx
interface DashboardAdminPerizinanProps {
  loggedInUser: UserData;
  handleLogout: () => void;
}

// =======================================================
// Komponen Modal Detail Santri
// =======================================================
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
        <button className="modal-close-button" onClick={onClose}>
          &times;
        </button>
        <h2>Detail Data Santri</h2>
        <div className="detail-view-container">
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
            <div className="detail-item detail-span-2">
              <label>Nama Lengkap</label> <p>{santri.nama_santri}</p>
            </div>
            <div className="detail-item">
              <label>Jenis Kelamin</label>
              <p>{santri.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</p>
            </div>
            <div className="detail-item">
              <label>Status Santri</label>
              <p className={`status-badge ${santri.status_santri}`}>
                {santri.status_santri}
              </p>
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
// Halaman Pengajuan (Pencarian)
// =======================================================
interface PengajuanViewProps {
  onSantriSelected: (santri: SantriDataLengkap) => void;
}
const PengajuanView: React.FC<PengajuanViewProps> = ({ onSantriSelected }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState<
    SantriPerizinanSearchResult[]
  >([]);
  const [successMessage, setSuccessMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSantri, setSelectedSantri] =
    useState<SantriDataLengkap | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const handleSearchSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    setSearchError("");
    setSuccessMessage("");
    try {
      const token = getToken();
      const response = await fetch(
        `/api/admin/perizinan/search-santri?q=${encodeURIComponent(
          searchQuery
        )}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal mencari data");
      setSearchResults(data.results);
    } catch (err: any) {
      setSearchError(err.message);
    } finally {
      setIsSearching(false);
    }
  };
  const handleDetailClick = async (id: number) => {
    setIsLoadingDetail(true);
    setDetailError("");
    setIsModalOpen(true);
    try {
      const token = getToken();
      const response = await fetch(`/api/admin/santri/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Gagal mengambil detail");
      }
      const data: SantriDataLengkap = await response.json();
      setSelectedSantri(data);
    } catch (err: any) {
      setDetailError(err.message);
    } finally {
      setIsLoadingDetail(false);
    }
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSantri(null);
  };
  const handleBuatPengajuanClick = () => {
    if (!selectedSantri) return;
    onSantriSelected(selectedSantri);
    closeModal();
  };
  return (
    <>
      <div className="placeholder-page">
        <h2>Pengajuan Izin</h2>
        <p>
          Cari santri (aktif, pengurus, atau pengabdi) untuk membuat pengajuan
          izin baru.
        </p>
        {successMessage && (
          <p className="success-message">{successMessage}</p>
        )}
        <form onSubmit={handleSearchSubmit}>
          <div className="search-bar">
            <input
              type="text"
              placeholder="Ketik nama santri..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
            />
            <button
              type="submit"
              className="login-button"
              disabled={isSearching}
            >
              {isSearching ? "..." : "Cari"}
            </button>
          </div>
        </form>
        {isSearching && <p>Mencari...</p>}
        {searchError && <p className="error-message">{searchError}</p>}
        {searchResults.length > 0 && (
          <div className="search-results-container">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Nama Santri</th> <th>Status</th> <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((santri) => (
                  <tr key={santri.id}>
                    <td>{santri.nama_santri}</td>
                    <td>
                      <span
                        className={`status-badge-small ${santri.status_santri}`}
                      >
                        {santri.status_santri}
                      </span>
                    </td>
                    <td>
                      <button
                        className="detail-button"
                        onClick={() => handleDetailClick(santri.id)}
                      >
                        Pilih & Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {isModalOpen && (
        <>
          {isLoadingDetail && (
            <div className="modal-overlay">
              <p style={{ color: "white", fontSize: "2rem" }}>Memuat...</p>
            </div>
          )}
          {detailError && (
            <div className="modal-overlay">
              <p className="error-message">{detailError}</p>
            </div>
          )}
          {selectedSantri && (
            <SantriDetailModal
              santri={selectedSantri}
              onClose={closeModal}
              onBuatPengajuan={handleBuatPengajuanClick}
            />
          )}
        </>
      )}
    </>
  );
};

// =======================================================
// "Halaman" Form Pengajuan
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
  const [error, setError] = useState("");
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
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
          namaPengajuan,
          keterangan,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal membuat pengajuan");
      }
      alert("Pengajuan izin baru berhasil dibuat!");
      onSubmitSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="placeholder-page">
      <button onClick={onBack} className="back-button">
        &larr; Kembali ke Pencarian
      </button>
      <h2>Buat Pengajuan Izin</h2>
      <div className="detail-view-container simple">
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
          <div className="detail-item detail-span-2">
            <label>Nama Santri</label> <p>{santri.nama_santri}</p>
          </div>
          <div className="detail-item">
            <label>Jenis Kelamin</label>
            <p>{santri.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}</p>
          </div>
          <div className="detail-item">
            <label>Status Santri</label>
            <p className={`status-badge ${santri.status_santri}`}>
              {santri.status_santri}
            </p>
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="modal-actions">
        {error && <p className="error-message">{error}</p>}
        <div className="form-grid">
          <div className="form-group form-span-2">
            <label htmlFor="nama_pengajuan">Nama Pengajuan / Alasan *</label>
            <input
              type="text"
              id="nama_pengajuan"
              required
              value={namaPengajuan}
              onChange={(e) => setNamaPengajuan(e.target.value)}
            />
          </div>
          <div className="form-group form-span-2">
            <label htmlFor="keterangan">Keterangan (Opsional)</label>
            <textarea
              id="keterangan"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
            />
          </div>
        </div>
        <button
          type="submit"
          className="login-button"
          disabled={isLoading}
        >
          {isLoading
            ? "Menyimpan..."
            : "Simpan Pengajuan (Status: Menunggu)"}
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
      <p>
        Selamat datang. Area ini akan menampilkan statistik dan ringkasan
        perizinan.
      </p>
    </div>
  );
};
const SuratView: React.FC = () => {
  const [approvedList, setApprovedList] = useState<SemuaPengajuanData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataToPrint, setDataToPrint] = useState<SuratIzinData | null>(null);
  const componentToPrintRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: componentToPrintRef,
    onAfterPrint: () => setDataToPrint(null),
  });
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
        setApprovedList(
          data.results.filter(
            (p: SemuaPengajuanData) => p.keputusan === "disetujui"
          )
        );
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchApproved();
  }, []);
  const triggerPrint = (data: SemuaPengajuanData) => {
    if (!data.ID_Perizinan) {
      alert("Error: Data perizinan tidak lengkap, ID Perizinan tidak ditemukan.");
      return;
    }
    const suratData: SuratIzinData = {
      ID_Perizinan: data.ID_Perizinan,
      nama_santri: data.nama_santri,
      alamat: data.alamat,
      foto: data.foto,
      Tanggal_Kembali: data.Tanggal_Kembali,
      disetujui_oleh: data.disetujui_oleh,
    };
    setDataToPrint(suratData);
  };
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
                <th>No. Surat</th>
                <th>Nama Santri</th>
                <th>Pengajuan</th>
                <th>Disetujui Oleh</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {approvedList.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{ textAlign: "center", color: "#888" }}
                  >
                    Belum ada pengajuan yang disetujui.
                  </td>
                </tr>
              )}
              {approvedList.map((p) => (
                <tr key={p.ID_Pengajuan}>
                  <td>{p.ID_Perizinan}</td>
                  <td>{p.nama_santri}</td>
                  <td>{p.nama_pengajuan}</td>
                  <td>{p.disetujui_oleh || "-"}</td>
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
      {dataToPrint && (
        <SuratIzinA5 ref={componentToPrintRef} data={dataToPrint} />
      )}
    </div>
  );
};

// =======================================================
// "Halaman" Status Izin
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
    return allPengajuan.filter((p) => p.keputusan === activeTab);
  }, [allPengajuan, activeTab]);
  return (
    <div className="placeholder-page">
      <h2>Status Semua Pengajuan Izin</h2>
      <p>Lihat semua pengajuan izin berdasarkan status persetujuan.</p>
      <div className="status-tabs">
        <button
          className={activeTab === "menunggu" ? "active" : ""}
          onClick={() => setActiveTab("menunggu")}
        >
          Menunggu
        </button>
        <button
          className={activeTab === "disetujui" ? "active" : ""}
          onClick={() => setActiveTab("disetujui")}
        >
          Disetujui
        </button>
        <button
          className={activeTab === "ditolak" ? "active" : ""}
          onClick={() => setActiveTab("ditolak")}
        >
          Ditolak
        </button>
      </div>
      {isLoading && <p>Memuat data...</p>}
      {error && <p className="error-message">{error}</p>}
      {!isLoading && <StatusTable list={filteredList} />}
    </div>
  );
};
const StatusTable: React.FC<{ list: SemuaPengajuanData[] }> = ({ list }) => {
  if (list.length === 0) {
    return (
      <p style={{ textAlign: "center", color: "#888", marginTop: "2rem" }}>
        Tidak ada data.
      </p>
    );
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
            <th>Keterlambatan</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.ID_Pengajuan}>
              <td>{p.nama_santri}</td>
              <td>{p.nama_pengajuan}</td>
              <td>
                <span className={`status-badge-small ${p.keputusan}`}>
                  {p.keputusan}
                </span>
              </td>
              <td>
                {p.Tanggal_Kembali
                  ? new Date(p.Tanggal_Kembali).toLocaleDateString("id-ID")
                  : "-"}
              </td>
              <td
                className={
                  p.Keterlambatan_Jam && p.Keterlambatan_Jam > 0
                    ? "text-late"
                    : ""
                }
              >
                {formatKeterlambatan(p.Keterlambatan_Jam)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// =======================================================
// "Halaman" Kembali
// =======================================================
const KembaliView: React.FC = () => {
  const [izinAktifList, setIzinAktifList] = useState<IzinAktifData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIzin, setSelectedIzin] = useState<IzinAktifData | null>(
    null
  );

  useEffect(() => {
    fetchIzinAktif();
  }, []);

  const fetchIzinAktif = async () => {
    setIsLoading(true);
    setError("");
    try {
      const token = getToken();
      const response = await fetch("/api/admin/perizinan/aktif", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal mengambil data");
      }
      setIzinAktifList(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenKembaliModal = (izin: IzinAktifData) => {
    setSelectedIzin(izin);
    setIsModalOpen(true);
    setUpdateMessage("");
    setError("");
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedIzin(null);
  };

  const handleReturnSuccess = (message: string) => {
    setUpdateMessage(message);
    fetchIzinAktif(); // Muat ulang daftar
  };

  const formatTanggalKembali = (tanggal: string) => {
    const tglKembali = new Date(tanggal);
    const sisaHari = Math.ceil(
      (tglKembali.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    const tglFormatted = tglKembali.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    let sisaHariText = `(sisa ${sisaHari} hari)`;
    if (sisaHari === 0) sisaHariText = "(Kembali Hari Ini)";
    if (sisaHari < 0) sisaHariText = `(Terlambat ${Math.abs(sisaHari)} hari)`;
    return `${tglFormatted} ${sisaHariText}`;
  };

  return (
    <>
      <div className="placeholder-page">
        <h2>Daftar Santri dalam Masa Izin</h2>
        <p>Santri yang telah disetujui izinnya dan belum kembali ke pondok.</p>

        {isLoading && <p>Memuat data...</p>}
        {error && <p className="error-message">{error}</p>}
        {updateMessage && (
          <p className="success-message">{updateMessage}</p>
        )}

        {!isLoading && (
          <div className="search-results-container">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Nama Santri</th>
                  <th>Alasan Izin</th>
                  <th>Harus Kembali</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {izinAktifList.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{ textAlign: "center", color: "#888" }}
                    >
                      Tidak ada santri yang sedang izin.
                    </td>
                  </tr>
                )}
                {izinAktifList.map((izin) => (
                  <tr key={izin.ID_Perizinan}>
                    <td>{izin.nama_santri}</td>
                    <td>{izin.nama_pengajuan}</td>
                    <td
                      className={
                        new Date(izin.Tanggal_Kembali) < new Date()
                          ? "text-late"
                          : ""
                      }
                    >
                      {formatTanggalKembali(izin.Tanggal_Kembali)}
                    </td>
                    <td>
                      <button
                        className="mark-returned-button"
                        onClick={() => handleOpenKembaliModal(izin)}
                      >
                        Tandai Kembali
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && selectedIzin && (
        <KembaliModal
          izin={selectedIzin}
          onClose={handleCloseModal}
          onSubmitSuccess={handleReturnSuccess}
        />
      )}
    </>
  );
};

// =======================================================
// Modal Kepulangan
// =======================================================
interface KembaliModalProps {
  izin: IzinAktifData;
  onClose: () => void;
  onSubmitSuccess: (message: string) => void;
}
const KembaliModal: React.FC<KembaliModalProps> = ({
  izin,
  onClose,
  onSubmitSuccess,
}) => {
  const [statusKembali, setStatusKembali] =
    useState<StatusKembali>("Tepat Waktu");
  const [keterlambatanHari, setKeterlambatanHari] = useState("0");
  const [keterlambatanJam, setKeterlambatanJam] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const token = getToken();
      const response = await fetch("/api/admin/perizinan/tandai-kembali", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          perizinanId: izin.ID_Perizinan,
          statusKembali,
          keterlambatanHari: parseInt(keterlambatanHari) || 0,
          keterlambatanJam: parseInt(keterlambatanJam) || 0,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Gagal mencatat kepulangan");
      }

      let message = "Kepulangan santri berhasil dicatat.";
      if (data.status === "Terlambat") {
        message += ` Status: Terlambat (${formatKeterlambatan(
          data.keterlambatanJam
        )})`;
      } else {
        message += " Status: Tepat Waktu.";
      }

      onSubmitSuccess(message);
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
        <h2>Tandai Kepulangan Santri</h2>

        <div className="detail-info-grid simple-grid">
          <div className="detail-item">
            <label>Nama Santri</label> <p>{izin.nama_santri}</p>
          </div>
          <div className="detail-item">
            <label>Izin</label> <p>{izin.nama_pengajuan}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <p className="error-message">{error}</p>}
          <div className="form-grid">
            <div className="form-group form-span-2">
              <label htmlFor="status_kembali">Status Kepulangan *</label>
              <select
                id="status_kembali"
                value={statusKembali}
                onChange={(e) =>
                  setStatusKembali(e.target.value as StatusKembali)
                }
              >
                <option value="Tepat Waktu">Tepat Waktu</option>
                <option value="Terlambat">Terlambat</option>
              </select>
            </div>

            {statusKembali === "Terlambat" && (
              <div className="form-group keterlambatan-inputs form-span-2">
                <div>
                  <label htmlFor="keterlambatan_hari">Hari Terlambat</label>
                  <input
                    type="number"
                    id="keterlambatan_hari"
                    value={keterlambatanHari}
                    onChange={(e) => setKeterlambatanHari(e.target.value)}
                    min="0"
                  />
                </div>
                <div>
                  <label htmlFor="keterlambatan_jam">Jam Terlambat</label>
                  <input
                    type="number"
                    id="keterlambatan_jam"
                    value={keterlambatanJam}
                    onChange={(e) => setKeterlambatanJam(e.target.value)}
                    min="0"
                    max="23"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={isLoading}
            style={{ marginTop: "1rem" }}
          >
            {isLoading ? "Menyimpan..." : "Simpan Status Kepulangan"}
          </button>
        </form>
      </div>
    </div>
  );
};

// =======================================================
// Komponen Utama Dashboard (Router Internal) (DIPERBARUI)
// =======================================================
const DashboardAdminPerizinan: React.FC<DashboardAdminPerizinanProps> = ({
  loggedInUser,
  handleLogout,
}) => {
  const [view, setView] = useState<PerizinanView>("dashboard");
  const [selectedSantri, setSelectedSantri] =
    useState<SantriDataLengkap | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleGoToPengajuanForm = (santri: SantriDataLengkap) => {
    setSelectedSantri(santri);
    setView("buat_pengajuan_form");
  };
  const handleReturnToDashboard = () => {
    setSelectedSantri(null);
    setView("dashboard");
  };

  const renderView = () => {
    switch (view) {
      case "dashboard":
        return <DashboardView />;
      case "pengajuan":
        return <PengajuanView onSantriSelected={handleGoToPengajuanForm} />;
      case "status":
        return <StatusView />;
      case "surat":
        return <SuratView />;
      case "kembali":
        return <KembaliView />;
      case "buat_pengajuan_form":
        return (
          <BuatPengajuanFormView
            santri={selectedSantri!}
            onBack={() => setView("pengajuan")}
            onSubmitSuccess={handleReturnToDashboard}
          />
        );
      default:
        return <DashboardView />;
    }
  };

  // --- Definisikan Navigasi untuk Sidebar ---
  const navLinks = [
    { key: "dashboard", label: "Dashboard" },
    { key: "pengajuan", label: "Pengajuan" },
    { key: "status", label: "Status" },
    { key: "surat", label: "Surat" },
    { key: "kembali", label: "Kembali" },
  ];

  // Tentukan view yang aktif untuk highlight link
  const getActiveViewForNav = () => {
    if (view === "buat_pengajuan_form") return "pengajuan";
    return view;
  };

  return (
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
        activeView={getActiveViewForNav()}
        onNavigate={(v) => {
          setView(v as PerizinanView);
          setSelectedSantri(null);
          setIsSidebarOpen(false); // Tutup sidebar di mobile
        }}
        navLinks={navLinks}
        handleLogout={handleLogout}
      />
      
      <div className="dashboard-content-main">
        <main className="dashboard-content">
          {view === "buat_pengajuan_form" && !selectedSantri ? (
            <PengajuanView onSantriSelected={handleGoToPengajuanForm} />
          ) : (
            renderView()
          )}
        </main>
      </div>
    </div>
  );
};

export default DashboardAdminPerizinan;