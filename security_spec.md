# Spesifikasi Keamanan Firestore — Ruang Kenangan

## 1. Invarian Data (Data Invariants)
1. **Gerbang Anggota Terverifikasi**: Tidak ada dokumen di `groupSettings`, `albums`, `media`, `folders`, `documents`, atau `members` yang dapat dibaca atau ditulis oleh pengguna anonim, belum terverifikasi emailnya (`email_verified != true`), atau emailnya tidak terdaftar aktif (`active == true`) di `/members/{email}`.
2. **Integritas Identitas & Anti-Eskalasi**:
   - Pengguna biasa (`member`) tidak pernah bisa membuat, mengubah peran (`role`), atau mengaktifkan dirinya sendiri di `/members`. Hanya admin yang dapat memberi/mencabut akses.
   - Saat membuat album, media, folder, atau dokumen, `createdByUid` harus sama persis dengan `request.auth.uid` dan bersifat permanen (immutable) pada pembaruan berikutnya.
3. **Konsistensi Relasional**:
   - Sebuah `media` tidak boleh dibuat tanpa `albumId` yang benar-benar ada di `/albums/{albumId}`.
   - Sebuah `folder` atau `document` dengan `parentId != 'root'` / `folderId != 'root'` tidak boleh dibuat atau dipindahkan ke folder tujuan yang tidak ada di `/folders/{id}`.
4. **Batasan Skema & Ukuran (Anti-Shadow-Field & Anti-DoW)**:
   - Setiap penulisan memvalidasi daftar key wajib (`hasAll`) dan yang diizinkan (`hasOnly`), tipe data, batas panjang string, serta stempel waktu server (`request.time`).
5. **Isolasi PII**:
   - Dokumen `/members/{memberEmail}` hanya dapat dibaca (`get`) oleh pemilik email tersebut sendiri atau admin. Daftar seluruh anggota (`list`) hanya dapat diakses oleh admin.

## 2. "Dirty Dozen" Payloads (Pengujian Penolakan Akses)
1. **Unauthenticated Read**: `get(/albums/alb1)` tanpa `request.auth` -> `PERMISSION_DENIED`.
2. **Unverified Email Spoof**: `get(/albums/alb1)` dengan `email: 'ahmadropaldo@gmail.com'`, `email_verified: false` -> `PERMISSION_DENIED`.
3. **Revoked Member Access**: `get(/media/med1)` sebagai email yang `active: false` di `/members` -> `PERMISSION_DENIED`.
4. **Self-Promotion Member**: Member menulis `/members/user@gmail.com` dengan `role: 'admin'` -> `PERMISSION_DENIED`.
5. **PII Cross-Read**: Member biasa `get(/members/other@gmail.com)` atau `list(/members)` -> `PERMISSION_DENIED`.
6. **Shadow Field Injection**: Member aktif membuat `/albums/alb1` dengan field ekstra `isAdminAlbum: true` -> `PERMISSION_DENIED`.
7. **UID Spoofing**: Member aktif membuat `/media/med1` dengan `createdByUid: 'victim_uid'` -> `PERMISSION_DENIED`.
8. **Orphaned Media Write**: Member aktif membuat `/media/med1` dengan `albumId: 'nonexistent_album'` -> `PERMISSION_DENIED`.
9. **Client Timestamp Forgery**: Member aktif membuat `/folders/fol1` dengan `createdAt` manual bukan `request.time` -> `PERMISSION_DENIED`.
10. **Cross-Owner Delete**: Member A menghapus `/documents/doc_milik_B` -> `PERMISSION_DENIED`.
11. **Path ID Poisoning**: Member aktif menulis `/albums/id_yang_sangat_panjang_atau_mengandung_spasi!` -> `PERMISSION_DENIED`.
12. **Type/Size Poisoning on Update**: Member A mengubah `title` di `/documents/doc_milik_A` menjadi string 500 karakter atau tipe angka -> `PERMISSION_DENIED`.
