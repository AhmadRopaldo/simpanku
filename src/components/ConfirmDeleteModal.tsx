import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  open,
  title,
  description,
  confirmLabel = 'Ya, Hapus',
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
    >
      <div className="w-full sm:max-w-md bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl p-6 shadow-xl border border-[#E5DEC9]">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="w-11 h-11 rounded-2xl bg-[#FDF2F0] text-[#9B2C2C] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Tutup dialog"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#5A645D] hover:bg-[#F3EEE3] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <h3 id="confirm-delete-title" className="font-display text-xl font-semibold text-[#1C241E] mb-2">
          {title}
        </h3>
        <p className="text-sm text-[#5A645D] leading-relaxed mb-6">{description}</p>

        <div className="flex flex-col-reverse sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-sm font-medium hover:bg-[#E7E0CF] transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#9B2C2C] text-white text-sm font-semibold hover:bg-[#7D2222] disabled:opacity-60 transition-colors cursor-pointer"
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
