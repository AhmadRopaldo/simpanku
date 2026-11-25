import React, { useEffect, useState } from 'react';
import {
  Download,
  Edit3,
  FileText,
  FolderInput,
  RefreshCw,
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
import { LIMITS, type DocumentFile, type Folder } from '../types';
import { formatTanggal, formatUkuranBerkas } from '../utils/formatters';

interface PdfPreviewModalProps {
  documentFile: DocumentFile | null;
  folders: Folder[];
  folderPathLabel: string;
  currentUid: string;
  isAdmin: boolean;
  onClose: () => void;
  onRequestDelete: (docFile: DocumentFile) => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  documentFile,
  folders,
  folderPathLabel,
  currentUid,
  isAdmin,
  onClose,
  onRequestDelete,
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const [mode, setMode] = useState<'preview' | 'rename' | 'move'>('preview');
  const [newTitle, setNewTitle] = useState('');
  const [newFolderId, setNewFolderId] = useState('root');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!documentFile) {
      setBlobUrl(null);
      return;
    }

    setNewTitle(documentFile.title);
    setNewFolderId(documentFile.folderId);
    setMode('preview');

    let active = true;
    let createdUrl: string | null = null;
    setLoading(true);
    setErrorMsg(null);

    fetchPrivateStorageBlob(documentFile.storagePath)
      .then((blob) => {
        if (!active) return;
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        createdUrl = URL.createObjectURL(pdfBlob);
        setBlobUrl(createdUrl);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setErrorMsg(translateFirebaseError(err));
        setLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [documentFile, attempt]);

  if (!documentFile) return null;

  const canManage = isAdmin || documentFile.createdByUid === currentUid;

  const handleDownload = async () => {
    try {
      let url = blobUrl;
      let tempUrl: string | null = null;
      if (!url) {
        const blob = await fetchPrivateStorageBlob(documentFile.storagePath);
        tempUrl = URL.createObjectURL(blob);
        url = tempUrl;
      }
      const a = document.createElement('a');
      a.href = url;
      a.download = documentFile.originalFileName || `${documentFile.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (tempUrl) {
        window.setTimeout(() => URL.revokeObjectURL(tempUrl as string), 1000);
      }
    } catch (err) {
      setErrorMsg(translateFirebaseError(err));
    }
  };

  const handleSaveRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTitle.trim();
    if (!clean) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await updateDoc(doc(db, 'documents', documentFile.id), {
        title: clean.slice(0, LIMITS.docTitleMax),
        updatedAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `documents/${documentFile.id}`));
      setMode('preview');
    } catch (err) {
      setErrorMsg(translateFirebaseError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMove = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      await updateDoc(doc(db, 'documents', documentFile.id), {
        folderId: newFolderId,
        updatedAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `documents/${documentFile.id}`));
      setMode('preview');
    } catch (err) {
      setErrorMsg(translateFirebaseError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau ${documentFile.title}`}
    >
      <div className="w-full sm:max-w-4xl h-[92vh] bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl border border-[#E5DEC9]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-[#EFE9DA] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold text-[#1C241E] truncate">
              {documentFile.title}
            </h3>
            <p className="text-xs text-[#5A645D] truncate">
              {folderPathLabel} · {formatUkuranBerkas(documentFile.fileSize)} ·{' '}
              {formatTanggal(documentFile.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleDownload}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#143326] cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh PDF</span>
            </button>

            {canManage && (
              <>
                <button
                  type="button"
                  onClick={() => setMode(mode === 'rename' ? 'preview' : 'rename')}
                  title="Ubah nama berkas"
                  aria-label="Ubah nama berkas"
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-[#F3EEE3] text-[#1C241E] hover:bg-[#E7E0CF] flex items-center justify-center cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMode(mode === 'move' ? 'preview' : 'move')}
                  title="Pindahkan folder"
                  aria-label="Pindahkan folder"
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-[#F3EEE3] text-[#1C241E] hover:bg-[#E7E0CF] flex items-center justify-center cursor-pointer"
                >
                  <FolderInput className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onRequestDelete(documentFile)}
                  title="Hapus dokumen"
                  aria-label="Hapus dokumen"
                  className="min-w-[44px] min-h-[44px] rounded-xl bg-[#FDF2F0] text-[#9B2C2C] hover:bg-[#FADFD9] flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup pratinjau"
              className="min-w-[44px] min-h-[44px] rounded-xl text-[#5A645D] hover:bg-[#F3EEE3] flex items-center justify-center cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Inline Edit / Move Panels */}
        {mode === 'rename' && (
          <form
            onSubmit={handleSaveRename}
            className="px-6 py-3.5 bg-[#FAF7F0] border-b border-[#E5DEC9] flex flex-col sm:flex-row gap-2.5"
          >
            <input
              type="text"
              value={newTitle}
              maxLength={LIMITS.docTitleMax}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nama dokumen baru"
              className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#D8D0BC] text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('preview')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#E7E0CF] text-xs font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
              >
                {saving ? 'Menyimpan...' : 'Simpan Nama'}
              </button>
            </div>
          </form>
        )}

        {mode === 'move' && (
          <form
            onSubmit={handleSaveMove}
            className="px-6 py-3.5 bg-[#FAF7F0] border-b border-[#E5DEC9] flex flex-col sm:flex-row gap-2.5"
          >
            <select
              value={newFolderId}
              onChange={(e) => setNewFolderId(e.target.value)}
              className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#D8D0BC] text-sm"
            >
              <option value="root">Dokumen Utama (Teratas)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('preview')}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#E7E0CF] text-xs font-medium cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold cursor-pointer"
              >
                {saving ? 'Memindahkan...' : 'Pindahkan'}
              </button>
            </div>
          </form>
        )}

        {/* PDF Preview Area */}
        <div className="flex-1 bg-[#EFE9DA] flex flex-col items-center justify-center overflow-hidden p-2 sm:p-4">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-[#5A645D]">
              <div className="w-8 h-8 border-2 border-[#1B4332]/25 border-t-[#1B4332] rounded-full animate-spin" />
              <p className="text-sm">Memuat pratinjau PDF...</p>
            </div>
          ) : errorMsg || !blobUrl ? (
            <div className="max-w-md bg-white border border-[#E5DEC9] rounded-2xl p-6 text-center">
              <FileText className="w-8 h-8 text-[#7A847C] mx-auto mb-2" />
              <p className="text-sm text-[#1C241E] font-medium mb-1">
                Pratinjau belum dapat ditampilkan
              </p>
              <p className="text-xs text-[#5A645D] mb-4">
                {errorMsg || 'Terjadi kendala saat mengambil berkas PDF.'}
              </p>
              <button
                type="button"
                onClick={() => setAttempt((a) => a + 1)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Coba Muat Ulang
              </button>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col gap-2">
              <iframe
                src={blobUrl}
                title={documentFile.title}
                className="w-full flex-1 rounded-2xl bg-white border border-[#DFD8C6]"
              />
              <p className="text-[11px] text-center text-[#5A645D] sm:hidden">
                Jika pratinjau PDF tidak tampil di peramban ponsel Anda, ketuk tombol{' '}
                <strong>Unduh PDF</strong> di atas untuk membukanya.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
