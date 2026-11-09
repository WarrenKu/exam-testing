import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TabBar, Switch, Button, Glass, Input, SearchField, SegmentedControl } from 'glisse';
import {
  Monitor,
  AlertTriangle,
  BarChart3,
  Settings as SettingsIcon,
  Battery,
  Wifi,
  Activity,
  Thermometer,
  ShieldAlert,
  LogOut,
  Smartphone,
  CheckCircle,
  Copy,
  Lock,
  User,
  Radio,
  Clock,
  Check,
  Zap
} from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('ujiankita_superadmin_token') || '');
  const [students, setStudents] = useState([]);
  const [activeTab, setActiveTab] = useState('monitoring');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [simulatorRunning, setSimulatorRunning] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Login form state
  const [loginUser, setLoginUser] = useState('rick');
  const [loginPass, setLoginPass] = useState('rick');
  const [loginError, setLoginError] = useState('');

  const eventSourceRef = useRef(null);

  // Live Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('id-ID', { hour12: false }) + ' WIB');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // SSE Realtime Connection
  useEffect(() => {
    if (!token) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
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
        console.error('SSE parse error:', err);
      }
    };

    es.onerror = () => {
      console.warn('SSE reconnecting...');
    };

    // Initial fetch
    fetch('/api/students', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => setStudents(data.students || []))
      .catch(() => {});

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [token]);

  // Periodic Stale Student Cleanup (> 18s without heartbeat)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setStudents((prev) => prev.filter((s) => now - s.lastSeen <= 18000));
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

  // Remote Unlock Action
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
                  violationLogs: [
                    ...(s.violationLogs || []),
                    { timestamp: Date.now(), text: 'Sesi dibuka kembali oleh Super-Admin (Remote Unlock)' },
                  ],
                }
              : s
          )
        );
      }
    } catch (err) {
      console.error('Unlock error:', err);
    }
  };

  // Selected student for telemetry modal
  const selectedStudent = useMemo(() => {
    return students.find((s) => s.deviceId === selectedStudentId) || null;
  }, [students, selectedStudentId]);

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

  // Copy endpoint handler
  const copyEndpoint = () => {
    const url = `http://${window.location.host}/api/telemetry`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Helper for status badge presentation
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
  // VIEW: LOGIN SCREEN (if not authenticated)
  // =========================================================================
  if (!token) {
    return (
      <div className="login-screen">
        <Glass className="login-card">
          <div className="login-head">
            <div className="login-badge">
              <span className="pulse-dot"></span>
              <span>SMAN 18 BATAM</span>
            </div>
            <h1>Super-Admin Monitor</h1>
            <p>Glisse Liquid Glass Realtime Exam Integrity Panel</p>
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

            <Button variant="filled" tint="#10B981" type="submit" style={{ width: '100%', height: 44, marginTop: 8 }}>
              Masuk Dashboard Super-Admin
            </Button>
          </form>

          <div className="login-foot">
            <ShieldAlert size={14} color="#10B981" />
            <span>Enkripsi Sesi Aktif · Super-Admin (rick / rick)</span>
          </div>
        </Glass>
      </div>
    );
  }

  // =========================================================================
  // VIEW: MAIN DASHBOARD
  // =========================================================================
  return (
    <div className="app-container">
      {/* Top Header */}
      <Glass className="dashboard-topbar">
        <div className="topbar-brand">
          <div className="brand-icon-box">
            <Monitor size={22} />
          </div>
          <div className="brand-title-wrap">
            <h1>
              UjianKita <span className="badge-tag">Super-Admin</span>
            </h1>
            <div className="brand-sub">SMAN 18 Batam · Monitoring Panel</div>
          </div>
        </div>

        <div className="topbar-center">
          <div className="live-pill">
            <span className="pulse-dot"></span>
            <span>LIVE SERVER</span>
          </div>
          <div className="clock-val">{currentTime}</div>
        </div>

        <div className="topbar-actions">
          <div className="demo-toggle-wrap">
            <span>Demo Siswa</span>
            <Switch
              aria-label="Mode Demo Siswa"
              checked={simulatorRunning}
              onCheckedChange={handleToggleSimulator}
            />
          </div>

          <div className="admin-pill">
            <div className="admin-avatar">R</div>
            <span style={{ fontSize: 13, fontWeight: 700 }}>rick</span>
            <button onClick={handleLogout} className="logout-icon-btn" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </Glass>

      {/* Main Workspace Area */}
      <main className="main-workspace">
        {/* TAB 1: MONITORING */}
        {activeTab === 'monitoring' && (
          <div>
            {/* Metrics Row */}
            <div className="metrics-row">
              <Glass
                className={`metric-card ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                <div className="metric-header">Total Terhubung</div>
                <div className="metric-number">{counts.total}</div>
                <div className="metric-subtext">Siswa Aktif Ujian</div>
              </Glass>

              <Glass
                className={`metric-card ${filter === 'mengerjakan' ? 'active' : ''}`}
                onClick={() => setFilter('mengerjakan')}
              >
                <div className="metric-header color-green">🟢 Mengerjakan</div>
                <div className="metric-number color-green">{counts.mengerjakan}</div>
                <div className="metric-subtext">Fokus di Layar Soal</div>
              </Glass>

              <Glass
                className={`metric-card ${filter === 'keluar' ? 'active' : ''}`}
                onClick={() => setFilter('keluar')}
              >
                <div className="metric-header color-yellow">🟡 Keluar Aplikasi</div>
                <div className="metric-number color-yellow">{counts.keluar}</div>
                <div className="metric-subtext">Peringatan 1-2x</div>
              </Glass>

              <Glass
                className={`metric-card ${filter === 'terkunci' ? 'active' : ''}`}
                onClick={() => setFilter('terkunci')}
              >
                <div className="metric-header color-red">🔴 Sesi Terkunci</div>
                <div className="metric-number color-red">{counts.terkunci}</div>
                <div className="metric-subtext">Melanggar 3x</div>
              </Glass>

              <Glass
                className={`metric-card ${filter === 'selesai' ? 'active' : ''}`}
                onClick={() => setFilter('selesai')}
              >
                <div className="metric-header color-blue">🔵 Selesai</div>
                <div className="metric-number color-blue">{counts.selesai}</div>
                <div className="metric-subtext">Telah Kirim Jawaban</div>
              </Glass>
            </div>

            {/* Filter & Search Bar */}
            <Glass className="filter-search-bar">
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
            </Glass>

            {/* Students Grid */}
            {filteredStudents.length === 0 ? (
              <Glass className="empty-box">
                <div className="empty-icon">
                  <Monitor size={32} />
                </div>
                <div className="empty-title">Belum Ada Siswa Aktif</div>
                <div className="empty-desc">
                  Aktifkan tombol <strong>"Demo Siswa"</strong> di atas atau buka APK UjianKita pada HP siswa untuk
                  melihat telemetry secara realtime.
                </div>
              </Glass>
            ) : (
              <div className="students-grid">
                {filteredStudents.map((s) => {
                  const meta = getStatusPresentation(s.status, s.leaveCount);
                  const timeFormatted = new Date(s.startTime || Date.now()).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <Glass
                      key={s.deviceId}
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
                        <div className="stat-item color-green" title="Ping">
                          <Activity size={14} />
                          <span>{s.pingMs || 9}ms</span>
                        </div>
                        <div className="stat-item" title="Suhu HP">
                          <Thermometer size={14} />
                          <span>{s.temperature || 36.5}°C</span>
                        </div>
                      </div>

                      <div className="click-hint">Klik untuk melihat detail & buka kunci ➔</div>
                    </Glass>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PELANGGARAN */}
        {activeTab === 'violations' && (
          <div>
            <div className="tab-section-head">
              <h2>Log Riwayat Pelanggaran Siswa</h2>
              <p>Daftar siswa yang keluar dari aplikasi ujian atau mengalami sesi terkunci.</p>
            </div>

            <div className="violations-list">
              {students.filter((s) => s.status === 'terkunci' || s.status === 'keluar' || (s.violationLogs && s.violationLogs.length > 1)).length === 0 ? (
                <Glass className="empty-box">
                  <div className="empty-title">Tidak Ada Pelanggaran Aktif</div>
                  <div className="empty-desc">Semua siswa sedang fokus di layar soal tanpa pelanggaran.</div>
                </Glass>
              ) : (
                students
                  .filter((s) => s.status === 'terkunci' || s.status === 'keluar' || (s.violationLogs && s.violationLogs.length > 1))
                  .map((s) => (
                    <Glass key={s.deviceId} className="violation-row">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: s.status === 'terkunci' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: s.status === 'terkunci' ? '#EF4444' : '#F59E0B',
                          }}
                        >
                          <AlertTriangle size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>
                            {s.name} · <span className="class-pill">{s.className}</span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text-concrete)' }}>
                            {s.status === 'terkunci'
                              ? '🔴 Sesi Terkunci - Melanggar batas 3x keluar aplikasi'
                              : `🟡 Terdeteksi keluar aplikasi (${s.leaveCount}/3 kali)`}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {s.status === 'terkunci' && (
                          <Button
                            destructive
                            onClick={() => handleRemoteUnlock(s.deviceId)}
                            style={{ height: 36, fontSize: 12 }}
                          >
                            Buka Kunci Jarak Jauh
                          </Button>
                        )}
                        <Button
                          variant="glass"
                          onClick={() => setSelectedStudentId(s.deviceId)}
                          style={{ height: 36, fontSize: 12 }}
                        >
                          Detail
                        </Button>
                      </div>
                    </Glass>
                  ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: STATISTIK */}
        {activeTab === 'stats' && (
          <div>
            <div className="tab-section-head">
              <h2>Statistik Integritas & Kesehatan Perangkat</h2>
              <p>Analisis kondisi baterai, jaringan, dan kepatuhan siswa secara realtime.</p>
            </div>

            <div className="stats-grid">
              <Glass className="stat-box">
                <div className="stat-title">Tingkat Kepatuhan Siswa</div>
                <div className="stat-huge">
                  {students.length === 0
                    ? '100%'
                    : `${Math.round(
                        (students.filter((s) => s.status === 'mengerjakan' || s.status === 'selesai').length /
                          students.length) *
                          100
                      )}%`}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-concrete)' }}>
                  Siswa tetap berada di layar soal tanpa keluar aplikasi.
                </div>
              </Glass>

              <Glass className="stat-box">
                <div className="stat-title">Terhubung ke Wi-Fi Sekolah</div>
                <div className="stat-huge">{students.length} Siswa</div>
                <div style={{ fontSize: 12, color: 'var(--text-concrete)' }}>
                  Semua peserta terverifikasi terhubung ke SSID SMAN18-GUEST.
                </div>
              </Glass>

              <Glass className="stat-box">
                <div className="stat-title">Peringatan Baterai Rendah (&lt; 20%)</div>
                <div className="stat-huge">
                  {students.filter((s) => (s.batteryLevel || 100) < 20).length} Siswa
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-concrete)' }}>
                  Perlu pengecasan agar HP tidak mati mendadak saat ujian.
                </div>
              </Glass>
            </div>
          </div>
        )}

        {/* TAB 4: PENGATURAN */}
        {activeTab === 'settings' && (
          <div>
            <div className="tab-section-head">
              <h2>Pengaturan Server Super-Admin</h2>
              <p>Konfigurasi endpoint telemetry dan status sistem pemantauan.</p>
            </div>

            <Glass className="settings-card">
              <div className="setting-row">
                <div className="setting-info">
                  <h4>Endpoint Telemetry APK Siswa</h4>
                  <p>{`http://${window.location.host}/api/telemetry`}</p>
                </div>
                <Button variant="glass" icon={copied ? <Check size={16} /> : <Copy size={16} />} onClick={copyEndpoint}>
                  {copied ? 'Tersalin!' : 'Salin URL'}
                </Button>
              </div>

              <div className="setting-sep"></div>

              <div className="setting-row">
                <div className="setting-info">
                  <h4>Simulasi Profil Siswa Demo</h4>
                  <p>Menjalankan 8 siswa virtual dengan aktivitas acak untuk pengujian.</p>
                </div>
                <Switch
                  aria-label="Simulasi Data Siswa"
                  checked={simulatorRunning}
                  onCheckedChange={handleToggleSimulator}
                />
              </div>

              <div className="setting-sep"></div>

              <div className="setting-row">
                <div className="setting-info">
                  <h4>Batas Waktu Siswa Tidak Aktif (Timeout)</h4>
                  <p>Siswa otomatis dihapus jika tidak ada denyut respon (heartbeat) selama 18 detik.</p>
                </div>
                <div className="class-pill">18 Detik</div>
              </div>

              <div className="setting-sep"></div>

              <div className="setting-row">
                <div className="setting-info">
                  <h4>Kredensial Super-Admin</h4>
                  <p>Akun berwenang: <strong>rick</strong> (Hak Penuh Buka Kunci Jarak Jauh).</p>
                </div>
                <div className="class-pill" style={{ color: 'var(--status-green)' }}>
                  Aktif
                </div>
              </div>
            </Glass>
          </div>
        )}
      </main>

      {/* ===================================================================== */}
      {/* KELVIN ZHANG OFFICIAL GLISSE TAB BAR (Anchored at Bottom)              */}
      {/* ===================================================================== */}
      <div className="glisse-bottom-bar-container">
        <TabBar
          aria-label="Navigasi Utama"
          value={activeTab}
          onValueChange={(val) => val && setActiveTab(val)}
          items={[
            { value: 'monitoring', label: 'Monitoring', icon: <Monitor size={22} /> },
            { value: 'violations', label: 'Pelanggaran', icon: <AlertTriangle size={22} /> },
            { value: 'stats', label: 'Statistik', icon: <BarChart3 size={22} /> },
            { value: 'settings', label: 'Pengaturan', icon: <SettingsIcon size={22} /> },
          ]}
        />
      </div>

      {/* ===================================================================== */}
      {/* MODAL: DETAIL TELEMETRY SISWA                                         */}
      {/* ===================================================================== */}
      {selectedStudent && (
        <div className="modal-backdrop" onClick={() => setSelectedStudentId(null)}>
          <Glass className="modal-card" onClick={(e) => e.stopPropagation()}>
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
              <Button variant="glass" onClick={() => setSelectedStudentId(null)} style={{ width: 36, height: 36, padding: 0 }}>
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
              INFORMASI TAMBAHAN REALTIME
            </div>

            <div className="modal-quad-grid">
              <Glass className="quad-cell">
                <div className="quad-label">
                  <Battery size={16} />
                  <span>Baterai</span>
                </div>
                <div className="quad-value">{selectedStudent.batteryLevel || 100}%</div>
                <div className="quad-desc">{selectedStudent.isCharging ? '⚡ Sedang Mengecas' : 'Menggunakan Daya Baterai'}</div>
              </Glass>

              <Glass className="quad-cell">
                <div className="quad-label">
                  <Wifi size={16} />
                  <span>WiFi / Jaringan</span>
                </div>
                <div className="quad-value">Wi-Fi</div>
                <div className="quad-desc">{selectedStudent.network || 'SMAN18-GUEST'}</div>
              </Glass>

              <Glass className="quad-cell">
                <div className="quad-label">
                  <Activity size={16} />
                  <span>Ping Jaringan</span>
                </div>
                <div className="quad-value color-green">{selectedStudent.pingMs || 9} ms</div>
                <div className="quad-desc">Responsif & Stabil</div>
              </Glass>

              <Glass className="quad-cell">
                <div className="quad-label">
                  <Thermometer size={16} />
                  <span>Suhu HP</span>
                </div>
                <div className="quad-value">{selectedStudent.temperature || 36.5}°C</div>
                <div className="quad-desc">Suhu Operasional Normal</div>
              </Glass>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text-concrete)', textTransform: 'uppercase' }}>
              RIWAYAT PELANGGARAN & AKTIVITAS
            </div>

            <div className="timeline-box">
              {(selectedStudent.violationLogs || []).length === 0 ? (
                <div className="timeline-entry">
                  <span className="tl-time">{new Date().toLocaleTimeString('id-ID')}</span>
                  <span className="tl-text">Siswa fokus di layar ujian tanpa pelanggaran.</span>
                </div>
              ) : (
                [...selectedStudent.violationLogs].reverse().map((log, i) => (
                  <div key={i} className="timeline-entry">
                    <span className="tl-time">{new Date(log.timestamp).toLocaleTimeString('id-ID')}</span>
                    <span className={`tl-text ${log.text.includes('Keluar') || log.text.includes('terkunci') ? 'danger' : ''}`}>
                      {log.text}
                    </span>
                  </div>
                ))
              )}
            </div>

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
          </Glass>
        </div>
      )}
    </div>
  );
}
