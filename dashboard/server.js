/**
 * UjianKita Realtime Exam Monitor Server
 * Super-Admin Dashboard Backend with Server-Sent Events (SSE)
 * Zero external dependencies - runs on vanilla Node.js 18+
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 5000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Super-admin credentials
const ADMIN_USER = 'rick';
const ADMIN_PASS = 'rick';

// Staff / Teachers & Pengawas Registry
// Privacy Rule: Super-admin account (isSuperAdmin: true) is Developer-only
// and MUST NEVER be exposed to regular roles (Guru, Pengawas, etc.)
let staffUsers = [
  {
    id: 'DEV-001',
    username: 'rick',
    name: 'Rick Sanchez (Developer Root)',
    nip: 'DEV-ROOT-001',
    role: 'Super-Admin (Developer)',
    subject: 'System Architecture & Dev Options',
    room: 'Ruang Server Pusat',
    status: 'Aktif',
    privilege: 'Akses Penuh Root & Bypass Kiosk',
    lastLogin: 'Baru saja',
    isSuperAdmin: true,
  },
  {
    id: 'ADM-101',
    username: 'hendra.gunawan',
    name: 'Drs. Hendra Gunawan, M.Pd',
    nip: '19790514 200501 1 008',
    role: 'Admin Kurikulum',
    subject: 'Koordinator Bank Soal & Jadwal',
    room: 'Ruang Kurikulum',
    status: 'Aktif',
    privilege: 'Kelola Jadwal, Token, & Nilai',
    lastLogin: '10 menit lalu',
    isSuperAdmin: false,
  },
  {
    id: 'PRK-201',
    username: 'siti.nurhaliza',
    name: 'Siti Nurhaliza, S.Kom',
    nip: '19850320 200902 2 004',
    role: 'Proktor Utama',
    subject: 'Server CBT & Lab Komputer',
    room: 'Lab Komputer 1',
    status: 'Aktif',
    privilege: 'Sinkronisasi Token & Restart Sesi',
    lastLogin: '3 menit lalu',
    isSuperAdmin: false,
  },
  {
    id: 'PRK-202',
    username: 'doni.pratama',
    name: 'Doni Pratama, S.T',
    nip: '19940115 201903 1 007',
    role: 'Proktor Cadangan',
    subject: 'Teknis Jaringan & Perangkat',
    room: 'Lab Multimedia',
    status: 'Aktif',
    privilege: 'Infrastruktur LAN & Kiosk APK',
    lastLogin: '1 jam lalu',
    isSuperAdmin: false,
  },
  {
    id: 'GRU-301',
    username: 'budi.santoso',
    name: 'Budi Santoso, S.Pd',
    nip: '19821105 200801 1 012',
    role: 'Guru Pengawas',
    subject: 'Matematika Peminatan & Wajib',
    room: 'Ruang Ujian 01',
    status: 'Aktif',
    privilege: 'Presensi & Pengawasan Ruang 01',
    lastLogin: '25 menit lalu',
    isSuperAdmin: false,
  },
  {
    id: 'GRU-302',
    username: 'dewi.lestari',
    name: 'Dewi Lestari, M.Si',
    nip: '19880719 201101 2 009',
    role: 'Guru Pengawas',
    subject: 'Fisika & Kimia IPA',
    room: 'Ruang Ujian 02',
    status: 'Aktif',
    privilege: 'Presensi & Pengawasan Ruang 02',
    lastLogin: '45 menit lalu',
    isSuperAdmin: false,
  },
  {
    id: 'GRU-303',
    username: 'ahmad.fauzi',
    name: 'Ahmad Fauzi, S.Pd',
    nip: '19910412 201502 1 003',
    role: 'Guru Pengawas',
    subject: 'Bahasa Indonesia & Sastra',
    room: 'Ruang Ujian 03',
    status: 'Aktif',
    privilege: 'Presensi & Pengawasan Ruang 03',
    lastLogin: 'Hari ini, 07:15',
    isSuperAdmin: false,
  },
  {
    id: 'GRU-304',
    username: 'rina.agustina',
    name: 'Rina Agustina, S.Pd',
    nip: '19890928 201403 2 006',
    role: 'Guru Pengawas',
    subject: 'Bahasa Inggris Wajib',
    room: 'Ruang Ujian 04',
    status: 'Nonaktif',
    privilege: 'Cuti Dinas / Pengawas Pengganti',
    lastLogin: '3 hari lalu',
    isSuperAdmin: false,
  },
  {
    id: 'GRU-305',
    username: 'hartono.pai',
    name: 'Drs. H. Hartono, M.Ag',
    nip: '19750208 200212 1 002',
    role: 'Guru Pengawas',
    subject: 'Pendidikan Agama & Budi Pekerti',
    room: 'Ruang Ujian 05',
    status: 'Aktif',
    privilege: 'Presensi & Pengawasan Ruang 05',
    lastLogin: 'Hari ini, 07:30',
    isSuperAdmin: false,
  },
];

// In-memory active tokens & student state
const activeTokens = new Set();
const students = new Map(); // key: deviceId, value: StudentData
const sseClients = new Set(); // SSE connected response streams

// Simulator state
let simulatorInterval = null;

// Clean up stale students (no heartbeat for 18 seconds)
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [id, s] of students.entries()) {
    if (now - s.lastSeen > 18000) {
      students.delete(id);
      changed = true;
    }
  }
  if (changed) {
    broadcast({ type: 'SYNC_STUDENTS', students: Array.from(students.values()) });
  }
}, 3000);

// Broadcast event to all connected dashboard SSE clients
function broadcast(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch (_) {
      sseClients.delete(res);
    }
  }
}

// Helpers
function sendJson(res, statusCode, obj) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  res.end(JSON.stringify(obj));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy(); // 1MB limit
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function checkAuth(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  return activeTokens.has(token);
}

// MIME types for static file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// HTTP Server
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    });
    return res.end();
  }

  // --- API ROUTES ---

  // 1. Login
  if (pathname === '/api/login' && req.method === 'POST') {
    const { username, password } = await parseBody(req);
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      const token = crypto.randomBytes(24).toString('hex');
      activeTokens.add(token);
      return sendJson(res, 200, {
        success: true,
        token,
        user: { username: ADMIN_USER, role: 'Super-Admin' }
      });
    }
    return sendJson(res, 401, { success: false, message: 'Username atau password salah!' });
  }

  // 2. Auth Check
  if (pathname === '/api/auth/check' && req.method === 'GET') {
    return sendJson(res, 200, { authenticated: checkAuth(req) });
  }

  // 3. Telemetry Ingest from Android APK
  if (pathname === '/api/telemetry' && req.method === 'POST') {
    const data = await parseBody(req);
    const deviceId = data.deviceId || 'DEV-' + crypto.createHash('md5').update(data.name + data.deviceLabel).digest('hex').substring(0, 8);

    const now = Date.now();
    const existing = students.get(deviceId) || {
      deviceId,
      name: data.name || 'Siswa Ujian',
      className: data.className || 'X.1',
      subject: data.subject || 'Ujian Sekolah',
      deviceLabel: data.deviceLabel || 'Android Device',
      startTime: now,
      violationLogs: [],
    };

    const prevStatus = existing.status;
    const newStatus = data.status || 'mengerjakan';

    // Record violation event if status changed to keluar or terkunci
    if (newStatus !== prevStatus) {
      if (newStatus === 'keluar') {
        existing.violationLogs.push({
          timestamp: now,
          text: `Keluar aplikasi / membuka notifikasi (Pelanggaran ${data.leaveCount || 1}/3)`
        });
      } else if (newStatus === 'terkunci') {
        existing.violationLogs.push({
          timestamp: now,
          text: `Sesi terkunci! Melanggar batas keluar aplikasi 3x`
        });
      } else if (newStatus === 'selesai') {
        existing.violationLogs.push({
          timestamp: now,
          text: `Menyelesaikan ujian`
        });
      }
    }

    // Update state
    existing.name = data.name || existing.name;
    existing.className = data.className || existing.className;
    existing.subject = data.subject || existing.subject;
    existing.deviceLabel = data.deviceLabel || existing.deviceLabel;
    existing.status = newStatus;
    existing.leaveCount = data.leaveCount !== undefined ? data.leaveCount : existing.leaveCount || 0;
    existing.batteryLevel = data.batteryLevel !== undefined ? data.batteryLevel : 85;
    existing.isCharging = data.isCharging || false;
    existing.temperature = data.temperature || 36.0;
    existing.network = data.network || 'Wi-Fi';
    existing.pingMs = data.pingMs || Math.floor(Math.random() * 12 + 6);
    existing.lastSeen = now;

    students.set(deviceId, existing);

    // Broadcast updated student to dashboard
    broadcast({ type: 'STUDENT_UPDATE', student: existing });

    return sendJson(res, 200, { success: true });
  }

  // 4. Get active students list
  if (pathname === '/api/students' && req.method === 'GET') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    return sendJson(res, 200, { students: Array.from(students.values()) });
  }

  // 5. Remote Unlock Command
  if (pathname === '/api/students/unlock' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const { deviceId } = await parseBody(req);
    const s = students.get(deviceId);
    if (s) {
      s.status = 'mengerjakan';
      s.leaveCount = 0;
      s.violationLogs.push({
        timestamp: Date.now(),
        text: 'Sesi dibuka kembali dari jarak jauh oleh Super-Admin'
      });
      broadcast({ type: 'STUDENT_UPDATE', student: s });
      return sendJson(res, 200, { success: true });
    }
    return sendJson(res, 404, { error: 'Siswa tidak ditemukan' });
  }

  // 6. Realtime Server-Sent Events (SSE) Stream
  if (pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`data: ${JSON.stringify({ type: 'INIT', students: Array.from(students.values()) })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // 7. Simulator Control
  if (pathname === '/api/simulator/toggle' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const { active } = await parseBody(req);
    if (active && !simulatorInterval) {
      startSimulator();
    } else if (!active && simulatorInterval) {
      stopSimulator();
    }
    return sendJson(res, 200, { running: !!simulatorInterval, count: students.size });
  }

  // 8. Staff / Teachers & Pengawas Management (User ID)
  // PRIVACY RULE: If viewRole is regular/guru/proktor/admin, Super-Admin dev account is HIDDEN!
  if (pathname === '/api/teachers' && req.method === 'GET') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const viewRole = urlObj.searchParams.get('viewRole') || req.headers['x-view-role'] || 'superadmin';
    const isSuperAdminView = viewRole === 'superadmin';
    const list = isSuperAdminView ? staffUsers : staffUsers.filter(u => !u.isSuperAdmin);
    return sendJson(res, 200, {
      success: true,
      viewRole,
      superAdminHidden: !isSuperAdminView,
      teachers: list,
    });
  }

  if (pathname === '/api/teachers' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const payload = await parseBody(req);
    if (!payload.name) return sendJson(res, 400, { error: 'Nama guru wajib diisi' });
    
    const newId = payload.id || `GRU-${String(staffUsers.length + 301).padStart(3, '0')}`;
    const newUser = {
      id: newId,
      username: (payload.username || payload.name.toLowerCase().replace(/[^a-z0-9]/g, '.')).slice(0, 20),
      name: payload.name,
      nip: payload.nip || '-',
      role: payload.role || 'Guru Pengawas',
      subject: payload.subject || 'Mata Pelajaran Umum',
      room: payload.room || 'Ruang 01',
      status: payload.status || 'Aktif',
      privilege: payload.privilege || 'Presensi & Pengawasan Ruang',
      lastLogin: 'Belum pernah',
      isSuperAdmin: false,
    };
    staffUsers.push(newUser);
    return sendJson(res, 201, { success: true, teacher: newUser });
  }

  if (pathname === '/api/teachers/toggle-status' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const { id } = await parseBody(req);
    const user = staffUsers.find(u => u.id === id);
    if (!user) return sendJson(res, 404, { error: 'Pengguna tidak ditemukan' });
    if (user.isSuperAdmin) return sendJson(res, 403, { error: 'Status Super-Admin tidak dapat dinonaktifkan' });
    user.status = user.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    return sendJson(res, 200, { success: true, user });
  }

  if (pathname === '/api/teachers/reset-password' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const { id } = await parseBody(req);
    const user = staffUsers.find(u => u.id === id);
    if (!user) return sendJson(res, 404, { error: 'Pengguna tidak ditemukan' });
    const tempPass = 'UK-' + Math.floor(100000 + Math.random() * 900000);
    return sendJson(res, 200, {
      success: true,
      message: `Password akun ${user.name} berhasil direset!`,
      tempPassword: tempPass,
    });
  }

  if (pathname === '/api/teachers' && req.method === 'DELETE') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const { id } = await parseBody(req);
    const target = staffUsers.find(u => u.id === id);
    if (!target) return sendJson(res, 404, { error: 'Pengguna tidak ditemukan' });
    if (target.isSuperAdmin) return sendJson(res, 403, { error: 'Super-Admin tidak dapat dihapus!' });
    staffUsers = staffUsers.filter(u => u.id !== id);
    return sendJson(res, 200, { success: true });
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading file');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

// Built-in Simulator for Instant Demo
function startSimulator() {
  const sampleStudents = [
    { name: 'ANDI PRATAMA', className: 'X.1', deviceLabel: 'Xiaomi Redmi Note 10', subject: 'INFORMATIKA X' },
    { name: 'BELLA SAFITRI', className: 'X.1', deviceLabel: 'Samsung Galaxy A14', subject: 'INFORMATIKA X' },
    { name: 'DIMAS SETIAWAN', className: 'X.2', deviceLabel: 'Oppo A57', subject: 'INFORMATIKA X' },
    { name: 'CITRA LESTARI', className: 'X.2', deviceLabel: 'Vivo Y21', subject: 'INFORMATIKA X' },
    { name: 'FAJAR HIDAYAT', className: 'XI.3', deviceLabel: 'Realme C35', subject: 'SOSIOLOGI XI' },
    { name: 'GITA MAHARANI', className: 'XI.4', deviceLabel: 'Infinix Hot 20', subject: 'SOSIOLOGI XI' },
    { name: 'HENDRA WIJAYA', className: 'X.3', deviceLabel: 'Xiaomi Poco M4', subject: 'INFORMATIKA X' },
    { name: 'INDAH PERMATA', className: 'XI.1', deviceLabel: 'Samsung Galaxy A32', subject: 'PAI XI' },
  ];

  sampleStudents.forEach((sample, i) => {
    const id = `SIM-DEV-00${i + 1}`;
    const initialStatus = i === 2 ? 'keluar' : i === 4 ? 'terkunci' : i === 6 ? 'selesai' : 'mengerjakan';
    students.set(id, {
      deviceId: id,
      name: sample.name,
      className: sample.className,
      subject: sample.subject,
      deviceLabel: sample.deviceLabel,
      status: initialStatus,
      leaveCount: initialStatus === 'terkunci' ? 3 : initialStatus === 'keluar' ? 1 : 0,
      batteryLevel: Math.floor(Math.random() * 35 + 60),
      isCharging: Math.random() > 0.7,
      temperature: Number((35.5 + Math.random() * 2.5).toFixed(1)),
      network: 'Wi-Fi SMAN18-GUEST',
      pingMs: Math.floor(Math.random() * 12 + 6),
      startTime: Date.now() - (i * 240000 + 120000),
      lastSeen: Date.now(),
      violationLogs: initialStatus === 'terkunci' ? [
        { timestamp: Date.now() - 400000, text: 'Keluar aplikasi (Pelanggaran 1/3)' },
        { timestamp: Date.now() - 250000, text: 'Keluar aplikasi (Pelanggaran 2/3)' },
        { timestamp: Date.now() - 60000, text: 'Sesi terkunci! Melanggar batas keluar aplikasi 3x' },
      ] : initialStatus === 'keluar' ? [
        { timestamp: Date.now() - 30000, text: 'Keluar aplikasi / membuka WhatsApp (Pelanggaran 1/3)' }
      ] : [
        { timestamp: Date.now() - 300000, text: 'Sesi ujian dimulai' }
      ]
    });
  });

  broadcast({ type: 'SYNC_STUDENTS', students: Array.from(students.values()) });

  simulatorInterval = setInterval(() => {
    for (const s of students.values()) {
      if (!s.deviceId.startsWith('SIM-')) continue;
      s.lastSeen = Date.now();
      s.pingMs = Math.floor(Math.random() * 10 + 6);
      s.temperature = Number((36.0 + Math.random() * 1.5).toFixed(1));
      if (Math.random() > 0.95 && s.batteryLevel > 15) {
        s.batteryLevel -= 1;
      }
      broadcast({ type: 'STUDENT_UPDATE', student: s });
    }
  }, 3500);
}

function stopSimulator() {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    simulatorInterval = null;
  }
  for (const [id] of students.entries()) {
    if (id.startsWith('SIM-')) students.delete(id);
  }
  broadcast({ type: 'SYNC_STUDENTS', students: Array.from(students.values()) });
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(` 🚀 UjianKita Realtime Monitor Server Active!`);
  console.log(` 🌐 Dashboard URL: http://localhost:${PORT}`);
  console.log(` 🔑 Super-Admin:   rick / rick`);
  console.log(` 📡 Telemetry API: http://localhost:${PORT}/api/telemetry`);
  console.log(`======================================================\n`);
});
