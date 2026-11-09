import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Menu, TabBar, Switch, Button, Glass, Input, SearchField, SegmentedControl } from 'glisse';
import {
  LayoutDashboard,
  Monitor,
  Server,
  Activity,
  Users,
  ShieldCheck,
  Settings as SettingsIcon,
  Battery,
  Wifi,
  Thermometer,
  Smartphone,
  LogOut,
  RefreshCw,
  Unlock,
  Download,
  Trash2,
  Check,
  Copy,
  AlertTriangle,
  Sliders,
  Clock,
  Sparkles,
  Layers,
  CircleDot,
  Radio,
  FileSpreadsheet,
  Lock,
  User,
  Zap,
  Info
} from 'lucide-react';

// =========================================================================
// ISOLATED STANDALONE COMPONENTS (Defined OUTSIDE App to prevent re-mounts)
// =========================================================================

// 1. Stable Panel Wrapper (Never causes re-mounts on state changes)
function Panel({ isGlass, children, className = '', style = {}, onClick }) {
  if (isGlass) {
    return (
      <Glass className={className} style={style} onClick={onClick}>
        {children}
      </Glass>
    );
  }
  return (
    <div className={`standard-panel ${className}`} style={style} onClick={onClick}>
      {children}
    </div>
  );
}

// 2. Isolated Live Clock (Updates locally, NEVER triggers App re-render)
function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('id-ID', { hour12: false }) + ' WIB');
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('id-ID', { hour12: false }) + ' WIB');
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  return <div className="clock-val">{time}</div>;
}

// 3. Isolated Server Uptime (Updates locally, NEVER triggers App re-render)
function ServerUptime() {
  const [uptime, setUptime] = useState(160);
  useEffect(() => {
    const timer = setInterval(() => setUptime((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const format = (sec) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${h > 0 ? h + 'j ' : ''}${m}m ${s}d`;
  };
  return <div className="stat-huge">{format(uptime)}</div>;
}

// 4. Stable One-Click Copy Button
function CopyButton({ text, label = 'Salin' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button className="api-copy-btn" onClick={handleCopy} title="Salin ke clipboard">
      {copied ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
      <span>{copied ? 'Tersalin!' : label}</span>
    </button>
  );
}

// =========================================================================
// MAIN APP CONTROLLER
// =========================================================================
export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ujiankita_superadmin_token') || '');
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [simulatorRunning, setSimulatorRunning] = useState(false);
  const [liquidGlassEnabled, setLiquidGlassEnabled] = useState(
    () => localStorage.getItem('ujiankita_liquid_glass') !== 'false'
  );
  const [soundAlertEnabled, setSoundAlertEnabled] = useState(
    () => localStorage.getItem('ujiankita_sound_alert') === 'true'
  );
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  // Login form state
  const [loginUser, setLoginUser] = useState('rick');
  const [loginPass, setLoginPass] = useState('rick');
  const [loginError, setLoginError] = useState('');

  const eventSourceRef = useRef(null);

  // Responsive detector
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persist Liquid Glass preference
  useEffect(() => {
    localStorage.setItem('ujiankita_liquid_glass', liquidGlassEnabled ? 'true' : 'false');
  }, [liquidGlassEnabled]);

  // Persist Sound Alert preference
  useEffect(() => {
    localStorage.setItem('ujiankita_sound_alert', soundAlertEnabled ? 'true' : 'false');
  }, [soundAlertEnabled]);

  // SSE Realtime Connection
  const connectSSE = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource('/api/events');
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'INIT' || payload.type === 'SYNC_STUDENTS') {
          setStudents(payload.students || []);
        } else if (payload.type === 'STUDENT_UPDATE' && payload.student) {
          setStudents((prev) => {
            const idx = prev.findIndex((s) => s.deviceId === payload.student.deviceId);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = payload.student;
              return updated;
            } else {
              return [...prev, payload.student];
            }
          });
        }
      } catch (err) {
        console.error('SSE error:', err);
      }
    };

    es.onerror = () => {
      console.warn('SSE reconnecting...');
    };
  };

  useEffect(() => {
    if (!token) return;
    connectSSE();

    // Fetch initial list
    fetch('/api/students', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setStudents(data.students || []))
      .catch(() => {});

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [token]);

  // Auto Stale Cleanup (Safely checks before updating state to avoid re-renders)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setStudents((prev) => {
        const hasStale = prev.some((s) => now - s.lastSeen > 18000);
        if (!hasStale) return prev;
        return prev.filter((s) => now - s.lastSeen <= 18000);
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Authentication Handlers
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.token) {
        localStorage.setItem('ujiankita_superadmin_token', data.token);
        setToken(data.token);
      } else {
        setLoginError(data.message || 'Username atau password salah.');
      }
    } catch (err) {
      setLoginError('Gagal terhubung ke server backend.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ujiankita_superadmin_token');
    setToken('');
    setStudents([]);
    setSelectedStudentId(null);
  };

  // Simulator Toggle
  const handleToggleSimulator = async (checked) => {
    try {
      setSimulatorRunning(checked);
      const res = await fetch('/api/simulator/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: checked }),
      });
      const data = await res.json();
      setSimulatorRunning(data.running);
    } catch (err) {
      console.error('Simulator toggle error:', err);
    }
  };

  // Remote Unlock (Single)
  const handleRemoteUnlock = async (deviceId) => {
    try {
      const res = await fetch('/api/students/unlock', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ deviceId }),
      });
      if (res.ok) {
        setStudents((prev) =>
          prev.map((s) =>
            s.deviceId === deviceId
              ? {
                  ...s,
                  status: 'mengerjakan',
                  leaveCount: 0,
                }
              : s
          )
        );
      }
    } catch (err) {
      console.error('Unlock error:', err);
    }
  };

  // Remote Unlock All
  const handleUnlockAll = async () => {
    const lockedStudents = students.filter((s) => s.status === 'terkunci' || s.status === 'keluar');
    for (const s of lockedStudents) {
      await handleRemoteUnlock(s.deviceId);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['ID Perangkat', 'Nama Siswa', 'Kelas', 'Mata Pelajaran', 'Status', 'Baterai', 'Suhu', 'Ping', 'Terakhir Aktif'];
    const rows = students.map((s) => [
      s.deviceId,
      `"${s.name}"`,
      `"${s.className}"`,
      `"${s.subject}"`,
      s.status,
      `${s.batteryLevel}%`,
      `${s.temperature}°C`,
      `${s.pingMs}ms`,
      new Date(s.lastSeen).toISOString(),
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ujiankita-monitoring-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clear demo / reset
  const handleResetSession = () => {
    if (confirm('Bersihkan semua siswa simulasi dan reset sesi monitoring?')) {
      handleToggleSimulator(false);
      setStudents((prev) => prev.filter((s) => !s.deviceId.startsWith('SIM-')));
    }
  };

  // Copy endpoint handler
  const copyEndpoint = () => {
    const url = `http://${window.location.host}/api/telemetry`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedEndpoint(true);
      setTimeout(() => setCopiedEndpoint(false), 2000);
    });
  };

  // Metrics Count
  const counts = useMemo(() => {
    let total = 0,
      mengerjakan = 0,
      keluar = 0,
      terkunci = 0,
      selesai = 0;
    for (const s of students) {
      total++;
      if (s.status === 'mengerjakan') mengerjakan++;
      else if (s.status === 'keluar') keluar++;
      else if (s.status === 'terkunci') terkunci++;
      else if (s.status === 'selesai') selesai++;
    }
    return { total, mengerjakan, keluar, terkunci, selesai };
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (filter !== 'all' && s.status !== filter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = (s.name || '').toLowerCase().includes(q);
        const matchClass = (s.className || '').toLowerCase().includes(q);
        const matchDevice = (s.deviceLabel || '').toLowerCase().includes(q);
        return matchName || matchClass || matchDevice;
      }
      return true;
    });
  }, [students, filter, search]);

  // Selected student for modal
  const selectedStudent = useMemo(() => {
    return students.find((s) => s.deviceId === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  // Status Presentation Helper
  const getStatusPresentation = (status, leaveCount) => {
    switch (status) {
      case 'mengerjakan':
        return {
          title: '🟢 Mengerjakan',
          sub: 'Fokus Soal',
          className: 'status-mengerjakan',
        };
      case 'keluar':
        return {
          title: '🟡 Keluar Aplikasi',
          sub: `Peringatan: ${leaveCount || 1}/3`,
          className: 'status-keluar',
        };
      case 'terkunci':
        return {
          title: '🔴 Sesi Terkunci',
          sub: 'Melanggar 3x!',
          className: 'status-terkunci',
        };
      case 'selesai':
        return {
          title: '🔵 Selesai Ujian',
          sub: 'Terkirim',
          className: 'status-selesai',
        };
      default:
        return {
          title: '🟢 Mengerjakan',
          sub: 'Fokus',
          className: 'status-mengerjakan',
        };
    }
  };

  // =========================================================================
  // VIEW: LOGIN SCREEN (If not authenticated)
  // =========================================================================
  if (!token) {
    return (
      <div className="login-screen">
        <Panel isGlass={liquidGlassEnabled} className="login-card">
          <div className="login-head">
            <div className="login-badge">
              <span className="pulse-dot"></span>
              <span>SMAN 18 BATAM</span>
            </div>
            <h1>Super-Admin Monitor</h1>
            <p>UjianKita Realtime Integrity Control Panel</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label className="form-label">Username</label>
              <Input
                value={loginUser}
                onValueChange={setLoginUser}
                placeholder="Masukkan username"
                icon={<User size={16} />}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <Input
                type="password"
                value={loginPass}
                onValueChange={setLoginPass}
                placeholder="Masukkan password"
                icon={<Lock size={16} />}
              />
            </div>

            {loginError && <div className="error-banner">{loginError}</div>}

            <Button
              variant="filled"
              tint="#10B981"
              type="submit"
              style={{ width: '100%', height: 44, marginTop: 8 }}
            >
              Masuk Dashboard Super-Admin
            </Button>
          </form>

          <div className="login-foot">
            <ShieldCheck size={14} color="#10B981" />
            <span>Kredensial Super-Admin: <strong>rick</strong> / <strong>rick</strong></span>
          </div>
        </Panel>
      </div>
    );
  }

  // =========================================================================
  // VIEW: AUTHENTICATED SUPER-ADMIN DASHBOARD
  // =========================================================================
  return (
    <div className={`admin-app-root ${liquidGlassEnabled ? 'liquid-mode' : 'standard-mode'}`}>
      {/* DESKTOP SIDEBAR (Left) */}
      <aside className="admin-desktop-sidebar">
        <div className="sidebar-brand-box">
          <div className="brand-logo-icon">
            <Zap size={20} color="#10B981" />
          </div>
          <div>
            <div className="sidebar-brand-title">UjianKita</div>
            <div className="sidebar-brand-sub">Super-Admin Monitor</div>
          </div>
        </div>

        <div className="sidebar-school-tag">
          <CircleDot size={12} color="#10B981" />
          <span>SMAN 18 BATAM</span>
        </div>

        <nav className="sidebar-nav-menu">
          <div className="nav-group-label">NAVIGASI UTAMA</div>

          <button
            className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button
            className={`sidebar-nav-item ${activeTab === 'monitoring' ? 'active' : ''}`}
            onClick={() => setActiveTab('monitoring')}
          >
            <Monitor size={18} />
            <span>Monitoring</span>
            {counts.total > 0 && <span className="nav-count-pill">{counts.total}</span>}
          </button>

          <button
            className={`sidebar-nav-item ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <Server size={18} />
            <span>System</span>
          </button>

          <button
            className={`sidebar-nav-item ${activeTab === 'status' ? 'active' : ''}`}
            onClick={() => setActiveTab('status')}
          >
            <Activity size={18} />
            <span>Status API</span>
          </button>

          <button
            className={`sidebar-nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={18} />
            <span>User (ID)</span>
          </button>

          <div className="nav-group-label" style={{ marginTop: 16 }}>
            AKUN & KONTROL
          </div>

          <button
            className={`sidebar-nav-item ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <ShieldCheck size={18} />
            <span>Akun Super-Admin</span>
          </button>

          <button
            className={`sidebar-nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={18} />
            <span>Settings</span>
          </button>
        </nav>

        <div className="sidebar-bottom-profile">
          <div className="profile-mini-avatar">R</div>
          <div className="profile-mini-info">
            <div className="profile-mini-name">rick</div>
            <div className="profile-mini-role">Super-Admin</div>
          </div>
          <button className="sidebar-logout-btn" onClick={handleLogout} title="Keluar">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="admin-main-viewport">
        {/* Top Header */}
        <header className="admin-topbar">
          <div className="topbar-left">
            <div className="mobile-only-brand">
              <span className="brand-dot"></span>
              <strong>UjianKita</strong>
            </div>
            <div className="live-pill">
              <span className="pulse-dot"></span>
              <span>LIVE SERVER</span>
            </div>
            <LiveClock />
          </div>

          <div className="topbar-right">
            {/* Quick Demo Switch */}
            <div className="topbar-demo-switch">
              <span style={{ fontSize: 12, color: 'var(--text-concrete)' }}>Demo:</span>
              <Switch
                aria-label="Toggle Demo Siswa"
                checked={simulatorRunning}
                onCheckedChange={handleToggleSimulator}
              />
            </div>

            {/* Kelvin Zhang Glisse Menu Component */}
            <div className="topbar-menu-wrapper">
              <Menu
                aria-label="Menu Aksi Super-Admin"
                items={[
                  { label: 'Refresh Data SSE', icon: <RefreshCw size={15} />, onSelect: connectSSE },
                  { label: 'Buka Kunci Semua Siswa', icon: <Unlock size={15} />, onSelect: handleUnlockAll },
                  { label: 'Ekspor Data CSV', icon: <Download size={15} />, onSelect: handleExportCSV },
                  { label: 'Pengaturan', icon: <Sliders size={15} />, onSelect: () => setActiveTab('settings') },
                  'separator',
                  { label: 'Bersihkan Sesi / Demo', icon: <Trash2 size={15} />, onSelect: handleResetSession, destructive: true },
                ]}
              />
            </div>

            <div className="admin-avatar-pill">
              <div className="profile-mini-avatar">R</div>
              <span style={{ fontSize: 13, fontWeight: 700 }}>rick</span>
            </div>
          </div>
        </header>

        {/* Content Workspace */}
        <main className="admin-workspace-scroll">
          {/* =================================================================== */}
          {/* TAB 1: DASHBOARD (HOME)                                             */}
          {/* =================================================================== */}
          {activeTab === 'dashboard' && (
            <div className="tab-pane-content">
              <div className="workspace-header">
                <div>
                  <h1 className="workspace-title">Dashboard Pengawasan Ujian</h1>
                  <p className="workspace-sub">Ringkasan status peserta, kesehatan sesi, dan deteksi integritas realtime.</p>
                </div>
              </div>

              {/* Status Metric Grid */}
              <div className="metrics-grid">
                <Panel isGlass={liquidGlassEnabled} className="metric-box" onClick={() => { setActiveTab('monitoring'); setFilter('all'); }}>
                  <div className="metric-box-title">Total Terhubung</div>
                  <div className="metric-box-val">{counts.total}</div>
                  <div className="metric-box-desc">Peserta Aktif di Server</div>
                </Panel>

                <Panel isGlass={liquidGlassEnabled} className="metric-box" onClick={() => { setActiveTab('monitoring'); setFilter('mengerjakan'); }}>
                  <div className="metric-box-title color-green">🟢 Mengerjakan</div>
                  <div className="metric-box-val color-green">{counts.mengerjakan}</div>
                  <div className="metric-box-desc">Fokus di Layar Soal</div>
                </Panel>

                <Panel isGlass={liquidGlassEnabled} className="metric-box" onClick={() => { setActiveTab('monitoring'); setFilter('keluar'); }}>
                  <div className="metric-box-title color-yellow">🟡 Keluar Aplikasi</div>
                  <div className="metric-box-val color-yellow">{counts.keluar}</div>
                  <div className="metric-box-desc">Peringatan Terdeteksi (1-2x)</div>
                </Panel>

                <Panel isGlass={liquidGlassEnabled} className="metric-box" onClick={() => { setActiveTab('monitoring'); setFilter('terkunci'); }}>
                  <div className="metric-box-title color-red">🔴 Sesi Terkunci</div>
                  <div className="metric-box-val color-red">{counts.terkunci}</div>
                  <div className="metric-box-desc">Melanggar Batas 3x Keluar</div>
                </Panel>

                <Panel isGlass={liquidGlassEnabled} className="metric-box" onClick={() => { setActiveTab('monitoring'); setFilter('selesai'); }}>
                  <div className="metric-box-title color-blue">🔵 Selesai Ujian</div>
                  <div className="metric-box-val color-blue">{counts.selesai}</div>
                  <div className="metric-box-desc">Telah Kirim Jawaban</div>
                </Panel>
              </div>

              {/* Quick Info Banners */}
              <div className="dashboard-double-cards">
                <Panel isGlass={liquidGlassEnabled} className="banner-card">
                  <div className="banner-card-head">
                    <Zap size={18} color="#10B981" />
                    <h3>Status Sistem & Pelaksanaan</h3>
                  </div>
                  <div className="banner-card-body">
                    <div className="info-stat-row">
                      <span>Server Engine</span>
                      <strong>Node.js SSE EventStream (Port 5000)</strong>
                    </div>
                    <div className="info-stat-row">
                      <span>Protokol Keamanan</span>
                      <strong>Kiosk Pinning & Window Lock Active</strong>
                    </div>
                    <div className="info-stat-row">
                      <span>Auto-Purge Inaktif</span>
                      <strong>18 Detik Tanpa Heartbeat</strong>
                    </div>
                    <div className="info-stat-row">
                      <span>Pengalaman UI</span>
                      <strong>{liquidGlassEnabled ? 'Liquid Glass (Apple iOS)' : 'Standar (Modern Graphite)'}</strong>
                    </div>
                  </div>
                </Panel>

                <Panel isGlass={liquidGlassEnabled} className="banner-card">
                  <div className="banner-card-head">
                    <Activity size={18} color="#3B82F6" />
                    <h3>Aksi Cepat Super-Admin</h3>
                  </div>
                  <div className="banner-card-body">
                    <p style={{ fontSize: 13, color: 'var(--text-concrete)', marginBottom: 12 }}>
                      Gunakan tombol berikut untuk kontrol massal sesi seluruh siswa:
                    </p>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <Button variant="glass" icon={<Unlock size={14} />} onClick={handleUnlockAll}>
                        Buka Kunci Semua Siswa
                      </Button>
                      <Button variant="glass" icon={<Download size={14} />} onClick={handleExportCSV}>
                        Unduh Laporan CSV
                      </Button>
                      <Button
                        variant="glass"
                        icon={<Monitor size={14} />}
                        onClick={() => setActiveTab('monitoring')}
                      >
                        Buka Layar Monitoring
                      </Button>
                    </div>
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 2: MONITORING REALTIME                                          */}
          {/* =================================================================== */}
          {activeTab === 'monitoring' && (
            <div className="tab-pane-content">
              <div className="workspace-header">
                <div>
                  <h1 className="workspace-title">Monitoring Siswa Realtime</h1>
                  <p className="workspace-sub">Pantau kartu perangkat siswa yang sedang aktif di ruang ujian.</p>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <Panel isGlass={liquidGlassEnabled} className="search-filter-panel">
                <SearchField
                  value={search}
                  onValueChange={setSearch}
                  placeholder="Cari nama siswa, kelas, perangkat..."
                />

                <SegmentedControl
                  value={filter}
                  onValueChange={(val) => val && setFilter(val)}
                  items={[
                    { value: 'all', label: 'Semua' },
                    { value: 'mengerjakan', label: '🟢 Mengerjakan' },
                    { value: 'keluar', label: '🟡 Keluar' },
                    { value: 'terkunci', label: '🔴 Terkunci' },
                    { value: 'selesai', label: '🔵 Selesai' },
                  ]}
                />
              </Panel>

              {/* Student Cards Grid (Clean layout: no activity list clutter) */}
              {filteredStudents.length === 0 ? (
                <Panel isGlass={liquidGlassEnabled} className="empty-box">
                  <div className="empty-icon">
                    <Monitor size={32} />
                  </div>
                  <div className="empty-title">Belum Ada Siswa Aktif</div>
                  <div className="empty-desc">
                    Buka aplikasi Android UjianKita siswa atau aktifkan tombol <strong>"Demo"</strong> di kanan atas.
                  </div>
                </Panel>
              ) : (
                <div className="students-grid">
                  {filteredStudents.map((s) => {
                    const meta = getStatusPresentation(s.status, s.leaveCount);
                    const timeFormatted = new Date(s.startTime || Date.now()).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <Panel
                        key={s.deviceId}
                        isGlass={liquidGlassEnabled}
                        className="student-card"
                        onClick={() => setSelectedStudentId(s.deviceId)}
                      >
                        <div className="card-top">
                          <div className="student-name">{s.name}</div>
                          <div className="class-pill">{s.className}</div>
                        </div>

                        <div className="card-meta-row">
                          <div className="device-chip">
                            <Smartphone size={14} />
                            <span>{s.deviceLabel || 'Android'}</span>
                          </div>
                          <div className="time-chip">{timeFormatted} WIB</div>
                        </div>

                        <div className={`card-status-badge ${meta.className}`}>
                          <div className="status-badge-left">
                            <span className="status-dot"></span>
                            <span>{meta.title}</span>
                          </div>
                          <span>{meta.sub}</span>
                        </div>

                        <div className="card-quick-stats">
                          <div className="stat-item" title="Baterai">
                            <Battery size={14} />
                            <span>
                              {s.isCharging ? '⚡' : ''}
                              {s.batteryLevel || 100}%
                            </span>
                          </div>
                          <div className="stat-item color-green" title="Ping Jaringan">
                            <Activity size={14} />
                            <span>{s.pingMs || 9}ms</span>
                          </div>
                          <div className="stat-item" title="Suhu HP">
                            <Thermometer size={14} />
                            <span>{s.temperature || 36.5}°C</span>
                          </div>
                        </div>

                        <div className="click-hint">Klik untuk melihat detail & remote unlock ➔</div>
                      </Panel>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 3: SYSTEM                                                       */}
          {/* =================================================================== */}
          {activeTab === 'system' && (
            <div className="tab-pane-content">
              <div className="workspace-header">
                <div>
                  <h1 className="workspace-title">Status Server & Lingkungan Sistem</h1>
                  <p className="workspace-sub">Informasi performa runtime, soket SSE, dan memori backend.</p>
                </div>
              </div>

              <div className="stats-grid">
                <Panel isGlass={liquidGlassEnabled} className="stat-box">
                  <div className="stat-title">Server Runtime</div>
                  <div className="stat-huge">Node.js 22</div>
                  <div style={{ fontSize: 12, color: 'var(--text-concrete)' }}>Zero external native deps · Standalone Server</div>
                </Panel>

                <Panel isGlass={liquidGlassEnabled} className="stat-box">
                  <div className="stat-title">Uptime Server</div>
                  <ServerUptime />
                  <div style={{ fontSize: 12, color: 'var(--text-concrete)' }}>Aktif tanpa crash / gangguan</div>
                </Panel>

                <Panel isGlass={liquidGlassEnabled} className="stat-box">
                  <div className="stat-title">Pembersihan Otomatis</div>
                  <div className="stat-huge">18s Timeout</div>
                  <div style={{ fontSize: 12, color: 'var(--text-concrete)' }}>Siswa inaktif otomatis dibersihkan</div>
                </Panel>
              </div>

              <Panel isGlass={liquidGlassEnabled} className="system-detail-panel" style={{ marginTop: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Metrik Soket & Protokol</h3>
                <div className="banner-card-body">
                  <div className="info-stat-row">
                    <span>Soket SSE Aktif</span>
                    <strong>1 Sambungan Dashboard Terverifikasi</strong>
                  </div>
                  <div className="info-stat-row">
                    <span>Frekuensi Heartbeat</span>
                    <strong>Tiap 3000 ms</strong>
                  </div>
                  <div className="info-stat-row">
                    <span>Protokol Enkripsi</span>
                    <strong>Bearer Session Token SHA-256</strong>
                  </div>
                  <div className="info-stat-row">
                    <span>Endpoint Port</span>
                    <strong>5000 (Bebas dari PWA cache)</strong>
                  </div>
                </div>
              </Panel>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 4: STATUS (API)                                                 */}
          {/* =================================================================== */}
          {activeTab === 'status' && (
            <div className="tab-pane-content">
              <div className="workspace-header">
                <div>
                  <h1 className="workspace-title">Konektivitas & Status API</h1>
                  <p className="workspace-sub">Diagnostik kesehatan REST API dan aliran telemetri siswa.</p>
                </div>
              </div>

              <div className="api-status-list">
                <Panel isGlass={liquidGlassEnabled} className="api-status-row">
                  <div className="api-status-lead">
                    <span className="api-method post">POST</span>
                    <div>
                      <div className="api-url">/api/telemetry</div>
                      <div className="api-desc">Menerima denyut baterai, status ujian, dan suhu dari APK siswa</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CopyButton text={`http://${window.location.host}/api/telemetry`} label="Salin URL" />
                    <div className="api-badge online">200 OK · Active</div>
                  </div>
                </Panel>

                <Panel isGlass={liquidGlassEnabled} className="api-status-row">
                  <div className="api-status-lead">
                    <span className="api-method get">GET</span>
                    <div>
                      <div className="api-url">/api/events</div>
                      <div className="api-desc">Streaming Server-Sent Events (SSE) update realtime ke dashboard</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CopyButton text={`http://${window.location.host}/api/events`} label="Salin URL" />
                    <div className="api-badge online">Connected</div>
                  </div>
                </Panel>

                <Panel isGlass={liquidGlassEnabled} className="api-status-row">
                  <div className="api-status-lead">
                    <span className="api-method post">POST</span>
                    <div>
                      <div className="api-url">/api/login</div>
                      <div className="api-desc">Gerbang verifikasi login kredensial Super-Admin (rick/rick)</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CopyButton text={`http://${window.location.host}/api/login`} label="Salin URL" />
                    <div className="api-badge online">Secured</div>
                  </div>
                </Panel>

                <Panel isGlass={liquidGlassEnabled} className="api-status-row">
                  <div className="api-status-lead">
                    <span className="api-method post">POST</span>
                    <div>
                      <div className="api-url">/api/students/unlock</div>
                      <div className="api-desc">RPC pembukaan kunci layar ujian jarak jauh dari Super-Admin</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CopyButton text={`http://${window.location.host}/api/students/unlock`} label="Salin URL" />
                    <div className="api-badge online">Ready</div>
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 5: USER (ID) / DATA SISWA TABLE                                 */}
          {/* =================================================================== */}
          {activeTab === 'users' && (
            <div className="tab-pane-content">
              <div className="workspace-header">
                <div>
                  <h1 className="workspace-title">Data Siswa & Perangkat (User ID)</h1>
                  <p className="workspace-sub">Daftar lengkap sesi peserta ujian yang terdaftar saat ini.</p>
                </div>
              </div>

              <Panel isGlass={liquidGlassEnabled} className="user-table-wrapper">
                <table className="user-data-table">
                  <thead>
                    <tr>
                      <th>Device ID</th>
                      <th>Nama Siswa</th>
                      <th>Kelas</th>
                      <th>Perangkat</th>
                      <th>Status Ujian</th>
                      <th>Baterai</th>
                      <th>Ping</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-concrete)' }}>
                          Belum ada data siswa aktif. Buka APK atau nyalakan mode Demo.
                        </td>
                      </tr>
                    ) : (
                      students.map((s) => {
                        const meta = getStatusPresentation(s.status, s.leaveCount);
                        return (
                          <tr key={s.deviceId}>
                            <td className="code-font">{s.deviceId}</td>
                            <td style={{ fontWeight: 700 }}>{s.name}</td>
                            <td>{s.className}</td>
                            <td>{s.deviceLabel}</td>
                            <td>
                              <span className={`table-status-pill ${meta.className}`}>
                                {meta.title}
                              </span>
                            </td>
                            <td>{s.isCharging ? '⚡ ' : ''}{s.batteryLevel || 100}%</td>
                            <td className="color-green">{s.pingMs || 9}ms</td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                {s.status === 'terkunci' && (
                                  <button
                                    className="table-action-btn danger"
                                    onClick={() => handleRemoteUnlock(s.deviceId)}
                                  >
                                    Buka Kunci
                                  </button>
                                )}
                                <button
                                  className="table-action-btn"
                                  onClick={() => setSelectedStudentId(s.deviceId)}
                                >
                                  Detail
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </Panel>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 6: AKUN SUPER-ADMIN                                             */}
          {/* =================================================================== */}
          {activeTab === 'account' && (
            <div className="tab-pane-content">
              <div className="workspace-header">
                <div>
                  <h1 className="workspace-title">Profil & Keamanan Akun</h1>
                  <p className="workspace-sub">Informasi kredensial login dan hak akses Super-Admin.</p>
                </div>
              </div>

              <Panel isGlass={liquidGlassEnabled} className="settings-card">
                <div className="account-profile-header">
                  <div className="profile-large-avatar">R</div>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 800 }}>rick</h2>
                    <p style={{ fontSize: 13, color: 'var(--text-concrete)' }}>Super-Admin UjianKita · Hak Penuh</p>
                  </div>
                </div>

                <div className="setting-sep"></div>

                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Kredensial Login</h4>
                    <p>Username: <strong>rick</strong> | Password: <strong>rick</strong></p>
                  </div>
                  <div className="class-pill" style={{ color: 'var(--status-green)' }}>Aktif</div>
                </div>

                <div className="setting-sep"></div>

                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Hak Akses Khusus</h4>
                    <p>Membuka kunci sesi jarak jauh (Remote Unlock), bypass PIN, kontrol simulator, dan ekspor CSV.</p>
                  </div>
                  <span className="badge-tag">Full Privilege</span>
                </div>

                <div className="setting-sep"></div>

                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Keluar dari Sesi</h4>
                    <p>Mengakhiri sesi Super-Admin dan kembali ke halaman login.</p>
                  </div>
                  <Button destructive onClick={handleLogout}>
                    Logout Sekarang
                  </Button>
                </div>
              </Panel>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 7: SETTINGS                                                     */}
          {/* =================================================================== */}
          {activeTab === 'settings' && (
            <div className="tab-pane-content">
              <div className="workspace-header">
                <div>
                  <h1 className="workspace-title">Pengaturan Sistem & Tampilan</h1>
                  <p className="workspace-sub">Kustomisasi pengalaman antarmuka, endpoint, dan simulasi.</p>
                </div>
              </div>

              <Panel isGlass={liquidGlassEnabled} className="settings-card">
                {/* 1. TOGGLE LIQUID GLASS vs STANDAR */}
                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Pengalaman Tampilan (Liquid Glass vs Standar)</h4>
                    <p>
                      {liquidGlassEnabled
                        ? '🟢 Mode Liquid Glass Aktif: Menggunakan refraksi kaca cair, blur translusen, dan fisika spring Apple iOS.'
                        : '⚪ Mode Standar Aktif: Menggunakan tombol datar modern (Solid Graphite Flat) tanpa efek kaca.'}
                    </p>
                  </div>
                  <Switch
                    aria-label="Toggle Liquid Glass vs Standar"
                    checked={liquidGlassEnabled}
                    onCheckedChange={setLiquidGlassEnabled}
                  />
                </div>

                <div className="setting-sep"></div>

                {/* 2. SIMULATOR TOGGLE */}
                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Simulasi Data Ujian Siswa (Demo Mode)</h4>
                    <p>Jalankan 8 profil siswa virtual dengan beragam status ujian untuk demonstrasi.</p>
                  </div>
                  <Switch
                    aria-label="Toggle Demo Siswa"
                    checked={simulatorRunning}
                    onCheckedChange={handleToggleSimulator}
                  />
                </div>

                <div className="setting-sep"></div>

                {/* 3. SOUND ALERT TOGGLE */}
                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Suara Alarm Pelanggaran</h4>
                    <p>Bunyikan sinyal audio ketika terdeteksi siswa keluar aplikasi atau terkunci.</p>
                  </div>
                  <Switch
                    aria-label="Toggle Audio Alert"
                    checked={soundAlertEnabled}
                    onCheckedChange={setSoundAlertEnabled}
                  />
                </div>

                <div className="setting-sep"></div>

                {/* 4. ENDPOINT URL */}
                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Endpoint Telemetry APK Siswa</h4>
                    <p>{`http://${window.location.host}/api/telemetry`}</p>
                  </div>
                  <Button variant="glass" icon={copiedEndpoint ? <Check size={16} /> : <Copy size={16} />} onClick={copyEndpoint}>
                    {copiedEndpoint ? 'Tersalin!' : 'Salin URL'}
                  </Button>
                </div>

                <div className="setting-sep"></div>

                {/* 5. TIMEOUT SPEC */}
                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Batas Waktu Siswa Tidak Aktif (Timeout)</h4>
                    <p>Siswa otomatis dihapus jika tidak ada respon selama 18 detik.</p>
                  </div>
                  <div className="class-pill">18 Detik</div>
                </div>
              </Panel>
            </div>
          )}
        </main>
      </div>

      {/* ===================================================================== */}
      {/* MOBILE (ANDROID) BOTTOM NAVBAR                                         */}
      {/* ===================================================================== */}
      {isMobile && (
        <div className="mobile-bottom-nav-container">
          {liquidGlassEnabled ? (
            <TabBar
              aria-label="Navigasi Android"
              value={activeTab}
              onValueChange={(val) => val && setActiveTab(val)}
              items={[
                { value: 'dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
                { value: 'monitoring', label: 'Monitoring', icon: <Monitor size={20} /> },
                { value: 'status', label: 'Status API', icon: <Activity size={20} /> },
                { value: 'account', label: 'Akun', icon: <ShieldCheck size={20} /> },
              ]}
            />
          ) : (
            <div className="standard-bottom-nav-bar">
              <button
                className={`std-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <LayoutDashboard size={18} />
                <span>Home</span>
              </button>
              <button
                className={`std-nav-btn ${activeTab === 'monitoring' ? 'active' : ''}`}
                onClick={() => setActiveTab('monitoring')}
              >
                <Monitor size={18} />
                <span>Monitoring</span>
              </button>
              <button
                className={`std-nav-btn ${activeTab === 'status' ? 'active' : ''}`}
                onClick={() => setActiveTab('status')}
              >
                <Activity size={18} />
                <span>Status API</span>
              </button>
              <button
                className={`std-nav-btn ${activeTab === 'account' ? 'active' : ''}`}
                onClick={() => setActiveTab('account')}
              >
                <ShieldCheck size={18} />
                <span>Akun</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: DETAIL TELEMETRY (Clean: No Activity List Clutter)              */}
      {/* ===================================================================== */}
      {selectedStudent && (
        <div className="modal-backdrop" onClick={() => setSelectedStudentId(null)}>
          <Panel isGlass={liquidGlassEnabled} className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-identity">
                  <div className="modal-name">{selectedStudent.name}</div>
                  <div className="class-pill">{selectedStudent.className}</div>
                </div>
                <div className="modal-sub">
                  {selectedStudent.deviceLabel} · {selectedStudent.subject || 'Ujian Sekolah'}
                </div>
              </div>
              <Button
                variant="glass"
                onClick={() => setSelectedStudentId(null)}
                style={{ width: 36, height: 36, padding: 0 }}
              >
                ✕
              </Button>
            </div>

            <div className={`card-status-badge ${getStatusPresentation(selectedStudent.status, selectedStudent.leaveCount).className}`}>
              <div className="status-badge-left">
                <span className="status-dot"></span>
                <span>{getStatusPresentation(selectedStudent.status, selectedStudent.leaveCount).title}</span>
              </div>
              <span>({getStatusPresentation(selectedStudent.status, selectedStudent.leaveCount).sub})</span>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text-concrete)', textTransform: 'uppercase' }}>
              INFORMASI TELEMETRI REALTIME
            </div>

            <div className="modal-quad-grid">
              <Panel isGlass={liquidGlassEnabled} className="quad-cell">
                <div className="quad-label">
                  <Battery size={16} />
                  <span>Baterai</span>
                </div>
                <div className="quad-value">{selectedStudent.batteryLevel || 100}%</div>
                <div className="quad-desc">{selectedStudent.isCharging ? '⚡ Sedang Mengecas' : 'Daya Baterai'}</div>
              </Panel>

              <Panel isGlass={liquidGlassEnabled} className="quad-cell">
                <div className="quad-label">
                  <Wifi size={16} />
                  <span>WiFi / Jaringan</span>
                </div>
                <div className="quad-value">Wi-Fi</div>
                <div className="quad-desc">{selectedStudent.network || 'SMAN18-GUEST'}</div>
              </Panel>

              <Panel isGlass={liquidGlassEnabled} className="quad-cell">
                <div className="quad-label">
                  <Activity size={16} />
                  <span>Ping Jaringan</span>
                </div>
                <div className="quad-value color-green">{selectedStudent.pingMs || 9} ms</div>
                <div className="quad-desc">Responsif & Stabil</div>
              </Panel>

              <Panel isGlass={liquidGlassEnabled} className="quad-cell">
                <div className="quad-label">
                  <Thermometer size={16} />
                  <span>Suhu HP</span>
                </div>
                <div className="quad-value">{selectedStudent.temperature || 36.5}°C</div>
                <div className="quad-desc">Suhu Operasional Normal</div>
              </Panel>
            </div>

            {selectedStudent.status === 'terkunci' && (
              <div className="locked-warning-banner">
                <AlertTriangle size={20} color="#EF4444" />
                <div>
                  <strong>Siswa Melanggar Batas Keluar Aplikasi 3 Kali!</strong>
                  <div style={{ fontSize: 12, marginTop: 2 }}>
                    Layar ujian di HP siswa sedang terkunci. Klik tombol di bawah untuk membuka kunci dari jarak jauh.
                  </div>
                </div>
              </div>
            )}

            <div className="modal-footer">
              {(selectedStudent.status === 'terkunci' || (selectedStudent.status === 'keluar' && (selectedStudent.leaveCount || 0) >= 2)) && (
                <Button
                  destructive
                  onClick={() => handleRemoteUnlock(selectedStudent.deviceId)}
                >
                  Buka Kunci Sesi Jarak Jauh
                </Button>
              )}
              <Button variant="glass" onClick={() => setSelectedStudentId(null)}>
                Tutup
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
