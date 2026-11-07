# Membuat APK Uji di Codemagic

1. Buat akun Codemagic dan masuk dengan akun GitHub.
2. Buat repository GitHub baru, misalnya `ujian-kita-test`.
3. Unggah seluruh isi folder ini ke repository tersebut.
4. Di Codemagic pilih **Add application**, lalu pilih repository `ujian-kita-test`.
5. Jalankan workflow **UjianKita Test APK**.
6. Setelah status build selesai, buka bagian **Artifacts** dan unduh berkas APK.
7. Pindahkan APK ke Android, aktifkan izin instalasi dari sumber tersebut bila diminta Android, lalu pasang.

## Uji awal

- Masukkan token yang memang terisi di Spreadsheet.
- Untuk saat ini aplikasi mengizinkan token dipakai di luar hari jadwal karena **Mode uji jadwal** aktif.
- Masukkan nama dan kelas pada halaman awal Google Form.
- Tekan Home atau berpindah aplikasi tiga kali untuk memeriksa penguncian sesi.

## Sebelum digunakan sekolah

- Ganti Spreadsheet publik dengan server token terlindungi.
- Tambahkan dashboard guru dan database aktivitas sesi.
- Uji pada beberapa ponsel Android yang benar-benar akan dipakai siswa.
