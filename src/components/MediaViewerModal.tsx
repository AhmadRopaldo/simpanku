import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Trash2,
  X,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
  db,
  fetchPrivateStorageBlob,
  handleFirestoreError,
  OperationType,
  translateFirebaseError,
} from '../firebase';
import { LIMITS, type Album, type MediaItem } from '../types';
import { formatDurasi, formatTanggal, formatUkuranBerkas } from '../utils/formatters';
import { PrivateImage, PrivateVideoPlayer } from './PrivateMedia';

interface MediaViewerModalProps {
  items: MediaItem[];
  currentIndex: number;
  albums: Album[];
  currentUid: string;
  isAdmin: boolean;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
  onRequestDelete: (item: MediaItem) => void;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  items,
  currentIndex,
  albums,
  currentUid,
  isAdmin,
  onClose,
  onChangeIndex,
  onRequestDelete,
}) => {
  const item = items[currentIndex];
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [mediaDate, setMediaDate] = useState('');
  const [albumId, setAlbumId] = useState('');
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setCaption(item.caption);
      setMediaDate(item.mediaDate);
      setAlbumId(item.albumId);
      setEditing(false);
      setError(null);
    }
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && currentIndex > 0) onChangeIndex(currentIndex - 1);
      if (e.key === 'ArrowRight' && currentIndex < items.length - 1) onChangeIndex(currentIndex + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, currentIndex, items.length, onClose, onChangeIndex]);

  if (!item) return null;

  const canManage = isAdmin || item.createdByUid === currentUid;

  const handleDownload = async () => {
    setDownloading(true);
    setError(null);
    try {
      const blob = await fetchPrivateStorageBlob(item.storagePath);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.fileName || `${item.title}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(translateFirebaseError(err));
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Judul wajib diisi.');
      return;
    }
    const targetAlbum = albums.find((a) => a.id === albumId);
    if (!targetAlbum) {
      setError('Pilih album yang valid.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateDoc(doc(db, 'media', item.id), {
        title: cleanTitle.slice(0, LIMITS.mediaTitleMax),
        caption: caption.trim().slice(0, LIMITS.mediaCaptionMax),
        mediaDate,
        albumId: targetAlbum.id,
        albumTitle: targetAlbum.title.slice(0, LIMITS.albumTitleMax),
        updatedAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `media/${item.id}`));
      setEditing(false);
    } catch (err) {
      setError(translateFirebaseError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0E1410]/95 text-[#FAF7F0] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
    >
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-white/10">
        <div className="min-w-0">
          <p className="text-xs text-[#B7C4BC] truncate">
            {item.albumTitle} · {currentIndex + 1} dari {items.length}
          </p>
          <h3 className="text-sm sm:text-base font-semibold truncate">{item.title}</h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            title="Unduh berkas asli"
            aria-label="Unduh berkas asli"
            className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">{downloading ? 'Mengunduh...' : 'Unduh'}</span>
          </button>

          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                title="Ubah detail"
                aria-label="Ubah detail"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onRequestDelete(item)}
                title="Hapus kenangan"
                aria-label="Hapus kenangan"
                className="min-w-[44px] min-h-[44px] rounded-xl bg-[#9B2C2C]/40 hover:bg-[#9B2C2C]/70 text-[#FFDAD6] flex items-center justify-center cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup penampil"
            className="min-w-[44px] min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewer Canvas */}
      <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden">
        {currentIndex > 0 && (
          <button
            type="button"
            onClick={() => onChangeIndex(currentIndex - 1)}
            aria-label="Sebelumnya"
            className="absolute left-3 z-10 min-w-[44px] min-h-[44px] rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {item.mediaType === 'video' ? (
          <PrivateVideoPlayer storagePath={item.storagePath} title={item.title} />
        ) : (
          <div className="max-h-[70vh] max-w-full flex items-center justify-center">
            <PrivateImage
              storagePath={item.storagePath}
              alt={item.title}
              className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl"
              aspectClass="w-72 h-72 rounded-xl"
            />
          </div>
        )}

        {currentIndex < items.length - 1 && (
          <button
            type="button"
            onClick={() => onChangeIndex(currentIndex + 1)}
            aria-label="Berikutnya"
            className="absolute right-3 z-10 min-w-[44px] min-h-[44px] rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center cursor-pointer"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Metadata / Edit Drawer */}
      <div className="bg-[#161F19] border-t border-white/10 px-4 sm:px-6 py-4 pb-safe">
        {error && (
          <div className="mb-3 p-2.5 rounded-xl bg-[#9B2C2C]/30 text-xs text-[#FFDAD6]">
            {error}
          </div>
        )}

        {editing ? (
          <form onSubmit={handleSaveEdit} className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={title}
              maxLength={LIMITS.mediaTitleMax}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul"
              className="min-h-[42px] px-3 py-2 rounded-xl bg-[#222E26] border border-white/15 text-sm text-white"
            />
            <div className="flex gap-2">
              <input
                type="date"
                value={mediaDate}
                onChange={(e) => setMediaDate(e.target.value)}
                className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-[#222E26] border border-white/15 text-sm text-white"
              />
              <select
                value={albumId}
                onChange={(e) => setAlbumId(e.target.value)}
                className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-[#222E26] border border-white/15 text-sm text-white"
              >
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              value={caption}
              maxLength={LIMITS.mediaCaptionMax}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Keterangan kenangan..."
              className="sm:col-span-2 min-h-[42px] px-3 py-2 rounded-xl bg-[#222E26] border border-white/15 text-sm text-white"
            />
            <div className="sm:col-span-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-white/10 text-xs font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#2D6A4F] text-white text-xs font-semibold cursor-pointer"
              >
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        ) : (
          <div className="max-w-3xl mx-auto">
            {item.caption && (
              <p className="text-sm text-[#EDF2EE] leading-relaxed mb-1.5">{item.caption}</p>
            )}
            <div className="text-xs text-[#B7C4BC] flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{formatTanggal(item.mediaDate)}</span>
              <span aria-hidden="true">·</span>
              <span>Diunggah oleh {item.createdByName}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{formatUkuranBerkas(item.fileSize)}</span>
              {item.mediaType === 'video' && item.durationSec > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">Durasi {formatDurasi(item.durationSec)}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
