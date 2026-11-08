import 'dart:async';
import 'dart:convert';
import 'dart:ui';

import 'package:csv/csv.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_windowmanager_plus/flutter_windowmanager_plus.dart';
import 'package:http/http.dart' as http;
import 'package:webview_flutter/webview_flutter.dart';

const tokenSheetCsvUrl =
    'https://docs.google.com/spreadsheets/d/1mMANbRElvGLNAViBzOqY1UND5CY8wR6WNQRg1lpSKb0/export?format=csv';

void main() {
  runApp(const UjianKitaApp());
}

/// Service komunikasi ke Android native untuk Kiosk / Lock Task Mode & statistik
class KioskService {
  static const _channel = MethodChannel('id.ujian_kita/kiosk');

  static Future<bool> startLockTask() async {
    try {
      final res = await _channel.invokeMethod<bool>('startLockTask');
      return res ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> stopLockTask() async {
    try {
      final res = await _channel.invokeMethod<bool>('stopLockTask');
      return res ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> isPinned() async {
    try {
      final res = await _channel.invokeMethod<bool>('isPinned');
      return res ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<Map<String, dynamic>> getStats() async {
    try {
      final res = await _channel.invokeMapMethod<String, dynamic>('getStats');
      return res ?? {};
    } catch (_) {
      return {};
    }
  }
}

class UjianKitaApp extends StatefulWidget {
  const UjianKitaApp({super.key});

  @override
  State<UjianKitaApp> createState() => _UjianKitaAppState();
}

class _UjianKitaAppState extends State<UjianKitaApp> {
  bool _isDark = false;
  bool _ignoreScheduleForTesting = true;
  bool _isReady = false;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'EXAMBRO SMAN18 BATAM',
      themeMode: _isDark ? ThemeMode.dark : ThemeMode.light,
      theme: _theme(Brightness.light),
      darkTheme: _theme(Brightness.dark),
      home: _isReady
          ? ExamShell(
              isDark: _isDark,
              ignoreScheduleForTesting: _ignoreScheduleForTesting,
              onThemeChanged: (value) => setState(() => _isDark = value),
              onTestingModeChanged: (value) =>
                  setState(() => _ignoreScheduleForTesting = value),
            )
          : SplashScreen(
              onReady: () {
                if (mounted) setState(() => _isReady = true);
              },
            ),
    );
  }

  ThemeData _theme(Brightness brightness) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF1D4ED8),
      brightness: brightness,
    );
    return ThemeData(
      colorScheme: colorScheme,
      useMaterial3: true,
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: colorScheme.outline),
        ),
      ),
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key, required this.onReady});

  final VoidCallback onReady;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future<void>.delayed(const Duration(milliseconds: 2500), () {
      if (mounted) widget.onReady();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: theme.colorScheme.surface,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(20),
                child: Image.asset(
                  'assets/sman18-batam.png',
                  width: 140,
                  height: 140,
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      width: 140,
                      height: 140,
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Icon(
                        Icons.school,
                        size: 72,
                        color: theme.colorScheme.primary,
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 24),
              Text(
                'EXAMBRO SMAN18 BATAM',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                'dev by github/warrenku',
                style: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 36),
              const SizedBox(
                width: 26,
                height: 26,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ExamShell extends StatefulWidget {
  const ExamShell({
    super.key,
    required this.isDark,
    required this.ignoreScheduleForTesting,
    required this.onThemeChanged,
    required this.onTestingModeChanged,
  });

  final bool isDark;
  final bool ignoreScheduleForTesting;
  final ValueChanged<bool> onThemeChanged;
  final ValueChanged<bool> onTestingModeChanged;

  @override
  State<ExamShell> createState() => _ExamShellState();
}

class _ExamShellState extends State<ExamShell> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      TokenPage(ignoreScheduleForTesting: widget.ignoreScheduleForTesting),
      const InformationPage(),
      SettingsPage(
        isDark: widget.isDark,
        ignoreScheduleForTesting: widget.ignoreScheduleForTesting,
        onThemeChanged: widget.onThemeChanged,
        onTestingModeChanged: widget.onTestingModeChanged,
      ),
    ];
    return Scaffold(
      body: SafeArea(child: pages[_selectedIndex]),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(18),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
              child: NavigationBar(
                selectedIndex: _selectedIndex,
                onDestinationSelected: (value) => setState(() => _selectedIndex = value),
                destinations: const [
                  NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Beranda'),
                  NavigationDestination(icon: Icon(Icons.info_outline), selectedIcon: Icon(Icons.info), label: 'Informasi'),
                  NavigationDestination(icon: Icon(Icons.settings_outlined), selectedIcon: Icon(Icons.settings), label: 'Pengaturan'),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class TokenPage extends StatefulWidget {
  const TokenPage({super.key, required this.ignoreScheduleForTesting});

  final bool ignoreScheduleForTesting;

  @override
  State<TokenPage> createState() => _TokenPageState();
}

class _TokenPageState extends State<TokenPage> {
  final _tokenController = TextEditingController();
  bool _isLoading = false;
  String? _message;

  @override
  void dispose() {
    _tokenController.dispose();
    super.dispose();
  }

  Future<void> _validateToken() async {
    final enteredToken = _tokenController.text.trim();
    if (enteredToken.isEmpty) {
      setState(() => _message = 'Masukkan token ujian terlebih dahulu.');
      return;
    }
    setState(() {
      _isLoading = true;
      _message = null;
    });
    try {
      final exams = await TokenSheetRepository().loadByToken(enteredToken);
      if (exams.isEmpty) {
        setState(() => _message = 'Token "$enteredToken" tidak ditemukan di jadwal ujian.');
        return;
      }
      if (!mounted) return;

      // Jika hanya ada 1 mapel pada token ini, langsung buka ujian
      if (exams.length == 1) {
        final exam = exams.first;
        if (exam.cleanFormUrl.isEmpty) {
          setState(() => _message = 'Link soal untuk ${exam.subject.isEmpty ? 'mapel ini' : exam.subject} belum tersedia di Spreadsheet.');
          return;
        }
        if (!widget.ignoreScheduleForTesting && !exam.isScheduledToday) {
          setState(() => _message = 'Ujian ini dijadwalkan pada hari ${exam.day}. Aktifkan "Mode uji jadwal" di Pengaturan untuk menguji hari ini.');
          return;
        }
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ExamSessionPage(exam: exam),
          ),
        );
      } else {
        // Jika ada beberapa mapel dengan token yang sama, tampilkan halaman pilihan
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ExamSelectionPage(
              exams: exams,
              ignoreScheduleForTesting: widget.ignoreScheduleForTesting,
            ),
          ),
        );
      }
    } on SheetException catch (error) {
      setState(() => _message = error.message);
    } catch (_) {
      setState(() => _message = 'Gagal memeriksa token. Periksa koneksi internet Anda.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 20),
      children: [
        Text('Masuk ujian', style: theme.textTheme.headlineMedium),
        const SizedBox(height: 8),
        Text('Masukkan token dari pengawas untuk memulai ujian.', style: theme.textTheme.bodyLarge),
        const SizedBox(height: 36),
        TextField(
          controller: _tokenController,
          autocorrect: false,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(
            labelText: 'Token ujian',
            hintText: 'Contoh: XYZXY',
            prefixIcon: Icon(Icons.key_outlined),
          ),
          onSubmitted: (_) => _isLoading ? null : _validateToken(),
        ),
        const SizedBox(height: 16),
        SizedBox(
          height: 52,
          child: FilledButton.icon(
            onPressed: _isLoading ? null : _validateToken,
            icon: _isLoading
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.login),
            label: Text(_isLoading ? 'Memeriksa token...' : 'Buka ujian'),
          ),
        ),
        if (_message != null) ...[
          const SizedBox(height: 18),
          Semantics(
            liveRegion: true,
            child: Text(_message!, style: TextStyle(color: theme.colorScheme.error, fontWeight: FontWeight.w500)),
          ),
        ],
        const SizedBox(height: 44),
        const TestModeNotice(),
      ],
    );
  }
}

class TestModeNotice extends StatelessWidget {
  const TestModeNotice({super.key});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Versi uji', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 6),
            const Text(
              'Aplikasi membaca jadwal langsung dari Spreadsheet saat token diperiksa. '
              'Jika token berisi satu mapel, aplikasi langsung membuka soal Google Form. '
              'Jika token digunakan bersama oleh beberapa kelas, akan muncul daftar pilihan mapel.',
            ),
          ],
        ),
      ),
    );
  }
}

class InformationPage extends StatelessWidget {
  const InformationPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 20),
      children: [
        Text('Informasi ujian', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 20),
        const ListTile(
          leading: Icon(Icons.visibility_outlined),
          title: Text('Aktivitas sesi'),
          subtitle: Text('Aplikasi menghitung saat sesi masuk ke latar belakang.'),
        ),
        const ListTile(
          leading: Icon(Icons.lock_outline),
          title: Text('Tiga pelanggaran'),
          subtitle: Text('Pada versi uji, sesi dikunci setelah aplikasi ditinggalkan tiga kali.'),
        ),
        const ListTile(
          leading: Icon(Icons.privacy_tip_outlined),
          title: Text('Data peserta'),
          subtitle: Text('Nama dan kelas dibaca otomatis saat diketik pada formulir Google Form.'),
        ),
      ],
    );
  }
}

class SettingsPage extends StatelessWidget {
  const SettingsPage({
    super.key,
    required this.isDark,
    required this.ignoreScheduleForTesting,
    required this.onThemeChanged,
    required this.onTestingModeChanged,
  });

  final bool isDark;
  final bool ignoreScheduleForTesting;
  final ValueChanged<bool> onThemeChanged;
  final ValueChanged<bool> onTestingModeChanged;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 20),
      children: [
        Text('Pengaturan', style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: 20),
        SwitchListTile(
          value: isDark,
          onChanged: onThemeChanged,
          title: const Text('Tema gelap'),
          subtitle: const Text('Sesuaikan tampilan dengan kondisi ruang ujian.'),
        ),
        SwitchListTile(
          value: ignoreScheduleForTesting,
          onChanged: onTestingModeChanged,
          title: const Text('Mode uji jadwal'),
          subtitle: const Text('Izinkan token dibuka di luar hari yang tercantum pada Spreadsheet.'),
        ),
      ],
    );
  }
}

class ExamSelectionPage extends StatelessWidget {
  const ExamSelectionPage({
    super.key,
    required this.exams,
    required this.ignoreScheduleForTesting,
  });

  final List<ExamRecord> exams;
  final bool ignoreScheduleForTesting;

  void _openExam(BuildContext context, ExamRecord exam) {
    if (exam.cleanFormUrl.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Link soal untuk ${exam.subject.isEmpty ? 'mapel ini' : exam.subject} belum tersedia.'),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
      return;
    }
    if (!ignoreScheduleForTesting && !exam.isScheduledToday) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Ujian ini dijadwalkan pada hari ${exam.day}. Aktifkan Mode uji jadwal di Pengaturan.'),
        ),
      );
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ExamSessionPage(exam: exam)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pilih ujian')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 28),
        children: [
          Text('Pilih mapel dan kelas', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 6),
          Text('Token ini memiliki ${exams.length} pilihan jadwal.'),
          const SizedBox(height: 16),
          for (final exam in exams)
            Card(
              child: ListTile(
                contentPadding: const EdgeInsets.all(16),
                leading: const Icon(Icons.assignment_outlined),
                title: Text(exam.subject.isEmpty ? 'Mapel belum diisi' : exam.subject),
                subtitle: Text(
                  'Kelas ${exam.classLevel} · Sesi ${exam.session} · ${exam.durationMinutes} menit · ${exam.day}',
                ),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _openExam(context, exam),
              ),
            ),
        ],
      ),
    );
  }
}

class ExamSessionPage extends StatefulWidget {
  const ExamSessionPage({super.key, required this.exam});

  final ExamRecord exam;

  @override
  State<ExamSessionPage> createState() => _ExamSessionPageState();
}

class _ExamSessionPageState extends State<ExamSessionPage> with WidgetsBindingObserver {
  late final WebViewController _webController;
  String _name = 'Belum terbaca';
  String _className = 'Belum terbaca';
  String _deviceLabel = 'Memeriksa perangkat...';
  int _leaveCount = 0;
  bool _locked = false;
  bool _isLoadingWeb = true;
  String? _webError;

  bool _canGoBack = false;
  bool _canGoForward = false;

  // Realtime Device & Exam Statistics
  late DateTime _sessionStartTime;
  Timer? _tickerTimer;
  int _batteryLevel = 100;
  bool _isCharging = false;
  double _deviceTemp = 33.5;
  String _networkName = 'Wi-Fi';
  bool _isPinned = false;

  @override
  void initState() {
    super.initState();
    unawaited(_setScreenSecurity(true));
    WidgetsBinding.instance.addObserver(this);

    // Kiosk Mode & Layar Penuh Immersive Sticky
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    unawaited(KioskService.startLockTask());

    _sessionStartTime = DateTime.now();

    // Timer realtime 1 detik untuk statistik durasi, waktu, dan polling device
    _tickerTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) {
        setState(() {});
      }
    });

    // Polling stats setiap 5 detik
    Timer.periodic(const Duration(seconds: 5), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      _fetchDeviceStats();
    });

    _webController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setUserAgent('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36')
      ..addJavaScriptChannel('UjianKita', onMessageReceived: _readIdentity)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) {
              setState(() {
                _isLoadingWeb = true;
                _webError = null;
              });
            }
          },
          onPageFinished: (_) {
            if (mounted) {
              setState(() => _isLoadingWeb = false);
              _updateNavState();
            }
            _webController.runJavaScript(_identityListener);
          },
          onWebResourceError: (error) {
            if (mounted) {
              setState(() {
                _isLoadingWeb = false;
                _webError = 'Gagal memuat halaman ujian (${error.description}).';
              });
            }
          },
        ),
      );

    final targetUrl = widget.exam.cleanFormUrl;
    if (targetUrl.isNotEmpty) {
      _webController.loadRequest(Uri.parse(targetUrl));
    } else {
      _webError = 'Tautan formulir soal tidak valid atau kosong.';
    }

    _readDeviceLabel();
    _fetchDeviceStats();
  }

  @override
  void dispose() {
    _tickerTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_setScreenSecurity(false));
    unawaited(KioskService.stopLockTask());
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  Future<void> _updateNavState() async {
    final back = await _webController.canGoBack();
    final fwd = await _webController.canGoForward();
    if (mounted) {
      setState(() {
        _canGoBack = back;
        _canGoForward = fwd;
      });
    }
  }

  Future<void> _fetchDeviceStats() async {
    final stats = await KioskService.getStats();
    if (!mounted) return;
    if (stats.isNotEmpty) {
      setState(() {
        _batteryLevel = stats['batteryLevel'] as int? ?? _batteryLevel;
        _isCharging = stats['isCharging'] as bool? ?? _isCharging;
        final temp = stats['temperature'];
        if (temp is num && temp > 0) _deviceTemp = temp.toDouble();
        _networkName = stats['network'] as String? ?? _networkName;
        _isPinned = stats['isPinned'] as bool? ?? _isPinned;
      });
    }
  }

  Future<void> _setScreenSecurity(bool secure) async {
    try {
      await FlutterWindowManagerPlus.setSecure(secure);
    } catch (_) {}
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.paused || _locked) return;
    setState(() {
      _leaveCount += 1;
      _locked = _leaveCount >= 3;
    });
  }

  Future<void> _readDeviceLabel() async {
    try {
      final info = await DeviceInfoPlugin().androidInfo;
      if (mounted) {
        setState(() => _deviceLabel = '${info.manufacturer} ${info.model}');
      }
    } catch (_) {
      if (mounted) setState(() => _deviceLabel = 'Android Device');
    }
  }

  void _readIdentity(JavaScriptMessage message) {
    try {
      final data = jsonDecode(message.message) as Map<String, dynamic>;
      final value = (data['value'] as String? ?? '').trim();
      if (value.isEmpty) return;
      setState(() {
        if (data['key'] == 'name') _name = value;
        if (data['key'] == 'class') _className = value;
      });
    } catch (_) {}
  }

  void _restartWithToken() {
    Navigator.of(context).pop();
  }

  Future<void> _confirmExit() async {
    final shouldExit = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E24),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text('Keluar dari Ujian?', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: const Text(
          'Pastikan kamu sudah menekan tombol "Kirim" / "Submit" pada Google Form sebelum keluar.',
          style: TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Batal', style: TextStyle(color: Colors.white60)),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Ya, Selesai Ujian'),
          ),
        ],
      ),
    );
    if (shouldExit == true && mounted) {
      await KioskService.stopLockTask();
      if (mounted) Navigator.of(context).pop();
    }
  }

  String _formatDuration(Duration d) {
    final hours = d.inHours.toString().padLeft(2, '0');
    final minutes = (d.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (d.inSeconds % 60).toString().padLeft(2, '0');
    return hours == '00' ? '$minutes:$seconds' : '$hours:$minutes:$seconds';
  }

  String _formatCurrentTime() {
    final now = DateTime.now();
    final h = now.hour.toString().padLeft(2, '0');
    final m = now.minute.toString().padLeft(2, '0');
    final s = now.second.toString().padLeft(2, '0');
    return '$h:$m:$s WIB';
  }

  void _showStatsDialog() {
    final activeDuration = DateTime.now().difference(_sessionStartTime);

    showDialog<void>(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              padding: const EdgeInsets.all(22),
              decoration: BoxDecoration(
                color: const Color(0xF018181C),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: Colors.white.withOpacity(0.15)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.5),
                    blurRadius: 30,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1D4ED8).withOpacity(0.25),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(Icons.analytics_outlined, color: Color(0xFF60A5FA), size: 22),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Statistik Sesi Ujian',
                              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                            Text(
                              'EXAMBRO SMAN18 BATAM',
                              style: TextStyle(color: Colors.white54, fontSize: 12),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, color: Colors.white70),
                        onPressed: () => Navigator.of(ctx).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  const Divider(color: Colors.white12, height: 1),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: _StatCard(
                          icon: Icons.timer_outlined,
                          title: 'Durasi Aktif',
                          value: _formatDuration(activeDuration),
                          accentColor: const Color(0xFF38BDF8),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _StatCard(
                          icon: Icons.access_time,
                          title: 'Waktu Saat Ini',
                          value: _formatCurrentTime(),
                          accentColor: const Color(0xFFA78BFA),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _StatCard(
                          icon: Icons.device_thermostat_outlined,
                          title: 'Suhu HP',
                          value: '${_deviceTemp > 0 ? _deviceTemp.toStringAsFixed(1) : '33.5'} °C',
                          accentColor: const Color(0xFFFBBF24),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _StatCard(
                          icon: Icons.wifi,
                          title: 'Jaringan',
                          value: _networkName,
                          accentColor: const Color(0xFF34D399),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: _StatCard(
                          icon: _isCharging ? Icons.battery_charging_full : Icons.battery_std,
                          title: 'Baterai',
                          value: '${_batteryLevel >= 0 ? _batteryLevel : 100}% ${_isCharging ? '⚡' : ''}',
                          accentColor: const Color(0xFF4ADE80),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _StatCard(
                          icon: Icons.warning_amber_rounded,
                          title: 'Total Pelanggaran',
                          value: '$_leaveCount / 3',
                          accentColor: _leaveCount > 0 ? const Color(0xFFEF4444) : const Color(0xFF9CA3AF),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.04),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Peserta: $_name · $_className',
                            style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 3),
                        Text('Mapel: ${widget.exam.subject}',
                            style: const TextStyle(color: Colors.white70, fontSize: 12)),
                        const SizedBox(height: 3),
                        Text('Perangkat: $_deviceLabel',
                            style: const TextStyle(color: Colors.white54, fontSize: 11)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                  SizedBox(
                    width: double.infinity,
                    height: 44,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('Tutup', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _showGlisseMenu() {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(24),
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xF218181C),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white.withOpacity(0.14)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.55),
                      blurRadius: 30,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Handle Bar
                    Center(
                      child: Container(
                        margin: const EdgeInsets.only(top: 6, bottom: 12),
                        width: 36,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.white24,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    _GlisseMenuItem(
                      icon: Icons.info_outline_rounded,
                      label: 'Informasi & Statistik Ujian',
                      subtitle: 'Durasi aktif, suhu, baterai, pelanggaran',
                      onTap: () {
                        Navigator.of(ctx).pop();
                        _showStatsDialog();
                      },
                    ),
                    _GlisseMenuItem(
                      icon: Icons.push_pin_outlined,
                      label: 'Sematkan Layar (Pin App)',
                      subtitle: 'Kunci layar agar fokus ke lembar ujian',
                      onTap: () async {
                        Navigator.of(ctx).pop();
                        final res = await KioskService.startLockTask();
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(res ? 'Layar berhasil disematkan.' : 'Mode kunci layar aktif.'),
                              duration: const Duration(seconds: 2),
                            ),
                          );
                        }
                      },
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      child: Divider(color: Colors.white.withOpacity(0.1), height: 1),
                    ),
                    _GlisseMenuItem(
                      icon: Icons.delete_outline_rounded,
                      label: 'Selesaikan & Keluar Ujian',
                      subtitle: 'Pastikan sudah menekan Submit di form',
                      isDestructive: true,
                      onTap: () {
                        Navigator.of(ctx).pop();
                        _confirmExit();
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final subjectTitle = widget.exam.subject.isEmpty ? 'Ujian' : widget.exam.subject;

    return PopScope(
      canPop: false,
      child: Scaffold(
        appBar: AppBar(
          title: Text(subjectTitle, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          automaticallyImplyLeading: false,
          actions: [
            Container(
              margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: _leaveCount > 0 ? theme.colorScheme.errorContainer : theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  'Keluar: $_leaveCount/3',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: _leaveCount > 0 ? theme.colorScheme.onErrorContainer : theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ),
          ],
        ),
        body: Stack(
          children: [
            Column(
              children: [
                Material(
                  color: theme.colorScheme.secondaryContainer,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    child: Text(
                      'Sesi: $_name · $_className · $_deviceLabel',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSecondaryContainer,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
                if (_isLoadingWeb) const LinearProgressIndicator(minHeight: 3),
                if (_webError != null)
                  Expanded(
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
                            const SizedBox(height: 12),
                            Text(_webError!, textAlign: TextAlign.center),
                            const SizedBox(height: 16),
                            FilledButton.icon(
                              onPressed: () {
                                setState(() {
                                  _isLoadingWeb = true;
                                  _webError = null;
                                });
                                _webController.reload();
                              },
                              icon: const Icon(Icons.refresh),
                              label: const Text('Coba Lagi'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                else
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(bottom: 76),
                      child: WebViewWidget(controller: _webController),
                    ),
                  ),
              ],
            ),

            // Glisse Floating Bottom Bar (< > titik tiga)
            Align(
              alignment: Alignment.bottomCenter,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: GlisseBottomBar(
                  canGoBack: _canGoBack,
                  canGoForward: _canGoForward,
                  onBack: () async {
                    if (await _webController.canGoBack()) {
                      await _webController.goBack();
                      _updateNavState();
                    }
                  },
                  onForward: () async {
                    if (await _webController.canGoForward()) {
                      await _webController.goForward();
                      _updateNavState();
                    }
                  },
                  onReload: () => _webController.reload(),
                  onMenu: _showGlisseMenu,
                ),
              ),
            ),

            // Lock Overlay if 3 violations reached
            if (_locked)
              Positioned.fill(
                child: ColoredBox(
                  color: theme.colorScheme.surface.withValues(alpha: 0.96),
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(28),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.lock_outline, size: 56, color: theme.colorScheme.error),
                          const SizedBox(height: 16),
                          Text('Sesi dikunci', style: theme.textTheme.headlineSmall),
                          const SizedBox(height: 8),
                          const Text(
                            'Aplikasi telah ditinggalkan tiga kali. Masukkan token lagi untuk memulai sesi uji baru.',
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 20),
                          FilledButton(
                            onPressed: _restartWithToken,
                            child: const Text('Kembali ke token'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Floating Navigation Bar terinspirasi dari Glisse (kelvinzhang.ca)
class GlisseBottomBar extends StatelessWidget {
  const GlisseBottomBar({
    super.key,
    required this.canGoBack,
    required this.canGoForward,
    required this.onBack,
    required this.onForward,
    required this.onReload,
    required this.onMenu,
  });

  final bool canGoBack;
  final bool canGoForward;
  final VoidCallback onBack;
  final VoidCallback onForward;
  final VoidCallback onReload;
  final VoidCallback onMenu;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(32),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          height: 54,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: const Color(0xE018181C),
            borderRadius: BorderRadius.circular(32),
            border: Border.all(color: Colors.white.withOpacity(0.16), width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.4),
                blurRadius: 20,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Back Button <
              IconButton(
                icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
                color: canGoBack ? Colors.white : Colors.white38,
                tooltip: 'Kembali',
                onPressed: canGoBack ? onBack : null,
              ),
              Container(width: 1, height: 20, color: Colors.white12),
              // Forward Button >
              IconButton(
                icon: const Icon(Icons.arrow_forward_ios_rounded, size: 18),
                color: canGoForward ? Colors.white : Colors.white38,
                tooltip: 'Maju',
                onPressed: canGoForward ? onForward : null,
              ),
              Container(width: 1, height: 20, color: Colors.white12),
              // Refresh Button
              IconButton(
                icon: const Icon(Icons.refresh_rounded, size: 20),
                color: Colors.white70,
                tooltip: 'Muat ulang',
                onPressed: onReload,
              ),
              Container(width: 1, height: 20, color: Colors.white12),
              // Menu Button Titik Tiga ...
              InkWell(
                onTap: onMenu,
                borderRadius: BorderRadius.circular(20),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.more_horiz_rounded, size: 22, color: Colors.white),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _GlisseMenuItem extends StatelessWidget {
  const _GlisseMenuItem({
    required this.icon,
    required this.label,
    required this.onTap,
    this.subtitle,
    this.isDestructive = false,
  });

  final IconData icon;
  final String label;
  final String? subtitle;
  final VoidCallback onTap;
  final bool isDestructive;

  @override
  Widget build(BuildContext context) {
    final color = isDestructive ? const Color(0xFFEF4444) : Colors.white;

    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: isDestructive ? const Color(0xFFEF4444).withOpacity(0.15) : Colors.white.withOpacity(0.06),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: color, size: 20),
      ),
      title: Text(
        label,
        style: TextStyle(color: color, fontSize: 14, fontWeight: FontWeight.w600),
      ),
      subtitle: subtitle != null
          ? Text(subtitle!, style: TextStyle(color: isDestructive ? const Color(0xFFEF4444).withOpacity(0.8) : Colors.white54, fontSize: 11))
          : null,
      onTap: onTap,
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.title,
    required this.value,
    required this.accentColor,
  });

  final IconData icon;
  final String title;
  final String value;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: accentColor),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(color: Colors.white60, fontSize: 11),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: Colors.white,
              fontSize: 15,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.2,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

const _identityListener = r'''
(() => {
  if (window.__ujianKitaIdentityReady) return;
  window.__ujianKitaIdentityReady = true;
  const normalize = (value) => value.toLowerCase().replace(/[^a-z]/g, '');
  const classify = (label) => {
    const value = normalize(label);
    if (value.includes('nama')) return 'name';
    if (value.includes('kelas')) return 'class';
    return null;
  };
  const report = (element) => {
    const container = element.closest('[role="listitem"]') || element.parentElement;
    const key = classify(container ? container.innerText : '');
    if (!key || !element.value) return;
    window.UjianKita.postMessage(JSON.stringify({ key, value: element.value }));
  };
  document.querySelectorAll('input, textarea, select').forEach((element) => {
    element.addEventListener('input', () => report(element));
    element.addEventListener('change', () => report(element));
  });
})();
''';

class TokenSheetRepository {
  Future<List<ExamRecord>> loadByToken(String token) async {
    final cleanInputToken = token.trim();
    if (cleanInputToken.isEmpty) return [];

    final response = await http.get(Uri.parse(tokenSheetCsvUrl));
    if (response.statusCode != 200) {
      throw SheetException('Gagal menghubungi Spreadsheet (HTTP ${response.statusCode}). Pastikan koneksi internet aktif.');
    }

    final rows = const CsvToListConverter(shouldParseNumbers: false).convert(response.body);
    if (rows.length < 2) {
      throw const SheetException('Spreadsheet token kosong atau belum memiliki jadwal.');
    }

    final rawHeader = rows.first.map((cell) => cell.toString().trim().toUpperCase()).toList();

    int? findColumn(List<String> keywords) {
      for (final kw in keywords) {
        final idx = rawHeader.indexOf(kw);
        if (idx != -1) return idx;
      }
      for (final kw in keywords) {
        final idx = rawHeader.indexWhere((h) => h.contains(kw));
        if (idx != -1) return idx;
      }
      return null;
    }

    final mapelIdx = findColumn(['MAPEL', 'MATA PELAJARAN']);
    final kelasIdx = findColumn(['KELAS', 'TINGKAT']);
    final sesiIdx = findColumn(['SESI']);
    final tokenIdx = findColumn(['TOKEN', 'KODE']);
    final durasiIdx = findColumn(['DURASI', 'DURAS', 'WAKTU']);
    final hariIdx = findColumn(['HARI', 'JADWAL']);
    final linkIdx = findColumn(['LINK SOAL', 'LINK FORM', 'LINK', 'URL', 'SOAL', 'FORM']);

    if (tokenIdx == null || linkIdx == null) {
      throw const SheetException('Kolom TOKEN atau LINK SOAL tidak ditemukan di Spreadsheet.');
    }

    String getCell(List<dynamic> row, int? idx) {
      if (idx == null || idx >= row.length) return '';
      return row[idx].toString().trim();
    }

    final results = <ExamRecord>[];
    for (var i = 1; i < rows.length; i++) {
      final row = rows[i];
      if (row.isEmpty) continue;

      final rowToken = getCell(row, tokenIdx);
      if (rowToken.isEmpty) continue;

      if (rowToken.toUpperCase() == cleanInputToken.toUpperCase()) {
        results.add(
          ExamRecord(
            subject: getCell(row, mapelIdx),
            classLevel: getCell(row, kelasIdx),
            session: getCell(row, sesiIdx),
            token: rowToken,
            durationMinutes: getCell(row, durasiIdx),
            day: getCell(row, hariIdx),
            formUrl: getCell(row, linkIdx),
          ),
        );
      }
    }

    return results;
  }
}

class SheetException implements Exception {
  const SheetException(this.message);
  final String message;
}

class ExamRecord {
  const ExamRecord({
    required this.subject,
    required this.classLevel,
    required this.session,
    required this.token,
    required this.durationMinutes,
    required this.day,
    required this.formUrl,
  });

  final String subject;
  final String classLevel;
  final String session;
  final String token;
  final String durationMinutes;
  final String day;
  final String formUrl;

  String get cleanFormUrl {
    final trimmed = formUrl.trim();
    if (trimmed.isEmpty) return '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    return 'https://$trimmed';
  }

  bool get isScheduledToday {
    const dayNames = {
      DateTime.monday: 'SENIN',
      DateTime.tuesday: 'SELASA',
      DateTime.wednesday: 'RABU',
      DateTime.thursday: 'KAMIS',
      DateTime.friday: "JUM'AT",
      DateTime.saturday: 'SABTU',
      DateTime.sunday: 'MINGGU',
    };
    final todayName = dayNames[DateTime.now().weekday] ?? '';
    final normalizedExamDay = day.toUpperCase().replaceAll("'", '').replaceAll('`', '');
    final normalizedToday = todayName.replaceAll("'", '').replaceAll('`', '');
    return normalizedExamDay == normalizedToday;
  }
}
