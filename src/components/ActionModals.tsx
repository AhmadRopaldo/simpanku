import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  FolderPlus,
  ImagePlus,
  Images,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType,
  translateFirebaseError,
  uploadFileWithProgress,
} from '../firebase';
import {
  LIMITS,
  type AddActionType,
  type Album,
  type Folder,
  type UploadTaskState,
} from '../types';
import {
  extractVideoDuration,
  formatDurasi,
  formatUkuranBerkas,
  sanitizeStorageFileName,
  stripFileExtension,
  todayIsoDate,
  validateMediaFile,
  validatePdfFile,
} from '../utils/formatters';

interface AddActionSheetProps {
  open: boolean;
  onClose: () => void;
  onSelectAction: (action: AddActionType) => void;
}

export const AddActionSheet: React.FC<AddActionSheetProps> = ({
  open,
  onClose,
  onSelectAction,
}) => {
  if (!open) return null;

  const actions: {
    id: AddActionType;
    label: string;
    desc: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'upload-media',
      label: 'Unggah Foto & Video',
      desc: 'Tambahkan kenangan dari ponsel ke album',
      icon: <ImagePlus className="w-5 h-5 text-[#1B4332]" />,
    },
    {
      id: 'upload-pdf',
      label: 'Unggah PDF',
      desc: 'Simpan dokumen penting ke dalam folder',
      icon: <FileText className="w-5 h-5 text-[#1B4332]" />,
    },
    {
      id: 'create-album',
      label: 'Buat Album',
      desc: 'Kelompokkan foto dan video berdasarkan acara',
      icon: <Images className="w-5 h-5 text-[#1B4332]" />,
    },
    {
      id: 'create-folder',
      label: 'Buat Folder',
      desc: 'Atur folder atau subfolder untuk berkas PDF',
      icon: <FolderPlus className="w-5 h-5 text-[#1B4332]" />,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Menu Tambah"
    >
      <div
        className="w-full sm:max-w-md bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-xl border border-[#E5DEC9]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1.5 bg-[#DFD8C6] rounded-full mx-auto mb-4 sm:hidden" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-semibold text-[#1C241E]">
            Tambah ke Simpan-Ku
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup menu tambah"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#5A645D] hover:bg-[#F3EEE3] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5 pb-safe">
          {actions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onClose();
                onSelectAction(item.id);
              }}
              className="w-full min-h-[60px] p-3.5 rounded-2xl bg-[#FAF7F0] hover:bg-[#EFE9DA] border border-[#E5DEC9] flex items-center gap-3.5 text-left transition-colors cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-[#EBF2ED] flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-[#1C241E]">{item.label}</div>
                <div className="text-xs text-[#5A645D] mt-0.5">{item.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

interface AlbumFormModalProps {
  open: boolean;
  editingAlbum: Album | null;
  currentUid: string;
  currentUserName: string;
  onClose: () => void;
  onSaved?: (albumId: string, albumTitle: string) => void;
}

export const AlbumFormModal: React.FC<AlbumFormModalProps> = ({
  open,
  editingAlbum,
  currentUid,
  currentUserName,
  onClose,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(editingAlbum?.title ?? '');
      setDescription(editingAlbum?.description ?? '');
      setError(null);
      setSaving(false);
    }
  }, [open, editingAlbum]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const cleanDesc = description.trim();
    if (!cleanTitle) {
      setError('Judul album wajib diisi.');
      return;
    }
    if (cleanTitle.length > LIMITS.albumTitleMax) {
      setError(`Judul album maksimal ${LIMITS.albumTitleMax} karakter.`);
      return;
    }
    if (cleanDesc.length > LIMITS.albumDescMax) {
      setError(`Deskripsi album maksimal ${LIMITS.albumDescMax} karakter.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingAlbum) {
        await updateDoc(doc(db, 'albums', editingAlbum.id), {
          title: cleanTitle,
          description: cleanDesc,
          updatedAt: serverTimestamp(),
        }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `albums/${editingAlbum.id}`));
        onSaved?.(editingAlbum.id, cleanTitle);
      } else {
        const ref = await addDoc(collection(db, 'albums'), {
          title: cleanTitle,
          description: cleanDesc,
          createdByUid: currentUid,
          createdByName: currentUserName.slice(0, LIMITS.displayNameMax),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((err) => handleFirestoreError(err, OperationType.CREATE, 'albums'));
        onSaved?.(ref.id, cleanTitle);
      }
      onClose();
    } catch (err) {
      setError(translateFirebaseError(err));
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editingAlbum ? 'Ubah Album' : 'Buat Album Baru'}
    >
      <div className="w-full sm:max-w-md bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl p-6 shadow-xl border border-[#E5DEC9]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-semibold text-[#1C241E]">
            {editingAlbum ? 'Ubah Detail Album' : 'Buat Album Baru'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#5A645D] hover:bg-[#F3EEE3] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="album-title-input" className="block text-xs font-semibold text-[#3C463E] mb-1.5">
              Nama Album
            </label>
            <input
              id="album-title-input"
              type="text"
              value={title}
              maxLength={LIMITS.albumTitleMax}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Lebaran di Rumah Nenek 2026"
              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#D8D0BC] text-sm text-[#1C241E] focus:outline-none focus:border-[#1B4332]"
            />
          </div>

          <div>
            <label htmlFor="album-desc-input" className="block text-xs font-semibold text-[#3C463E] mb-1.5">
              Catatan Singkat (Opsional)
            </label>
            <textarea
              id="album-desc-input"
              rows={3}
              value={description}
              maxLength={LIMITS.albumDescMax}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cerita singkat mengenai momen di album ini..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#D8D0BC] text-sm text-[#1C241E] focus:outline-none focus:border-[#1B4332] resize-none"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-[#FDF2F0] border border-[#F5CFC9] text-xs text-[#9B2C2C]">
              {error}
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-sm font-medium hover:bg-[#E7E0CF] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-sm font-semibold hover:bg-[#143326] disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Menyimpan...' : editingAlbum ? 'Simpan Perubahan' : 'Buat Album'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface FolderFormModalProps {
  open: boolean;
  editingFolder: Folder | null;
  defaultParentId: string;
  folders: Folder[];
  currentUid: string;
  currentUserName: string;
  onClose: () => void;
  onCreated?: (folderId: string) => void;
}

export const FolderFormModal: React.FC<FolderFormModalProps> = ({
  open,
  editingFolder,
  defaultParentId,
  folders,
  currentUid,
  currentUserName,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('root');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(editingFolder?.name ?? '');
      setParentId(editingFolder?.parentId ?? defaultParentId ?? 'root');
      setError(null);
      setSaving(false);
    }
  }, [open, editingFolder, defaultParentId]);

  if (!open) return null;

  const availableParents = folders.filter((f) => f.id !== editingFolder?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Nama folder wajib diisi.');
      return;
    }
    if (cleanName.length > LIMITS.folderNameMax) {
      setError(`Nama folder maksimal ${LIMITS.folderNameMax} karakter.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (editingFolder) {
        await updateDoc(doc(db, 'folders', editingFolder.id), {
          name: cleanName,
          parentId,
          updatedAt: serverTimestamp(),
        }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `folders/${editingFolder.id}`));
      } else {
        const ref = await addDoc(collection(db, 'folders'), {
          name: cleanName,
          parentId,
          createdByUid: currentUid,
          createdByName: currentUserName.slice(0, LIMITS.displayNameMax),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((err) => handleFirestoreError(err, OperationType.CREATE, 'folders'));
        onCreated?.(ref.id);
      }
      onClose();
    } catch (err) {
      setError(translateFirebaseError(err));
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editingFolder ? 'Ubah Folder' : 'Buat Folder Baru'}
    >
      <div className="w-full sm:max-w-md bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl p-6 shadow-xl border border-[#E5DEC9]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-xl font-semibold text-[#1C241E]">
            {editingFolder ? 'Ubah Folder' : 'Buat Folder Baru'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#5A645D] hover:bg-[#F3EEE3] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="folder-name-input" className="block text-xs font-semibold text-[#3C463E] mb-1.5">
              Nama Folder
            </label>
            <input
              id="folder-name-input"
              type="text"
              value={name}
              maxLength={LIMITS.folderNameMax}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Dokumen Keluarga / Sertifikat"
              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#D8D0BC] text-sm text-[#1C241E] focus:outline-none focus:border-[#1B4332]"
            />
          </div>

          <div>
            <label htmlFor="folder-parent-select" className="block text-xs font-semibold text-[#3C463E] mb-1.5">
              Lokasi Folder Induk
            </label>
            <select
              id="folder-parent-select"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#D8D0BC] text-sm text-[#1C241E] focus:outline-none focus:border-[#1B4332]"
            >
              <option value="root">Dokumen Utama (Teratas)</option>
              {availableParents.map((f) => (
                <option key={f.id} value={f.id}>
                  Di dalam: {f.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-[#FDF2F0] border border-[#F5CFC9] text-xs text-[#9B2C2C]">
              {error}
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-sm font-medium hover:bg-[#E7E0CF] cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-sm font-semibold hover:bg-[#143326] disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Menyimpan...' : editingFolder ? 'Simpan Perubahan' : 'Buat Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface UploadMediaModalProps {
  open: boolean;
  albums: Album[];
  defaultAlbumId: string | null;
  currentUid: string;
  currentUserName: string;
  onClose: () => void;
  onRequestCreateAlbum: () => void;
}

export const UploadMediaModal: React.FC<UploadMediaModalProps> = ({
  open,
  albums,
  defaultAlbumId,
  currentUid,
  currentUserName,
  onClose,
  onRequestCreateAlbum,
}) => {
  const [selectedAlbumId, setSelectedAlbumId] = useState('');
  const [tasks, setTasks] = useState<UploadTaskState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSelectedAlbumId(defaultAlbumId || albums[0]?.id || '');
      setTasks([]);
      setIsUploading(false);
    }
  }, [open, defaultAlbumId, albums]);

  if (!open) return null;

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;

    const prepared: UploadTaskState[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const check = validateMediaFile(file);
      const durationSec = check.valid && check.mediaType === 'video' ? await extractVideoDuration(file) : 0;
      prepared.push({
        localId: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        title: stripFileExtension(file.name).slice(0, LIMITS.mediaTitleMax),
        caption: '',
        mediaDate: todayIsoDate(),
        mediaType: check.mediaType || 'photo',
        durationSec,
        progress: 0,
        status: check.valid ? 'pending' : 'error',
        validationError: check.error,
        errorMessage: check.error,
      });
    }

    setTasks((prev) => [...prev, ...prepared]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateTask = (localId: string, patch: Partial<UploadTaskState>) => {
    setTasks((prev) => prev.map((t) => (t.localId === localId ? { ...t, ...patch } : t)));
  };

  const removeTask = (localId: string) => {
    setTasks((prev) => prev.filter((t) => t.localId !== localId));
  };

  const uploadSingleTask = async (taskItem: UploadTaskState, album: Album) => {
    if (taskItem.validationError) return;
    const cleanTitle = taskItem.title.trim() || stripFileExtension(taskItem.file.name);
    const cleanCaption = (taskItem.caption || '').trim().slice(0, LIMITS.mediaCaptionMax);
    const cleanDate = LIMITS.mediaDatePattern.test(taskItem.mediaDate || '')
      ? (taskItem.mediaDate as string)
      : todayIsoDate();

    updateTask(taskItem.localId, { status: 'uploading', progress: 0, errorMessage: undefined });

    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${sanitizeStorageFileName(
      taskItem.file.name
    )}`;
    const storagePath = `media/${currentUid}/${album.id}/${uniqueName}`;

    try {
      const { promise } = uploadFileWithProgress(storagePath, taskItem.file, (pct) => {
        updateTask(taskItem.localId, { progress: pct });
      });
      await promise;

      await addDoc(collection(db, 'media'), {
        albumId: album.id,
        albumTitle: album.title.slice(0, LIMITS.albumTitleMax),
        title: cleanTitle.slice(0, LIMITS.mediaTitleMax),
        caption: cleanCaption,
        mediaDate: cleanDate,
        mediaType: taskItem.mediaType || 'photo',
        mimeType: taskItem.file.type || (taskItem.mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
        fileName: taskItem.file.name.slice(0, 180),
        fileSize: taskItem.file.size,
        durationSec: taskItem.durationSec || 0,
        storagePath,
        createdByUid: currentUid,
        createdByName: currentUserName.slice(0, LIMITS.displayNameMax),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.CREATE, 'media'));

      updateTask(taskItem.localId, { status: 'success', progress: 100 });
    } catch (err) {
      updateTask(taskItem.localId, {
        status: 'error',
        errorMessage: translateFirebaseError(err),
      });
    }
  };

  const handleStartUpload = async () => {
    const album = albums.find((a) => a.id === selectedAlbumId);
    if (!album) return;
    const pending = tasks.filter((t) => (t.status === 'pending' || t.status === 'error') && !t.validationError);
    if (pending.length === 0) return;

    setIsUploading(true);
    for (const item of pending) {
      await uploadSingleTask(item, album);
    }
    setIsUploading(false);
  };

  const allSucceeded = tasks.length > 0 && tasks.every((t) => t.status === 'success');
  const uploadableCount = tasks.filter((t) => t.status !== 'success' && !t.validationError).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Unggah Foto dan Video"
    >
      <div className="w-full sm:max-w-xl max-h-[90vh] bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-xl border border-[#E5DEC9]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EFE9DA]">
          <h3 className="font-display text-xl font-semibold text-[#1C241E]">
            Unggah Foto & Video
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            aria-label="Tutup"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#5A645D] hover:bg-[#F3EEE3] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {albums.length === 0 ? (
            <div className="rounded-2xl bg-[#FAF7F0] border border-[#E5DEC9] p-5 text-center">
              <p className="text-sm text-[#1C241E] font-medium mb-1">Belum ada album di galeri</p>
              <p className="text-xs text-[#5A645D] mb-4">
                Buat album terlebih dahulu agar foto dan video dapat tersimpan rapi.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRequestCreateAlbum();
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-sm font-semibold cursor-pointer"
              >
                Buat Album Pertama
              </button>
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="upload-album-select" className="block text-xs font-semibold text-[#3C463E] mb-1.5">
                  Pilih Album Tujuan
                </label>
                <select
                  id="upload-album-select"
                  value={selectedAlbumId}
                  disabled={isUploading}
                  onChange={(e) => setSelectedAlbumId(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#D8D0BC] text-sm text-[#1C241E] focus:outline-none focus:border-[#1B4332]"
                >
                  {albums.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFilesSelected}
                  className="hidden"
                  id="media-file-picker"
                />
                <label
                  htmlFor="media-file-picker"
                  className="w-full min-h-[96px] rounded-2xl border-2 border-dashed border-[#C7BFA8] bg-[#FAF7F0] hover:bg-[#F3EEE3] flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors"
                >
                  <Upload className="w-6 h-6 text-[#1B4332] mb-1.5" />
                  <span className="text-sm font-semibold text-[#1C241E]">
                    Pilih Foto atau Video dari Perangkat
                  </span>
                  <span className="text-xs text-[#5A645D] mt-0.5">
                    Bisa pilih banyak sekaligus · Foto maks 15 MB · Video maks 50 MB
                  </span>
                </label>
              </div>

              {tasks.length > 0 && (
                <div className="space-y-3">
                  {tasks.map((item) => (
                    <div
                      key={item.localId}
                      className="rounded-2xl border border-[#E5DEC9] bg-[#FAF7F0] p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-[#5A645D] truncate">
                            {item.file.name} · {formatUkuranBerkas(item.file.size)}
                            {item.durationSec ? ` · ${formatDurasi(item.durationSec)}` : ''}
                          </div>
                        </div>
                        {item.status !== 'uploading' && item.status !== 'success' && (
                          <button
                            type="button"
                            onClick={() => removeTask(item.localId)}
                            aria-label="Hapus dari daftar unggah"
                            className="text-xs text-[#5A645D] hover:text-[#9B2C2C] px-2 py-1 cursor-pointer"
                          >
                            Hapus
                          </button>
                        )}
                      </div>

                      {!item.validationError && item.status !== 'success' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-medium text-[#5A645D] mb-1">
                              Judul
                            </label>
                            <input
                              type="text"
                              value={item.title}
                              maxLength={LIMITS.mediaTitleMax}
                              disabled={item.status === 'uploading'}
                              onChange={(e) => updateTask(item.localId, { title: e.target.value })}
                              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-[#D8D0BC] text-xs text-[#1C241E]"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-medium text-[#5A645D] mb-1">
                              Tanggal Momen
                            </label>
                            <input
                              type="date"
                              value={item.mediaDate}
                              disabled={item.status === 'uploading'}
                              onChange={(e) => updateTask(item.localId, { mediaDate: e.target.value })}
                              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-[#D8D0BC] text-xs text-[#1C241E]"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-medium text-[#5A645D] mb-1">
                              Keterangan (Opsional)
                            </label>
                            <input
                              type="text"
                              value={item.caption}
                              maxLength={LIMITS.mediaCaptionMax}
                              disabled={item.status === 'uploading'}
                              onChange={(e) => updateTask(item.localId, { caption: e.target.value })}
                              placeholder="Tulis cerita singkat foto/video ini..."
                              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-[#D8D0BC] text-xs text-[#1C241E]"
                            />
                          </div>
                        </div>
                      )}

                      {item.status === 'uploading' && (
                        <div>
                          <div className="flex justify-between text-xs text-[#1B4332] font-medium mb-1">
                            <span>Mengunggah...</span>
                            <span className="tabular-nums">{item.progress}%</span>
                          </div>
                          <div className="w-full h-2 bg-[#E5DEC9] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#1B4332] transition-all duration-150"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {item.status === 'success' && (
                        <div className="flex items-center gap-2 text-xs font-medium text-[#1B4332]">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Berhasil diunggah ke album</span>
                        </div>
                      )}

                      {item.status === 'error' && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FDF2F0] border border-[#F5CFC9] text-xs text-[#9B2C2C]">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{item.errorMessage}</span>
                          </div>
                          {!item.validationError && (
                            <button
                              type="button"
                              onClick={() => {
                                const album = albums.find((a) => a.id === selectedAlbumId);
                                if (album) void uploadSingleTask(item, album);
                              }}
                              className="shrink-0 min-h-[36px] px-3 py-1.5 rounded-lg bg-[#9B2C2C] text-white font-medium inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Coba Lagi
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#EFE9DA] flex gap-2.5 pb-safe">
          {allSucceeded ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-sm font-semibold cursor-pointer"
            >
              Selesai
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-sm font-medium hover:bg-[#E7E0CF] cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={isUploading || uploadableCount === 0 || !selectedAlbumId}
                onClick={handleStartUpload}
                className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-sm font-semibold hover:bg-[#143326] disabled:opacity-50 cursor-pointer"
              >
                {isUploading
                  ? 'Mengunggah...'
                  : `Unggah (${uploadableCount} Berkas)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface UploadPdfModalProps {
  open: boolean;
  folders: Folder[];
  defaultFolderId: string;
  currentUid: string;
  currentUserName: string;
  onClose: () => void;
}

export const UploadPdfModal: React.FC<UploadPdfModalProps> = ({
  open,
  folders,
  defaultFolderId,
  currentUid,
  currentUserName,
  onClose,
}) => {
  const [targetFolderId, setTargetFolderId] = useState('root');
  const [tasks, setTasks] = useState<UploadTaskState[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTargetFolderId(defaultFolderId || 'root');
      setTasks([]);
      setIsUploading(false);
    }
  }, [open, defaultFolderId]);

  if (!open) return null;

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    if (fileList.length === 0) return;

    const prepared: UploadTaskState[] = fileList.map((file, i) => {
      const check = validatePdfFile(file);
      return {
        localId: `${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        title: stripFileExtension(file.name).slice(0, LIMITS.docTitleMax),
        progress: 0,
        status: check.valid ? 'pending' : 'error',
        validationError: check.error,
        errorMessage: check.error,
      };
    });

    setTasks((prev) => [...prev, ...prepared]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateTask = (localId: string, patch: Partial<UploadTaskState>) => {
    setTasks((prev) => prev.map((t) => (t.localId === localId ? { ...t, ...patch } : t)));
  };

  const uploadSinglePdf = async (taskItem: UploadTaskState) => {
    if (taskItem.validationError) return;
    const cleanTitle = taskItem.title.trim() || stripFileExtension(taskItem.file.name);

    updateTask(taskItem.localId, { status: 'uploading', progress: 0, errorMessage: undefined });

    const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${sanitizeStorageFileName(
      taskItem.file.name
    )}`;
    const storagePath = `documents/${currentUid}/${targetFolderId}/${uniqueName}`;

    try {
      const { promise } = uploadFileWithProgress(storagePath, taskItem.file, (pct) => {
        updateTask(taskItem.localId, { progress: pct });
      });
      await promise;

      await addDoc(collection(db, 'documents'), {
        folderId: targetFolderId,
        title: cleanTitle.slice(0, LIMITS.docTitleMax),
        originalFileName: taskItem.file.name.slice(0, 180),
        mimeType: 'application/pdf',
        fileSize: taskItem.file.size,
        storagePath,
        createdByUid: currentUid,
        createdByName: currentUserName.slice(0, LIMITS.displayNameMax),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.CREATE, 'documents'));

      updateTask(taskItem.localId, { status: 'success', progress: 100 });
    } catch (err) {
      updateTask(taskItem.localId, {
        status: 'error',
        errorMessage: translateFirebaseError(err),
      });
    }
  };

  const handleStartUpload = async () => {
    const pending = tasks.filter((t) => (t.status === 'pending' || t.status === 'error') && !t.validationError);
    if (pending.length === 0) return;

    setIsUploading(true);
    for (const item of pending) {
      await uploadSinglePdf(item);
    }
    setIsUploading(false);
  };

  const allSucceeded = tasks.length > 0 && tasks.every((t) => t.status === 'success');
  const uploadableCount = tasks.filter((t) => t.status !== 'success' && !t.validationError).length;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Unggah Dokumen PDF"
    >
      <div className="w-full sm:max-w-xl max-h-[90vh] bg-[#FFFFFF] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-xl border border-[#E5DEC9]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EFE9DA]">
          <h3 className="font-display text-xl font-semibold text-[#1C241E]">
            Unggah Dokumen PDF
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            aria-label="Tutup"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#5A645D] hover:bg-[#F3EEE3] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label htmlFor="pdf-folder-select" className="block text-xs font-semibold text-[#3C463E] mb-1.5">
              Simpan ke Folder
            </label>
            <select
              id="pdf-folder-select"
              value={targetFolderId}
              disabled={isUploading}
              onChange={(e) => setTargetFolderId(e.target.value)}
              className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#D8D0BC] text-sm text-[#1C241E] focus:outline-none focus:border-[#1B4332]"
            >
              <option value="root">Dokumen Utama (Teratas)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="application/pdf,.pdf"
              onChange={handleFilesSelected}
              className="hidden"
              id="pdf-file-picker"
            />
            <label
              htmlFor="pdf-file-picker"
              className="w-full min-h-[96px] rounded-2xl border-2 border-dashed border-[#C7BFA8] bg-[#FAF7F0] hover:bg-[#F3EEE3] flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors"
            >
              <FileText className="w-6 h-6 text-[#1B4332] mb-1.5" />
              <span className="text-sm font-semibold text-[#1C241E]">
                Pilih Satu atau Beberapa Berkas PDF
              </span>
              <span className="text-xs text-[#5A645D] mt-0.5">
                Hanya format .pdf · Ukuran maksimal 25 MB per berkas
              </span>
            </label>
          </div>

          {tasks.length > 0 && (
            <div className="space-y-3">
              {tasks.map((item) => (
                <div
                  key={item.localId}
                  className="rounded-2xl border border-[#E5DEC9] bg-[#FAF7F0] p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs text-[#5A645D] truncate">
                      {item.file.name} · {formatUkuranBerkas(item.file.size)}
                    </div>
                    {item.status !== 'uploading' && item.status !== 'success' && (
                      <button
                        type="button"
                        onClick={() => setTasks((prev) => prev.filter((t) => t.localId !== item.localId))}
                        className="text-xs text-[#5A645D] hover:text-[#9B2C2C] cursor-pointer"
                      >
                        Hapus
                      </button>
                    )}
                  </div>

                  {!item.validationError && item.status !== 'success' && (
                    <div>
                      <label className="block text-[11px] font-medium text-[#5A645D] mb-1">
                        Nama Dokumen
                      </label>
                      <input
                        type="text"
                        value={item.title}
                        maxLength={LIMITS.docTitleMax}
                        disabled={item.status === 'uploading'}
                        onChange={(e) => updateTask(item.localId, { title: e.target.value })}
                        className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-white border border-[#D8D0BC] text-xs text-[#1C241E]"
                      />
                    </div>
                  )}

                  {item.status === 'uploading' && (
                    <div>
                      <div className="flex justify-between text-xs text-[#1B4332] font-medium mb-1">
                        <span>Mengunggah PDF...</span>
                        <span className="tabular-nums">{item.progress}%</span>
                      </div>
                      <div className="w-full h-2 bg-[#E5DEC9] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1B4332] transition-all duration-150"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {item.status === 'success' && (
                    <div className="flex items-center gap-2 text-xs font-medium text-[#1B4332]">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>PDF berhasil disimpan</span>
                    </div>
                  )}

                  {item.status === 'error' && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-[#FDF2F0] border border-[#F5CFC9] text-xs text-[#9B2C2C]">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{item.errorMessage}</span>
                      </div>
                      {!item.validationError && (
                        <button
                          type="button"
                          onClick={() => void uploadSinglePdf(item)}
                          className="shrink-0 min-h-[36px] px-3 py-1.5 rounded-lg bg-[#9B2C2C] text-white font-medium inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          Coba Lagi
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[#EFE9DA] flex gap-2.5 pb-safe">
          {allSucceeded ? (
            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-sm font-semibold cursor-pointer"
            >
              Selesai
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-sm font-medium hover:bg-[#E7E0CF] cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                disabled={isUploading || uploadableCount === 0}
                onClick={handleStartUpload}
                className="flex-1 min-h-[48px] px-4 py-3 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-sm font-semibold hover:bg-[#143326] disabled:opacity-50 cursor-pointer"
              >
                {isUploading ? 'Mengunggah...' : `Unggah (${uploadableCount} PDF)`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
