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
  Info,
  UserPlus,
  Eye,
  EyeOff,
  Key,
  GraduationCap,
  ShieldAlert,
  CheckCircle2
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
    () => localStorage.getItem('ujiankita_liquid_glasses') === 'true'
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

  // Teachers & Staff Users State (User ID)
  const [teachers, setTeachers] = useState([]);
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [viewAsRole, setViewAsRole] = useState('superadmin'); // 'superadmin' vs 'regular'
  const [selectedTeacherForDetail, setSelectedTeacherForDetail] = useState(null);
  const [showAddTeacherModal, setShowAddTeacherModal] = useState(false);
  const [teacherNotification, setTeacherNotification] = useState('');
  const [newTeacher, setNewTeacher] = useState({
    name: '',
    nip: '',
    nsid: '',
    role: 'Guru Mata Pelajaran',
    subject: '',
    classes: '',
    status: 'Aktif',
  });

  // Realtime Broadcast State (Siaran Pengumuman Massal & Per-Siswa)
  const [activeBroadcast, setActiveBroadcast] = useState(null);
  const [showBroadcastAllModal, setShowBroadcastAllModal] = useState(false);
  const [broadcastAllForm, setBroadcastAllForm] = useState({
    title: 'PENGUMUMAN PENGAWAS',
    message: '',
    durationSeconds: 120,
  });
  const [studentBroadcastMsg, setStudentBroadcastMsg] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastFeedback, setBroadcastFeedback] = useState('');

  const eventSourceRef = useRef(null);

  // Responsive detector
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persist Liquid Glasses preference (Default OFF)
  useEffect(() => {
    localStorage.setItem('ujiankita_liquid_glasses', liquidGlassEnabled ? 'true' : 'false');
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
        } else if (payload.type === 'BROADCAST_SENT' && payload.broadcast) {
          setActiveBroadcast(payload.broadcast);
          setBroadcastFeedback(`Siaran Terkirim: ${payload.broadcast.title}`);
          setTimeout(() => setBroadcastFeedback(''), 5000);
        } else if (payload.type === 'BROADCAST_CLEARED') {
          setActiveBroadcast(null);
          setBroadcastFeedback('Siaran aktif telah dihentikan');
          setTimeout(() => setBroadcastFeedback(''), 4000);
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

    // Fetch initial broadcast state
    fetch('/api/broadcast', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => {
        if (data.activeBroadcast) setActiveBroadcast(data.activeBroadcast);
      })
      .catch(() => {});

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [token]);

  // Fetch teachers from server
  const fetchTeachers = async (roleView = viewAsRole) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/teachers?viewRole=${roleView}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.teachers) {
        setTeachers(data.teachers);
      }
    } catch (err) {
      console.error('Fetch teachers error:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchTeachers(viewAsRole);
    }
  }, [token, viewAsRole]);

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

  // Realtime Broadcast Handlers (Massal & Per-Siswa)
  const handleSendBroadcastAll = async (e) => {
    if (e) e.preventDefault();
    if (!broadcastAllForm.message.trim()) return;
    setSendingBroadcast(true);
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target: 'all',
          title: broadcastAllForm.title.trim() || 'PENGUMUMAN PENGAWAS',
          message: broadcastAllForm.message.trim(),
          durationSeconds: broadcastAllForm.durationSeconds || 120,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActiveBroadcast(data.broadcast);
        setShowBroadcastAllModal(false);
        setBroadcastFeedback('📢 Siaran massal berhasil dikirim ke seluruh siswa!');
        setTimeout(() => setBroadcastFeedback(''), 5000);
      }
    } catch (err) {
      console.error('Send broadcast all error:', err);
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleSendStudentBroadcast = async () => {
    if (!selectedStudent || !studentBroadcastMsg.trim()) return;
    setSendingBroadcast(true);
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          target: selectedStudent.deviceId,
          title: 'PERINGATAN KHUSUS PENGAWAS',
          message: studentBroadcastMsg.trim(),
          durationSeconds: 120,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBroadcastFeedback(`Siaran berhasil dikirim ke ${selectedStudent.name}!`);
        setStudentBroadcastMsg('');
        setTimeout(() => setBroadcastFeedback(''), 4000);
      }
    } catch (err) {
      console.error('Send student broadcast error:', err);
    } finally {
      setSendingBroadcast(false);
    }
  };

  const handleClearBroadcast = async () => {
    try {
      const res = await fetch('/api/broadcast', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setActiveBroadcast(null);
        setBroadcastFeedback('Siaran aktif telah dihentikan');
        setTimeout(() => setBroadcastFeedback(''), 4000);
      }
    } catch (err) {
      console.error('Clear broadcast error:', err);
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

  // Teacher & Staff Actions
  const handleToggleTeacherStatus = async (id) => {
    try {
      const res = await fetch('/api/teachers/toggle-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        setTeachers((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status: data.user.status } : t))
        );
        if (selectedTeacherForDetail && selectedTeacherForDetail.id === id) {
          setSelectedTeacherForDetail((prev) => ({ ...prev, status: data.user.status }));
        }
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      console.error('Toggle status error:', err);
    }
  };

  const handleResetTeacherPassword = async (teacher) => {
    try {
      const res = await fetch('/api/teachers/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: teacher.id }),
      });
      const data = await res.json();
      if (res.ok && data.tempPassword) {
        setTeacherNotification(
          `Password sementara untuk ${teacher.name} berhasil direset: [ ${data.tempPassword} ]. Harap berikan kepada guru bersangkutan.`
        );
      }
    } catch (err) {
      console.error('Reset password error:', err);
    }
  };

  const handleDeleteTeacher = async (id, name) => {
    if (!confirm(`Hapus akun pengawas/guru "${name}"?`)) return;
    try {
      const res = await fetch('/api/teachers', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setTeachers((prev) => prev.filter((t) => t.id !== id));
        if (selectedTeacherForDetail && selectedTeacherForDetail.id === id) {
          setSelectedTeacherForDetail(null);
        }
      }
    } catch (err) {
      console.error('Delete teacher error:', err);
    }
  };

  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    if (!newTeacher.name.trim()) return;
    try {
      const res = await fetch('/api/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTeacher),
      });
      const data = await res.json();
      if (res.ok && data.teacher) {
        setTeachers((prev) => [...prev, data.teacher]);
        setShowAddTeacherModal(false);
        setNewTeacher({
          name: '',
          nip: '',
          nsid: '',
          role: 'Guru Mata Pelajaran',
          subject: '',
          classes: '',
          status: 'Aktif',
        });
        setTeacherNotification(`Akun guru baru "${data.teacher.name}" (NSID: ${data.teacher.nsid || data.teacher.id}) berhasil ditambahkan ke sistem!`);
      }
    } catch (err) {
      console.error('Create teacher error:', err);
    }
  };

  // Filtered teachers list with Developer Privacy Shield
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      // PRIVACY SHIELD: If viewAsRole is regular, completely hide super-admin developer account
      if (viewAsRole === 'regular' && t.isSuperAdmin) {
        return false;
      }

      // Role filter
      if (userRoleFilter === 'guru' && !t.role.toLowerCase().includes('guru')) return false;
      if (userRoleFilter === 'proktor' && !t.role.toLowerCase().includes('proktor')) return false;
      if (userRoleFilter === 'admin' && !t.role.toLowerCase().includes('admin kurikulum')) return false;
      if (userRoleFilter === 'dev' && !t.isSuperAdmin) return false;

      // Text search
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        const matchName = (t.name || '').toLowerCase().includes(q);
        const matchNip = (t.nip || '').toLowerCase().includes(q);
        const matchId = (t.id || '').toLowerCase().includes(q);
        const matchSubject = (t.subject || '').toLowerCase().includes(q);
        const matchClasses = (t.classes || '').toLowerCase().includes(q);
        const matchRole = (t.role || '').toLowerCase().includes(q);
        return matchName || matchNip || matchId || matchSubject || matchClasses || matchRole;
      }

      return true;
    });
  }, [teachers, viewAsRole, userRoleFilter, userSearch]);

  const teacherRoleCounts = useMemo(() => {
    const visibleTeachers = viewAsRole === 'regular' ? teachers.filter((t) => !t.isSuperAdmin) : teachers;
    let total = visibleTeachers.length;
    let guru = 0,
      proktor = 0,
      admin = 0,
      dev = 0;
    for (const t of visibleTeachers) {
      if (t.isSuperAdmin) dev++;
      else if (t.role.toLowerCase().includes('admin kurikulum')) admin++;
      else if (t.role.toLowerCase().includes('proktor')) proktor++;
      else guru++;
    }
    return { total, guru, proktor, admin, dev };
  }, [teachers, viewAsRole]);

  // Shared Admin Menu Items (Used in Desktop topbar and Mobile bottom navbar)
  const adminMenuItems = useMemo(() => {
    const isSuper = viewAsRole === 'superadmin';
    const items = [
      { label: 'Buka Kunci Semua Siswa', icon: <Unlock size={15} />, onSelect: handleUnlockAll },
      { label: 'Siaran Pengumuman Massal', icon: <Radio size={15} />, onSelect: () => setShowBroadcastAllModal(true) },
      { label: 'Refresh Data SSE', icon: <RefreshCw size={15} />, onSelect: connectSSE },
      { label: 'Ekspor Data CSV', icon: <Download size={15} />, onSelect: handleExportCSV },
    ];
    if (isSuper) {
      items.push(
        { label: 'Pengaturan Sistem', icon: <Sliders size={15} />, onSelect: () => setActiveTab('settings') },
        'separator',
        { label: 'Bersihkan Sesi / Demo', icon: <Trash2 size={15} />, onSelect: handleResetSession, destructive: true }
      );
    }
    return items;
  }, [students, viewAsRole]);

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
      <div className={`login-screen ${liquidGlassEnabled ? 'liquid-mode' : 'standard-mode'}`}>
        {liquidGlassEnabled && <div className="login-ambient-glow"></div>}
        <Panel isGlass={liquidGlassEnabled} className="login-card">
          <div className="login-head">
            {/* Logo Emblem UjianKita */}
            <div className="login-logo-wrapper">
              <div className="login-logo-badge">
                <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
                  <rect width="48" height="48" rx="14" fill="url(#login-logo-grad)" />
                  <path d="M24 10L12 18V28C12 34.6 17.1 40.8 24 42.4C30.9 40.8 36 34.6 36 28V18L24 10Z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="rgba(255,255,255,0.12)"/>
                  <path d="M25 18L18 27H24L23 34L30 25H24L25 18Z" fill="#F0EFEA" stroke="#F0EFEA" strokeWidth="1" strokeLinejoin="round"/>
                  <defs>
                    <linearGradient id="login-logo-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#10B981"/>
                      <stop offset="1" stopColor="#0284C7"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="login-logo-text">
                <span>UjianKita</span>
                <span style={{ color: 'var(--text-concrete)', fontWeight: 400 }}>·</span>
                <span style={{ fontSize: 13, color: '#10B981' }}>CBT System</span>
              </div>
            </div>

            <div className="login-badge" style={{ marginTop: 4 }}>
              <span className="pulse-dot"></span>
              <span>SMAN 18 BATAM</span>
            </div>

            <h1 style={{ marginTop: 8 }}>Login Portal</h1>
            <p>Portal Pemantauan & Otoritas Sesi Ujian CBT</p>
          </div>

          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label className="form-label">Username</label>
              <Input
                value={loginUser}
                onValueChange={setLoginUser}
                placeholder="Masukkan username petugas"
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
              Masuk ke Portal
            </Button>
          </form>

          <div className="login-foot">
            <ShieldCheck size={14} color="#10B981" />
            <span>Kredensial Petugas: <strong>rick</strong> / <strong>rick</strong></span>
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
            {/* Mobile Branding: Petir Logo Badge + Nama (disamping) & Role (dibawahnya) */}
            <div className="mobile-header-brand">
              <div className="mobile-brand-lightning">
                <Zap size={18} color="#10B981" />
              </div>
              <div className="mobile-profile-info">
                <div className="mobile-profile-name">rick</div>
                <div className="mobile-profile-role">Super-Admin</div>
              </div>
            </div>

            {/* Desktop Server & Clock Status */}
            <div className="desktop-status-group">
              <div className="live-pill">
                <span className="pulse-dot"></span>
                <span>LIVE SERVER</span>
              </div>
              <LiveClock />
            </div>
          </div>

          <div className="topbar-right">
            {/* On Mobile, show LIVE pill on the right cleanly */}
            {isMobile && (
              <div className="live-pill" style={{ padding: '4px 10px', fontSize: 11 }}>
                <span className="pulse-dot"></span>
                <span>LIVE</span>
              </div>
            )}

            {/* Kelvin Zhang Glisse Menu Component (Desktop Only - Dipindahkan ke companion bar di mobile) */}
            {!isMobile && (
              <div className="topbar-menu-wrapper desktop-only-menu">
                <Menu
                  aria-label="Menu Aksi Super-Admin"
                  items={adminMenuItems}
                />
              </div>
            )}

            {/* Avatar Pill (Desktop Only - Pada Mobile sudah ada di samping petir) */}
            {!isMobile && (
              <div className="admin-avatar-pill">
                <div className="profile-mini-avatar">R</div>
                <span style={{ fontSize: 13, fontWeight: 700 }}>rick</span>
              </div>
            )}
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

              {/* Summary Metrics Section (Hanya Total & Selesai Ujian) */}
              <div className="summary-section two-cards">
                <Panel
                  isGlass={liquidGlassEnabled}
                  className="stat-card"
                  onClick={() => {
                    setActiveTab('monitoring');
                    setFilter('all');
                  }}
                >
                  <div className="stat-icon-wrap all-icon">
                    <Users size={22} color="#F0EFEA" />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value">{counts.total}</div>
                    <div className="stat-label">Total Peserta Ujian</div>
                  </div>
                </Panel>

                <Panel
                  isGlass={liquidGlassEnabled}
                  className="stat-card active-highlight"
                  onClick={() => {
                    setActiveTab('monitoring');
                    setFilter('selesai');
                  }}
                >
                  <div className="stat-icon-wrap blue-icon">
                    <CheckCircle2 size={22} color="#38BDF8" />
                  </div>
                  <div className="stat-info">
                    <div className="stat-value text-blue">{counts.selesai}</div>
                    <div className="stat-label">🔵 Selesai Ujian (Terkirim)</div>
                  </div>
                </Panel>
              </div>

              {/* Active Broadcast Notification Banner */}
              {activeBroadcast && (
                <div className="active-broadcast-alert">
                  <div className="broadcast-alert-icon">
                    <Radio size={18} />
                  </div>
                  <div className="broadcast-alert-content">
                    <div className="broadcast-alert-title">
                      <span>📢 SIARAN LANGSUNG AKTIF ({activeBroadcast.targetName || 'Semua Siswa'})</span>
                      <span className="live-tag">LIVE</span>
                    </div>
                    <div className="broadcast-alert-text">
                      <strong>{activeBroadcast.title}:</strong> {activeBroadcast.message}
                    </div>
                  </div>
                  <button className="broadcast-stop-btn" onClick={handleClearBroadcast}>
                    Hentikan Siaran
                  </button>
                </div>
              )}

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
                  </div>
                </Panel>

                <Panel isGlass={liquidGlassEnabled} className="banner-card">
                  <div className="banner-card-head">
                    <Activity size={18} color="#3B82F6" />
                    <h3>Aksi Cepat Super-Admin</h3>
                  </div>
                  <div className="banner-card-body">
                    <p style={{ fontSize: 13, color: 'var(--text-concrete)', marginBottom: 14 }}>
                      Gunakan tombol berikut untuk kontrol massal sesi seluruh siswa:
                    </p>
                    <div className="quick-action-buttons">
                      <button className="dashboard-action-btn" style={{ borderColor: 'rgba(56, 189, 248, 0.4)' }} onClick={() => setShowBroadcastAllModal(true)}>
                        <Radio size={15} color="#38BDF8" />
                        <span style={{ color: '#38BDF8', fontWeight: 600 }}>Siaran Pengumuman Massal</span>
                      </button>
                      <button className="dashboard-action-btn" onClick={handleUnlockAll}>
                        <Unlock size={15} />
                        <span>Buka Kunci Semua Siswa</span>
                      </button>
                      <button className="dashboard-action-btn" onClick={handleExportCSV}>
                        <Download size={15} />
                        <span>Unduh Laporan CSV</span>
                      </button>
                      <button className="dashboard-action-btn" onClick={() => setActiveTab('monitoring')}>
                        <Monitor size={15} />
                        <span>Buka Layar Monitoring</span>
                      </button>
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
                    Buka aplikasi Android UjianKita pada tablet/HP siswa untuk menghubungkan sesi ujian secara realtime.
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

                <Panel isGlass={liquidGlassEnabled} className="api-status-row">
                  <div className="api-status-lead">
                    <span className="api-method get">GET</span>
                    <div>
                      <div className="api-url">/api/teachers</div>
                      <div className="api-desc">REST API akun guru & staf (Super-Admin otomatis disembunyikan untuk peran reguler)</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CopyButton text={`http://${window.location.host}/api/teachers`} label="Salin URL" />
                    <div className="api-badge online">Active · Protected</div>
                  </div>
                </Panel>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* TAB 5: USER (ID) / DAFTAR AKUN GURU & PENGAWAS                      */}
          {/* =================================================================== */}
          {activeTab === 'users' && (
            <div className="tab-pane-content">
              <div className="workspace-header">
                <div>
                  <h1 className="workspace-title">Data Pengguna & Guru (User ID)</h1>
                  <p className="workspace-sub">
                    Daftar akun dewan guru pengawas, proktor ujian CBT, admin kurikulum, dan opsi proteksi akun Super-Admin.
                  </p>
                </div>
                <div className="workspace-header-actions">
                  {viewAsRole === 'superadmin' ? (
                    <Button
                      variant="filled"
                      tint="#10B981"
                      icon={<UserPlus size={16} />}
                      onClick={() => setShowAddTeacherModal(true)}
                    >
                      + Tambah Akun Guru
                    </Button>
                  ) : (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 12, background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399', fontSize: 13, fontWeight: 600 }}>
                      <ShieldCheck size={16} />
                      <span>Hak Akses Guru: Monitoring & Buka Kunci Siswa</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ROLE PRIVACY SHIELD & SUPER-ADMIN BANNER */}
              <Panel isGlass={liquidGlassEnabled} className={`privacy-guard-card ${viewAsRole === 'superadmin' ? 'super-hebat-mode' : 'warning-global-mode'}`}>
                <div className="privacy-guard-left">
                  <div className="privacy-shield-icon">
                    {viewAsRole === 'superadmin' ? (
                      <Zap size={24} color="#10B981" />
                    ) : (
                      <ShieldAlert size={24} color="#F59E0B" />
                    )}
                  </div>
                  <div>
                    <div className="privacy-guard-title">
                      <span style={{ fontSize: 16, fontWeight: 800, color: viewAsRole === 'superadmin' ? '#10B981' : '#F59E0B' }}>
                        {viewAsRole === 'superadmin' ? 'KAMU HEBAT' : 'PERINGATAN: AREA TERPROTEKSI'}
                      </span>
                      <span className={`privacy-guard-badge ${viewAsRole === 'superadmin' ? 'badge-super' : 'badge-warning'}`}>
                        {viewAsRole === 'superadmin' ? '🌟 Super-Admin Root' : '⚠️ Otoritas Terbatas'}
                      </span>
                    </div>
                    <p className="privacy-guard-desc">
                      {viewAsRole === 'superadmin' ? (
                        <>
                          Akses <strong>Super-Admin (rick)</strong> aktif! Seluruh kontrol pengawasan CBT, bypass kiosk, dan wewenang akun dewan guru berada dalam kendali penuhmu.
                        </>
                      ) : (
                        <>
                          <strong>Peringatan Privasi:</strong> Akun tingkat developer (Super-Admin) disembunyikan secara otomatis. Anda beroperasi di bawah tampilan dan wewenang guru/pengawas ruang standar.
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="privacy-guard-toggle-box">
                  <div className="privacy-toggle-label">Simulasi Pandangan Akses:</div>
                  <div className="role-simulator-buttons">
                    <button
                      className={`sim-role-btn ${viewAsRole === 'superadmin' ? 'active-super' : ''}`}
                      onClick={() => setViewAsRole('superadmin')}
                      title="Lihat semua akun termasuk Super-Admin (Dev Mode)"
                    >
                      <Zap size={14} />
                      <span>Mode Super-Admin (Dev)</span>
                    </button>
                    <button
                      className={`sim-role-btn ${viewAsRole === 'regular' ? 'active-regular' : ''}`}
                      onClick={() => setViewAsRole('regular')}
                      title="Simulasi pandangan Guru / Pengawas biasa (Super-Admin disembunyikan otomatis)"
                    >
                      <EyeOff size={14} />
                      <span>Pandangan Guru / Staf</span>
                    </button>
                  </div>
                </div>
              </Panel>

              {/* Notification Toast Alert */}
              {teacherNotification && (
                <div className="teacher-toast-alert">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle2 size={18} color="#10B981" />
                    <span>{teacherNotification}</span>
                  </div>
                  <button
                    onClick={() => setTeacherNotification('')}
                    style={{ background: 'none', border: 'none', color: 'var(--text-concrete)', cursor: 'pointer', fontSize: 16 }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Filter & Search Bar */}
              <Panel isGlass={liquidGlassEnabled} className="search-filter-panel">
                <SearchField
                  value={userSearch}
                  onValueChange={setUserSearch}
                  placeholder="Cari nama guru, NIP, user ID, mata pelajaran, ruang tugas..."
                />

                <div className="role-filter-chips">
                  <button
                    className={`role-filter-chip ${userRoleFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setUserRoleFilter('all')}
                  >
                    Semua ({teacherRoleCounts.total})
                  </button>
                  <button
                    className={`role-filter-chip ${userRoleFilter === 'guru' ? 'active' : ''}`}
                    onClick={() => setUserRoleFilter('guru')}
                  >
                    <GraduationCap size={13} />
                    <span>Guru ({teacherRoleCounts.guru})</span>
                  </button>
                  <button
                    className={`role-filter-chip ${userRoleFilter === 'proktor' ? 'active' : ''}`}
                    onClick={() => setUserRoleFilter('proktor')}
                  >
                    <Server size={13} />
                    <span>Proktor ({teacherRoleCounts.proktor})</span>
                  </button>
                  <button
                    className={`role-filter-chip ${userRoleFilter === 'admin' ? 'active' : ''}`}
                    onClick={() => setUserRoleFilter('admin')}
                  >
                    <ShieldCheck size={13} />
                    <span>Admin ({teacherRoleCounts.admin})</span>
                  </button>
                  {viewAsRole === 'superadmin' && (
                    <button
                      className={`role-filter-chip ${userRoleFilter === 'dev' ? 'active' : ''}`}
                      onClick={() => setUserRoleFilter('dev')}
                    >
                      <Zap size={13} />
                      <span>Developer ({teacherRoleCounts.dev})</span>
                    </button>
                  )}
                </div>
              </Panel>

              {/* Teacher & Staff Table */}
              <Panel isGlass={liquidGlassEnabled} className="user-table-wrapper">
                <table className="user-data-table">
                  <thead>
                    <tr>
                      <th>User ID & NSID</th>
                      <th>Nama Pengguna / Guru</th>
                      <th>Role / Peran</th>
                      <th>MATA PELAJARAN</th>
                      <th>Otoritas & Hak Akses</th>
                      <th>Status Akun</th>
                      <th>Terakhir Login</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeachers.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: 'var(--text-concrete)' }}>
                          Tidak ada akun guru/staf yang cocok dengan pencarian atau filter.
                        </td>
                      </tr>
                    ) : (
                      filteredTeachers.map((t) => {
                        const isDev = t.isSuperAdmin;
                        const roleLower = (t.role || '').toLowerCase();
                        const roleClass = isDev
                          ? 'dev'
                          : roleLower.includes('admin')
                          ? 'admin'
                          : roleLower.includes('proktor')
                          ? 'proktor'
                          : 'guru';

                        return (
                          <tr key={t.id} className={isDev ? 'super-admin-row' : ''}>
                            {/* User ID & NSID */}
                            <td>
                              <div className="code-font" style={{ fontWeight: 700, color: isDev ? '#34d399' : 'inherit' }}>
                                {t.id}
                              </div>
                              <div className="nsid-tag-chip" title="Nomor Standar Identitas Guru">
                                {t.nsid || `NSID-${t.id}`}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-concrete)', marginTop: 2 }}>
                                @{t.username || t.id.toLowerCase()}
                              </div>
                            </td>

                            {/* Nama & NIP */}
                            <td>
                              <div className="user-identity-cell">
                                <div className={`user-avatar-circle ${isDev ? 'dev' : ''}`}>
                                  {isDev ? '⚡' : (t.name || 'G')[0]}
                                </div>
                                <div>
                                  <div className="user-primary-name">{t.name}</div>
                                  <div className="user-sub-nip">NIP: {t.nip || '-'}</div>
                                  {isDev && (
                                    <div className="dev-tag-pill">
                                      <Zap size={10} />
                                      <span>Developer Options Root (Hidden from regular roles)</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Role / Peran */}
                            <td>
                              <span className={`role-badge ${roleClass}`}>
                                {isDev && <Zap size={12} />}
                                {!isDev && roleClass === 'admin' && <ShieldCheck size={12} />}
                                {!isDev && roleClass === 'proktor' && <Server size={12} />}
                                {!isDev && roleClass === 'guru' && <GraduationCap size={12} />}
                                <span>{t.role}</span>
                              </span>
                            </td>

                            {/* Mapel & Kelas Diampu */}
                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--text-bone)' }}>{t.subject || 'Mata Pelajaran Umum'}</div>
                              <div style={{ fontSize: 11, color: '#38BDF8', marginTop: 2, fontWeight: 600 }}>
                                Kelas: {t.classes || 'Semua Kelas'}
                              </div>
                            </td>

                            {/* Otoritas & Hak Akses */}
                            <td>
                              <div style={{ fontSize: 12, fontWeight: 600, color: isDev ? '#34d399' : '#10B981' }}>
                                {isDev ? 'Akses Penuh Arsitektur Root' : 'Monitoring Siswa & Buka Kunci'}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-concrete)' }}>
                                {isDev ? 'Developer Options' : 'Dapat membuka kunci layar siswa'}
                              </div>
                            </td>

                            {/* Status Akun (Interactive Toggle) */}
                            <td>
                              <button
                                className={`status-toggle-pill ${t.status === 'Aktif' ? 'active' : 'inactive'}`}
                                onClick={() => handleToggleTeacherStatus(t.id)}
                                title={viewAsRole !== 'superadmin' ? 'Hanya Super-Admin yang dapat mengubah status' : (isDev ? 'Status Super-Admin tidak dapat diubah' : 'Klik untuk mengubah status')}
                                disabled={isDev || viewAsRole !== 'superadmin'}
                              >
                                <span className="status-dot"></span>
                                <span>{t.status}</span>
                              </button>
                            </td>

                            {/* Terakhir Login */}
                            <td style={{ fontSize: 12, color: 'var(--text-concrete)' }}>
                              {t.lastLogin || 'Hari ini'}
                            </td>

                            {/* Aksi */}
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <button
                                  className="table-action-btn"
                                  onClick={() => setSelectedTeacherForDetail(t)}
                                  title="Lihat detail hak akses guru"
                                >
                                  Detail
                                </button>
                                {viewAsRole === 'superadmin' && !isDev && (
                                  <>
                                    <button
                                      className="table-action-btn"
                                      onClick={() => handleResetTeacherPassword(t)}
                                      title="Reset password ke sandi sementara"
                                    >
                                      Reset PIN
                                    </button>
                                    <button
                                      className="table-action-btn danger"
                                      onClick={() => handleDeleteTeacher(t.id, t.name)}
                                      title="Hapus akun guru"
                                    >
                                      Hapus
                                    </button>
                                  </>
                                )}
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
                {/* 1. TOGGLE LIQUID GLASSES vs STANDAR */}
                <div className="setting-row">
                  <div className="setting-info">
                    <h4>Liquid Glasses</h4>
                    <p>
                      {liquidGlassEnabled
                        ? '🟢 Mode Liquid Glasses Aktif: Menggunakan refraksi kaca cair, blur translusen, dan fisika spring Apple iOS.'
                        : '⚪ Mode Standar Aktif: Antarmuka standar normal, solid graphite tanpa efek kaca atau blur pada menu dan toggle.'}
                    </p>
                  </div>
                  <Switch
                    aria-label="Toggle Liquid Glasses"
                    checked={liquidGlassEnabled}
                    onCheckedChange={setLiquidGlassEnabled}
                  />
                </div>

                <div className="setting-sep"></div>

                {/* 2. SOUND ALERT TOGGLE */}
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
                  <button className="ui-action-btn" onClick={copyEndpoint}>
                    {copiedEndpoint ? <Check size={16} color="#10B981" /> : <Copy size={16} />}
                    <span>{copiedEndpoint ? 'Tersalin!' : 'Salin URL'}</span>
                  </button>
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
      {/* MOBILE (ANDROID) BOTTOM NAVBAR & ACTION MENU                           */}
      {/* ===================================================================== */}
      {isMobile && (
        <div className="mobile-bottom-nav-container">
          {liquidGlassEnabled ? (
            /* MODE LIQUID GLASS: Kelvin Zhang Glisse TabBar Asli (Animasi Tarik & Spring Physics) */
            <div className="mobile-glisse-tabbar-wrap">
              <TabBar
                aria-label="Navigasi UjianKita Android"
                value={activeTab === 'account' ? 'users' : activeTab}
                onValueChange={(val) => val && setActiveTab(val)}
                items={[
                  { value: 'dashboard', label: 'Home', icon: <LayoutDashboard size={20} /> },
                  { value: 'monitoring', label: 'Monitoring', icon: <Monitor size={20} /> },
                  { value: 'status', label: 'Status API', icon: <Activity size={20} /> },
                  { value: 'users', label: 'Akun', icon: <ShieldCheck size={20} /> },
                ]}
              />
            </div>
          ) : (
            /* MODE STANDAR: UI Standar Halus & Ringan untuk Device Biasa (Tanpa GPU Lag) */
            <div className="mobile-nav-capsule standard-capsule">
              <button
                type="button"
                className={`capsule-tab-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('dashboard')}
              >
                <LayoutDashboard size={20} className="tab-icon" />
                <span className="tab-label">Home</span>
              </button>

              <button
                type="button"
                className={`capsule-tab-item ${activeTab === 'monitoring' ? 'active' : ''}`}
                onClick={() => setActiveTab('monitoring')}
              >
                <Monitor size={20} className="tab-icon" />
                <span className="tab-label">Monitoring</span>
              </button>

              <button
                type="button"
                className={`capsule-tab-item ${activeTab === 'status' ? 'active' : ''}`}
                onClick={() => setActiveTab('status')}
              >
                <Activity size={20} className="tab-icon" />
                <span className="tab-label">Status API</span>
              </button>

              <button
                type="button"
                className={`capsule-tab-item ${activeTab === 'users' || activeTab === 'account' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                <ShieldCheck size={20} className="tab-icon" />
                <span className="tab-label">Akun</span>
              </button>
            </div>
          )}

          {/* Tombol Companion Aksi Bulat di Samping Kapsul (Persis Gambar 2) */}
          <div className="mobile-companion-action">
            <Menu
              aria-label="Menu Opsi Aksi"
              align="end"
              items={adminMenuItems}
            />
          </div>
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
              <button
                className="modal-close-btn"
                onClick={() => setSelectedStudentId(null)}
                aria-label="Tutup"
              >
                ✕
              </button>
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

            {/* Realtime Broadcast / Peringatan Langsung ke Siswa */}
            <div className="modal-broadcast-section">
              <div className="section-label-row">
                <Radio size={14} color="#38BDF8" />
                <span className="section-label">📢 Kirim Siaran Langsung ke Siswa Ini</span>
              </div>
              <div className="broadcast-preset-chips">
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => setStudentBroadcastMsg('Harap tetap fokus pada lembar soal dan jangan membuka aplikasi lain!')}
                >
                  Fokus Soal
                </button>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => setStudentBroadcastMsg('Peringatan Pengawas: Terdeteksi upaya berpindah jendela aplikasi!')}
                >
                  Peringatan Jendela
                </button>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => setStudentBroadcastMsg('Sisa waktu ujian 15 menit lagi. Periksa seluruh jawaban Anda.')}
                >
                  Sisa 15 Menit
                </button>
              </div>
              <div className="broadcast-input-row">
                <input
                  type="text"
                  className="broadcast-text-input"
                  placeholder={`Ketik pesan siaran untuk ${selectedStudent.name}...`}
                  value={studentBroadcastMsg}
                  onChange={(e) => setStudentBroadcastMsg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSendStudentBroadcast();
                  }}
                />
                <button
                  className="broadcast-send-btn"
                  onClick={handleSendStudentBroadcast}
                  disabled={!studentBroadcastMsg.trim() || sendingBroadcast}
                >
                  <Radio size={14} />
                  <span>{sendingBroadcast ? 'Mengirim...' : 'Kirim Siaran'}</span>
                </button>
              </div>
              <div className="broadcast-hint">
                Pesan akan langsung tampil melayang di layar ujian HP siswa secara realtime tanpa menggeser formulir soal.
              </div>
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
              <button className="ui-action-btn" onClick={() => setSelectedStudentId(null)}>
                Tutup
              </button>
            </div>
          </Panel>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: DETAIL AKUN GURU & HAK AKSES                                    */}
      {/* ===================================================================== */}
      {selectedTeacherForDetail && (
        <div className="modal-backdrop" onClick={() => setSelectedTeacherForDetail(null)}>
          <Panel isGlass={liquidGlassEnabled} className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  className={`user-avatar-circle ${selectedTeacherForDetail.isSuperAdmin ? 'dev' : ''}`}
                  style={{ width: 44, height: 44, fontSize: 16 }}
                >
                  {selectedTeacherForDetail.isSuperAdmin ? '⚡' : (selectedTeacherForDetail.name || 'G')[0]}
                </div>
                <div>
                  <div className="modal-name">{selectedTeacherForDetail.name}</div>
                  <div className="modal-sub">
                    ID: {selectedTeacherForDetail.id} · NSID: <strong style={{ color: '#38BDF8' }}>{selectedTeacherForDetail.nsid || selectedTeacherForDetail.id}</strong> · NIP: {selectedTeacherForDetail.nip || '-'}
                  </div>
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setSelectedTeacherForDetail(null)}
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>

            {selectedTeacherForDetail.isSuperAdmin && (
              <div
                className="locked-warning-banner"
                style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)' }}
              >
                <Zap size={20} color="#10B981" />
                <div>
                  <strong style={{ color: '#34d399' }}>Akun Developer Root (Super-Admin)</strong>
                  <div style={{ fontSize: 12, marginTop: 2, color: 'var(--text-concrete)' }}>
                    Akun ini memegang hak akses penuh arsitektur sistem. Akun ini tidak dapat dihapus dan otomatis disembunyikan dari peran Guru dan Pengawas biasa demi privasi.
                  </div>
                </div>
              </div>
            )}

            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: 'var(--text-concrete)', textTransform: 'uppercase' }}>
              RINCIAN PENUGASAN & HAK AKSES SISTEM
            </div>

            <div className="modal-quad-grid">
              <Panel isGlass={liquidGlassEnabled} className="quad-cell">
                <div className="quad-label">
                  <ShieldCheck size={16} />
                  <span>Peran / Role</span>
                </div>
                <div className="quad-value" style={{ fontSize: 15 }}>{selectedTeacherForDetail.role}</div>
                <div className="quad-desc">Tingkat Otoritas Sistem</div>
              </Panel>

              <Panel isGlass={liquidGlassEnabled} className="quad-cell">
                <div className="quad-label">
                  <GraduationCap size={16} />
                  <span>Mata Pelajaran</span>
                </div>
                <div className="quad-value" style={{ fontSize: 15 }}>{selectedTeacherForDetail.subject}</div>
                <div className="quad-desc">Bidang Ujian Diampu</div>
              </Panel>

              <Panel isGlass={liquidGlassEnabled} className="quad-cell">
                <div className="quad-label">
                  <Monitor size={16} />
                  <span>Kelas yang Diampu</span>
                </div>
                <div className="quad-value" style={{ fontSize: 15 }}>{selectedTeacherForDetail.classes || 'XI.1 - XI.4'}</div>
                <div className="quad-desc">Rombel Penugasan Ujian</div>
              </Panel>

              <Panel isGlass={liquidGlassEnabled} className="quad-cell">
                <div className="quad-label">
                  <Key size={16} />
                  <span>Status Akun</span>
                </div>
                <div
                  className="quad-value"
                  style={{
                    fontSize: 15,
                    color: selectedTeacherForDetail.status === 'Aktif' ? 'var(--status-green)' : 'var(--text-concrete)',
                  }}
                >
                  {selectedTeacherForDetail.status}
                </div>
                <div className="quad-desc">Kesiapan Login Petugas</div>
              </Panel>
            </div>

            <div className="banner-card-body" style={{ background: 'rgba(24, 24, 27, 0.6)', padding: 14, borderRadius: 14, marginTop: 12 }}>
              <div className="info-stat-row">
                <span>Nomor Standar Identitas (NSID)</span>
                <strong className="code-font" style={{ color: '#38BDF8' }}>{selectedTeacherForDetail.nsid || selectedTeacherForDetail.id}</strong>
              </div>
              <div className="info-stat-row">
                <span>Hak Otoritas & Akses</span>
                <strong style={{ color: '#10B981' }}>{selectedTeacherForDetail.privilege || 'Monitoring Siswa & Buka Kunci Layar'}</strong>
              </div>
              <div className="info-stat-row">
                <span>Terakhir Login</span>
                <strong>{selectedTeacherForDetail.lastLogin || 'Hari ini'}</strong>
              </div>
              <div className="info-stat-row">
                <span>Username Sistem</span>
                <strong className="code-font">@{selectedTeacherForDetail.username || selectedTeacherForDetail.id.toLowerCase()}</strong>
              </div>
            </div>

            <div className="modal-footer">
              {viewAsRole === 'superadmin' && !selectedTeacherForDetail.isSuperAdmin && (
                <>
                  <button
                    className="ui-action-btn"
                    onClick={() => handleToggleTeacherStatus(selectedTeacherForDetail.id)}
                  >
                    {selectedTeacherForDetail.status === 'Aktif' ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                  </button>
                  <button
                    className="ui-action-btn"
                    style={{ borderColor: 'rgba(245, 158, 11, 0.5)', color: '#F59E0B' }}
                    onClick={() => {
                      handleResetTeacherPassword(selectedTeacherForDetail);
                      setSelectedTeacherForDetail(null);
                    }}
                  >
                    Reset Password
                  </button>
                </>
              )}
              <button className="ui-action-btn" onClick={() => setSelectedTeacherForDetail(null)}>
                Tutup
              </button>
            </div>
          </Panel>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: TAMBAH AKUN GURU BARU                                          */}
      {/* ===================================================================== */}
      {showAddTeacherModal && (
        <div className="modal-backdrop" onClick={() => setShowAddTeacherModal(false)}>
          <Panel isGlass={liquidGlassEnabled} className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-name">Tambah Akun Guru / Petugas Baru</div>
                <div className="modal-sub">Daftarkan dewan guru, proktor, atau pengawas ujian baru ke sistem.</div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowAddTeacherModal(false)}
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTeacher} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Nama Lengkap & Gelar</label>
                <Input
                  value={newTeacher.name}
                  onValueChange={(val) => setNewTeacher((prev) => ({ ...prev, name: val }))}
                  placeholder="Contoh: Siti Fatimah, S.Pd"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">NSID (Nomor Standar Identitas Guru)</label>
                <Input
                  value={newTeacher.nsid || ''}
                  onValueChange={(val) => setNewTeacher((prev) => ({ ...prev, nsid: val }))}
                  placeholder="Contoh: NSID-202611-0550 (Otomatis dibuat jika dikosongkan)"
                />
              </div>

              <div className="form-group">
                <label className="form-label">NIP / NUPTK / Kode Guru</label>
                <Input
                  value={newTeacher.nip}
                  onValueChange={(val) => setNewTeacher((prev) => ({ ...prev, nip: val }))}
                  placeholder="Contoh: 19890415 201201 2 007"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Peran / Role Petugas</label>
                <select
                  className="form-select-input"
                  value={newTeacher.role}
                  onChange={(e) => setNewTeacher((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="Guru Mata Pelajaran">👨‍🏫 Guru Mata Pelajaran (Default)</option>
                  <option value="Guru Pengawas">📋 Guru Pengawas Ruang</option>
                  <option value="Proktor CBT">🛡️ Proktor CBT</option>
                  <option value="Admin Kurikulum">📊 Admin Kurikulum</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">MATA PELAJARAN</label>
                <Input
                  value={newTeacher.subject}
                  onValueChange={(val) => setNewTeacher((prev) => ({ ...prev, subject: val }))}
                  placeholder="Contoh: MATEMATIKA XI.4"
                  required
                />
              </div>

              <div className="modal-footer" style={{ marginTop: 10 }}>
                <button className="ui-action-btn" type="button" onClick={() => setShowAddTeacherModal(false)}>
                  Batal
                </button>
                <Button variant="filled" tint="#10B981" type="submit">
                  Simpan Akun Guru
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL: SIARAN PENGUMUMAN MASSAL KE SEMUA SISWA (BROADCAST ALL)       */}
      {/* ===================================================================== */}
      {showBroadcastAllModal && (
        <div className="modal-backdrop" onClick={() => setShowBroadcastAllModal(false)}>
          <Panel isGlass={liquidGlassEnabled} className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-identity">
                  <div className="modal-name">📢 Siaran Pengumuman Massal (Broadcast All)</div>
                </div>
                <div className="modal-sub">
                  Kirim pesan teks realtime ke SELURUH peserta ujian yang sedang aktif secara serentak.
                </div>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setShowBroadcastAllModal(false)}
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>

            <div className="broadcast-live-preview-box">
              <div className="preview-label">PRATINJAU TAMPILAN DI HP SISWA (MENGAMBANG TANPA MENGGESER SOAL):</div>
              <div className="preview-banner-card">
                <div className="preview-icon">📢</div>
                <div className="preview-content">
                  <div className="preview-title">
                    <span>{broadcastAllForm.title || 'PENGUMUMAN PENGAWAS'}</span>
                    <span className="live-tag">LIVE</span>
                  </div>
                  <div className="preview-msg">
                    {broadcastAllForm.message || 'Ketik pesan siaran di bawah untuk melihat simulasi tampilan...'}
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleSendBroadcastAll} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Judul Siaran</label>
                <Input
                  value={broadcastAllForm.title}
                  onValueChange={(val) => setBroadcastAllForm((prev) => ({ ...prev, title: val }))}
                  placeholder="Contoh: PENGUMUMAN PENGAWAS"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Pesan Siaran untuk Seluruh Siswa</label>
                <textarea
                  className="broadcast-textarea"
                  rows={3}
                  value={broadcastAllForm.message}
                  onChange={(e) => setBroadcastAllForm((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Ketik pengumuman penting yang harus dibaca oleh seluruh siswa..."
                  required
                />
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: 6, display: 'block' }}>Pilihan Cepat / Template Pengawas:</label>
                <div className="broadcast-preset-chips">
                  <button
                    type="button"
                    className="preset-chip"
                    onClick={() => setBroadcastAllForm((prev) => ({ ...prev, message: 'Waktu ujian tersisa 15 menit lagi! Pastikan semua jawaban telah diisi.' }))}
                  >
                    ⏳ Sisa 15 Menit
                  </button>
                  <button
                    type="button"
                    className="preset-chip"
                    onClick={() => setBroadcastAllForm((prev) => ({ ...prev, message: 'Dilarang keras keluar dari aplikasi ujian atau sesi Anda akan langsung terkunci!' }))}
                  >
                    ⚠️ Peringatan Jangan Keluar
                  </button>
                  <button
                    type="button"
                    className="preset-chip"
                    onClick={() => setBroadcastAllForm((prev) => ({ ...prev, message: 'Waktu ujian telah berakhir. Silakan segera tekan tombol Submit / Kirim formulir!' }))}
                  >
                    🛑 Waktu Ujian Selesai
                  </button>
                  <button
                    type="button"
                    className="preset-chip"
                    onClick={() => setBroadcastAllForm((prev) => ({ ...prev, message: 'Pengawas sedang memeriksa ruangan. Harap tenang dan fokus pada layar masing-masing.' }))}
                  >
                    👮 Pengecekan Ruang
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Durasi Tampil di Layar Siswa</label>
                <select
                  className="form-select-input"
                  value={broadcastAllForm.durationSeconds}
                  onChange={(e) => setBroadcastAllForm((prev) => ({ ...prev, durationSeconds: Number(e.target.value) }))}
                >
                  <option value={30}>30 Detik</option>
                  <option value={60}>1 Menit</option>
                  <option value={120}>2 Menit (Standar)</option>
                  <option value={300}>5 Menit</option>
                </select>
              </div>

              <div className="modal-footer" style={{ marginTop: 10 }}>
                {activeBroadcast && (
                  <button
                    type="button"
                    className="ui-action-btn"
                    style={{ borderColor: 'rgba(239, 68, 68, 0.5)', color: '#EF4444' }}
                    onClick={handleClearBroadcast}
                  >
                    Hentikan Siaran Aktif
                  </button>
                )}
                <button className="ui-action-btn" type="button" onClick={() => setShowBroadcastAllModal(false)}>
                  Batal
                </button>
                <Button variant="filled" tint="#0284C7" type="submit" disabled={!broadcastAllForm.message.trim() || sendingBroadcast}>
                  {sendingBroadcast ? 'Mengirim Siaran...' : '🚀 Siarkan ke Semua Siswa'}
                </Button>
              </div>
            </form>
          </Panel>
        </div>
      )}
    </div>
  );
}
