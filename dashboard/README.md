# UjianKita Realtime Monitor Dashboard

Dashboard pemantauan ujian realtime dengan gaya **Glisse Liquid Glass** dan palet warna **Obsidian**.

## 🎨 Palet Warna & Desain
- **Primary Background**: `#080808` (Obsidian)
- **Primary Text**: `#F0EFEA` (Bone White)
- **Secondary Text**: `#898989` (Concrete Grey)
- **Surface & Dividers**: `#292929` (Graphite)
- **Aesthetic**: Glisse Liquid Glass (efek refraksi kaca cair, lens specular, dan spring physics)

## 🔑 Kredensial Super-Admin
- **Username**: `rick`
- **Password**: `rick`

## 🚀 Cara Menjalankan Server Dashboard
Pastikan Node.js (v18+) sudah terpasang, lalu jalankan di terminal:
```bash
node dashboard/server.js
```
Akses di browser:
- **Lokal**: `http://localhost:5000`
- **Jaringan Sekolah / LAN**: `http://<IP-Komputer>:5000` (misal: `http://192.168.1.100:5000`)

## 📱 Fitur Utama
1. **Login Super-Admin**: Proteksi akses login dengan token sesi.
2. **Realtime 4 Status Siswa**:
   - 🟢 **Mengerjakan**: Siswa fokus mengerjakan soal di Google Form.
   - 🟡 **Keluar Aplikasi (1-2x)**: Siswa terdeteksi membuka aplikasi lain / notifikasi.
   - 🔴 **Sesi Terkunci (3x)**: Siswa melanggar batas 3x keluar, layar terkunci, dan muncul tombol "Buka Kunci Jarak Jauh" untuk admin.
   - 🔵 **Selesai**: Siswa selesai menekan tombol "Selesai Ujian".
3. **Auto-Remove Siswa Non-Aktif**: Siswa yang menutup aplikasi atau putus koneksi lebih dari 18 detik otomatis hilang dari daftar aktif.
4. **Detail Telemetry Modal**: Klik kartu siswa untuk melihat:
   - Level Baterai & status Charging
   - Jaringan & SSID WiFi
   - Ping jaringan (ms)
   - Suhu HP (°C)
   - Riwayat kejadian pelanggaran (*timeline*)
5. **Mode Demo / Simulator**: Klik tombol **"Demo Siswa"** di pojok kanan atas untuk langsung menguji tampilan realtime tanpa harus membuka banyak HP.
