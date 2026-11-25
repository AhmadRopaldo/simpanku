import React from 'react';
import {
  ArrowRight,
  FileText,
  FolderOpen,
  Images,
  Plus,
} from 'lucide-react';
import type { Album, DocumentFile, Folder, GroupConfig, MediaItem } from '../types';
import { formatTanggal, formatUkuranBerkas } from '../utils/formatters';
import { PrivateImage, PrivateVideoThumb } from './PrivateMedia';

interface HomeViewProps {
  groupConfig: GroupConfig;
  albums: Album[];
  media: MediaItem[];
  documents: DocumentFile[];
  folders: Folder[];
  onOpenAddMenu: () => void;
  onOpenAlbum: (albumId: string) => void;
  onGoToGallery: () => void;
  onGoToDocuments: () => void;
  onPreviewDocument: (docFile: DocumentFile) => void;
  getFolderPathLabel: (folderId: string) => string;
}

export const HomeView: React.FC<HomeViewProps> = ({
  groupConfig,
  albums,
  media,
  documents,
  folders,
  onOpenAddMenu,
  onOpenAlbum,
  onGoToGallery,
  onGoToDocuments,
  onPreviewDocument,
  getFolderPathLabel,
}) => {
  const recentAlbums = albums.slice(0, 4);
  const recentDocs = documents.slice(0, 5);

  const getAlbumPreviewMedia = (albumId: string) => {
    const inAlbum = media.filter((m) => m.albumId === albumId);
    const photo = inAlbum.find((m) => m.mediaType === 'photo');
    return photo || inAlbum[0] || null;
  };

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Group Hero Banner */}
      <section className="rounded-3xl overflow-hidden bg-[#FFFFFF] border border-[#E5DEC9] shadow-xs grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between gap-6">
          <div>
            <div className="text-xs text-[#5A645D] flex flex-wrap items-center gap-2 mb-2">
              <span className="font-medium text-[#1B4332]">File Storage</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{albums.length} Album</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{media.length} Kenangan</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{documents.length} PDF</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#1C241E] leading-tight text-balance">
              {groupConfig.groupName}
            </h1>
            <p className="text-sm sm:text-base text-[#5A645D] mt-2.5 leading-relaxed max-w-xl">
              {groupConfig.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenAddMenu}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#143326] active:scale-[0.99] transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-5 h-5" />
              <span>Tambah</span>
            </button>

            <button
              type="button"
              onClick={onGoToGallery}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-sm font-medium inline-flex items-center gap-2 hover:bg-[#E7E0CF] transition-colors cursor-pointer"
            >
              <Images className="w-4 h-4 text-[#1B4332]" />
              <span>Buka Galeri</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 relative min-h-[190px] lg:min-h-full bg-[#1B4332]">
          <img
            src="/src/assets/images/ruang_kenangan_banner_1795580064718.jpg"
            alt="Meja kayu dengan album foto kenangan dan tanaman hijau"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      </section>

      {/* Album Terbaru */}
      <section aria-labelledby="heading-album-terbaru">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2
              id="heading-album-terbaru"
              className="font-display text-xl sm:text-2xl font-semibold text-[#1C241E]"
            >
              Album Terbaru
            </h2>
            <p className="text-xs text-[#5A645D] mt-0.5">
              Kumpulan foto dan video kenangan bersama
            </p>
          </div>

          <button
            type="button"
            onClick={onGoToGallery}
            className="min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#1B4332] hover:bg-[#EFE9DA] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Lihat Semua</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {recentAlbums.length === 0 ? (
          <div className="rounded-3xl bg-[#FFFFFF] border border-[#E5DEC9] p-8 text-center">
            <Images className="w-8 h-8 text-[#7A847C] mx-auto mb-2.5" />
            <p className="text-sm font-semibold text-[#1C241E] mb-1">Belum ada album kenangan</p>
            <p className="text-xs text-[#5A645D] mb-4 max-w-sm mx-auto">
              Mulai buat album pertama untuk menyimpan foto liburan, acara keluarga, atau momen penting bersama.
            </p>
            <button
              type="button"
              onClick={onOpenAddMenu}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-xs font-semibold cursor-pointer"
            >
              Buat Album Sekarang
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentAlbums.map((album) => {
              const items = media.filter((m) => m.albumId === album.id);
              const photoCount = items.filter((m) => m.mediaType === 'photo').length;
              const videoCount = items.filter((m) => m.mediaType === 'video').length;
              const cover = getAlbumPreviewMedia(album.id);

              return (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => onOpenAlbum(album.id)}
                  className="group text-left rounded-2xl bg-[#FFFFFF] border border-[#E5DEC9] overflow-hidden hover:border-[#1B4332]/40 transition-colors cursor-pointer"
                >
                  <div className="aspect-[4/3] w-full bg-[#EFE9DA] overflow-hidden">
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
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-[#1C241E] truncate">
                      {album.title}
                    </h3>
                    <p className="text-xs text-[#5A645D] mt-1 tabular-nums">
                      {photoCount} Foto · {videoCount} Video
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Dokumen Terbaru */}
      <section aria-labelledby="heading-dokumen-terbaru">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2
              id="heading-dokumen-terbaru"
              className="font-display text-xl sm:text-2xl font-semibold text-[#1C241E]"
            >
              Dokumen Baru Ditambahkan
            </h2>
            <p className="text-xs text-[#5A645D] mt-0.5">
              Arsip PDF penting tersusun dalam {folders.length} folder
            </p>
          </div>

          <button
            type="button"
            onClick={onGoToDocuments}
            className="min-h-[44px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold text-[#1B4332] hover:bg-[#EFE9DA] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Buka Folder</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {recentDocs.length === 0 ? (
          <div className="rounded-3xl bg-[#FFFFFF] border border-[#E5DEC9] p-8 text-center">
            <FolderOpen className="w-8 h-8 text-[#7A847C] mx-auto mb-2.5" />
            <p className="text-sm font-semibold text-[#1C241E] mb-1">Belum ada dokumen PDF</p>
            <p className="text-xs text-[#5A645D] mb-4 max-w-sm mx-auto">
              Simpan akta, surat penting, catatan rapat, atau dokumen perjalanan grup di sini.
            </p>
            <button
              type="button"
              onClick={onOpenAddMenu}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-xs font-semibold cursor-pointer"
            >
              Unggah PDF Pertama
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#FFFFFF] border border-[#E5DEC9] divide-y divide-[#EFE9DA] overflow-hidden">
            {recentDocs.map((docFile) => (
              <button
                key={docFile.id}
                type="button"
                onClick={() => onPreviewDocument(docFile)}
                className="w-full min-h-[64px] px-4 sm:px-5 py-3.5 flex items-center gap-3.5 text-left hover:bg-[#FAF7F0] transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#EBF2ED] text-[#1B4332] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-[#1C241E] truncate">
                    {docFile.title}
                  </div>
                  <div className="text-xs text-[#5A645D] mt-0.5 truncate tabular-nums">
                    {getFolderPathLabel(docFile.folderId)} · {formatUkuranBerkas(docFile.fileSize)} ·{' '}
                    {formatTanggal(docFile.createdAt)}
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#1B4332] shrink-0">Buka</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
