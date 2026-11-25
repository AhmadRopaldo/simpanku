import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { FileText, Home, Images, Plus, User as UserIcon } from 'lucide-react';
import {
  auth,
  clearPrivateMediaCache,
  db,
  deleteStorageFile,
  googleProvider,
  handleFirestoreError,
  OperationType,
  translateFirebaseError,
} from './firebase';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  LIMITS,
  type AddActionType,
  type Album,
  type AppTab,
  type DocumentFile,
  type Folder,
  type GroupConfig,
  type MediaItem,
  type MemberRecord,
} from './types';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SignInScreen } from './components/SignInScreen';
import { HomeView } from './components/HomeView';
import { GalleryView } from './components/GalleryView';
import { DocumentsView } from './components/DocumentsView';
import { ProfileView } from './components/ProfileView';
import {
  AddActionSheet,
  AlbumFormModal,
  FolderFormModal,
  UploadMediaModal,
  UploadPdfModal,
} from './components/ActionModals';
import { MediaViewerModal } from './components/MediaViewerModal';
import { PdfPreviewModal } from './components/PdfPreviewModal';
import { ConfirmDeleteModal } from './components/ConfirmDeleteModal';

const DEFAULT_GROUP_CONFIG: GroupConfig = {
  groupName: 'Simpan-Ku',
  description:
    'File Storage privat untuk menyimpan album foto, video kebersamaan, dan dokumen PDF penting grup.',
  updatedByUid: '',
};

type DeleteTarget =
  | { kind: 'album'; item: Album }
  | { kind: 'media'; item: MediaItem }
  | { kind: 'folder'; item: Folder }
  | { kind: 'document'; item: DocumentFile }
  | { kind: 'member'; item: MemberRecord };

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [memberChecked, setMemberChecked] = useState(false);
  const [memberRecord, setMemberRecord] = useState<MemberRecord | null>(null);
  const [recheckNonce, setRecheckNonce] = useState(0);

  // Domain Data
  const [groupConfig, setGroupConfig] = useState<GroupConfig>(DEFAULT_GROUP_CONFIG);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);

  // Navigation & UI state
  const [activeTab, setActiveTab] = useState<AppTab>('beranda');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');

  // Modals
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [albumModalOpen, setAlbumModalOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [defaultFolderParentId, setDefaultFolderParentId] = useState<string>('root');

  const [uploadMediaOpen, setUploadMediaOpen] = useState(false);
  const [uploadMediaAlbumId, setUploadMediaAlbumId] = useState<string | null>(null);
  const [uploadPdfOpen, setUploadPdfOpen] = useState(false);
  const [uploadPdfFolderId, setUploadPdfFolderId] = useState<string>('root');

  const [viewerItems, setViewerItems] = useState<MediaItem[]>([]);
  const [viewerIndex, setViewerIndex] = useState<number>(-1);
  const [previewDoc, setPreviewDoc] = useState<DocumentFile | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 1. Auth Listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        clearPrivateMediaCache();
        setMemberRecord(null);
        setMemberChecked(true);
        setAlbums([]);
        setMedia([]);
        setFolders([]);
        setDocuments([]);
        setMembers([]);
      } else {
        setMemberChecked(false);
      }
    });
    return () => unsub();
  }, []);

  const normalizedEmail = (user?.email || '').trim().toLowerCase();
  const isBootstrappedAdmin = Boolean(
    user && user.emailVerified && normalizedEmail === BOOTSTRAPPED_ADMIN_EMAIL
  );

  // 2. Current Member Access Listener
  useEffect(() => {
    if (!user || !normalizedEmail) return;

    const memberRef = doc(db, 'members', normalizedEmail);
    const unsub = onSnapshot(
      memberRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Omit<MemberRecord, 'id'>;
          const record: MemberRecord = { id: snap.id, ...data };
          setMemberRecord(record);
          setMemberChecked(true);

          if (!record.active) {
            clearPrivateMediaCache();
          } else if (
            record.uid !== user.uid ||
            record.photoURL !== (user.photoURL || '')
          ) {
            void updateDoc(memberRef, {
              uid: user.uid,
              displayName: (user.displayName || record.displayName || normalizedEmail.split('@')[0]).slice(
                0,
                LIMITS.displayNameMax
              ),
              photoURL: (user.photoURL || '').slice(0, 500),
              updatedAt: serverTimestamp(),
            }).catch(() => {
              // Non-fatal sync error
            });
          }
        } else {
          setMemberRecord(null);
          setMemberChecked(true);

          if (isBootstrappedAdmin) {
            void setDoc(memberRef, {
              email: normalizedEmail,
              displayName: (user.displayName || 'Admin Utama').slice(0, LIMITS.displayNameMax),
              role: 'admin',
              active: true,
              uid: user.uid,
              photoURL: (user.photoURL || '').slice(0, 500),
              addedByEmail: normalizedEmail,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }).catch((err) => handleFirestoreError(err, OperationType.CREATE, `members/${normalizedEmail}`));
          }
        }
      },
      (err) => {
        setMemberRecord(null);
        setMemberChecked(true);
        handleFirestoreError(err, OperationType.GET, `members/${normalizedEmail}`);
      }
    );

    return () => unsub();
  }, [user, normalizedEmail, isBootstrappedAdmin, recheckNonce]);

  const isAuthorized = Boolean(
    user &&
      user.emailVerified &&
      (isBootstrappedAdmin || (memberRecord && memberRecord.active))
  );

  const isAdmin = Boolean(
    isAuthorized &&
      (isBootstrappedAdmin || (memberRecord?.active && memberRecord?.role === 'admin'))
  );

  // 3. Group Data Listeners (only when authorized)
  useEffect(() => {
    if (!isAuthorized) return;

    const unsubGroup = onSnapshot(
      doc(db, 'groupSettings', 'main'),
      (snap) => {
        if (snap.exists()) {
          setGroupConfig(snap.data() as GroupConfig);
        } else {
          setGroupConfig(DEFAULT_GROUP_CONFIG);
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'groupSettings/main')
    );

    const unsubAlbums = onSnapshot(
      query(collection(db, 'albums'), orderBy('createdAt', 'desc')),
      (snap) => {
        setAlbums(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Album, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'albums')
    );

    const unsubMedia = onSnapshot(
      query(collection(db, 'media'), orderBy('createdAt', 'desc')),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<MediaItem, 'id'>),
        }));
        list.sort((a, b) => (b.mediaDate || '').localeCompare(a.mediaDate || ''));
        setMedia(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'media')
    );

    const unsubFolders = onSnapshot(
      query(collection(db, 'folders'), orderBy('name', 'asc')),
      (snap) => {
        setFolders(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Folder, 'id'>) })));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'folders')
    );

    const unsubDocs = onSnapshot(
      query(collection(db, 'documents'), orderBy('createdAt', 'desc')),
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DocumentFile, 'id'>),
        }));
        setDocuments(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'documents')
    );

    return () => {
      unsubGroup();
      unsubAlbums();
      unsubMedia();
      unsubFolders();
      unsubDocs();
    };
  }, [isAuthorized]);

  // 4. Admin Member List Listener
  useEffect(() => {
    if (!isAdmin) {
      setMembers([]);
      return;
    }

    const unsubMembers = onSnapshot(
      query(collection(db, 'members'), orderBy('createdAt', 'asc')),
      (snap) => {
        setMembers(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MemberRecord, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'members')
    );

    return () => unsubMembers();
  }, [isAdmin]);

  // Keep previewDoc & viewerItems synchronized with live updates (rename / move / edit)
  const livePreviewDoc = useMemo(() => {
    if (!previewDoc) return null;
    return documents.find((d) => d.id === previewDoc.id) || null;
  }, [previewDoc, documents]);

  const liveViewerItems = useMemo(() => {
    if (viewerItems.length === 0) return [];
    const byId = new Map(media.map((m) => [m.id, m]));
    return viewerItems
      .map((item) => byId.get(item.id))
      .filter((item): item is MediaItem => Boolean(item));
  }, [viewerItems, media]);

  // Folder path helpers
  const getFolderPathItems = useCallback(
    (folderId: string): Folder[] => {
      const chain: Folder[] = [];
      let cursor = folderId;
      let guard = 0;
      while (cursor && cursor !== 'root' && guard < 20) {
        const found = folders.find((f) => f.id === cursor);
        if (!found) break;
        chain.unshift(found);
        cursor = found.parentId;
        guard += 1;
      }
      return chain;
    },
    [folders]
  );

  const getFolderPathLabel = useCallback(
    (folderId: string): string => {
      if (!folderId || folderId === 'root') return 'Dokumen Utama';
      const items = getFolderPathItems(folderId);
      if (items.length === 0) return 'Dokumen Utama';
      return ['Dokumen Utama', ...items.map((i) => i.name)].join(' / ');
    },
    [getFolderPathItems]
  );

  // Auth handlers
  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(translateFirebaseError(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    clearPrivateMediaCache();
    await signOut(auth);
  };

  const handleSelectAddAction = (action: AddActionType) => {
    if (action === 'create-album') {
      setEditingAlbum(null);
      setAlbumModalOpen(true);
    } else if (action === 'create-folder') {
      setEditingFolder(null);
      setDefaultFolderParentId(activeTab === 'dokumen' ? currentFolderId : 'root');
      setFolderModalOpen(true);
    } else if (action === 'upload-media') {
      setUploadMediaAlbumId(activeTab === 'galeri' ? selectedAlbumId : null);
      setUploadMediaOpen(true);
    } else if (action === 'upload-pdf') {
      setUploadPdfFolderId(activeTab === 'dokumen' ? currentFolderId : 'root');
      setUploadPdfOpen(true);
    }
  };

  // Recursive folder descendant collector for safe deletion
  const collectFolderTreeIds = (rootFolderId: string): string[] => {
    const result = [rootFolderId];
    const queue = [rootFolderId];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      const children = folders.filter((f) => f.parentId === current);
      for (const child of children) {
        if (!result.includes(child.id)) {
          result.push(child.id);
          queue.push(child.id);
        }
      }
    }
    return result;
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      if (deleteTarget.kind === 'media') {
        const target = deleteTarget.item;
        await deleteStorageFile(target.storagePath);
        await deleteDoc(doc(db, 'media', target.id)).catch((err) =>
          handleFirestoreError(err, OperationType.DELETE, `media/${target.id}`)
        );
        if (viewerIndex >= 0) {
          const next = viewerItems.filter((m) => m.id !== target.id);
          if (next.length === 0) {
            setViewerItems([]);
            setViewerIndex(-1);
          } else {
            setViewerItems(next);
            setViewerIndex(Math.min(viewerIndex, next.length - 1));
          }
        }
      } else if (deleteTarget.kind === 'album') {
        const album = deleteTarget.item;
        const albumMedia = media.filter((m) => m.albumId === album.id);
        for (const item of albumMedia) {
          await deleteStorageFile(item.storagePath);
          await deleteDoc(doc(db, 'media', item.id)).catch((err) =>
            handleFirestoreError(err, OperationType.DELETE, `media/${item.id}`)
          );
        }
        await deleteDoc(doc(db, 'albums', album.id)).catch((err) =>
          handleFirestoreError(err, OperationType.DELETE, `albums/${album.id}`)
        );
        if (selectedAlbumId === album.id) {
          setSelectedAlbumId(null);
        }
      } else if (deleteTarget.kind === 'document') {
        const docFile = deleteTarget.item;
        await deleteStorageFile(docFile.storagePath);
        await deleteDoc(doc(db, 'documents', docFile.id)).catch((err) =>
          handleFirestoreError(err, OperationType.DELETE, `documents/${docFile.id}`)
        );
        if (previewDoc?.id === docFile.id) {
          setPreviewDoc(null);
        }
      } else if (deleteTarget.kind === 'folder') {
        const folderIds = collectFolderTreeIds(deleteTarget.item.id);
        const docsToDelete = documents.filter((d) => folderIds.includes(d.folderId));
        for (const docFile of docsToDelete) {
          await deleteStorageFile(docFile.storagePath);
          await deleteDoc(doc(db, 'documents', docFile.id)).catch((err) =>
            handleFirestoreError(err, OperationType.DELETE, `documents/${docFile.id}`)
          );
        }
        for (const fid of folderIds.reverse()) {
          await deleteDoc(doc(db, 'folders', fid)).catch((err) =>
            handleFirestoreError(err, OperationType.DELETE, `folders/${fid}`)
          );
        }
        if (folderIds.includes(currentFolderId)) {
          setCurrentFolderId('root');
        }
      } else if (deleteTarget.kind === 'member') {
        await deleteDoc(doc(db, 'members', deleteTarget.item.email)).catch((err) =>
          handleFirestoreError(err, OperationType.DELETE, `members/${deleteTarget.item.email}`)
        );
      }
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const deleteModalCopy = useMemo(() => {
    if (!deleteTarget) return { title: '', description: '' };
    switch (deleteTarget.kind) {
      case 'album':
        return {
          title: `Hapus Album "${deleteTarget.item.title}"?`,
          description:
            'Seluruh foto dan video di dalam album ini juga akan dihapus permanen.',
        };
      case 'media':
        return {
          title: `Hapus "${deleteTarget.item.title}"?`,
          description:
            'Kenangan ini akan dihapus secara permanen dari album dan penyimpanan grup.',
        };
      case 'folder':
        return {
          title: `Hapus Folder "${deleteTarget.item.name}"?`,
          description:
            'Seluruh subfolder dan berkas PDF di dalamnya akan ikut dihapus permanen.',
        };
      case 'document':
        return {
          title: `Hapus Dokumen "${deleteTarget.item.title}"?`,
          description:
            'Berkas PDF ini akan dihapus permanen dan tidak dapat dipulihkan.',
        };
      case 'member':
        return {
          title: `Hapus Anggota "${deleteTarget.item.email}"?`,
          description:
            'Anggota ini akan langsung kehilangan akses ke seluruh album dan dokumen grup.',
        };
    }
  }, [deleteTarget]);

  // Loading Splash
  if (!authReady || (user && !memberChecked)) {
    return (
      <div className="min-h-screen bg-[#FAF7F0] flex flex-col items-center justify-center p-6 gap-3">
        <div className="w-9 h-9 border-2 border-[#1B4332]/20 border-t-[#1B4332] rounded-full animate-spin" />
        <p className="text-sm text-[#5A645D]">Memeriksa akses Simpan-Ku...</p>
      </div>
    );
  }

  // Unauthenticated or Unapproved/Revoked Screen
  if (!user || !isAuthorized) {
    const deniedReason: 'not-approved' | 'revoked' | null = user
      ? memberRecord && !memberRecord.active
        ? 'revoked'
        : 'not-approved'
      : null;

    return (
      <SignInScreen
        user={user}
        authLoading={authLoading}
        accessDeniedReason={deniedReason}
        authError={authError}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onRecheckAccess={() => setRecheckNonce((n) => n + 1)}
      />
    );
  }

  const currentUserName =
    user.displayName || memberRecord?.displayName || normalizedEmail.split('@')[0] || 'Anggota';

  const navItems: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: 'beranda', label: 'Beranda', icon: <Home className="w-5 h-5" /> },
    { id: 'galeri', label: 'Galeri', icon: <Images className="w-5 h-5" /> },
    { id: 'dokumen', label: 'Dokumen', icon: <FileText className="w-5 h-5" /> },
    { id: 'profil', label: 'Profil', icon: <UserIcon className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-[#FAF7F0] text-[#1C241E] pb-24 md:pb-12">
      {/* Sticky Top Header (Mobile compact <= 48px, Desktop 3-zone contract) */}
      <header className="sticky top-0 z-30 bg-[#FAF7F0]/90 backdrop-blur-md border-b border-[#E5DEC9]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 md:h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('beranda')}
            className="font-display text-lg md:text-xl font-semibold tracking-tight text-[#1B4332] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Simpan-Ku
          </button>

          <nav className="hidden md:flex items-center gap-6" aria-label="Navigasi utama">
            {navItems.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[44px] px-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                  activeTab === tab.id
                    ? 'border-[#1B4332] text-[#1B4332] font-semibold'
                    : 'border-transparent text-[#5A645D] hover:text-[#1C241E]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={() => setAddSheetOpen(true)}
            className="min-h-[38px] md:min-h-[42px] px-3.5 md:px-4 py-1.5 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-[#143326] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8">
        {activeTab === 'beranda' && (
          <HomeView
            groupConfig={groupConfig}
            albums={albums}
            media={media}
            documents={documents}
            folders={folders}
            onOpenAddMenu={() => setAddSheetOpen(true)}
            onOpenAlbum={(albumId) => {
              setSelectedAlbumId(albumId);
              setActiveTab('galeri');
            }}
            onGoToGallery={() => {
              setSelectedAlbumId(null);
              setActiveTab('galeri');
            }}
            onGoToDocuments={() => {
              setActiveTab('dokumen');
            }}
            onPreviewDocument={(docFile) => setPreviewDoc(docFile)}
            getFolderPathLabel={getFolderPathLabel}
          />
        )}

        {activeTab === 'galeri' && (
          <GalleryView
            albums={albums}
            media={media}
            selectedAlbumId={selectedAlbumId}
            currentUid={user.uid}
            isAdmin={isAdmin}
            onSelectAlbum={(albumId) => setSelectedAlbumId(albumId)}
            onCreateAlbum={() => {
              setEditingAlbum(null);
              setAlbumModalOpen(true);
            }}
            onEditAlbum={(album) => {
              setEditingAlbum(album);
              setAlbumModalOpen(true);
            }}
            onDeleteAlbum={(album) => setDeleteTarget({ kind: 'album', item: album })}
            onUploadMedia={(albumId) => {
              setUploadMediaAlbumId(albumId);
              setUploadMediaOpen(true);
            }}
            onOpenMediaViewer={(items, index) => {
              setViewerItems(items);
              setViewerIndex(index);
            }}
          />
        )}

        {activeTab === 'dokumen' && (
          <DocumentsView
            folders={folders}
            documents={documents}
            currentFolderId={currentFolderId}
            currentUid={user.uid}
            isAdmin={isAdmin}
            onSelectFolder={(folderId) => setCurrentFolderId(folderId)}
            onCreateFolder={(parentId) => {
              setEditingFolder(null);
              setDefaultFolderParentId(parentId);
              setFolderModalOpen(true);
            }}
            onEditFolder={(folder) => {
              setEditingFolder(folder);
              setDefaultFolderParentId(folder.parentId);
              setFolderModalOpen(true);
            }}
            onDeleteFolder={(folder) => setDeleteTarget({ kind: 'folder', item: folder })}
            onUploadPdf={(folderId) => {
              setUploadPdfFolderId(folderId);
              setUploadPdfOpen(true);
            }}
            onPreviewDocument={(docFile) => setPreviewDoc(docFile)}
            onDeleteDocument={(docFile) => setDeleteTarget({ kind: 'document', item: docFile })}
            getFolderPathItems={getFolderPathItems}
            getFolderPathLabel={getFolderPathLabel}
          />
        )}

        {activeTab === 'profil' && (
          <ProfileView
            user={user}
            isAdmin={isAdmin}
            groupConfig={groupConfig}
            members={members}
            onSignOut={handleSignOut}
            onRequestDeleteMember={(member) => setDeleteTarget({ kind: 'member', item: member })}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi bawah"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FAF7F0]/95 backdrop-blur-md border-t border-[#E5DEC9] pb-safe"
      >
        <div className="grid grid-cols-4 h-[60px] items-center">
          {navItems.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  active ? 'text-[#1B4332] font-semibold' : 'text-[#6B756D]'
                }`}
              >
                {tab.icon}
                <span className="text-[11px] leading-none">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals & Viewers */}
      <AddActionSheet
        open={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        onSelectAction={handleSelectAddAction}
      />

      <AlbumFormModal
        open={albumModalOpen}
        editingAlbum={editingAlbum}
        currentUid={user.uid}
        currentUserName={currentUserName}
        onClose={() => setAlbumModalOpen(false)}
        onSaved={(albumId) => {
          if (!editingAlbum) {
            setSelectedAlbumId(albumId);
            setActiveTab('galeri');
          }
        }}
      />

      <FolderFormModal
        open={folderModalOpen}
        editingFolder={editingFolder}
        defaultParentId={defaultFolderParentId}
        folders={folders}
        currentUid={user.uid}
        currentUserName={currentUserName}
        onClose={() => setFolderModalOpen(false)}
        onCreated={(folderId) => {
          if (!editingFolder) {
            setCurrentFolderId(folderId);
            setActiveTab('dokumen');
          }
        }}
      />

      <UploadMediaModal
        open={uploadMediaOpen}
        albums={albums}
        defaultAlbumId={uploadMediaAlbumId}
        currentUid={user.uid}
        currentUserName={currentUserName}
        onClose={() => setUploadMediaOpen(false)}
        onRequestCreateAlbum={() => {
          setEditingAlbum(null);
          setAlbumModalOpen(true);
        }}
      />

      <UploadPdfModal
        open={uploadPdfOpen}
        folders={folders}
        defaultFolderId={uploadPdfFolderId}
        currentUid={user.uid}
        currentUserName={currentUserName}
        onClose={() => setUploadPdfOpen(false)}
      />

      <MediaViewerModal
        items={liveViewerItems}
        currentIndex={viewerIndex}
        albums={albums}
        currentUid={user.uid}
        isAdmin={isAdmin}
        onClose={() => {
          setViewerItems([]);
          setViewerIndex(-1);
        }}
        onChangeIndex={(idx) => setViewerIndex(idx)}
        onRequestDelete={(item) => setDeleteTarget({ kind: 'media', item })}
      />

      <PdfPreviewModal
        documentFile={livePreviewDoc}
        folders={folders}
        folderPathLabel={livePreviewDoc ? getFolderPathLabel(livePreviewDoc.folderId) : ''}
        currentUid={user.uid}
        isAdmin={isAdmin}
        onClose={() => setPreviewDoc(null)}
        onRequestDelete={(docFile) => setDeleteTarget({ kind: 'document', item: docFile })}
      />

      <ConfirmDeleteModal
        open={Boolean(deleteTarget)}
        title={deleteModalCopy.title}
        description={deleteModalCopy.description}
        loading={deleting}
        onConfirm={() => void handleConfirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
