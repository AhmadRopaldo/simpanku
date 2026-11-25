import type { Timestamp } from 'firebase/firestore';

export type AppTab = 'beranda' | 'galeri' | 'dokumen' | 'profil';

export type AddActionType = 'upload-media' | 'upload-pdf' | 'create-album' | 'create-folder';

export type MemberRole = 'admin' | 'member';

export type MediaFilterType = 'semua' | 'photo' | 'video';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'ahmadropaldo@gmail.com';

export const MAX_PHOTO_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB

export const LIMITS = {
  groupNameMax: 80,
  groupDescMax: 240,
  displayNameMax: 80,
  emailMax: 128,
  emailPattern: /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/,
  idPattern: /^[a-zA-Z0-9_-]+$/,
  albumTitleMax: 100,
  albumDescMax: 400,
  mediaTitleMax: 120,
  mediaCaptionMax: 600,
  mediaDatePattern: /^\d{4}-\d{2}-\d{2}$/,
  folderNameMax: 100,
  docTitleMax: 150,
} as const;

export interface GroupConfig {
  groupName: string;
  description: string;
  updatedAt?: Timestamp;
  updatedByUid: string;
}

export interface MemberRecord {
  id: string; // lowercase email
  email: string;
  displayName: string;
  role: MemberRole;
  active: boolean;
  uid: string;
  photoURL: string;
  addedByEmail: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Album {
  id: string;
  title: string;
  description: string;
  createdByUid: string;
  createdByName: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface MediaItem {
  id: string;
  albumId: string;
  albumTitle: string;
  title: string;
  caption: string;
  mediaDate: string; // YYYY-MM-DD
  mediaType: 'photo' | 'video';
  mimeType: string;
  fileName: string;
  fileSize: number;
  durationSec: number;
  storagePath: string;
  createdByUid: string;
  createdByName: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string; // 'root' or parent folder id
  createdByUid: string;
  createdByName: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface DocumentFile {
  id: string;
  folderId: string; // 'root' or folder id
  title: string;
  originalFileName: string;
  mimeType: 'application/pdf';
  fileSize: number;
  storagePath: string;
  createdByUid: string;
  createdByName: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UploadTaskState {
  localId: string;
  file: File;
  title: string;
  caption?: string;
  mediaDate?: string;
  mediaType?: 'photo' | 'video';
  durationSec?: number;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMessage?: string;
  validationError?: string;
}
