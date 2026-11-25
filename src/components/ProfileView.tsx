import React, { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  LogOut,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
  UserX,
} from 'lucide-react';
import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  db,
  firebaseConfig,
  handleFirestoreError,
  OperationType,
  translateFirebaseError,
} from '../firebase';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  LIMITS,
  type GroupConfig,
  type MemberRecord,
  type MemberRole,
} from '../types';
import { formatTanggal } from '../utils/formatters';

interface ProfileViewProps {
  user: User;
  isAdmin: boolean;
  groupConfig: GroupConfig;
  members: MemberRecord[];
  onSignOut: () => void;
  onRequestDeleteMember: (member: MemberRecord) => void;
}

const STORAGE_RULES_SNIPPET = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isVerifiedUser() {
      return request.auth != null
        && request.auth.token.email is string
        && request.auth.token.email_verified == true;
    }
    function authEmail() { return request.auth.token.email.lower(); }
    function isBootstrappedAdmin() { return isVerifiedUser() && authEmail() == '${BOOTSTRAPPED_ADMIN_EMAIL}'; }
    function isActiveMember() {
      return isVerifiedUser() && (
        isBootstrappedAdmin() || (
          firestore.exists(/databases/${firebaseConfig.firestoreDatabaseId}/documents/members/$(authEmail())) &&
          firestore.get(/databases/${firebaseConfig.firestoreDatabaseId}/documents/members/$(authEmail())).data.active == true
        )
      );
    }
    function isAdmin() {
      return isVerifiedUser() && (
        isBootstrappedAdmin() || (
          firestore.exists(/databases/${firebaseConfig.firestoreDatabaseId}/documents/members/$(authEmail())) &&
          firestore.get(/databases/${firebaseConfig.firestoreDatabaseId}/documents/members/$(authEmail())).data.active == true &&
          firestore.get(/databases/${firebaseConfig.firestoreDatabaseId}/documents/members/$(authEmail())).data.role == 'admin'
        )
      );
    }
    match /media/{uploaderUid}/{albumId}/{fileName} {
      allow read: if isActiveMember();
      allow create: if isActiveMember() && request.auth.uid == uploaderUid && request.resource != null && (
        (request.resource.contentType.matches('image/.*') && request.resource.size <= 15 * 1024 * 1024) ||
        (request.resource.contentType.matches('video/.*') && request.resource.size <= 50 * 1024 * 1024)
      );
      allow delete: if isActiveMember() && (isAdmin() || request.auth.uid == uploaderUid);
    }
    match /documents/{uploaderUid}/{folderId}/{fileName} {
      allow read: if isActiveMember();
      allow create: if isActiveMember() && request.auth.uid == uploaderUid && request.resource != null
        && request.resource.contentType == 'application/pdf' && request.resource.size <= 25 * 1024 * 1024;
      allow delete: if isActiveMember() && (isAdmin() || request.auth.uid == uploaderUid);
    }
    match /{allPaths=**} { allow read, write: if false; }
  }
}`;

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  isAdmin,
  groupConfig,
  members,
  onSignOut,
  onRequestDeleteMember,
}) => {
  // Group settings form (admin only)
  const [groupName, setGroupName] = useState(groupConfig.groupName);
  const [groupDesc, setGroupDesc] = useState(groupConfig.description);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupMsg, setGroupMsg] = useState<string | null>(null);

  // Add member form (admin only)
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<MemberRole>('member');
  const [addingMember, setAddingMember] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null);

  const [guideOpen, setGuideOpen] = useState(false);
  const [copiedStorageRules, setCopiedStorageRules] = useState(false);

  useEffect(() => {
    setGroupName(groupConfig.groupName);
    setGroupDesc(groupConfig.description);
  }, [groupConfig]);

  const handleSaveGroupConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = groupName.trim();
    if (!cleanName) {
      setGroupMsg('Nama grup tidak boleh kosong.');
      return;
    }
    setSavingGroup(true);
    setGroupMsg(null);
    try {
      await setDoc(doc(db, 'groupSettings', 'main'), {
        groupName: cleanName.slice(0, LIMITS.groupNameMax),
        description: groupDesc.trim().slice(0, LIMITS.groupDescMax),
        updatedAt: serverTimestamp(),
        updatedByUid: user.uid,
      }).catch((err) => handleFirestoreError(err, OperationType.WRITE, 'groupSettings/main'));
      setGroupMsg('Pengaturan grup berhasil disimpan.');
    } catch (err) {
      setGroupMsg(translateFirebaseError(err));
    } finally {
      setSavingGroup(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    const displayName = newName.trim() || email.split('@')[0];

    setMemberError(null);
    setMemberSuccess(null);

    if (!LIMITS.emailPattern.test(email) || email.length > LIMITS.emailMax) {
      setMemberError('Masukkan alamat email Google yang valid.');
      return;
    }
    if (displayName.length > LIMITS.displayNameMax) {
      setMemberError(`Nama maksimal ${LIMITS.displayNameMax} karakter.`);
      return;
    }

    setAddingMember(true);
    try {
      const existing = members.find((m) => m.email === email);
      if (existing) {
        await updateDoc(doc(db, 'members', email), {
          displayName,
          role: newRole,
          active: true,
          updatedAt: serverTimestamp(),
        }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `members/${email}`));
        setMemberSuccess(`Akses untuk ${email} diperbarui dan diaktifkan.`);
      } else {
        await setDoc(doc(db, 'members', email), {
          email,
          displayName,
          role: newRole,
          active: true,
          uid: '',
          photoURL: '',
          addedByEmail: (user.email || BOOTSTRAPPED_ADMIN_EMAIL).toLowerCase(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }).catch((err) => handleFirestoreError(err, OperationType.CREATE, `members/${email}`));
        setMemberSuccess(`${email} berhasil ditambahkan ke grup.`);
      }
      setNewEmail('');
      setNewName('');
      setNewRole('member');
    } catch (err) {
      setMemberError(translateFirebaseError(err));
    } finally {
      setAddingMember(false);
    }
  };

  const handleToggleMemberActive = async (member: MemberRecord) => {
    setMemberError(null);
    setMemberSuccess(null);
    try {
      await updateDoc(doc(db, 'members', member.email), {
        active: !member.active,
        updatedAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `members/${member.email}`));
      setMemberSuccess(
        !member.active
          ? `Akses ${member.email} telah diaktifkan kembali.`
          : `Akses ${member.email} telah dicabut.`
      );
    } catch (err) {
      setMemberError(translateFirebaseError(err));
    }
  };

  const handleToggleMemberRole = async (member: MemberRecord) => {
    const nextRole: MemberRole = member.role === 'admin' ? 'member' : 'admin';
    setMemberError(null);
    setMemberSuccess(null);
    try {
      await updateDoc(doc(db, 'members', member.email), {
        role: nextRole,
        updatedAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `members/${member.email}`));
    } catch (err) {
      setMemberError(translateFirebaseError(err));
    }
  };

  const handleCopyStorageRules = async () => {
    try {
      await navigator.clipboard.writeText(STORAGE_RULES_SNIPPET);
      setCopiedStorageRules(true);
      window.setTimeout(() => setCopiedStorageRules(false), 2000);
    } catch {
      // Fallback ignored if clipboard denied
    }
  };

  const initials = (user.displayName || user.email || 'RK')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#1C241E]">
          Profil & Akses Grup
        </h1>
        <p className="text-xs sm:text-sm text-[#5A645D] mt-1">
          Kelola akun Anda, informasi grup, dan keanggotaan privat
        </p>
      </header>

      {/* Current User Card */}
      <section className="rounded-3xl bg-[#FFFFFF] border border-[#E5DEC9] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'Foto profil'}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-2xl object-cover border border-[#E5DEC9] shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-[#1B4332] text-[#FAF7F0] font-semibold flex items-center justify-center shrink-0">
              {initials}
            </div>
          )}

          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-[#1C241E] truncate">
              {user.displayName || 'Anggota Simpan-Ku'}
            </h2>
            <p className="text-xs sm:text-sm text-[#5A645D] truncate">{user.email}</p>
            <p className="text-xs font-medium text-[#1B4332] mt-1">
              {isAdmin ? 'Admin Grup' : 'Anggota Grup'} · Akses Aktif
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 hover:bg-[#E7E0CF] shrink-0 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </section>

      {/* Admin-Only Sections */}
      {isAdmin && (
        <>
          {/* Group Settings */}
          <section className="rounded-3xl bg-[#FFFFFF] border border-[#E5DEC9] p-5 sm:p-6 space-y-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-[#1C241E]">
                Identitas Grup
              </h2>
              <p className="text-xs text-[#5A645D] mt-0.5">
                Nama grup tampil di halaman Beranda seluruh anggota
              </p>
            </div>

            <form onSubmit={handleSaveGroupConfig} className="space-y-3.5">
              <div>
                <label htmlFor="group-name-input" className="block text-xs font-semibold text-[#3C463E] mb-1.5">
                  Nama Grup
                </label>
                <input
                  id="group-name-input"
                  type="text"
                  value={groupName}
                  maxLength={LIMITS.groupNameMax}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#D8D0BC] text-sm text-[#1C241E]"
                />
              </div>

              <div>
                <label htmlFor="group-desc-input" className="block text-xs font-semibold text-[#3C463E] mb-1.5">
                  Deskripsi Singkat
                </label>
                <input
                  id="group-desc-input"
                  type="text"
                  value={groupDesc}
                  maxLength={LIMITS.groupDescMax}
                  onChange={(e) => setGroupDesc(e.target.value)}
                  className="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-[#FAF7F0] border border-[#D8D0BC] text-sm text-[#1C241E]"
                />
              </div>

              {groupMsg && (
                <p className="text-xs font-medium text-[#1B4332]">{groupMsg}</p>
              )}

              <button
                type="submit"
                disabled={savingGroup}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-xs sm:text-sm font-semibold hover:bg-[#143326] disabled:opacity-60 cursor-pointer"
              >
                {savingGroup ? 'Menyimpan...' : 'Simpan Identitas Grup'}
              </button>
            </form>
          </section>

          {/* Admin-Only Member Management */}
          <section className="rounded-3xl bg-[#FFFFFF] border border-[#E5DEC9] p-5 sm:p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold text-[#1C241E]">
                  Kelola Anggota Grup
                </h2>
                <p className="text-xs text-[#5A645D] mt-0.5">
                  Hanya email yang terdaftar dan aktif yang dapat membuka isi Simpan-Ku
                </p>
              </div>
              <Shield className="w-5 h-5 text-[#1B4332] shrink-0 mt-1" />
            </div>

            <form
              onSubmit={handleAddMember}
              className="rounded-2xl bg-[#FAF7F0] border border-[#E5DEC9] p-4 space-y-3"
            >
              <div className="text-xs font-semibold text-[#1C241E]">
                Berikan Akses Anggota Baru
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email.anggota@gmail.com"
                  required
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#D8D0BC] text-sm text-[#1C241E]"
                />
                <input
                  type="text"
                  value={newName}
                  maxLength={LIMITS.displayNameMax}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nama panggilan (opsional)"
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#D8D0BC] text-sm text-[#1C241E]"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as MemberRole)}
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-[#D8D0BC] text-sm text-[#1C241E]"
                >
                  <option value="member">Anggota</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {memberError && (
                <p className="text-xs text-[#9B2C2C] font-medium">{memberError}</p>
              )}
              {memberSuccess && (
                <p className="text-xs text-[#1B4332] font-medium">{memberSuccess}</p>
              )}

              <button
                type="submit"
                disabled={addingMember}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1B4332] text-[#FAF7F0] text-xs sm:text-sm font-semibold inline-flex items-center gap-2 hover:bg-[#143326] disabled:opacity-60 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{addingMember ? 'Menyimpan...' : 'Berikan Akses'}</span>
              </button>
            </form>

            {/* Member List */}
            <div className="divide-y divide-[#EFE9DA] border border-[#EFE9DA] rounded-2xl overflow-hidden">
              {members.map((member) => {
                const isRootAdmin = member.email === BOOTSTRAPPED_ADMIN_EMAIL;
                return (
                  <div
                    key={member.email}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#1C241E] truncate">
                        {member.displayName}
                      </div>
                      <div className="text-xs text-[#5A645D] truncate">{member.email}</div>
                      <div className="text-[11px] text-[#6B756D] mt-1 flex flex-wrap items-center gap-x-1.5">
                        <span className={member.active ? 'text-[#1B4332] font-medium' : 'text-[#9B2C2C] font-medium'}>
                          {member.active ? 'Aktif' : 'Akses Dicabut'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{member.role === 'admin' ? 'Admin' : 'Anggota'}</span>
                        <span aria-hidden="true">·</span>
                        <span>Ditambahkan {formatTanggal(member.createdAt)}</span>
                      </div>
                    </div>

                    {!isRootAdmin && (
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleMemberRole(member)}
                          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F3EEE3] text-[#1C241E] text-xs font-medium hover:bg-[#E7E0CF] cursor-pointer"
                        >
                          {member.role === 'admin' ? 'Jadikan Anggota' : 'Jadikan Admin'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleMemberActive(member)}
                          className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer ${
                            member.active
                              ? 'bg-[#FDF2F0] text-[#9B2C2C] hover:bg-[#FADFD9]'
                              : 'bg-[#EBF2ED] text-[#1B4332] hover:bg-[#D8E7DC]'
                          }`}
                        >
                          {member.active ? (
                            <>
                              <UserX className="w-3.5 h-3.5" />
                              <span>Cabut Akses</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>Aktifkan</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onRequestDeleteMember(member)}
                          aria-label={`Hapus ${member.email}`}
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
        </>
      )}

      {/* Firebase Setup & Testing Guide */}
      <section className="rounded-3xl bg-[#FFFFFF] border border-[#E5DEC9] overflow-hidden">
        <button
          type="button"
          onClick={() => setGuideOpen((v) => !v)}
          className="w-full min-h-[60px] px-5 sm:px-6 py-4 flex items-center justify-between gap-3 text-left hover:bg-[#FAF7F0] transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-[#1B4332] shrink-0" />
            <div>
              <div className="text-sm font-semibold text-[#1C241E]">
                Panduan Pengaturan Firebase & Pengujian Akses
              </div>
              <div className="text-xs text-[#5A645D]">
                Cara menyiapkan admin pertama, aturan Firebase Storage, dan pengujian akun
              </div>
            </div>
          </div>
          {guideOpen ? (
            <ChevronUp className="w-5 h-5 text-[#5A645D] shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[#5A645D] shrink-0" />
          )}
        </button>

        {guideOpen && (
          <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-[#EFE9DA] space-y-4 text-xs sm:text-sm text-[#49534B] leading-relaxed">
            <div>
              <h3 className="font-semibold text-[#1C241E] mb-1">
                1. Menyiapkan Admin Pertama
              </h3>
              <p>
                Akun <strong>{BOOTSTRAPPED_ADMIN_EMAIL}</strong> sudah didaftarkan otomatis sebagai
                admin utama pada aturan keamanan Firestore & Storage. Saat Anda masuk dengan akun
                Google tersebut, profil admin akan langsung aktif. Untuk proyek lain, buat dokumen
                di koleksi <code className="font-mono text-xs bg-[#F3EEE3] px-1.5 py-0.5 rounded">members/emailanda@gmail.com</code>{' '}
                dengan field <code className="font-mono text-xs bg-[#F3EEE3] px-1.5 py-0.5 rounded">role: &quot;admin&quot;</code> dan{' '}
                <code className="font-mono text-xs bg-[#F3EEE3] px-1.5 py-0.5 rounded">active: true</code>.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-[#1C241E] mb-1">
                2. Mengaktifkan Firebase Storage (Wajib untuk Unggah Berkas)
              </h3>
              <p className="mb-2">
                Database Firestore dan aturan Firestore sudah aktif. Fitur{' '}
                <strong>Unggah Foto &amp; Video</strong>, <strong>Unggah PDF</strong>, serta{' '}
                <strong>Pratinjau Media/PDF</strong> membutuhkan Firebase Storage aktif di proyek{' '}
                <code className="font-mono text-xs bg-[#F3EEE3] px-1.5 py-0.5 rounded">
                  {firebaseConfig.projectId}
                </code>{' '}
                dengan aturan berikut di tab <strong>Storage → Rules</strong>:
              </p>
              <div className="relative rounded-2xl bg-[#161F19] text-[#E9E4D5] p-4 font-mono text-[11px] overflow-x-auto">
                <button
                  type="button"
                  onClick={handleCopyStorageRules}
                  className="sticky float-right top-0 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] inline-flex items-center gap-1 cursor-pointer"
                >
                  {copiedStorageRules ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedStorageRules ? 'Tersalin' : 'Salin Rules'}</span>
                </button>
                <pre className="whitespace-pre">{STORAGE_RULES_SNIPPET}</pre>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-[#1C241E] mb-1">
                3. Langkah Pengujian Admin, Anggota, dan Akun Belum Disetujui
              </h3>
              <ol className="list-decimal pl-5 space-y-1">
                <li>
                  <strong>Admin</strong>: Masuk dengan {BOOTSTRAPPED_ADMIN_EMAIL}, buka menu{' '}
                  <em>Profil → Kelola Anggota Grup</em>, lalu tambahkan email Google kedua sebagai Anggota.
                </li>
                <li>
                  <strong>Anggota Disetujui</strong>: Masuk di peramban lain dengan email kedua tersebut,
                  pastikan album, foto, video, dan PDF grup terbuka dengan normal.
                </li>
                <li>
                  <strong>Cabut Akses</strong>: Dari akun Admin, klik <em>Cabut Akses</em> pada
                  anggota tersebut. Saat anggota memuat ulang atau membuka berkas baru, permintaan langsung ditolak.
                </li>
                <li>
                  <strong>Akun Belum Disetujui</strong>: Masuk dengan akun Google lain yang belum
                  didaftarkan; layar <em>Email Belum Disetujui</em> akan muncul dan akses data diblokir.
                </li>
              </ol>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
