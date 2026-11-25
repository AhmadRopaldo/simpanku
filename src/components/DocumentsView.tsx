import React, { useMemo, useState } from 'react';
import {
  ChevronRight,
  Download,
  Edit3,
  FilePlus2,
  FileText,
  Folder as FolderIcon,
  FolderInput,
  FolderOpen,
  FolderPlus,
  Search,
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

interface DocumentsViewProps {
  folders: Folder[];
  documents: DocumentFile[];
  currentFolderId: string;
  currentUid: string;
  isAdmin: boolean;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (parentId: string) => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onUploadPdf: (folderId: string) => void;
  onPreviewDocument: (docFile: DocumentFile) => void;
  onDeleteDocument: (docFile: DocumentFile) => void;
  getFolderPathItems: (folderId: string) => Folder[];
  getFolderPathLabel: (folderId: string) => string;
}

export const DocumentsView: React.FC<DocumentsViewProps> = ({
  folders,
  documents,
  currentFolderId,
  currentUid,
  isAdmin,
  onSelectFolder,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onUploadPdf,
  onPreviewDocument,
  onDeleteDocument,
  getFolderPathItems,
  getFolderPathLabel,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Inline rename / move modal state for a document
  const [editingDoc, setEditingDoc] = useState<DocumentFile | null>(null);
  const [editMode, setEditMode] = useState<'rename' | 'move'>('rename');
  const [docTitleInput, setDocTitleInput] = useState('');
  const [docTargetFolderId, setDocTargetFolderId] = useState('root');
  const [savingDoc, setSavingDoc] = useState(false);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const breadcrumbs = useMemo(
    () => getFolderPathItems(currentFolderId),
    [currentFolderId, getFolderPathItems]
  );

  const visibleFolders = useMemo(() => {
    if (normalizedQuery) {
      return folders.filter((f) => f.name.toLowerCase().includes(normalizedQuery));
    }
    return folders.filter((f) => f.parentId === currentFolderId);
  }, [folders, currentFolderId, normalizedQuery]);

  const visibleDocuments = useMemo(() => {
    if (normalizedQuery) {
      return documents.filter((d) => {
        const folderLabel = getFolderPathLabel(d.folderId);
        return (
          d.title.toLowerCase().includes(normalizedQuery) ||
          d.originalFileName.toLowerCase().includes(normalizedQuery) ||
          folderLabel.toLowerCase().includes(normalizedQuery)
        );
      });
    }
    return documents.filter((d) => d.folderId === currentFolderId);
  }, [documents, currentFolderId, normalizedQuery, getFolderPathLabel]);

  const handleDirectDownload = async (docFile: DocumentFile) => {
    setDownloadingId(docFile.id);
    setActionError(null);
    try {
      const blob = await fetchPrivateStorageBlob(docFile.storagePath);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docFile.originalFileName || `${docFile.title}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setActionError(translateFirebaseError(err));
    } finally {
      setDownloadingId(null);
    }
  };

  const openDocEdit = (docFile: DocumentFile, mode: 'rename' | 'move') => {
    setEditingDoc(docFile);
    setEditMode(mode);
    setDocTitleInput(docFile.title);
    setDocTargetFolderId(docFile.folderId);
    setActionError(null);
  };

  const handleSaveDocEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoc) return;
    setSavingDoc(true);
    setActionError(null);
    try {
      if (editMode === 'rename') {
        const clean = docTitleInput.trim();
        if (!clean) {
          setActionError('Nama dokumen tidak boleh kosong.');
          setSavingDoc(false);
          return;
        }
        await updateDoc(doc(db, 'documents', editingDoc.id), {
          title: clean.slice(0, LIMITS.docTitleMax),
          updatedAt: serverTimestamp(),
        }).catch((err) =>
          handleFirestoreError(err, OperationType.UPDATE, `documents/${editingDoc.id}`)
        );
      } else {
        await updateDoc(doc(db, 'documents', editingDoc.id), {
          folderId: docTargetFolderId,
          updatedAt: serverTimestamp(),
        }).catch((err) =>
          handleFirestoreError(err, OperationType.UPDATE, `documents/${editingDoc.id}`)
        );
      }
      setEditingDoc(null);
    } catch (err) {
      setActionError(translateFirebaseError(err));
    } finally {
      setSavingDoc(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#1C241E]">
            Dokumen PDF
          </h1>
          <p className="text-xs sm:text-sm text-[#5A645D] mt-1">
            Susun surat, akta, dan dokumen penting grup dalam folder
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCreateFolder(currentFolderId)}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-xs sm:text-sm font-medium inline-flex items-center gap-2 hover:bg-[#E7E0CF] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-[#1B4332]" />
            <span>Buat Folder</span>
          </button>

          <button
            type="button"
            onClick={() => onUploadPdf(currentFolderId)}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#143326] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Unggah PDF</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#6B756D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cari nama berkas PDF atau nama folder..."
          className="w-full min-h-[46px] pl-10 pr-10 py-2.5 rounded-xl bg-[#FFFFFF] border border-[#E5DEC9] text-sm text-[#1C241E] placeholder:text-[#7A847C] focus:outline-none focus:border-[#1B4332]"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            aria-label="Hapus pencarian"
            className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-[#5A645D] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Breadcrumb Path */}
      {!normalizedQuery && (
        <nav
          aria-label="Jalur folder saat ini"
          className="flex flex-wrap items-center gap-1 text-xs sm:text-sm bg-[#F3EEE3]/70 px-3.5 py-2 rounded-xl border border-[#E5DEC9]"
        >
          <button
            type="button"
            onClick={() => onSelectFolder('root')}
            className={`min-h-[36px] px-2 rounded-lg font-medium transition-colors cursor-pointer ${
              currentFolderId === 'root'
                ? 'text-[#1B4332] font-semibold'
                : 'text-[#5A645D] hover:text-[#1C241E]'
            }`}
          >
            Dokumen Utama
          </button>
          {breadcrumbs.map((folder, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <React.Fragment key={folder.id}>
                <ChevronRight className="w-4 h-4 text-[#8C948D] shrink-0" />
                <button
                  type="button"
                  onClick={() => onSelectFolder(folder.id)}
                  className={`min-h-[36px] px-2 rounded-lg transition-colors truncate max-w-[180px] cursor-pointer ${
                    isLast
                      ? 'text-[#1B4332] font-semibold'
                      : 'text-[#5A645D] hover:text-[#1C241E] font-medium'
                  }`}
                >
                  {folder.name}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {actionError && (
        <div className="p-3.5 rounded-xl bg-[#FDF2F0] border border-[#F5CFC9] text-xs text-[#9B2C2C]">
          {actionError}
        </div>
      )}

      {/* Subfolders Section */}
      {visibleFolders.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-[#5A645D] mb-2.5">
            {normalizedQuery ? `Folder yang Cocok (${visibleFolders.length})` : 'Folder'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleFolders.map((folder) => {
              const subCount =
                folders.filter((f) => f.parentId === folder.id).length +
                documents.filter((d) => d.folderId === folder.id).length;
              const canManage = isAdmin || folder.createdByUid === currentUid;

              return (
                <div
                  key={folder.id}
                  className="rounded-2xl bg-[#FFFFFF] border border-[#E5DEC9] hover:border-[#1B4332]/40 transition-colors p-3.5 flex items-center justify-between gap-2"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      onSelectFolder(folder.id);
                    }}
                    className="min-w-0 flex-1 flex items-center gap-3 text-left min-h-[44px] cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#EBF2ED] text-[#1B4332] flex items-center justify-center shrink-0">
                      <FolderIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#1C241E] truncate">
                        {folder.name}
                      </div>
                      <div className="text-xs text-[#5A645D] truncate tabular-nums">
                        {normalizedQuery
                          ? getFolderPathLabel(folder.parentId)
                          : `${subCount} item`}
                      </div>
                    </div>
                  </button>

                  {canManage && (
                    <div className="flex items-center shrink-0">
                      <button
                        type="button"
                        onClick={() => onEditFolder(folder)}
                        title="Ubah atau pindahkan folder"
                        aria-label={`Ubah folder ${folder.name}`}
                        className="min-w-[40px] min-h-[40px] rounded-xl text-[#5A645D] hover:bg-[#F3EEE3] flex items-center justify-center cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteFolder(folder)}
                        title="Hapus folder"
                        aria-label={`Hapus folder ${folder.name}`}
                        className="min-w-[40px] min-h-[40px] rounded-xl text-[#9B2C2C] hover:bg-[#FDF2F0] flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Documents List */}
      <section>
        {visibleDocuments.length > 0 && (
          <h2 className="text-xs font-semibold text-[#5A645D] mb-2.5">
            {normalizedQuery ? `Berkas PDF yang Cocok (${visibleDocuments.length})` : 'Berkas PDF'}
          </h2>
        )}

        {visibleFolders.length === 0 && visibleDocuments.length === 0 ? (
          <div className="rounded-3xl bg-[#FFFFFF] border border-[#E5DEC9] p-10 text-center">
            <FolderOpen className="w-10 h-10 text-[#7A847C] mx-auto mb-3" />
            <h2 className="font-display text-xl font-semibold text-[#1C241E] mb-1.5">
              {normalizedQuery ? 'Dokumen atau Folder Tidak Ditemukan' : 'Folder Ini Masih Kosong'}
            </h2>
            <p className="text-sm text-[#5A645D] max-w-md mx-auto mb-5">
              {normalizedQuery
                ? 'Coba kata kunci lain untuk menemukan dokumen PDF atau folder.'
                : 'Tambahkan subfolder baru atau unggah satu maupun beberapa berkas PDF langsung ke folder ini.'}
            </p>
            {!normalizedQuery && (
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onCreateFolder(currentFolderId)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-xs font-semibold cursor-pointer"
                >
                  Buat Folder
                </button>
                <button
                  type="button"
                  onClick={() => onUploadPdf(currentFolderId)}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-xs font-semibold cursor-pointer"
                >
                  Unggah PDF
                </button>
              </div>
            )}
          </div>
        ) : visibleDocuments.length > 0 ? (
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#E5DEC9] divide-y divide-[#EFE9DA] overflow-hidden">
            {visibleDocuments.map((docFile) => {
              const canManage = isAdmin || docFile.createdByUid === currentUid;
              const pathLabel = getFolderPathLabel(docFile.folderId);

              return (
                <div
                  key={docFile.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAF7F0]/70 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => onPreviewDocument(docFile)}
                    className="min-w-0 flex-1 flex items-start sm:items-center gap-3.5 text-left cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-xl bg-[#EBF2ED] text-[#1B4332] flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-[#1C241E] truncate">
                        {docFile.title}
                      </div>
                      <div className="text-xs text-[#5A645D] mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 tabular-nums">
                        <span>{pathLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatUkuranBerkas(docFile.fileSize)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatTanggal(docFile.createdAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{docFile.createdByName}</span>
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDirectDownload(docFile)}
                      disabled={downloadingId === docFile.id}
                      title="Unduh PDF"
                      aria-label={`Unduh ${docFile.title}`}
                      className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[#F3EEE3] text-[#1C241E] hover:bg-[#E7E0CF] text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span className="sm:hidden lg:inline">
                        {downloadingId === docFile.id ? 'Mengunduh...' : 'Unduh'}
                      </span>
                    </button>

                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={() => openDocEdit(docFile, 'rename')}
                          title="Ubah nama"
                          aria-label={`Ubah nama ${docFile.title}`}
                          className="min-w-[44px] min-h-[44px] rounded-xl text-[#5A645D] hover:bg-[#F3EEE3] flex items-center justify-center cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDocEdit(docFile, 'move')}
                          title="Pindahkan ke folder lain"
                          aria-label={`Pindahkan ${docFile.title}`}
                          className="min-w-[44px] min-h-[44px] rounded-xl text-[#5A645D] hover:bg-[#F3EEE3] flex items-center justify-center cursor-pointer"
                        >
                          <FolderInput className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteDocument(docFile)}
                          title="Hapus dokumen"
                          aria-label={`Hapus ${docFile.title}`}
                          className="min-w-[44px] min-h-[44px] rounded-xl text-[#9B2C2C] hover:bg-[#FDF2F0] flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      {/* Rename / Move Document Modal */}
      {editingDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editMode === 'rename' ? 'Ubah Nama Dokumen' : 'Pindahkan Dokumen'}
        >
          <div className="w-full sm:max-w-md bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl p-6 shadow-xl border border-[#E5DEC9]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-xl font-semibold text-[#1C241E]">
                {editMode === 'rename' ? 'Ubah Nama Dokumen' : 'Pindahkan ke Folder'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                aria-label="Tutup"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#5A645D] hover:bg-[#F3EEE3] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDocEdit} className="space-y-4">
              {editMode === 'rename' ? (
                <div>
                  <label className="block text-xs font-semibold text-[#3C463E] mb-1.5">
                    Nama Dokumen
                  </label>
                  <input
                    type="text"
                    value={docTitleInput}
                    maxLength={LIMITS.docTitleMax}
                    onChange={(e) => setDocTitleInput(e.target.value)}
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#D8D0BC] text-sm text-[#1C241E]"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-[#3C463E] mb-1.5">
                    Pilih Folder Tujuan
                  </label>
                  <select
                    value={docTargetFolderId}
                    onChange={(e) => setDocTargetFolderId(e.target.value)}
                    className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#D8D0BC] text-sm text-[#1C241E]"
                  >
                    <option value="root">Dokumen Utama (Teratas)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {getFolderPathLabel(f.id)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-sm font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingDoc}
                  className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-sm font-semibold cursor-pointer"
                >
                  {savingDoc ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
