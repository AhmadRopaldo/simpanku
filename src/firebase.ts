import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import {
  deleteObject,
  getBlob,
  getStorage,
  ref,
  uploadBytesResumable,
  type UploadTask,
} from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app, firebaseConfig.storageBucket);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Koneksi Firebase bermasalah. Periksa konfigurasi Firebase Anda.');
    }
  }
}

void testConnection();

export function translateFirebaseError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string })?.code ?? '';

  if (code === 'auth/popup-closed-by-user' || raw.includes('popup-closed-by-user')) {
    return 'Jendela masuk Google ditutup sebelum proses selesai.';
  }
  if (code === 'auth/popup-blocked' || raw.includes('popup-blocked')) {
    return 'Popup diblokir oleh peramban. Izinkan popup untuk masuk dengan Google.';
  }
  if (code === 'auth/network-request-failed' || raw.includes('network-request-failed')) {
    return 'Koneksi internet terputus. Periksa jaringan Anda lalu coba lagi.';
  }
  if (
    code === 'storage/unauthorized' ||
    raw.includes('storage/unauthorized') ||
    raw.includes('permission-denied') ||
    raw.includes('Missing or insufficient permissions')
  ) {
    return 'Akses ditolak. Pastikan akun Anda aktif sebagai anggota grup dan aturan Firebase Storage sudah diterbitkan.';
  }
  if (
    code === 'storage/bucket-not-found' ||
    code === 'storage/project-not-found' ||
    raw.includes('storage/bucket-not-found')
  ) {
    return 'Firebase Storage belum aktif di proyek ini. Aktifkan Storage di Firebase Console terlebih dahulu.';
  }
  if (code === 'storage/retry-limit-exceeded' || raw.includes('retry-limit-exceeded')) {
    return 'Waktu unggah habis karena jaringan lambat. Silakan coba unggah ulang.';
  }
  if (code === 'storage/canceled' || raw.includes('storage/canceled')) {
    return 'Pengunggahan dibatalkan.';
  }
  if (code === 'storage/object-not-found' || raw.includes('storage/object-not-found')) {
    return 'Berkas tidak ditemukan di penyimpanan.';
  }
  if (raw.includes('Quota exceeded')) {
    return 'Kuota harian Firestore terlampaui. Silakan coba lagi besok atau periksa paket Firebase Anda.';
  }
  return 'Terjadi kesalahan saat memproses permintaan. Silakan coba lagi.';
}

// Authenticated private media cache (enforces Storage rules on every fetch)
const objectUrlPromiseCache = new Map<string, Promise<string>>();
const resolvedObjectUrls = new Map<string, string>();

export function fetchPrivateStorageUrl(storagePath: string): Promise<string> {
  if (!storagePath) {
    return Promise.reject(new Error('Path berkas kosong.'));
  }
  const existing = objectUrlPromiseCache.get(storagePath);
  if (existing) {
    return existing;
  }

  const storageRef = ref(storage, storagePath);
  const promise = getBlob(storageRef)
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      resolvedObjectUrls.set(storagePath, url);
      return url;
    })
    .catch((err) => {
      objectUrlPromiseCache.delete(storagePath);
      throw err;
    });

  objectUrlPromiseCache.set(storagePath, promise);
  return promise;
}

export async function fetchPrivateStorageBlob(storagePath: string): Promise<Blob> {
  const storageRef = ref(storage, storagePath);
  return getBlob(storageRef);
}

export function clearPrivateMediaCache() {
  for (const url of resolvedObjectUrls.values()) {
    URL.revokeObjectURL(url);
  }
  resolvedObjectUrls.clear();
  objectUrlPromiseCache.clear();
}

export function invalidatePrivateMediaCacheEntry(storagePath: string) {
  const url = resolvedObjectUrls.get(storagePath);
  if (url) {
    URL.revokeObjectURL(url);
    resolvedObjectUrls.delete(storagePath);
  }
  objectUrlPromiseCache.delete(storagePath);
}

export function uploadFileWithProgress(
  storagePath: string,
  file: File,
  onProgress: (percent: number) => void
): { task: UploadTask; promise: Promise<void> } {
  const storageRef = ref(storage, storagePath);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
  });

  const promise = new Promise<void>((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        const pct = snapshot.totalBytes
          ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          : 0;
        onProgress(pct);
      },
      (error) => {
        reject(error);
      },
      () => {
        onProgress(100);
        resolve();
      }
    );
  });

  return { task, promise };
}

export async function deleteStorageFile(storagePath: string): Promise<void> {
  if (!storagePath) return;
  invalidatePrivateMediaCacheEntry(storagePath);
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== 'storage/object-not-found') {
      throw err;
    }
  }
}

export { firebaseConfig };
