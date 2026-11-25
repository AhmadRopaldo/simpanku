import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let friendly = 'Terjadi gangguan tak terduga pada aplikasi.';
    if (error.message.includes('Missing or insufficient permissions') || error.message.includes('permission-denied')) {
      friendly = 'Akses ke data ditolak. Pastikan akun Google Anda terdaftar sebagai anggota aktif grup ini.';
    } else if (error.message.includes('Quota exceeded')) {
      friendly = 'Kuota harian database terlampaui. Silakan coba lagi esok hari.';
    }
    return { hasError: true, message: friendly };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF7F0] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#FFFFFF] border border-[#E5DEC9] rounded-3xl p-8 text-center shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-[#FDF2F0] text-[#9B2C2C] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-[#1C241E] mb-2">
              Tidak Dapat Memuat Data
            </h1>
            <p className="text-sm text-[#5A645D] leading-relaxed mb-6">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#1B4332] text-[#FAF7F0] font-medium text-sm flex items-center justify-center gap-2 hover:bg-[#143326] transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
