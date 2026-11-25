import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Edit3,
  FolderPlus,
  ImagePlus,
  Images,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Album, MediaFilterType, MediaItem } from '../types';
import { formatTanggal } from '../utils/formatters';
import { PrivateImage, PrivateVideoThumb } from './PrivateMedia';

interface GalleryViewProps {
  albums: Album[];
  media: MediaItem[];
  selectedAlbumId: string | null;
  currentUid: string;
  isAdmin: boolean;
  onSelectAlbum: (albumId: string | null) => void;
  onCreateAlbum: () => void;
  onEditAlbum: (album: Album) => void;
  onDeleteAlbum: (album: Album) => void;
  onUploadMedia: (albumId: string | null) => void;
  onOpenMediaViewer: (items: MediaItem[], index: number) => void;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  albums,
  media,
  selectedAlbumId,
  currentUid,
  isAdmin,
  onSelectAlbum,
  onCreateAlbum,
  onEditAlbum,
  onDeleteAlbum,
  onUploadMedia,
  onOpenMediaViewer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<MediaFilterType>('semua');

  const selectedAlbum = useMemo(
    () => albums.find((a) => a.id === selectedAlbumId) || null,
    [albums, selectedAlbumId]
  );

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredMedia = useMemo(() => {
    return media.filter((item) => {
      if (selectedAlbum && item.albumId !== selectedAlbum.id) return false;
      if (filterType !== 'semua' && item.mediaType !== filterType) return false;
      if (normalizedQuery) {
        const hay = `${item.title} ${item.caption} ${item.albumTitle}`.toLowerCase();
        if (!hay.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [media, selectedAlbum, filterType, normalizedQuery]);

  const filteredAlbums = useMemo(() => {
    if (!normalizedQuery) return albums;
    return albums.filter((a) =>
      `${a.title} ${a.description}`.toLowerCase().includes(normalizedQuery)
    );
  }, [albums, normalizedQuery]);

  const getAlbumPreview = (albumId: string) => {
    const items = media.filter((m) => m.albumId === albumId);
    return items.find((m) => m.mediaType === 'photo') || items[0] || null;
  };

  const showingSearchOrFilterResults =
    !selectedAlbum && (normalizedQuery.length > 0 || filterType !== 'semua');

  return (
    <div className="space-y-6">
      {/* Header & Primary Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {selectedAlbum ? (
            <button
              type="button"
              onClick={() => onSelectAlbum(null)}
              className="min-h-[44px] -ml-2 px-2 py-1 rounded-xl text-sm font-semibold text-[#1B4332] hover:bg-[#EFE9DA] inline-flex items-center gap-1.5 mb-1 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Semua Album</span>
            </button>
          ) : null}

          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#1C241E]">
            {selectedAlbum ? selectedAlbum.title : 'Galeri Kenangan'}
          </h1>
          {selectedAlbum ? (
            <p className="text-xs sm:text-sm text-[#5A645D] mt-1">
              {selectedAlbum.description || `Dibuat oleh ${selectedAlbum.createdByName}`}
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-[#5A645D] mt-1">
              Simpan foto dan video kebersamaan dalam album grup
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedAlbum && (isAdmin || selectedAlbum.createdByUid === currentUid) && (
            <>
              <button
                type="button"
                onClick={() => onEditAlbum(selectedAlbum)}
                aria-label="Ubah detail album"
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#E7E0CF] cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                <span>Ubah Album</span>
              </button>
              <button
                type="button"
                onClick={() => onDeleteAlbum(selectedAlbum)}
                aria-label="Hapus album"
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#FDF2F0] text-[#9B2C2C] text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#FADFD9] cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus</span>
              </button>
            </>
          )}

          {!selectedAlbum && (
            <button
              type="button"
              onClick={onCreateAlbum}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-xs sm:text-sm font-medium inline-flex items-center gap-2 hover:bg-[#E7E0CF] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-[#1B4332]" />
              <span>Buat Album</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onUploadMedia(selectedAlbum?.id || null)}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#143326] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ImagePlus className="w-4 h-4" />
            <span>Unggah Foto & Video</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#6B756D] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari judul, keterangan, atau nama album..."
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

        <div
          className="inline-flex items-center p-1 rounded-xl bg-[#EFE9DA] self-start"
          role="group"
          aria-label="Filter jenis media"
        >
          {(
            [
              { id: 'semua', label: 'Semua' },
              { id: 'photo', label: 'Foto' },
              { id: 'video', label: 'Video' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id)}
              className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterType === tab.id
                  ? 'bg-[#FFFFFF] text-[#1B4332] shadow-xs'
                  : 'text-[#5A645D] hover:text-[#1C241E]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Album Directory View (when no album is selected and no media filter/search active) */}
      {!selectedAlbum && !showingSearchOrFilterResults && (
        <section>
          {filteredAlbums.length === 0 ? (
            <div className="rounded-3xl bg-[#FFFFFF] border border-[#E5DEC9] p-10 text-center">
              <Images className="w-10 h-10 text-[#7A847C] mx-auto mb-3" />
              <h2 className="font-display text-xl font-semibold text-[#1C241E] mb-1.5">
                Belum Ada Album
              </h2>
              <p className="text-sm text-[#5A645D] max-w-md mx-auto mb-5">
                Buat album pertama untuk mulai mengunggah foto dan video kenangan bersama anggota grup.
              </p>
              <button
                type="button"
                onClick={onCreateAlbum}
                className="min-h-[48px] px-6 py-3 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-sm font-semibold cursor-pointer"
              >
                Buat Album Pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filteredAlbums.map((album) => {
                const items = media.filter((m) => m.albumId === album.id);
                const photoCount = items.filter((m) => m.mediaType === 'photo').length;
                const videoCount = items.filter((m) => m.mediaType === 'video').length;
                const cover = getAlbumPreview(album.id);

                return (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => onSelectAlbum(album.id)}
                    className="group text-left rounded-2xl bg-[#FFFFFF] border border-[#E5DEC9] overflow-hidden hover:border-[#1B4332]/40 transition-colors cursor-pointer"
                  >
                    <div className="aspect-[4/3] bg-[#EFE9DA] overflow-hidden">
                      {cover ? (
                        cover.mediaType === 'video' ? (
                          <PrivateVideoThumb
                            storagePath={cover.storagePath}
                            title={cover.title}
                            durationSec={cover.durationSec}
                          />
                        ) : (
                          <PrivateImage
                            storagePath={cover.storagePath}
                            alt={album.title}
                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                          />
                        )
                      ) : (
                        <img
                          src="/src/assets/images/album_sampul_default_1795580064636.jpg"
                          alt={album.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-4 sm:p-5">
                      <h3 className="font-display text-lg font-semibold text-[#1C241E] truncate">
                        {album.title}
                      </h3>
                      {album.description && (
                        <p className="text-xs text-[#5A645D] mt-1 line-clamp-2">
                          {album.description}
                        </p>
                      )}
                      <div className="text-xs text-[#6B756D] mt-2.5 tabular-nums">
                        {photoCount} Foto · {videoCount} Video · Oleh {album.createdByName}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Media Grid View (when inside an album OR searching/filtering across gallery) */}
      {(selectedAlbum || showingSearchOrFilterResults) && (
        <section className="space-y-6">
          {showingSearchOrFilterResults && filteredAlbums.length > 0 && normalizedQuery && (
            <div>
              <h2 className="text-xs font-semibold text-[#5A645D] mb-2.5">
                Album yang Cocok ({filteredAlbums.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {filteredAlbums.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => onSelectAlbum(album.id)}
                    className="min-h-[56px] p-3.5 rounded-2xl bg-[#FFFFFF] border border-[#E5DEC9] hover:border-[#1B4332]/40 text-left flex items-center gap-3 cursor-pointer"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#EBF2ED] text-[#1B4332] flex items-center justify-center shrink-0">
                      <Images className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#1C241E] truncate">
                        {album.title}
                      </div>
                      <div className="text-xs text-[#5A645D] truncate">
                        Buka album
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredMedia.length === 0 ? (
            <div className="rounded-3xl bg-[#FFFFFF] border border-[#E5DEC9] p-10 text-center">
              <Images className="w-10 h-10 text-[#7A847C] mx-auto mb-3" />
              <h2 className="font-display text-xl font-semibold text-[#1C241E] mb-1.5">
                {normalizedQuery || filterType !== 'semua'
                  ? 'Tidak Ada Kenangan yang Cocok'
                  : 'Album Ini Masih Kosong'}
              </h2>
              <p className="text-sm text-[#5A645D] max-w-md mx-auto mb-5">
                {normalizedQuery || filterType !== 'semua'
                  ? 'Coba ubah kata kunci pencarian atau pilih filter Semua.'
                  : 'Unggah foto atau video pertama Anda langsung dari galeri ponsel ke album ini.'}
              </p>
              {!normalizedQuery && filterType === 'semua' && selectedAlbum && (
                <button
                  type="button"
                  onClick={() => onUploadMedia(selectedAlbum.id)}
                  className="min-h-[48px] px-6 py-3 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-sm font-semibold cursor-pointer"
                >
                  Unggah Foto & Video
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {filteredMedia.map((item, idx) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenMediaViewer(filteredMedia, idx)}
                  className="group text-left rounded-2xl bg-[#FFFFFF] border border-[#E5DEC9] overflow-hidden hover:border-[#1B4332]/40 transition-colors cursor-pointer"
                >
                  <div className="aspect-square bg-[#EFE9DA] overflow-hidden">
                    {item.mediaType === 'video' ? (
                      <PrivateVideoThumb
                        storagePath={item.storagePath}
                        title={item.title}
                        durationSec={item.durationSec}
                      />
                    ) : (
                      <PrivateImage
                        storagePath={item.storagePath}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                      />
                    )}
                  </div>
                  <div className="p-3">
                    <div className="text-xs sm:text-sm font-semibold text-[#1C241E] truncate">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-[#5A645D] mt-0.5 truncate">
                      {formatTanggal(item.mediaDate)}
                      {!selectedAlbum ? ` · ${item.albumTitle}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
