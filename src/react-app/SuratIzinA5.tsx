// src/react-app/SuratIzinA5.tsx

import React from "react";
import "./SuratIzinA5.css";

// Tipe data yang dibutuhkan oleh surat (DIPERBARUI)
export type SuratIzinData = {
  ID_Perizinan: number; // Gunakan ID Perizinan
  nama_santri: string;
  alamat: string | null;
  foto: string | null;
  Tanggal_Kembali: string | null;
  disetujui_oleh: string | null; // Nama Ndalem
};

interface SuratIzinProps {
  data: SuratIzinData;
}

// --- Helper untuk Bulan Romawi (BARU) ---
const toRoman = (num: number): string => {
  const numerals = [
    { value: 10, numeral: 'X' }, { value: 9, numeral: 'IX' },
    { value: 5, numeral: 'V' }, { value: 4, numeral: 'IV' },
    { value: 1, numeral: 'I' }
  ];
  let result = '';
  for (const { value, numeral } of numerals) {
    while (num >= value) {
      result += numeral;
      num -= value;
    }
  }
  return result;
};

// Gunakan React.forwardRef
export const SuratIzinA5 = React.forwardRef<HTMLDivElement, SuratIzinProps>(
  ({ data }, ref) => {
    
    // --- Logika Format Nomor Surat (BARU) ---
    const now = new Date();
    const tahun = now.getFullYear();
    const bulanRomawi = toRoman(now.getMonth() + 1); // getMonth() 0-indexed
    const kodeSurat = "IZN/E-NAJAH"; // Ganti dengan kode surat Anda
    // Format nomor urut (ID_Perizinan) menjadi 3 digit, misal: 001
    const nomorUrut = String(data.ID_Perizinan).padStart(3, '0');
    
    const nomorSuratLengkap = `${nomorUrut}/${kodeSurat}/${bulanRomawi}/${tahun}`;

    // Format tanggal
    const tanggalKembaliFormatted = data.Tanggal_Kembali
      ? new Date(data.Tanggal_Kembali).toLocaleDateString("id-ID", {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })
      : "Tidak Ditentukan";
      
    const tanggalCetak = new Date().toLocaleDateString("id-ID", {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    return (
      <div className="a5-page-container" ref={ref}>
        <div className="a5-header">
          <h3>PONDOK PESANTREN E-NAJAH</h3>
          <p>Jl. Raya Pahlawan No. 123, Sumbersuko, Jawa Timur</p>
          <div className="a5-divider"></div>
        </div>
        
        <div className="a5-content">
          <h4 className="a5-title">SURAT IZIN KEMBALI</h4>
          {/* --- NOMOR SURAT DIPERBARUI --- */}
          <p className="a5-subtitle">Nomor Surat: {nomorSuratLengkap}</p>

          <p className="a5-body-text">
            Yang bertanda tangan di bawah ini, Pengurus Pondok Pesantren E-Najah,
            memberikan izin kepada santri:
          </p>
          
          <table className="a5-datatable">
            <tbody>
              <tr>
                <td>Nama</td>
                <td>: {data.nama_santri}</td>
              </tr>
              <tr>
                <td>Alamat</td>
                <td>: {data.alamat || "-"}</td>
              </tr>
            </tbody>
          </table>

          <p className="a5-body-text">
            Untuk kembali ke rumah/wali dengan ketentuan harus kembali ke pondok pesantren pada:
          </p>
          <p className="a5-tanggal-kembali">
            {tanggalKembaliFormatted}
          </p>
          <p className="a5-body-text">
            Demikian surat izin ini dibuat untuk dipergunakan sebagaimana mestinya.
          </p>
        </div>
        
        <div className="a5-footer">
          <div className="a5-photo-container">
            {data.foto ? (
              <img 
                src={`/api/images/${data.foto}`} 
                alt="Foto Santri" 
                className="a5-photo"
              />
            ) : (
              <div className="a5-photo-placeholder">
                <span>(Foto Santri)</span>
              </div>
            )}
          </div>
          
          <div className="a5-ttd">
            <p>Sumbersuko, {tanggalCetak}</p>
            <p>Menyetujui,</p>
            <div className="a5-ttd-space"></div>
            <p className="a5-ttd-nama">{data.disetujui_oleh || "Ndalem"}</p>
          </div>
        </div>
      </div>
    );
  }
);