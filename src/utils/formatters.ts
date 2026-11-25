import { Timestamp } from 'firebase/firestore';
import { MAX_PDF_BYTES, MAX_PHOTO_BYTES, MAX_VIDEO_BYTES } from '../types';

export function formatTanggal(value?: Timestamp | string | Date | null): string {
  if (!value) return 'Baru saja';

  let date: Date;
  if (value instanceof Timestamp) {
    date = value.toDate();
  } else if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      date = new Date(y, m - 1, d);
    } else {
      date = new Date(value);
    }
  } else {
    date = value;
  }

  if (Number.isNaN(date.getTime())) return 'Tanggal tidak valid';

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatUkuranBerkas(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val < 10 && idx > 0 ? val.toFixed(1) : Math.round(val)} ${units[idx]}`;
}

export function formatDurasi(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const rounded = Math.round(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function sanitizeStorageFileName(fileName: string): string {
  const cleaned = fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 120);
  return cleaned || 'berkas';
}

export function stripFileExtension(fileName: string): string {
  return fileName.replace(/\.[^/.]+$/, '').trim() || fileName;
}

export function validateMediaFile(file: File): {
  valid: boolean;
  mediaType?: 'photo' | 'video';
  error?: string;
} {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  if (!isImage && !isVideo) {
    return {
      valid: false,
      error: `Format "${file.name}" tidak didukung. Pilih berkas foto (JPG, PNG, WebP, HEIC) atau video (MP4, MOV, WebM).`,
    };
  }

  if (isImage && file.size > MAX_PHOTO_BYTES) {
    return {
      valid: false,
      error: `Ukuran foto "${file.name}" (${formatUkuranBerkas(file.size)}) melebihi batas maksimal 15 MB.`,
    };
  }

  if (isVideo && file.size > MAX_VIDEO_BYTES) {
    return {
      valid: false,
      error: `Ukuran video "${file.name}" (${formatUkuranBerkas(file.size)}) melebihi batas maksimal 50 MB.`,
    };
  }

  if (file.size <= 0) {
    return {
      valid: false,
      error: `Berkas "${file.name}" kosong dan tidak dapat diunggah.`,
    };
  }

  return {
    valid: true,
    mediaType: isVideo ? 'video' : 'photo',
  };
}

export function validatePdfFile(file: File): { valid: boolean; error?: string } {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return {
      valid: false,
      error: `Berkas "${file.name}" bukan PDF. Hanya dokumen dengan format .pdf yang diizinkan.`,
    };
  }
  if (file.size <= 0) {
    return {
      valid: false,
      error: `Berkas "${file.name}" kosong dan tidak dapat diunggah.`,
    };
  }
  if (file.size > MAX_PDF_BYTES) {
    return {
      valid: false,
      error: `Ukuran "${file.name}" (${formatUkuranBerkas(file.size)}) melebihi batas maksimal 25 MB.`,
    };
  }
  return { valid: true };
}

export function extractVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/')) {
      resolve(0);
      return;
    }
    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.remove();
    };

    const timer = window.setTimeout(() => {
      cleanup();
      resolve(0);
    }, 4000);

    video.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const duration = Number.isFinite(video.duration) ? Math.round(video.duration) : 0;
      cleanup();
      resolve(duration);
    };

    video.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      resolve(0);
    };

    video.src = objectUrl;
  });
}
