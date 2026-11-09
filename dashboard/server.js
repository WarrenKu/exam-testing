/**
 * UjianKita Realtime Exam Monitor Server
 * Super-Admin Dashboard Backend with Server-Sent Events (SSE)
 * Zero external dependencies - runs on vanilla Node.js 18+
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 5000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Super-admin credentials
const ADMIN_USER = 'rick';
const ADMIN_PASS = 'rick';

// Google Spreadsheet Integration (Option 2)
// Student app & teachers data sheet
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '1yduCuweKpzd1GT967C9y-b3FLgRo-0VncdSOmzOoxjs';
const GOOGLE_SHEET_TAB = process.env.GOOGLE_SHEET_TAB || 'Data_Guru';
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(GOOGLE_SHEET_TAB)}`;

// Load default 38 SMAN 18 Batam teachers from data/teachers.json
let defaultTeachers = [];
try {
  const teachersPath = path.join(__dirname, 'data', 'teachers.json');
  if (fs.existsSync(teachersPath)) {
    defaultTeachers = JSON.parse(fs.readFileSync(teachersPath, 'utf8'));
  }
} catch (e) {
  console.warn('Could not read default teachers.json:', e.message);
}

// Staff / Teachers & Pengawas Registry
const SUPER_ADMIN_USER = {
  id: 'DEV-001',
  nsid: 'NSID-DEV-0001',
  code: 'ROOT',
  username: 'rick',
  name: 'Rick Sanchez (Developer Root)',
  nip: 'DEV-ROOT-001',
  role: 'Super-Admin (Developer)',
  subject: 'System Architecture & Dev Options',
  classes: 'Semua Sistem & Root',
  status: 'Aktif',
  privilege: 'Akses Penuh Root & Bypass Kiosk',
  lastLogin: 'Baru saja',
  isSuperAdmin: true,
};

let staffUsers = [SUPER_ADMIN_USER, ...defaultTeachers];

// Google Sheets Sync Status & Cache
let googleSyncStatus = {
  connected: false,
  lastSync: null,
  teacherCount: defaultTeachers.length,
  source: 'teachers.json (Pre-loaded 38 Guru SMAN 18 Batam)',
  sheetTab: GOOGLE_SHEET_TAB,
};
let lastGoogleFetch = 0;
const GOOGLE_CACHE_TTL_MS = 25000;

function fetchUrlWithRedirects(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          const u = new URL(url);
          redirectUrl = u.origin + redirectUrl;
        }
        return resolve(fetchUrlWithRedirects(redirectUrl, maxRedirects - 1));
      }
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const parseRow = (line) => {
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  // Dynamically detect header row (handles title/banner rows at top of sheet)
  let headerLineIndex = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const r = parseRow(lines[i]).map(c => c.toUpperCase().replace(/[^A-Z0-9]/g, ''));
    if (r.some(c => c.includes('KODE') || c.includes('NAMA') || c.includes('MAPEL'))) {
      headerLineIndex = i;
      break;
    }
  }

  const header = parseRow(lines[headerLineIndex]).map((h) => h.toUpperCase().replace(/[^A-Z0-9]/g, ''));
  const rows = [];
  for (let i = headerLineIndex + 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = parseRow(lines[i]);
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = cells[idx] || '';
    });
    rows.push(obj);
  }
  return rows;
}

async function syncGoogleTeachers(force = false) {
  const now = Date.now();
  if (!force && lastGoogleFetch && (now - lastGoogleFetch < GOOGLE_CACHE_TTL_MS)) {
    return;
  }
  lastGoogleFetch = now;
  try {
    const res = await fetchUrlWithRedirects(GOOGLE_SHEET_CSV_URL);
    if (res.status === 200 && res.body && res.body.includes(',')) {
      const rows = parseCsv(res.body);
      if (rows.length > 0) {
        for (const row of rows) {
          const code = String(row.KODEGURU || row.KODE || row.KODEMAPEL || row.USERNAME || '').trim().toUpperCase();
          const name = String(row.NAMAGURU || row.NAMA || row.NAME || '').trim();
          const subject = String(row.MATAPELAJARAN || row.MAPEL || row.SUBJECT || '').trim();
          const password = String(row.PASSWORD || row.PASS || 'admin').trim();
          const role = String(row.ROLE || 'Guru Mata Pelajaran').trim();
          const status = String(row.STATUS || 'Aktif').trim();

          if (!code && !name) continue;

          const existing = staffUsers.find((u) => {
            if (u.isSuperAdmin) return false;
            const matchCode = u.code && u.code.toUpperCase() === code;
            const matchName = u.name && u.name.toLowerCase() === name.toLowerCase();
            return matchCode || matchName;
          });

          if (existing) {
            if (name) existing.name = name;
            if (subject) existing.subject = subject;
            if (password) existing.password = password;
            if (role) existing.role = role;
            if (status) existing.status = status;
          } else if (code) {
            staffUsers.push({
              id: 'GRU-' + String(staffUsers.length + 1).padStart(3, '0'),
              nsid: 'NSID-202611-' + String(staffUsers.length + 1).padStart(4, '0'),
              code,
              username: code.toLowerCase(),
              password: password || 'admin',
              name: name || `Guru (${code})`,
              nip: '-',
              role: role || 'Guru Mata Pelajaran',
              subject: subject || 'Mata Pelajaran Umum',
              classes: 'Semua Rombel',
              status: status || 'Aktif',
              privilege: 'Monitoring Siswa & Buka Kunci Layar Siswa',
              lastLogin: 'Belum pernah',
              isSuperAdmin: false,
            });
          }
        }
        googleSyncStatus = {
          connected: true,
          lastSync: now,
          teacherCount: staffUsers.filter((u) => !u.isSuperAdmin).length,
          source: `Google Spreadsheet (Tab: ${GOOGLE_SHEET_TAB})`,
          sheetTab: GOOGLE_SHEET_TAB,
        };
        return;
      }
    }
  } catch (err) {
    // Graceful fallback without throwing
  }
  googleSyncStatus = {
    connected: false,
    lastSync: now,
    teacherCount: staffUsers.filter((u) => !u.isSuperAdmin).length,
    source: 'teachers.json (Pre-loaded 38 Guru SMAN 18 Batam)',
    sheetTab: GOOGLE_SHEET_TAB,
  };
}

// In-memory active tokens & student state
const activeTokens = new Map(); // token -> user details
const students = new Map(); // key: deviceId, value: StudentData
const sseClients = new Set(); // SSE connected response streams

// Realtime Teacher Presence (Online / Offline Detection)
// Key: uppercase teacher code, ID, or 'SUPERADMIN' -> { lastHeartbeat, user }
const activeTeacherPresence = new Map();

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Belum pernah';
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return 'Baru saja';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} menit lalu`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} jam lalu`;
  return `${Math.floor(diffSec / 86400)} hari lalu`;
}

function broadcastTeachersPresence() {
  const now = Date.now();
  for (const [key, p] of activeTeacherPresence.entries()) {
    if (now - p.lastHeartbeat > 25000) {
      activeTeacherPresence.delete(key);
    }
  }
  const onlineKeys = Array.from(activeTeacherPresence.keys());
  broadcast({ type: 'TEACHERS_PRESENCE_UPDATE', onlineKeys });
}

// Periodic presence cleanup: expire teachers inactive for >25 seconds
setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [key, p] of activeTeacherPresence.entries()) {
    if (now - p.lastHeartbeat > 25000) {
      activeTeacherPresence.delete(key);
      changed = true;
    }
  }
  if (changed) {
    const onlineKeys = Array.from(activeTeacherPresence.keys());
    broadcast({ type: 'TEACHERS_PRESENCE_UPDATE', onlineKeys });
  }
}, 8000);

// Realtime Announcement Broadcasts (Per-student or Mass All-Students)
// activeBroadcast: { id, title, message, target: 'all' | deviceId, timestamp, expiresAt }
let activeBroadcast = null;
const studentBroadcasts = new Map(); // key: deviceId, value: broadcastObj

// Simulator state
let simulatorInterval = null;

// Auto-purge stale students only after 20 MINUTES (1,200,000 ms) without heartbeat
// Student sessions stay visible even if phone is turned off or signal drops
const AUTO_PURGE_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

setInterval(() => {
  const now = Date.now();
  let changed = false;
  for (const [id, s] of students.entries()) {
    if (now - s.lastSeen > AUTO_PURGE_TIMEOUT_MS) {
      students.delete(id);
      changed = true;
    }
  }
  if (changed) {
    broadcast({ type: 'SYNC_STUDENTS', students: Array.from(students.values()) });
  }
}, 15000);

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

function getAuthUser(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  return activeTokens.get(token) || null;
}

function canEditStaff(req) {
  const user = getAuthUser(req);
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  const role = String(user.role || '').toLowerCase();
  return role.includes('admin');
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

// HTTP Server & Serverless Request Handler
async function requestHandler(req, res) {
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

  // 0. Server Health & Realtime Communication Status Check
  if (pathname === '/api/health' && req.method === 'GET') {
    // Non-blocking trigger so health check returns in <15ms
    syncGoogleTeachers().catch(() => {});
    return sendJson(res, 200, {
      status: 'online',
      message: 'Server Realtime Terhubung & Siap Berkomunikasi',
      domain: req.headers.host || 'sman18.warren.my.id',
      timestamp: Date.now(),
      studentsCount: students.size,
      connectedClients: sseClients.size,
      activeBroadcast: Boolean(activeBroadcast),
      googleSync: googleSyncStatus,
      uptimeSeconds: Math.floor(process.uptime()),
    });
  }

  // 1. Login (Super-Admin or Guru via Kode Guru / Google Sheet)
  if (pathname === '/api/login' && req.method === 'POST') {
    const { username, password } = await parseBody(req);
    const cleanUser = String(username || '').trim();
    const cleanPass = String(password || '').trim();

    // Trigger non-blocking/cached sync from Google Sheets
    await syncGoogleTeachers();

    // Check Super-Admin credentials
    if (cleanUser.toLowerCase() === ADMIN_USER.toLowerCase() && cleanPass === ADMIN_PASS) {
      const token = crypto.randomBytes(24).toString('hex');
      const superAdminUser = {
        username: ADMIN_USER,
        name: 'Rick Sanchez (Developer Root)',
        role: 'Super-Admin',
        isSuperAdmin: true,
      };
      activeTokens.set(token, superAdminUser);
      activeTeacherPresence.set('SUPERADMIN', {
        lastHeartbeat: Date.now(),
        user: superAdminUser,
      });
      broadcastTeachersPresence();

      return sendJson(res, 200, {
        success: true,
        token,
        user: superAdminUser
      });
    }

    // Check Teacher / Staff accounts (matching Kode Guru, username, or name)
    const teacher = staffUsers.find((u) => {
      if (u.isSuperAdmin) return false;
      const uCode = String(u.code || '').trim().toLowerCase();
      const uUsername = String(u.username || '').trim().toLowerCase();
      const uName = String(u.name || '').trim().toLowerCase();
      const target = cleanUser.toLowerCase();
      return uCode === target || uUsername === target || uName === target;
    });

    if (teacher) {
      const expectedPass = String(teacher.password || 'admin').trim();
      if (cleanPass === expectedPass) {
        if (teacher.status === 'Nonaktif') {
          return sendJson(res, 403, { success: false, message: 'Akun guru ini sedang dinonaktifkan oleh administrator.' });
        }

        const token = crypto.randomBytes(24).toString('hex');
        const teacherUser = {
          id: teacher.id,
          code: teacher.code,
          username: teacher.code || teacher.username,
          name: teacher.name,
          role: teacher.role || 'Guru Mata Pelajaran',
          subject: teacher.subject,
          isSuperAdmin: false,
        };
        activeTokens.set(token, teacherUser);
        
        const teacherKey = (teacher.code || teacher.id).toUpperCase();
        activeTeacherPresence.set(teacherKey, {
          lastHeartbeat: Date.now(),
          user: teacherUser,
        });
        teacher.lastLoginTimestamp = Date.now();
        teacher.lastLogin = 'Sedang Aktif';
        broadcastTeachersPresence();

        return sendJson(res, 200, {
          success: true,
          token,
          user: teacherUser
        });
      }
    }

    return sendJson(res, 401, { success: false, message: 'Kode Guru atau Password salah!' });
  }

  // 1b. Realtime Logout
  if (pathname === '/api/logout' && req.method === 'POST') {
    const auth = req.headers['authorization'] || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const user = activeTokens.get(token);
    if (user) {
      const key = (user.isSuperAdmin ? 'SUPERADMIN' : (user.code || user.id || '')).toUpperCase();
      activeTeacherPresence.delete(key);
      activeTokens.delete(token);

      const teacher = staffUsers.find((u) => u.id === user.id || (u.code && u.code.toUpperCase() === key));
      if (teacher) {
        teacher.lastLoginTimestamp = Date.now();
        teacher.lastLogin = 'Baru saja';
      }
      broadcastTeachersPresence();
    }
    return sendJson(res, 200, { success: true, message: 'Berhasil logout' });
  }

  // 1c. Teacher / User Realtime Heartbeat (Keep-alive presence)
  if (pathname === '/api/teachers/heartbeat' && req.method === 'POST') {
    const auth = req.headers['authorization'] || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const user = activeTokens.get(token);
    if (!user) {
      return sendJson(res, 401, { error: 'Unauthorized' });
    }
    const key = (user.isSuperAdmin ? 'SUPERADMIN' : (user.code || user.id || '')).toUpperCase();
    if (key) {
      activeTeacherPresence.set(key, {
        lastHeartbeat: Date.now(),
        user,
      });
    }
    return sendJson(res, 200, { success: true, isOnline: true });
  }

  // 2. Auth Check
  if (pathname === '/api/auth/check' && req.method === 'GET') {
    const auth = req.headers['authorization'] || '';
    const token = auth.replace(/^Bearer\s+/i, '').trim();
    const user = activeTokens.get(token) || null;
    return sendJson(res, 200, { authenticated: Boolean(user), user });
  }

  // 3. Telemetry Ingest from Android APK
  if (pathname === '/api/telemetry' && req.method === 'POST') {
    try {
      const data = await parseBody(req);
      const nameStr = String((data && data.name) || 'Siswa Ujian');
      const labelStr = String((data && data.deviceLabel) || 'Android Device');
      const seed = nameStr + labelStr + Date.now();
      const deviceId = (data && data.deviceId && String(data.deviceId).trim())
        || ('DEV-' + crypto.createHash('md5').update(seed).digest('hex').substring(0, 8));

      const now = Date.now();
      const existing = students.get(deviceId) || {
        deviceId,
        name: nameStr,
        className: String((data && data.className) || 'XI MIPA'),
        subject: String((data && data.subject) || 'Ujian Sekolah'),
        deviceLabel: labelStr,
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

      // Check if remote unlock was issued for this student
      let shouldUnlock = false;
      if (existing.unlockRequested) {
        shouldUnlock = true;
        existing.unlockRequested = false;
        existing.status = 'mengerjakan';
        existing.leaveCount = 0;
      }

      students.set(deviceId, existing);

      // Broadcast updated student to dashboard
      broadcast({ type: 'STUDENT_UPDATE', student: existing });

      // Determine pending broadcast for this student (targeted has higher priority than mass)
      let pendingBroadcast = null;
      const targeted = studentBroadcasts.get(deviceId);
      if (targeted && targeted.expiresAt > now) {
        pendingBroadcast = targeted;
      } else if (activeBroadcast && activeBroadcast.expiresAt > now) {
        pendingBroadcast = activeBroadcast;
      }

      return sendJson(res, 200, {
        success: true,
        shouldUnlock,
        broadcast: pendingBroadcast,
      });
    } catch (err) {
      console.error('Error handling /api/telemetry:', err);
      return sendJson(res, 500, { error: 'Internal Server Error' });
    }
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
      s.unlockRequested = true; // Signal APK to immediately unlock on next heartbeat
      s.violationLogs.push({
        timestamp: Date.now(),
        text: 'Sesi dibuka kembali dari jarak jauh oleh Super-Admin'
      });
      broadcast({ type: 'STUDENT_UPDATE', student: s });
      return sendJson(res, 200, { success: true });
    }
    return sendJson(res, 404, { error: 'Siswa tidak ditemukan' });
  }

  // 5b. Clear All Student Sessions (Bersihkan Sesi)
  if (pathname === '/api/students/clear' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    students.clear();
    broadcast({ type: 'INIT', students: [] });
    return sendJson(res, 200, { success: true, message: 'Seluruh sesi siswa berhasil dibersihkan.' });
  }

  // 5b. Realtime Broadcast Command (Single Student or Mass All Students)
  if (pathname === '/api/broadcast' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    const { target, title, message, durationSeconds } = await parseBody(req);
    if (!message || !message.trim()) {
      return sendJson(res, 400, { error: 'Pesan siaran tidak boleh kosong!' });
    }

    const duration = (durationSeconds && Number(durationSeconds) > 0) ? Number(durationSeconds) : 120;
    const now = Date.now();
    const isAll = !target || target === 'all';

    const broadcastObj = {
      id: 'BC-' + now,
      title: (title || 'PENGUMUMAN PENGAWAS').trim(),
      message: message.trim(),
      target: isAll ? 'all' : target,
      targetName: isAll ? 'Semua Siswa' : (students.get(target)?.name || target),
      timestamp: now,
      expiresAt: now + (duration * 1000),
    };

    if (isAll) {
      activeBroadcast = broadcastObj;
    } else {
      studentBroadcasts.set(target, broadcastObj);
    }

    // Push realtime event to all connected dashboards
    broadcast({ type: 'BROADCAST_SENT', broadcast: broadcastObj });

    return sendJson(res, 200, {
      success: true,
      broadcast: broadcastObj,
      message: `Siaran berhasil dikirim ke ${broadcastObj.targetName}`
    });
  }

  // 5c. Get Active Broadcasts
  if (pathname === '/api/broadcast' && req.method === 'GET') {
    const now = Date.now();
    const liveActive = (activeBroadcast && activeBroadcast.expiresAt > now) ? activeBroadcast : null;
    return sendJson(res, 200, {
      success: true,
      activeBroadcast: liveActive,
      studentBroadcastsCount: studentBroadcasts.size,
    });
  }

  // 5d. Clear Active Broadcast
  if (pathname === '/api/broadcast' && req.method === 'DELETE') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    activeBroadcast = null;
    studentBroadcasts.clear();
    broadcast({ type: 'BROADCAST_CLEARED' });
    return sendJson(res, 200, { success: true, message: 'Semua siaran aktif telah dihentikan' });
  }

  // 6. Realtime Server-Sent Events (SSE) Stream
  if (pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`data: ${JSON.stringify({ 
      type: 'INIT', 
      students: Array.from(students.values()),
      onlineTeachers: Array.from(activeTeacherPresence.keys())
    })}\n\n`);
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
    await syncGoogleTeachers();
    const viewRole = urlObj.searchParams.get('viewRole') || req.headers['x-view-role'] || 'superadmin';
    const isSuperAdminView = viewRole === 'superadmin';
    const rawList = isSuperAdminView ? staffUsers : staffUsers.filter(u => !u.isSuperAdmin);

    const now = Date.now();
    const list = rawList.map((u) => {
      const key = (u.isSuperAdmin ? 'SUPERADMIN' : (u.code || u.id || '')).toUpperCase();
      const session = activeTeacherPresence.get(key);
      const isOnline = Boolean(session && (now - session.lastHeartbeat <= 25000));
      return {
        ...u,
        isOnline,
        presence: isOnline ? 'Online' : 'Offline',
        lastLogin: isOnline ? 'Sedang Aktif' : (u.lastLoginTimestamp ? formatTimeAgo(u.lastLoginTimestamp) : (u.lastLogin && u.lastLogin !== 'Sedang Aktif' ? u.lastLogin : 'Belum pernah')),
      };
    });

    return sendJson(res, 200, {
      success: true,
      viewRole,
      googleSync: googleSyncStatus,
      superAdminHidden: !isSuperAdminView,
      teachers: list,
    });
  }

  if (pathname === '/api/teachers' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    if (!canEditStaff(req)) {
      return sendJson(res, 403, { error: 'Hanya Super-Admin dan Admin yang memiliki izin menambah akun guru.' });
    }
    const payload = await parseBody(req);
    if (!payload.name) return sendJson(res, 400, { error: 'Nama guru wajib diisi' });
    
    const newId = payload.id || `GRU-${String(staffUsers.length + 301).padStart(3, '0')}`;
    const newNsid = (payload.nsid && payload.nsid.trim())
      ? payload.nsid.trim()
      : `NSID-202611-${String(staffUsers.length + 301).padStart(4, '0')}`;

    const newUser = {
      id: newId,
      nsid: newNsid,
      username: (payload.username || payload.name.toLowerCase().replace(/[^a-z0-9]/g, '.')).slice(0, 20),
      name: payload.name,
      nip: payload.nip || '-',
      role: payload.role || 'Guru Mata Pelajaran',
      subject: payload.subject || 'Mata Pelajaran Umum',
      classes: payload.classes || 'Semua Kelas',
      status: payload.status || 'Aktif',
      privilege: payload.privilege || 'Monitoring Siswa & Buka Kunci Layar Siswa',
      lastLogin: 'Belum pernah',
      isSuperAdmin: false,
    };
    staffUsers.push(newUser);
    return sendJson(res, 201, { success: true, teacher: newUser });
  }

  if (pathname === '/api/teachers/edit' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    if (!canEditStaff(req)) {
      return sendJson(res, 403, { error: 'Hanya Super-Admin dan Admin yang memiliki izin mengedit data guru.' });
    }
    const payload = await parseBody(req);
    const target = staffUsers.find(u => u.id === payload.id);
    if (!target) return sendJson(res, 404, { error: 'Pengguna tidak ditemukan' });
    if (target.isSuperAdmin && !getAuthUser(req)?.isSuperAdmin) {
      return sendJson(res, 403, { error: 'Hanya Super-Admin yang dapat mengedit akun Super-Admin.' });
    }

    if (payload.name) target.name = String(payload.name).trim();
    if (payload.nip !== undefined) target.nip = String(payload.nip).trim();
    if (payload.role) target.role = String(payload.role).trim();
    if (payload.subject) target.subject = String(payload.subject).trim();
    if (payload.classes !== undefined) target.classes = String(payload.classes).trim();
    if (payload.status) target.status = String(payload.status).trim();
    if (payload.password) target.password = String(payload.password).trim();

    return sendJson(res, 200, { success: true, teacher: target });
  }

  if (pathname === '/api/teachers/toggle-status' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    if (!canEditStaff(req)) {
      return sendJson(res, 403, { error: 'Hanya Super-Admin dan Admin yang memiliki izin mengubah status keaktifan akun.' });
    }
    const { id } = await parseBody(req);
    const user = staffUsers.find(u => u.id === id);
    if (!user) return sendJson(res, 404, { error: 'Pengguna tidak ditemukan' });
    if (user.isSuperAdmin) return sendJson(res, 403, { error: 'Status Super-Admin tidak dapat dinonaktifkan' });
    user.status = user.status === 'Aktif' ? 'Nonaktif' : 'Aktif';
    return sendJson(res, 200, { success: true, user });
  }

  if (pathname === '/api/teachers/reset-password' && req.method === 'POST') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    if (!canEditStaff(req)) {
      return sendJson(res, 403, { error: 'Hanya Super-Admin dan Admin yang memiliki izin mereset sandi akun.' });
    }
    const { id } = await parseBody(req);
    const user = staffUsers.find(u => u.id === id);
    if (!user) return sendJson(res, 404, { error: 'Pengguna tidak ditemukan' });
    const tempPass = 'UK-' + Math.floor(100000 + Math.random() * 900000);
    user.password = tempPass;
    return sendJson(res, 200, {
      success: true,
      message: `Password akun ${user.name} berhasil direset!`,
      tempPassword: tempPass,
    });
  }

  if (pathname === '/api/teachers' && req.method === 'DELETE') {
    if (!checkAuth(req)) return sendJson(res, 401, { error: 'Unauthorized' });
    if (!canEditStaff(req)) {
      return sendJson(res, 403, { error: 'Hanya Super-Admin dan Admin yang memiliki izin menghapus akun.' });
    }
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
}

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

const server = http.createServer(requestHandler);

if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(` 🚀 UjianKita Realtime Monitor Server Active!`);
    console.log(` 🌐 Dashboard URL: http://localhost:${PORT}`);
    console.log(` 🔑 Super-Admin:   rick / rick`);
    console.log(` 📡 Telemetry API: http://localhost:${PORT}/api/telemetry`);
    console.log(`======================================================\n`);
  });
}

module.exports = requestHandler;
