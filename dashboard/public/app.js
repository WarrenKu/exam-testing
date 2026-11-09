/**
 * UjianKita Realtime Monitor · Client Application
 * Glisse Liquid Glass Dashboard Controller
 */

// Application State
const state = {
  token: localStorage.getItem('ujiankita_auth_token') || '',
  students: new Map(), // key: deviceId, value: StudentData
  activeFilter: 'all',
  searchQuery: '',
  selectedStudentId: null,
  eventSource: null,
  simulatorRunning: false,
};

// DOM Elements
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const loginErrorMsg = document.getElementById('loginErrorMsg');
const logoutBtn = document.getElementById('logoutBtn');

const liveClock = document.getElementById('liveClock');
const sseStatusText = document.getElementById('sseStatusText');
const toggleSimulatorBtn = document.getElementById('toggleSimulatorBtn');
const simBtnText = document.getElementById('simBtnText');

const countAll = document.getElementById('countAll');
const countMengerjakan = document.getElementById('countMengerjakan');
const countKeluar = document.getElementById('countKeluar');
const countTerkunci = document.getElementById('countTerkunci');
const countSelesai = document.getElementById('countSelesai');

const searchInput = document.getElementById('searchInput');
const filterTabs = document.querySelectorAll('.filter-tab');
const studentsGrid = document.getElementById('studentsGrid');
const emptyState = document.getElementById('emptyState');

// Modal Elements
const detailModal = document.getElementById('detailModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const closeModalActionBtn = document.getElementById('closeModalActionBtn');
const modalStudentName = document.getElementById('modalStudentName');
const modalStudentClass = document.getElementById('modalStudentClass');
const modalDeviceLabel = document.getElementById('modalDeviceLabel');
const modalSubject = document.getElementById('modalSubject');
const modalStatusBanner = document.getElementById('modalStatusBanner');
const modalStatusText = document.getElementById('modalStatusText');
const modalBattery = document.getElementById('modalBattery');
const modalBatterySub = document.getElementById('modalBatterySub');
const modalNetwork = document.getElementById('modalNetwork');
const modalPing = document.getElementById('modalPing');
const modalTemperature = document.getElementById('modalTemperature');
const modalTimeline = document.getElementById('modalTimeline');
const remoteUnlockBtn = document.getElementById('remoteUnlockBtn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  setupEventListeners();

  if (state.token) {
    showDashboard();
  } else {
    showLogin();
  }
});

// --- Live Clock ---
function initClock() {
  const updateClock = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
    liveClock.textContent = timeStr;
  };
  updateClock();
  setInterval(updateClock, 1000);
}

// --- Event Listeners ---
function setupEventListeners() {
  // Password Visibility Toggle
  togglePasswordBtn.addEventListener('click', () => {
    const isPass = passwordInput.type === 'password';
    passwordInput.type = isPass ? 'text' : 'password';
  });

  // Login Form Submission
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErrorMsg.style.display = 'none';

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await resp.json();

      if (resp.ok && data.success && data.token) {
        state.token = data.token;
        localStorage.setItem('ujiankita_auth_token', data.token);
        showDashboard();
      } else {
        loginErrorMsg.textContent = data.message || 'Login gagal. Periksa username dan password.';
        loginErrorMsg.style.display = 'block';
      }
    } catch (err) {
      loginErrorMsg.textContent = 'Gagal terhubung ke server.';
      loginErrorMsg.style.display = 'block';
    }
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('ujiankita_auth_token');
    state.token = '';
    if (state.eventSource) state.eventSource.close();
    showLogin();
  });

  // Search Input
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    renderCards();
  });

  // Filter Tabs
  filterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      filterTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeFilter = tab.getAttribute('data-filter');
      renderCards();
    });
  });

  // Summary Stat Cards click to filter
  document.querySelectorAll('.stat-card').forEach((card) => {
    card.addEventListener('click', () => {
      const filterKey = card.getAttribute('data-status');
      filterTabs.forEach((t) => {
        if (t.getAttribute('data-filter') === filterKey) t.click();
      });
    });
  });

  // Simulator Toggle
  toggleSimulatorBtn.addEventListener('click', async () => {
    try {
      state.simulatorRunning = !state.simulatorRunning;
      const resp = await fetch('/api/simulator/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({ active: state.simulatorRunning }),
      });
      const data = await resp.json();
      simBtnText.textContent = data.running ? 'Hentikan Demo' : 'Demo Siswa';
      toggleSimulatorBtn.classList.toggle('glisse-btn-warning', data.running);
      toggleSimulatorBtn.classList.toggle('glisse-btn-secondary', !data.running);
    } catch (_) {}
  });

  // Modal Close
  closeModalBtn.addEventListener('click', closeModal);
  closeModalActionBtn.addEventListener('click', closeModal);
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) closeModal();
  });

  // Remote Unlock Button
  remoteUnlockBtn.addEventListener('click', async () => {
    if (!state.selectedStudentId) return;
    try {
      const resp = await fetch('/api/students/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({ deviceId: state.selectedStudentId }),
      });
      if (resp.ok) {
        remoteUnlockBtn.style.display = 'none';
        const s = state.students.get(state.selectedStudentId);
        if (s) {
          s.status = 'mengerjakan';
          s.leaveCount = 0;
          updateModalData(s);
          renderCards();
        }
      }
    } catch (_) {}
  });

  // Periodic client-side check to remove stale/offline students
  setInterval(() => {
    const now = Date.now();
    let hasStale = false;
    for (const [id, s] of state.students.entries()) {
      if (now - s.lastSeen > 18000) {
        state.students.delete(id);
        hasStale = true;
      }
    }
    if (hasStale) {
      updateCounters();
      renderCards();
    }
  }, 4000);
}

// --- View Switching ---
function showLogin() {
  loginView.classList.add('active');
  dashboardView.classList.remove('active');
}

function showDashboard() {
  loginView.classList.remove('active');
  dashboardView.classList.add('active');
  connectRealtimeSSE();
}

// --- Realtime SSE Connection ---
function connectRealtimeSSE() {
  if (state.eventSource) state.eventSource.close();

  state.eventSource = new EventSource('/api/events');

  state.eventSource.onopen = () => {
    sseStatusText.textContent = 'LIVE CONNECTED';
  };

  state.eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.type === 'INIT' || payload.type === 'SYNC_STUDENTS') {
        state.students.clear();
        (payload.students || []).forEach((s) => state.students.set(s.deviceId, s));
      } else if (payload.type === 'STUDENT_UPDATE' && payload.student) {
        state.students.set(payload.student.deviceId, payload.student);
        // If modal currently open for this student, update it in realtime
        if (state.selectedStudentId === payload.student.deviceId) {
          updateModalData(payload.student);
        }
      }

      updateCounters();
      renderCards();
    } catch (_) {}
  };

  state.eventSource.onerror = () => {
    sseStatusText.textContent = 'RECONNECTING...';
  };
}

// --- Metrics & Counters ---
function updateCounters() {
  let total = 0;
  let mengerjakan = 0;
  let keluar = 0;
  let terkunci = 0;
  let selesai = 0;

  for (const s of state.students.values()) {
    total++;
    if (s.status === 'mengerjakan') mengerjakan++;
    else if (s.status === 'keluar') keluar++;
    else if (s.status === 'terkunci') terkunci++;
    else if (s.status === 'selesai') selesai++;
  }

  countAll.textContent = total;
  countMengerjakan.textContent = mengerjakan;
  countKeluar.textContent = keluar;
  countTerkunci.textContent = terkunci;
  countSelesai.textContent = selesai;
}

// --- Status Formatters ---
function getStatusMeta(status, leaveCount) {
  switch (status) {
    case 'mengerjakan':
      return {
        label: 'Mengerjakan',
        cssClass: 'status-mengerjakan',
        badgeHtml: `
          <div class="status-badge-left">
            <span class="badge-pulse"></span>
            <span>🟢 Mengerjakan</span>
          </div>
          <span style="font-size: 11px; opacity: 0.8;">Fokus Soal</span>
        `,
      };
    case 'keluar':
      return {
        label: `Keluar Aplikasi (${leaveCount || 1}/3)`,
        cssClass: 'status-keluar',
        badgeHtml: `
          <div class="status-badge-left">
            <span class="badge-pulse"></span>
            <span>🟡 Keluar Aplikasi (${leaveCount || 1}/3)</span>
          </div>
          <span style="font-size: 11px; opacity: 0.9;">Peringatan</span>
        `,
      };
    case 'terkunci':
      return {
        label: 'Sesi Terkunci (3/3)',
        cssClass: 'status-terkunci',
        badgeHtml: `
          <div class="status-badge-left">
            <span class="badge-pulse"></span>
            <span>🔴 Sesi Terkunci (3/3)</span>
          </div>
          <span style="font-size: 11px; font-weight: 800;">TERKUNCI</span>
        `,
      };
    case 'selesai':
      return {
        label: 'Selesai Ujian',
        cssClass: 'status-selesai',
        badgeHtml: `
          <div class="status-badge-left">
            <span class="badge-pulse"></span>
            <span>🔵 Selesai Ujian</span>
          </div>
          <span style="font-size: 11px; opacity: 0.8;">Terkirim</span>
        `,
      };
    default:
      return {
        label: 'Aktif',
        cssClass: 'status-mengerjakan',
        badgeHtml: `<span>🟢 Aktif</span>`,
      };
  }
}

// --- Render Student Cards ---
function renderCards() {
  studentsGrid.innerHTML = '';

  const studentList = Array.from(state.students.values());

  // Filter based on active tab & search query
  const filtered = studentList.filter((s) => {
    if (state.activeFilter !== 'all' && s.status !== state.activeFilter) {
      return false;
    }
    if (state.searchQuery) {
      const q = state.searchQuery;
      const matchName = (s.name || '').toLowerCase().includes(q);
      const matchClass = (s.className || '').toLowerCase().includes(q);
      const matchMapel = (s.subject || '').toLowerCase().includes(q);
      const matchDevice = (s.deviceLabel || '').toLowerCase().includes(q);
      if (!matchName && !matchClass && !matchMapel && !matchDevice) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  filtered.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'student-card glisse-card glisse-lens';
    card.setAttribute('data-id', s.deviceId);

    const statusMeta = getStatusMeta(s.status, s.leaveCount);
    const dateFormatted = new Date(s.lastSeen || Date.now()).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }) + ' WIB';

    card.innerHTML = `
      <div class="card-header-row">
        <div class="student-name-box">
          <div class="student-name">${escapeHtml(s.name || 'Siswa')}</div>
          <div class="student-subject">${escapeHtml(s.subject || 'Mapel')}</div>
        </div>
        <span class="glass-pill-sm">${escapeHtml(s.className || 'Kelas')}</span>
      </div>

      <div class="card-device-row">
        <div class="device-text">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <line x1="12" y1="18" x2="12.01" y2="18"></line>
          </svg>
          <span>${escapeHtml(s.deviceLabel || 'Android Device')}</span>
        </div>
        <div class="date-text">${dateFormatted}</div>
      </div>

      <div class="card-status-badge ${statusMeta.cssClass}">
        ${statusMeta.badgeHtml}
      </div>

      <div class="card-telemetry-row">
        <div class="tel-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="6" width="18" height="12" rx="2" ry="2"></rect>
            <line x1="23" y1="13" x2="23" y2="11"></line>
          </svg>
          <span>${s.batteryLevel !== undefined ? s.batteryLevel + '%' : '--'}</span>
        </div>

        <div class="tel-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>
          </svg>
          <span>${s.temperature ? s.temperature + '°C' : '36°C'}</span>
        </div>

        <div class="tel-chip">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          <span>${s.pingMs || 9}ms</span>
        </div>

        <div class="card-hint">Detail →</div>
      </div>
    `;

    card.addEventListener('click', () => openModal(s));
    studentsGrid.appendChild(card);
  });
}

// --- Modal Detailed Telemetry ---
function openModal(student) {
  state.selectedStudentId = student.deviceId;
  updateModalData(student);
  detailModal.classList.add('active');
}

function updateModalData(s) {
  modalStudentName.textContent = s.name || 'Siswa';
  modalStudentClass.textContent = s.className || 'Kelas';
  modalDeviceLabel.textContent = s.deviceLabel || 'Android Device';
  modalSubject.textContent = s.subject || 'Mapel Ujian';

  // Status Banner
  const meta = getStatusMeta(s.status, s.leaveCount);
  modalStatusBanner.className = `modal-status-banner ${meta.cssClass}`;
  modalStatusText.innerHTML = meta.badgeHtml;

  // Telemetry items
  modalBattery.textContent = `${s.batteryLevel || 85}%`;
  modalBatterySub.textContent = s.isCharging ? 'Sedang Mengisi Daya (Charging)' : 'Menggunakan Baterai (Discharging)';

  modalNetwork.textContent = s.network || 'Wi-Fi';
  modalPing.textContent = `${s.pingMs || 9} ms`;
  modalTemperature.textContent = `${s.temperature || 36.5}°C`;

  // Remote Unlock Button visibility (only for locked sessions)
  if (s.status === 'terkunci') {
    remoteUnlockBtn.style.display = 'inline-flex';
  } else {
    remoteUnlockBtn.style.display = 'none';
  }

  // Violation Timeline
  modalTimeline.innerHTML = '';
  const logs = s.violationLogs || [];
  if (logs.length === 0) {
    modalTimeline.innerHTML = `
      <div class="timeline-event">
        <span class="timeline-time">${new Date(s.startTime || Date.now()).toLocaleTimeString('id-ID')}</span>
        <span class="timeline-text">Sesi ujian dimulai secara tertib</span>
      </div>
    `;
  } else {
    logs.slice(-6).reverse().forEach((log) => {
      const timeStr = new Date(log.timestamp || Date.now()).toLocaleTimeString('id-ID');
      const isViolate = (log.text || '').toLowerCase().includes('keluar') || (log.text || '').toLowerCase().includes('terkunci');
      const item = document.createElement('div');
      item.className = `timeline-event ${isViolate ? 'event-violation' : ''}`;
      item.innerHTML = `
        <span class="timeline-time">${timeStr}</span>
        <span class="timeline-text">${escapeHtml(log.text)}</span>
      `;
      modalTimeline.appendChild(item);
    });
  }
}

function closeModal() {
  detailModal.classList.remove('active');
  state.selectedStudentId = null;
}

// Utility: escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
