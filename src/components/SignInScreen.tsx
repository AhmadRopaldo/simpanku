import React from 'react';
import type { User } from 'firebase/auth';
import { Lock, LogIn, LogOut, RefreshCw, ShieldAlert } from 'lucide-react';

interface SignInScreenProps {
  user: User | null;
  authLoading: boolean;
  accessDeniedReason: 'not-approved' | 'revoked' | null;
  authError: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
  onRecheckAccess: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  user,
  authLoading,
  accessDeniedReason,
  authError,
  onSignIn,
  onSignOut,
  onRecheckAccess,
}) => {
  return (
    <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-4xl w-full bg-[#FFFFFF] border border-[#E5DEC9] rounded-3xl overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-2 items-stretch">
        <div className="relative min-h-[240px] md:min-h-[520px] bg-[#1B4332]">
          <img
            src="/src/assets/images/ruang_kenangan_banner_1795580064718.jpg"
            alt="Album foto dan daun hijau hangat di Simpan-Ku"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#122B20]/90 via-[#122B20]/35 to-transparent flex flex-col justify-end p-6 sm:p-8 text-[#FAF7F0]">
            <p className="text-xs tracking-wide text-[#D8E2DC] mb-1.5">
              File Storage
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-tight text-balance">
              Simpan-Ku
            </h1>
            <p className="text-sm text-[#E9E4D5] mt-2 leading-relaxed">
              Tempat privat grup untuk menyimpan foto, video kebersamaan, dan dokumen PDF penting dalam folder yang rapi.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-10 flex flex-col justify-center">
          {user && accessDeniedReason ? (
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#FDF2F0] text-[#9B2C2C] flex items-center justify-center mb-5">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="font-display text-2xl font-semibold text-[#1C241E] mb-2">
                {accessDeniedReason === 'revoked'
                  ? 'Akses Akun Dinonaktifkan'
                  : 'Email Belum Disetujui'}
              </h2>
              <p className="text-sm text-[#5A645D] leading-relaxed mb-4">
                Anda masuk sebagai <strong className="text-[#1C241E]">{user.email}</strong>.{' '}
                {accessDeniedReason === 'revoked'
                  ? 'Akses Anda ke grup ini telah dicabut oleh admin grup. Permintaan data ditolak.'
                  : 'Hanya alamat email yang telah didaftarkan oleh admin grup yang dapat membuka Simpan-Ku.'}
              </p>
              <div className="rounded-2xl bg-[#F6F1E5] p-4 text-xs text-[#49534B] leading-relaxed mb-6">
                Minta admin grup menambahkan atau mengaktifkan kembali email{' '}
                <span className="font-semibold text-[#1C241E]">{user.email}</span> di halaman{' '}
                <span className="font-semibold text-[#1C241E]">Profil · Kelola Anggota</span>.
              </div>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={onRecheckAccess}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#143326] transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  Periksa Ulang Akses
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#E7E0CF] transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Keluar & Ganti Akun Google
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#EBF2ED] text-[#1B4332] flex items-center justify-center mb-5">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#1C241E] mb-2 text-balance">
                Masuk ke Ruang Grup
              </h2>
              <p className="text-sm text-[#5A645D] leading-relaxed mb-6">
                Gunakan akun Google Anda yang sudah terdaftar untuk membuka album foto, video, dan folder dokumen grup.
              </p>

              {authError && (
                <div className="mb-5 p-3.5 rounded-xl bg-[#FDF2F0] border border-[#F5CFC9] text-xs text-[#9B2C2C] leading-relaxed">
                  {authError}
                </div>
              )}

              <button
                type="button"
                onClick={onSignIn}
                disabled={authLoading}
                className="w-full min-h-[48px] px-6 py-3.5 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-sm font-semibold flex items-center justify-center gap-2.5 hover:bg-[#143326] disabled:opacity-60 transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                {authLoading ? 'Menghubungkan...' : 'Masuk dengan Google'}
              </button>

              <p className="text-xs text-[#6B756D] mt-5 leading-relaxed">
                Seluruh foto, video, dan dokumen PDF bersifat privat dan hanya dapat dibuka oleh anggota grup yang disetujui.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
