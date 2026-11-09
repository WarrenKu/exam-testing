/**
 * UjianKita Super-Admin Realtime Monitor Controller
 * Kelvin Zhang Glisse Liquid Glass Architecture & SSE Realtime Engine
 */

// Application State
const state = {
  token: localStorage.getItem('ujiankita_superadmin_token') || '',
  students: new Map(), // key: deviceId, value: StudentData
  activeFilter: 'all',
  searchQuery: '',
  selectedStudentId: null,
  eventSource: null,
  simulatorRunning: false,
  activeTab: 'monitoring',
};

// DOM References
const loginView = document.getElementById('loginView');
const dashboardView = document.getElementById('dashboardView');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const loginErrorMsg = document.getElementById('loginErrorMsg');
const logoutBtn = document.getElementById('logoutBtn');

const liveClockDisplay = document.getElementById('liveClockDisplay');
const sseStatusLabel = document.getElementById('sseStatusLabel');
const toggleDemoBtn = document.getElementById('toggleDemoBtn');
const demoBtnLabel = document.getElementById('demoBtnLabel');

const countAll = document.getElementById('countAll');
const countMengerjakan = document.getElementById('countMengerjakan');
const countKeluar = document.getElementById('countKeluar');
const countTerkunci = document.getElementById('countTerkunci');
const countSelesai = document.getElementById('countSelesai');

const searchInput = document.getElementById('searchInput');
const chipFilters = document.querySelectorAll('.chip-filter');
const metricCards = document.querySelectorAll('.metric-glass-card');
const studentsGrid = document.getElementById('studentsGrid');
const emptyGridState = document.getElementById('emptyGridState');

// Floating Bottom Nav & Tab Panes
const glisseTabs = document.querySelectorAll('.lg-tab');
const tabGlisseThumb = document.getElementById('tabGlisseThumb');
const tabPanes = {
  monitoring: document.getElementById('tabContentMonitoring'),
  violations: document.getElementById('tabContentViolations'),
  stats: document.getElementById('tabContentStats'),
  settings: document.getElementById('tabContentSettings'),
};

const violationsList = document.getElementById('violationsList');
const integrityRate = document.getElementById('integrityRate');
const wifiCount = document.getElementById('wifiCount');
const lowBatteryCount = document.getElementById('lowBatteryCount');
const copyEndpointBtn = document.getElementById('copyEndpointBtn');
const telemetryEndpointUrl = document.getElementById('telemetryEndpointUrl');

// Telemetry Modal
const telemetryModal = document.getElementById('telemetryModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalDismissBtn = document.getElementById('modalDismissBtn');
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
const modalTimelineLogs = document.getElementById('modalTimelineLogs');
const remoteUnlockBtn = document.getElementById('remoteUnlockBtn');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  setupEventListeners();
  updateFloatingNavThumb();

  if (state.token) {
    verifySession();
  } else {
    showLogin();
  }

  // Adjust floating tab thumb on window resize
  window.addEventListener('resize', () => {
    updateFloatingNavThumb();
  });
});

// --- Live Clock ---
function initClock() {
  const updateClock = () => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false }) + ' WIB';
    if (liveClockDisplay) liveClockDisplay.textContent = timeStr;
  };
  updateClock();
  setInterval(updateClock, 1000);
}

// --- Auth & Session ---
async function verifySession() {
  try {
    const resp = await fetch('/api/auth/check', {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await resp.json();
    if (data.authenticated) {
      showDashboard();
    } else {
      logout();
    }
  } catch (_) {
    showDashboard();
  }
}

function showLogin() {
  loginView.classList.add('active');
  dashboardView.classList.remove('active');
  if (state.eventSource) {
    state.eventSource.close();
    state.eventSource = null;
  }
}

function showDashboard() {
  loginView.classList.remove('active');
  dashboardView.classList.add('active');
  connectSSE();
  fetchInitialStudents();
  // Ensure thumb is aligned after rendering
  setTimeout(updateFloatingNavThumb, 50);
}

function logout() {
  localStorage.removeItem('ujiankita_superadmin_token');
  state.token = '';
  state.students.clear();
  showLogin();
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // 1. Password Visibility Toggle
  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      const isPass = passwordInput.type === 'password';
      passwordInput.type = isPass ? 'text' : 'password';
    });
  }

  // 2. Login Form
  if (loginForm) {
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
          localStorage.setItem('ujiankita_superadmin_token', data.token);
          showDashboard();
        } else {
          loginErrorMsg.textContent = data.message || 'Username atau password salah!';
          loginErrorMsg.style.display = 'block';
        }
      } catch (err) {
        loginErrorMsg.textContent = 'Gagal terhubung ke server backend.';
        loginErrorMsg.style.display = 'block';
      }
    });
  }

  // 3. Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  // 4. Glisse Bottom Navbar Tab Switching
  glisseTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // 5. Search Filtering
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      renderStudentsGrid();
    });
  }

  // 6. Filter Chips
  chipFilters.forEach((chip) => {
    chip.addEventListener('click', () => {
      const filter = chip.getAttribute('data-filter');
      setFilter(filter);
    });
  });

  // 7. Metric Cards click to filter
  metricCards.forEach((card) => {
    card.addEventListener('click', () => {
      const filter = card.getAttribute('data-filter');
      setFilter(filter);
    });
  });

  // 8. Demo Simulation Toggle
  if (toggleDemoBtn) {
    toggleDemoBtn.addEventListener('click', async () => {
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
        const isRunning = data.running ?? state.simulatorRunning;
        demoBtnLabel.textContent = isRunning ? 'Hentikan Demo' : 'Demo Siswa';
        toggleDemoBtn.classList.toggle('btn-active-demo', isRunning);
      } catch (err) {
        console.error('Simulator toggle error:', err);
      }
    });
  }

  // 9. Telemetry Modal Dismissals
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener('click', closeModal);
  if (telemetryModal) {
    telemetryModal.addEventListener('click', (e) => {
      if (e.target === telemetryModal) closeModal();
    });
  }

  // 10. Remote Unlock Action
  if (remoteUnlockBtn) {
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
          const s = state.students.get(state.selectedStudentId);
          if (s) {
            s.status = 'mengerjakan';
            s.leaveCount = 0;
            s.violationLogs.push({
              timestamp: Date.now(),
              text: 'Sesi dibuka kembali oleh Super-Admin (Remote Unlock)'
            });
            updateModalData(s);
            updateCounters();
            renderStudentsGrid();
          }
        }
      } catch (err) {
        console.error('Unlock error:', err);
      }
    });
  }

  // 11. Copy Telemetry Endpoint
  if (copyEndpointBtn) {
    copyEndpointBtn.addEventListener('click', () => {
      const url = `http://${window.location.host}/api/telemetry`;
      navigator.clipboard.writeText(url).then(() => {
        copyEndpointBtn.textContent = 'Tersalin!';
        setTimeout(() => {
          copyEndpointBtn.textContent = 'Salin URL';
        }, 2000);
      });
    });
  }

  // Auto-remove stale students (>18s without response) on client
  setInterval(() => {
    const now = Date.now();
    let hasStale = false;
    for (const [id, s] of state.students.entries()) {
      if (now - s.lastSeen > 18000) {
        state.students.delete(id);
        hasStale = true;
        if (state.selectedStudentId === id) {
          closeModal();
        }
      }
    }
    if (hasStale) {
      updateCounters();
      renderStudentsGrid();
      updateViolationsTab();
      updateStatsTab();
    }
  }, 3000);
}

// --- Glisse Bottom Navbar Tab Management ---
function switchTab(tabId) {
  state.activeTab = tabId;

  // Toggle active tab button
  glisseTabs.forEach((tab) => {
    const isTarget = tab.getAttribute('data-tab') === tabId;
    tab.classList.toggle('active', isTarget);
  });

  // Slide thumb
  updateFloatingNavThumb();

  // Toggle tab contents
  Object.keys(tabPanes).forEach((id) => {
    if (tabPanes[id]) {
      const isActive = id === tabId;
      tabPanes[id].classList.toggle('active', isActive);
    }
  });

  if (tabId === 'violations') updateViolationsTab();
  if (tabId === 'stats') updateStatsTab();
}

function updateFloatingNavThumb() {
  const activeTabEl = document.querySelector('.lg-tab.active');
  if (!activeTabEl || !tabGlisseThumb) return;

  const tabRect = activeTabEl.getBoundingClientRect();
  const parentRect = activeTabEl.parentElement.getBoundingClientRect();

  const left = tabRect.left - parentRect.left;
  const width = tabRect.width;

  tabGlisseThumb.style.transform = `translateX(${left}px)`;
  tabGlisseThumb.style.width = `${width}px`;
}

// --- Filter Management ---
function setFilter(filter) {
  state.activeFilter = filter;

  chipFilters.forEach((c) => {
    c.classList.toggle('active', c.getAttribute('data-filter') === filter);
  });

  metricCards.forEach((m) => {
    m.classList.toggle('active-filter', m.getAttribute('data-filter') === filter);
  });

  renderStudentsGrid();
}

// --- SSE Realtime Streaming ---
function connectSSE() {
  if (state.eventSource) state.eventSource.close();

  state.eventSource = new EventSource('/api/events');

  state.eventSource.onopen = () => {
    if (sseStatusLabel) sseStatusLabel.textContent = 'LIVE SERVER';
  };

  state.eventSource.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);

      if (payload.type === 'INIT' || payload.type === 'SYNC_STUDENTS') {
        state.students.clear();
        (payload.students || []).forEach((s) => state.students.set(s.deviceId, s));
      } else if (payload.type === 'STUDENT_UPDATE' && payload.student) {
        state.students.set(payload.student.deviceId, payload.student);
        // If modal open for this student, live update modal
        if (state.selectedStudentId === payload.student.deviceId) {
          updateModalData(payload.student);
        }
      }

      updateCounters();
      renderStudentsGrid();
      if (state.activeTab === 'violations') updateViolationsTab();
      if (state.activeTab === 'stats') updateStatsTab();
    } catch (err) {
      console.error('SSE parse error:', err);
    }
  };

  state.eventSource.onerror = () => {
    if (sseStatusLabel) sseStatusLabel.textContent = 'MENGHUBUNGKAN...';
  };
}

async function fetchInitialStudents() {
  try {
    const resp = await fetch('/api/students', {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    if (resp.ok) {
      const data = await resp.json();
      state.students.clear();
      (data.students || []).forEach((s) => state.students.set(s.deviceId, s));
      updateCounters();
      renderStudentsGrid();
    }
  } catch (_) {}
}

// --- Counters & Metrics ---
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

  if (countAll) countAll.textContent = total;
  if (countMengerjakan) countMengerjakan.textContent = mengerjakan;
  if (countKeluar) countKeluar.textContent = keluar;
  if (countTerkunci) countTerkunci.textContent = terkunci;
  if (countSelesai) countSelesai.textContent = selesai;
}

// --- Render Student Cards Grid ---
function renderStudentsGrid() {
  if (!studentsGrid) return;

  const filtered = Array.from(state.students.values()).filter((s) => {
    // 1. Filter match
    if (state.activeFilter !== 'all' && s.status !== state.activeFilter) {
      return false;
    }
    // 2. Search match
    if (state.searchQuery) {
      const query = state.searchQuery;
      const matchName = (s.name || '').toLowerCase().includes(query);
      const matchClass = (s.className || '').toLowerCase().includes(query);
      const matchDevice = (s.deviceLabel || '').toLowerCase().includes(query);
      return matchName || matchClass || matchDevice;
    }
    return true;
  });

  if (filtered.length === 0) {
    studentsGrid.innerHTML = '';
    if (emptyGridState) emptyGridState.style.display = 'block';
    return;
  }

  if (emptyGridState) emptyGridState.style.display = 'none';

  studentsGrid.innerHTML = filtered.map((s) => {
    const statusMeta = getStatusMeta(s.status, s.leaveCount);
    const dateFormatted = new Date(s.startTime || Date.now()).toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const isChargingIcon = s.isCharging ? '⚡ ' : '';
    const batteryText = `${isChargingIcon}${s.batteryLevel || 100}%`;
    const tempText = `${s.temperature || 36.5}°C`;
    const pingText = `${s.pingMs || 9}ms`;

    return `
      <div class="student-lens-card lg-glass" data-device-id="${s.deviceId}">
        <div class="card-top-identity">
          <div>
            <div class="student-name-text">${escapeHtml(s.name || 'Siswa')}</div>
          </div>
          <div class="class-badge-pill">${escapeHtml(s.className || 'X')}</div>
        </div>

        <div class="card-device-date-row">
          <div class="card-device-meta">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
              <line x1="12" y1="18" x2="12.01" y2="18"></line>
            </svg>
            <span>${escapeHtml(s.deviceLabel || 'Android')}</span>
          </div>
          <div class="card-date-meta">${dateFormatted} WIB</div>
        </div>

        <div class="card-status-badge ${statusMeta.cssClass}">
          <div class="status-badge-lead">
            <span class="badge-dot-indicator"></span>
            <span>${statusMeta.title}</span>
          </div>
          <span>${statusMeta.subtitle}</span>
        </div>

        <div class="card-quick-telemetry">
          <div class="quick-telemetry-chip" title="Baterai">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="6" width="18" height="12" rx="2" ry="2"></rect>
              <line x1="23" y1="13" x2="23" y2="11"></line>
            </svg>
            <span>${batteryText}</span>
          </div>
          <div class="quick-telemetry-chip" title="Ping Jaringan">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            <span class="text-green">${pingText}</span>
          </div>
          <div class="quick-telemetry-chip" title="Suhu HP">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"></path>
            </svg>
            <span>${tempText}</span>
          </div>
        </div>

        <div class="card-click-hint">Klik untuk melihat detail & remote action ➔</div>
      </div>
    `;
  }).join('');

  // Attach card click handlers
  studentsGrid.querySelectorAll('.student-lens-card').forEach((card) => {
    card.addEventListener('click', () => {
      const deviceId = card.getAttribute('data-device-id');
      openModal(deviceId);
    });
  });
}

// --- Status Metadata Helper ---
function getStatusMeta(status, leaveCount) {
  switch (status) {
    case 'mengerjakan':
      return {
        title: '🟢 Mengerjakan',
        subtitle: 'Fokus Soal',
        cssClass: 'status-mengerjakan',
      };
    case 'keluar':
      return {
        title: '🟡 Keluar Aplikasi',
        subtitle: `Tercatat: ${leaveCount || 1}/3`,
        cssClass: 'status-keluar',
      };
    case 'terkunci':
      return {
        title: '🔴 Sesi Terkunci',
        subtitle: 'Melanggar 3x!',
        cssClass: 'status-terkunci',
      };
    case 'selesai':
      return {
        title: '🔵 Selesai Ujian',
        subtitle: 'Terkirim',
        cssClass: 'status-selesai',
      };
    default:
      return {
        title: '🟢 Mengerjakan',
        subtitle: 'Fokus',
        cssClass: 'status-mengerjakan',
      };
  }
}

// --- Modal Detail Logic ---
function openModal(deviceId) {
  const student = state.students.get(deviceId);
  if (!student) return;

  state.selectedStudentId = deviceId;
  updateModalData(student);

  telemetryModal.classList.add('active');
}

function updateModalData(s) {
  if (!s) return;

  modalStudentName.textContent = s.name || 'Siswa Ujian';
  modalStudentClass.textContent = s.className || 'X';
  modalDeviceLabel.textContent = s.deviceLabel || 'Android Device';
  modalSubject.textContent = s.subject || 'Ujian Sekolah';

  const meta = getStatusMeta(s.status, s.leaveCount);
  modalStatusBanner.className = `modal-live-status-banner ${meta.cssClass} lg-glass`;
  modalStatusText.textContent = `${meta.title} (${meta.subtitle})`;

  // Battery
  modalBattery.textContent = `${s.batteryLevel || 100}%`;
  modalBatterySub.textContent = s.isCharging ? '⚡ Sedang Mengecas' : 'Menggunakan Daya Baterai';

  // Network & Ping
  modalNetwork.textContent = s.network || 'Wi-Fi Sekolah';
  modalPing.textContent = `${s.pingMs || 9} ms`;

  // Temperature
  modalTemperature.textContent = `${s.temperature || 36.5}°C`;

  // Timeline Logs
  const logs = s.violationLogs || [];
  if (logs.length === 0) {
    modalTimelineLogs.innerHTML = `
      <div class="timeline-row">
        <span class="tl-time">${new Date().toLocaleTimeString('id-ID')}</span>
        <span class="tl-text">Siswa fokus di layar ujian tanpa pelanggaran.</span>
      </div>
    `;
  } else {
    modalTimelineLogs.innerHTML = logs
      .slice()
      .reverse()
      .map((item) => {
        const time = new Date(item.timestamp).toLocaleTimeString('id-ID');
        const isViolation = item.text.includes('Keluar') || item.text.includes('terkunci') || item.text.includes('Pelanggaran');
        return `
          <div class="timeline-row">
            <span class="tl-time">${time}</span>
            <span class="tl-text ${isViolation ? 'tl-danger' : ''}">${escapeHtml(item.text)}</span>
          </div>
        `;
      })
      .join('');
  }

  // Show remote unlock button if locked or in warning state
  if (s.status === 'terkunci' || (s.status === 'keluar' && (s.leaveCount || 0) >= 2)) {
    remoteUnlockBtn.style.display = 'inline-flex';
  } else {
    remoteUnlockBtn.style.display = 'none';
  }
}

function closeModal() {
  telemetryModal.classList.remove('active');
  state.selectedStudentId = null;
}

// --- Violations Tab Logic ---
function updateViolationsTab() {
  if (!violationsList) return;

  const violators = Array.from(state.students.values()).filter(
    (s) => s.status === 'terkunci' || s.status === 'keluar' || (s.violationLogs && s.violationLogs.length > 1)
  );

  if (violators.length === 0) {
    violationsList.innerHTML = `
      <div class="empty-glass-state lg-glass">
        <div class="empty-title">Tidak Ada Pelanggaran Aktif</div>
        <div class="empty-text">Semua siswa sedang fokus mengerjakan ujian dengan tertib.</div>
      </div>
    `;
    return;
  }

  violationsList.innerHTML = violators.map((s) => {
    const isLocked = s.status === 'terkunci';
    return `
      <div class="violation-card-row lg-glass">
        <div class="v-lead">
          <div class="v-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div>
            <div class="v-name">${escapeHtml(s.name)} · <span class="tag-status-val">${escapeHtml(s.className)}</span></div>
            <div class="v-desc">${isLocked ? '🔴 Sesi Terkunci - Melanggar 3x keluar aplikasi' : `🟡 Terdeteksi keluar aplikasi (${s.leaveCount}/3 kali)`}</div>
          </div>
        </div>
        <div class="v-time">Perangkat: ${escapeHtml(s.deviceLabel)}</div>
      </div>
    `;
  }).join('');
}

// --- Stats Tab Logic ---
function updateStatsTab() {
  const all = Array.from(state.students.values());
  const total = all.length;

  if (total === 0) {
    if (integrityRate) integrityRate.textContent = '100%';
    if (wifiCount) wifiCount.textContent = '0 Siswa';
    if (lowBatteryCount) lowBatteryCount.textContent = '0 Siswa';
    return;
  }

  const compliant = all.filter((s) => s.status === 'mengerjakan' || s.status === 'selesai').length;
  const rate = Math.round((compliant / total) * 100);
  const lowBat = all.filter((s) => (s.batteryLevel || 100) < 20).length;

  if (integrityRate) integrityRate.textContent = `${rate}%`;
  if (wifiCount) wifiCount.textContent = `${total} Siswa`;
  if (lowBatteryCount) lowBatteryCount.textContent = `${lowBat} Siswa`;
}

// --- Utility: Escape HTML ---
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
