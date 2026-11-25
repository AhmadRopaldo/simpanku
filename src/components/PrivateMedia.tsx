import React, { useEffect, useState } from 'react';
import { Film, ImageOff, Play, RefreshCw } from 'lucide-react';
import { fetchPrivateStorageUrl, invalidatePrivateMediaCacheEntry, translateFirebaseError } from '../firebase';
import { formatDurasi } from '../utils/formatters';

interface PrivateImageProps {
  storagePath: string;
  alt: string;
  className?: string;
  aspectClass?: string;
}

export const PrivateImage: React.FC<PrivateImageProps> = ({
  storagePath,
  alt,
  className = 'w-full h-full object-cover',
  aspectClass = 'w-full h-full',
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg(null);

    fetchPrivateStorageUrl(storagePath)
      .then((objectUrl) => {
        if (active) {
          setUrl(objectUrl);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setErrorMsg(translateFirebaseError(err));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [storagePath, attempt]);

  if (loading) {
    return <div className={`${aspectClass} bg-[#EFE9DA] animate-pulse`} aria-label="Memuat foto..." />;
  }

  if (errorMsg || !url) {
    return (
      <div
        className={`${aspectClass} bg-[#F3EEE3] flex flex-col items-center justify-center p-3 text-center gap-1.5`}
      >
        <ImageOff className="w-5 h-5 text-[#7A847C]" />
        <span className="text-[11px] text-[#5A645D] line-clamp-2">{alt}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            invalidatePrivateMediaCacheEntry(storagePath);
            setAttempt((a) => a + 1);
          }}
          className="text-[11px] font-medium text-[#1B4332] hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
        >
          <RefreshCw className="w-3 h-3" />
          Muat Ulang
        </button>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      referrerPolicy="no-referrer"
      className={className}
      onError={() => {
        setErrorMsg('Gagal menampilkan foto.');
      }}
    />
  );
};

interface PrivateVideoThumbProps {
  storagePath: string;
  title: string;
  durationSec: number;
}

export const PrivateVideoThumb: React.FC<PrivateVideoThumbProps> = ({
  storagePath,
  title,
  durationSec,
}) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPrivateStorageUrl(storagePath)
      .then((objectUrl) => {
        if (active) setUrl(objectUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [storagePath]);

  const formatted = formatDurasi(durationSec);

  return (
    <div className="relative w-full h-full bg-[#1C241E] overflow-hidden">
      {url && !failed ? (
        <video
          src={`${url}#t=0.3`}
          muted
          playsInline
          preload="metadata"
          aria-label={title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-[#233329] to-[#131C16] flex items-center justify-center">
          <Film className="w-7 h-7 text-[#D8E2DC]/60" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent flex items-center justify-center">
        <div className="w-11 h-11 rounded-full bg-[#FAF7F0]/90 text-[#1B4332] flex items-center justify-center shadow-md">
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </div>
      </div>

      {formatted && (
        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/70 text-[#FAF7F0] text-[11px] font-mono tabular-nums">
          {formatted}
        </span>
      )}
    </div>
  );
};

interface PrivateVideoPlayerProps {
  storagePath: string;
  title: string;
}

export const PrivateVideoPlayer: React.FC<PrivateVideoPlayerProps> = ({ storagePath, title }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg(null);
    fetchPrivateStorageUrl(storagePath)
      .then((objectUrl) => {
        if (active) {
          setUrl(objectUrl);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          setErrorMsg(translateFirebaseError(err));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [storagePath, attempt]);

  if (loading) {
    return (
      <div className="w-full max-w-2xl aspect-video rounded-2xl bg-[#1F2922] flex flex-col items-center justify-center text-[#D8E2DC] gap-3">
        <div className="w-8 h-8 border-2 border-[#D8E2DC]/30 border-t-[#D8E2DC] rounded-full animate-spin" />
        <p className="text-sm">Memuat video...</p>
      </div>
    );
  }

  if (errorMsg || !url) {
    return (
      <div className="w-full max-w-md rounded-2xl bg-[#1F2922] p-6 text-center text-[#FAF7F0]">
        <p className="text-sm text-[#E5DEC9] mb-4">{errorMsg || 'Video gagal dimuat.'}</p>
        <button
          type="button"
          onClick={() => {
            invalidatePrivateMediaCacheEntry(storagePath);
            setAttempt((a) => a + 1);
          }}
          className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FAF7F0] text-[#1B4332] text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          Coba Muat Ulang
        </button>
      </div>
    );
  }

  return (
    <video
      src={url}
      controls
      playsInline
      autoPlay
      aria-label={title}
      className="max-h-[72vh] max-w-full rounded-2xl bg-black shadow-2xl"
    />
  );
};
