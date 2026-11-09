import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'dart:ui';

import 'package:csv/csv.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_windowmanager_plus/flutter_windowmanager_plus.dart';
import 'package:http/http.dart' as http;
import 'package:liquid_glass_bar/liquid_glass_bar.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';

const tokenSheetCsvUrl =
    'https://docs.google.com/spreadsheets/d/1mMANbRElvGLNAViBzOqY1UND5CY8wR6WNQRg1lpSKb0/export?format=csv';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarDividerColor: Colors.transparent,
    ),
  );
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

  static Future<bool> openUrl(String url) async {
    try {
      final res = await _channel.invokeMethod<bool>('openUrl', {'url': url});
      return res ?? false;
    } catch (_) {
      return false;
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
  bool _useGlassBar = false;
  bool _isReady = false;

  bool _devModeUnlocked = false;
  bool _devAntiScreenshot = true;
  bool _devKioskPinning = true;
  bool _devNoDetectViolations = false;
  bool _devGuideLines = false;

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((prefs) {
      if (mounted) {
        // RESET KHUSUS PENGEMBANG:
        // Saat aplikasi di-restart atau dibuka ulang (cold start),
        // semua opsi & toggle pengembang otomatis di-reset ke default aman
        prefs.remove('dev_mode_unlocked');
        prefs.remove('dev_anti_screenshot');
        prefs.remove('dev_kiosk_pinning');
        prefs.remove('dev_no_detect_violations');
        prefs.remove('dev_guide_lines');

        setState(() {
          // Setting reguler TETAP DISIMPAN (persisten)
          _useGlassBar = prefs.getBool('use_glass_bar') ??
              prefs.getBool('use_liquid_glass') ??
              false;
          _isDark = prefs.getBool('is_dark') ?? false;
          _ignoreScheduleForTesting =
              prefs.getBool('ignore_schedule_for_testing') ?? true;

          // Toggle pengembang SELALU RESET ke default aman
          _devModeUnlocked = false;
          _devAntiScreenshot = true;
          _devKioskPinning = true;
          _devNoDetectViolations = false;
          _devGuideLines = false;
        });

        // Pastikan keamanan layar aktif secara default
        FlutterWindowManagerPlus.setSecure(true);
      }
    });
  }

  void _updateTheme(bool value) {
    setState(() => _isDark = value);
    SharedPreferences.getInstance().then((prefs) {
      prefs.setBool('is_dark', value);
    });
  }

  void _updateTestingMode(bool value) {
    setState(() => _ignoreScheduleForTesting = value);
    SharedPreferences.getInstance().then((prefs) {
      prefs.setBool('ignore_schedule_for_testing', value);
    });
  }

  void _updateGlassBar(bool value) {
    setState(() => _useGlassBar = value);
    SharedPreferences.getInstance().then((prefs) {
      prefs.setBool('use_glass_bar', value);
      prefs.setBool('use_liquid_glass', value);
    });
  }

  void _updateDevModeUnlocked(bool value) {
    setState(() => _devModeUnlocked = value);
    if (!value) {
      SharedPreferences.getInstance().then((prefs) {
        prefs.remove('dev_mode_unlocked');
        prefs.remove('dev_otp_date');
      });
    }
  }

  void _updateDevAntiScreenshot(bool value) {
    setState(() => _devAntiScreenshot = value);
    FlutterWindowManagerPlus.setSecure(value);
  }

  void _updateDevKioskPinning(bool value) {
    setState(() => _devKioskPinning = value);
  }

  void _updateDevNoDetectViolations(bool value) {
    setState(() => _devNoDetectViolations = value);
  }

  void _updateDevGuideLines(bool value) {
    setState(() => _devGuideLines = value);
  }

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
              useGlassBar: _useGlassBar,
              devModeUnlocked: _devModeUnlocked,
              devAntiScreenshot: _devAntiScreenshot,
              devKioskPinning: _devKioskPinning,
              devNoDetectViolations: _devNoDetectViolations,
              devGuideLines: _devGuideLines,
              onThemeChanged: _updateTheme,
              onTestingModeChanged: _updateTestingMode,
              onGlassBarChanged: _updateGlassBar,
              onDevModeUnlockedChanged: _updateDevModeUnlocked,
              onDevAntiScreenshotChanged: _updateDevAntiScreenshot,
              onDevKioskPinningChanged: _updateDevKioskPinning,
              onDevNoDetectViolationsChanged: _updateDevNoDetectViolations,
              onDevGuideLinesChanged: _updateDevGuideLines,
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
      appBarTheme: AppBarTheme(
        systemOverlayStyle: SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness:
              brightness == Brightness.dark ? Brightness.light : Brightness.dark,
          systemNavigationBarColor: Colors.transparent,
          systemNavigationBarDividerColor: Colors.transparent,
          systemNavigationBarIconBrightness:
              brightness == Brightness.dark ? Brightness.light : Brightness.dark,
        ),
      ),
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
                borderRadius: BorderRadius.circular(16),
                child: Image.asset(
                  'assets/sman18-batam.png',
                  width: 90,
                  height: 90,
                  fit: BoxFit.contain,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      width: 90,
                      height: 90,
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primaryContainer,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Icon(
                        Icons.school_rounded,
                        size: 46,
                        color: theme.colorScheme.primary,
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'EXAMBRO SMAN18 BATAM',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.8,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                'dev by github/warrenku',
                style: TextStyle(
                  fontSize: 12,
                  color: theme.colorScheme.onSurfaceVariant,
                  letterSpacing: 0.2,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 28),
              const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.2),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class DeveloperGuideLinesOverlay extends StatefulWidget {
  const DeveloperGuideLinesOverlay({super.key, required this.child});

  final Widget child;

  /// Posisi koordinat penunjuk disimpan statis agar tidak reset/refresh ke atas saat ditoggle atau berpindah halaman
  static Offset sharedPointer = const Offset(200, 300);

  @override
  State<DeveloperGuideLinesOverlay> createState() =>
      _DeveloperGuideLinesOverlayState();
}

class _DeveloperGuideLinesOverlayState
    extends State<DeveloperGuideLinesOverlay> {
  @override
  Widget build(BuildContext context) {
    return Listener(
      behavior: HitTestBehavior.translucent,
      onPointerDown: (event) {
        setState(() {
          DeveloperGuideLinesOverlay.sharedPointer = event.position;
        });
      },
      onPointerMove: (event) {
        setState(() {
          DeveloperGuideLinesOverlay.sharedPointer = event.position;
        });
      },
      // Saat jari tidak digerakkan atau diangkat, garis penunjuk tetap diam di posisi terakhir
      child: Stack(
        children: [
          widget.child,
          Positioned.fill(
            child: IgnorePointer(
              ignoring: true, // Garis penunjuk tidak menghalangi tombol, scroll, atau ketukan
              child: CustomPaint(
                painter: _GuideLinesPainter(
                  pointer: DeveloperGuideLinesOverlay.sharedPointer,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _GuideLinesPainter extends CustomPainter {
  _GuideLinesPainter({required this.pointer});

  final Offset pointer;

  @override
  void paint(Canvas canvas, Size size) {
    final linePaint = Paint()
      ..color = const Color(0xFFEF4444).withOpacity(0.65)
      ..strokeWidth = 1.0;

    // Garis horizontal penunjuk
    canvas.drawLine(
        Offset(0, pointer.dy), Offset(size.width, pointer.dy), linePaint);
    // Garis vertikal penunjuk
    canvas.drawLine(
        Offset(pointer.dx, 0), Offset(pointer.dx, size.height), linePaint);

    // Keterangan koordinat X dan Y
    final textSpan = TextSpan(
      text: ' X: ${pointer.dx.toInt()} | Y: ${pointer.dy.toInt()} ',
      style: const TextStyle(
        color: Colors.white,
        fontSize: 10,
        fontWeight: FontWeight.bold,
        backgroundColor: Color(0xCC0F172A),
      ),
    );
    final textPainter = TextPainter(
      text: textSpan,
      textDirection: TextDirection.ltr,
    )..layout();
    textPainter.paint(
      canvas,
      Offset(
        (pointer.dx + 8).clamp(8.0, size.width - textPainter.width - 8),
        (pointer.dy + 8).clamp(8.0, size.height - textPainter.height - 8),
      ),
    );
  }

  @override
  bool shouldRepaint(_GuideLinesPainter oldDelegate) =>
      oldDelegate.pointer != pointer;
}

class ExamShell extends StatefulWidget {
  const ExamShell({
    super.key,
    required this.isDark,
    required this.ignoreScheduleForTesting,
    required this.useGlassBar,
    required this.onThemeChanged,
    required this.onTestingModeChanged,
    required this.onGlassBarChanged,
    required this.devModeUnlocked,
    required this.devAntiScreenshot,
    required this.devKioskPinning,
    required this.devNoDetectViolations,
    required this.devGuideLines,
    required this.onDevModeUnlockedChanged,
    required this.onDevAntiScreenshotChanged,
    required this.onDevKioskPinningChanged,
    required this.onDevNoDetectViolationsChanged,
    required this.onDevGuideLinesChanged,
  });

  final bool isDark;
  final bool ignoreScheduleForTesting;
  final bool useGlassBar;
  final ValueChanged<bool> onThemeChanged;
  final ValueChanged<bool> onTestingModeChanged;
  final ValueChanged<bool> onGlassBarChanged;

  final bool devModeUnlocked;
  final bool devAntiScreenshot;
  final bool devKioskPinning;
  final bool devNoDetectViolations;
  final bool devGuideLines;
  final ValueChanged<bool> onDevModeUnlockedChanged;
  final ValueChanged<bool> onDevAntiScreenshotChanged;
  final ValueChanged<bool> onDevKioskPinningChanged;
  final ValueChanged<bool> onDevNoDetectViolationsChanged;
  final ValueChanged<bool> onDevGuideLinesChanged;

  @override
  State<ExamShell> createState() => _ExamShellState();
}

class _ExamShellState extends State<ExamShell> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [
      TokenPage(
        ignoreScheduleForTesting: widget.ignoreScheduleForTesting,
        devAntiScreenshot: widget.devAntiScreenshot,
        devKioskPinning: widget.devKioskPinning,
        devNoDetectViolations: widget.devNoDetectViolations,
        devGuideLines: widget.devGuideLines,
      ),
      InformationPage(
        onDevModeUnlockedChanged: widget.onDevModeUnlockedChanged,
      ),
      SettingsPage(
        isDark: widget.isDark,
        ignoreScheduleForTesting: widget.ignoreScheduleForTesting,
        useGlassBar: widget.useGlassBar,
        onThemeChanged: widget.onThemeChanged,
        onTestingModeChanged: widget.onTestingModeChanged,
        onGlassBarChanged: widget.onGlassBarChanged,
        devModeUnlocked: widget.devModeUnlocked,
        onDevModeUnlockedChanged: widget.onDevModeUnlockedChanged,
        devAntiScreenshot: widget.devAntiScreenshot,
        devKioskPinning: widget.devKioskPinning,
        devNoDetectViolations: widget.devNoDetectViolations,
        devGuideLines: widget.devGuideLines,
        onDevAntiScreenshotChanged: widget.onDevAntiScreenshotChanged,
        onDevKioskPinningChanged: widget.onDevKioskPinningChanged,
        onDevNoDetectViolationsChanged: widget.onDevNoDetectViolationsChanged,
        onDevGuideLinesChanged: widget.onDevGuideLinesChanged,
      ),
    ];
    final scaffold = Scaffold(
      extendBody: widget.useGlassBar,
      body: SafeArea(
        bottom: !widget.useGlassBar,
        child: pages[_selectedIndex],
      ),
      bottomNavigationBar: widget.useGlassBar
          ? Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: LiquidGlassBar(
                items: const [
                  LiquidGlassBarItem(
                    iconData: Icons.home_rounded,
                    label: 'Beranda',
                  ),
                  LiquidGlassBarItem(
                    iconData: Icons.info_outline_rounded,
                    label: 'Informasi',
                  ),
                  LiquidGlassBarItem(
                    iconData: Icons.settings_rounded,
                    label: 'Pengaturan',
                  ),
                ],
                currentIndex: _selectedIndex,
                onTap: (index) => setState(() => _selectedIndex = index),
                style: LiquidGlassBarStyle(
                  height: 60.0,
                  borderRadius: 32.0,
                  activeColor: widget.isDark
                      ? Colors.white
                      : const Color(0xFF0F172A),
                  inactiveColor: widget.isDark
                      ? Colors.white60
                      : const Color(0xFF64748B),
                ),
              ),
            )
          : SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                    child: NavigationBar(
                      height: 65,
                      selectedIndex: _selectedIndex,
                      onDestinationSelected: (value) =>
                          setState(() => _selectedIndex = value),
                      destinations: const [
                        NavigationDestination(
                            icon: Icon(Icons.home_outlined),
                            selectedIcon: Icon(Icons.home),
                            label: 'Beranda'),
                        NavigationDestination(
                            icon: Icon(Icons.info_outline),
                            selectedIcon: Icon(Icons.info),
                            label: 'Informasi'),
                        NavigationDestination(
                            icon: Icon(Icons.settings_outlined),
                            selectedIcon: Icon(Icons.settings),
                            label: 'Pengaturan'),
                      ],
                    ),
                  ),
                ),
              ),
            ),
    );

    if (widget.devGuideLines) {
      return DeveloperGuideLinesOverlay(child: scaffold);
    }
    return scaffold;
  }
}

class TokenPage extends StatefulWidget {
  const TokenPage({
    super.key,
    required this.ignoreScheduleForTesting,
    this.devAntiScreenshot = true,
    this.devKioskPinning = true,
    this.devNoDetectViolations = false,
    this.devGuideLines = false,
  });

  final bool ignoreScheduleForTesting;
  final bool devAntiScreenshot;
  final bool devKioskPinning;
  final bool devNoDetectViolations;
  final bool devGuideLines;

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
        setState(() =>
            _message = 'Token "$enteredToken" tidak ditemukan di jadwal ujian.');
        return;
      }
      if (!mounted) return;

      // Jika hanya ada 1 mapel pada token ini, langsung buka ujian
      if (exams.length == 1) {
        final exam = exams.first;
        if (exam.cleanFormUrl.isEmpty) {
          setState(() => _message =
              'Link soal untuk ${exam.subject.isEmpty ? 'mapel ini' : exam.subject} belum tersedia di Spreadsheet.');
          return;
        }
        if (!widget.ignoreScheduleForTesting && !exam.isScheduledToday) {
          setState(() => _message =
              'Ujian ini dijadwalkan pada hari ${exam.day}. Aktifkan "Mode uji jadwal" di Pengaturan untuk menguji hari ini.');
          return;
        }
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ExamSessionPage(
              exam: exam,
              devAntiScreenshot: widget.devAntiScreenshot,
              devKioskPinning: widget.devKioskPinning,
              devNoDetectViolations: widget.devNoDetectViolations,
              devGuideLines: widget.devGuideLines,
            ),
          ),
        );
      } else {
        // Jika ada beberapa mapel dengan token yang sama, tampilkan halaman pilihan
        await Navigator.of(context).push(
          MaterialPageRoute(
            builder: (_) => ExamSelectionPage(
              exams: exams,
              ignoreScheduleForTesting: widget.ignoreScheduleForTesting,
              devAntiScreenshot: widget.devAntiScreenshot,
              devKioskPinning: widget.devKioskPinning,
              devNoDetectViolations: widget.devNoDetectViolations,
              devGuideLines: widget.devGuideLines,
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
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 120),
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

class TelegramDevService {
  static const String botToken =
      '9254314814:AAHAxgoS9MyRVZJC2OFacgkpUqmlmW62XdU';
  static const String botUsername = 'desxam_bot';

  static Future<bool> sendMessage(String chatId, String message) async {
    try {
      final res = await http.post(
        Uri.parse('https://api.telegram.org/bot$botToken/sendMessage'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'chat_id': chatId,
          'text': message,
        }),
      );
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  static Future<List<Map<String, dynamic>>> getUpdates({int? offset}) async {
    try {
      final url = offset != null
          ? 'https://api.telegram.org/bot$botToken/getUpdates?offset=$offset&timeout=1'
          : 'https://api.telegram.org/bot$botToken/getUpdates?timeout=1';
      final res = await http
          .get(Uri.parse(url))
          .timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['ok'] == true && data['result'] is List) {
          return List<Map<String, dynamic>>.from(data['result']);
        }
      }
    } catch (_) {}
    return [];
  }
}

class DeveloperModeSection extends StatefulWidget {
  const DeveloperModeSection({
    super.key,
    this.onDevModeUnlockedChanged,
  });

  final ValueChanged<bool>? onDevModeUnlockedChanged;

  @override
  State<DeveloperModeSection> createState() => DeveloperModeSectionState();
}

class DeveloperModeSectionState extends State<DeveloperModeSection> {
  bool _isConnected = false;
  bool _isWaitingConnection = false;
  String? _telegramId;
  String? _telegramUsername;
  String? _telegramName;

  bool _isSendingOtp = false;
  bool _showOtpInput = false;
  String? _currentOtp;
  String? _otpError;
  bool _isDevUnlocked = false;

  Timer? _pollingTimer;
  int? _lastUpdateId;

  final _c1 = TextEditingController();
  final _c2 = TextEditingController();
  final _c3 = TextEditingController();
  final _c4 = TextEditingController();

  final _f1 = FocusNode();
  final _f2 = FocusNode();
  final _f3 = FocusNode();
  final _f4 = FocusNode();

  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((prefs) {
      if (mounted) {
        final today = DateTime.now().toIso8601String().substring(0, 10);
        final savedDate = prefs.getString('dev_otp_date');
        final isUnlocked = prefs.getBool('dev_mode_unlocked') ?? false;

        setState(() {
          _isConnected = prefs.getBool('dev_telegram_connected') ?? false;
          _telegramId = prefs.getString('dev_telegram_id');
          _telegramUsername = prefs.getString('dev_telegram_username');
          _telegramName = prefs.getString('dev_telegram_name');
          _isDevUnlocked = isUnlocked && (savedDate == today);
        });
      }
    });
  }

  /// Dipanggil otomatis saat user tap 5x dan Telegram sudah terhubung
  Future<void> checkAndAutoSendOtpDaily() async {
    final prefs = await SharedPreferences.getInstance();
    final today = DateTime.now().toIso8601String().substring(0, 10);
    final savedDate = prefs.getString('dev_otp_date');
    final isUnlocked = prefs.getBool('dev_mode_unlocked') ?? false;
    final isTodayActive = isUnlocked && (savedDate == today);

    if (_isConnected && !isTodayActive) {
      await _sendOtp();
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _c1.dispose();
    _c2.dispose();
    _c3.dispose();
    _c4.dispose();
    _f1.dispose();
    _f2.dispose();
    _f3.dispose();
    _f4.dispose();
    super.dispose();
  }

  Future<void> _startConnectTelegram() async {
    setState(() {
      _isWaitingConnection = true;
      _otpError = null;
    });

    final sessionCode = (100000 + Random().nextInt(900000)).toString();

    // Inisialisasi offset agar pesan lama tidak terbaca ulang
    final initialUpdates = await TelegramDevService.getUpdates();
    if (initialUpdates.isNotEmpty) {
      _lastUpdateId = (initialUpdates.last['update_id'] as int) + 1;
    }

    final botUrl =
        'https://t.me/${TelegramDevService.botUsername}?start=$sessionCode';
    await KioskService.openUrl(botUrl);

    _pollingTimer?.cancel();
    int polls = 0;
    _pollingTimer = Timer.periodic(const Duration(seconds: 2), (timer) async {
      polls++;
      if (polls > 45) {
        timer.cancel();
        if (mounted) {
          setState(() {
            _isWaitingConnection = false;
            _otpError = 'Waktu tunggu habis. Tekan Hubungkan lagi.';
          });
        }
        return;
      }

      final updates = await TelegramDevService.getUpdates(offset: _lastUpdateId);
      for (final update in updates) {
        _lastUpdateId = (update['update_id'] as int) + 1;
        final msg = update['message'];
        if (msg != null) {
          final text = (msg['text'] ?? '').toString();
          if (text.startsWith('/start')) {
            timer.cancel();

            final chatId = msg['chat']['id'].toString();
            final from = msg['from'] ?? {};
            final username = (from['username'] ?? '').toString();
            final firstName = (from['first_name'] ?? 'Developer').toString();

            // Kirim pesan sambutan pertama kali
            await TelegramDevService.sendMessage(
              chatId,
              'Bot telah berhasil terhubung dengan perangkat Developer!\n\n'
              'Nama: $firstName\n'
              'ID Telegram: $chatId\n\n'
              'Silakan kembali ke aplikasi UjianKita untuk verifikasi OTP.',
            );

            final prefs = await SharedPreferences.getInstance();
            await prefs.setString('dev_telegram_id', chatId);
            await prefs.setString('dev_telegram_username', username);
            await prefs.setString('dev_telegram_name', firstName);
            await prefs.setBool('dev_telegram_connected', true);

            if (mounted) {
              setState(() {
                _isWaitingConnection = false;
                _isConnected = true;
                _telegramId = chatId;
                _telegramUsername = username;
                _telegramName = firstName;
                _otpError = null;
              });
            }
            break;
          }
        }
      }
    });
  }

  Future<void> _sendOtp() async {
    if (_telegramId == null) return;
    setState(() {
      _isSendingOtp = true;
      _otpError = null;
    });

    final otp = (1000 + Random().nextInt(9000)).toString();
    _currentOtp = otp;

    final ok = await TelegramDevService.sendMessage(
      _telegramId!,
      'One try code (kode sekali pake): $otp',
    );

    if (mounted) {
      setState(() {
        _isSendingOtp = false;
        if (ok) {
          _showOtpInput = true;
          _c1.clear();
          _c2.clear();
          _c3.clear();
          _c4.clear();
        } else {
          _otpError = 'Gagal mengirim pesan OTP ke Telegram. Coba lagi.';
        }
      });
      if (ok) {
        Future.delayed(const Duration(milliseconds: 350), () {
          if (mounted) _f1.requestFocus();
        });
      }
    }
  }

  Future<void> _verifyOtp() async {
    final entered = '${_c1.text}${_c2.text}${_c3.text}${_c4.text}'.trim();
    if (entered.length < 4) {
      setState(() => _otpError = 'Ketik lengkap 4 digit OTP.');
      return;
    }

    if (entered == _currentOtp) {
      _currentOtp = null; // Sekali pakai
      final today = DateTime.now().toIso8601String().substring(0, 10);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('dev_mode_unlocked', true);
      await prefs.setString('dev_otp_date', today);

      widget.onDevModeUnlockedChanged?.call(true);

      await TelegramDevService.sendMessage(
        _telegramId!,
        'Verifikasi OTP Berhasil!\n\nMode Pengembang telah aktif di perangkat Anda.',
      );

      if (mounted) {
        setState(() {
          _isDevUnlocked = true;
          _otpError = null;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Mode Pengembang berhasil diaktifkan!'),
            backgroundColor: Color(0xFF16A34A),
          ),
        );
      }
    } else {
      setState(() {
        _otpError = 'Kode OTP salah. Periksa pesan di Telegram.';
      });
    }
  }

  Future<void> _disconnect() async {
    _pollingTimer?.cancel();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('dev_telegram_id');
    await prefs.remove('dev_telegram_username');
    await prefs.remove('dev_telegram_name');
    await prefs.remove('dev_telegram_connected');
    await prefs.remove('dev_mode_unlocked');
    await prefs.remove('dev_otp_date');

    widget.onDevModeUnlockedChanged?.call(false);

    setState(() {
      _isConnected = false;
      _isWaitingConnection = false;
      _telegramId = null;
      _telegramUsername = null;
      _telegramName = null;
      _isDevUnlocked = false;
      _showOtpInput = false;
      _currentOtp = null;
      _otpError = null;
    });
  }

  Future<void> _deactivateDevMode() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('dev_mode_unlocked', false);
    await prefs.remove('dev_otp_date');

    widget.onDevModeUnlockedChanged?.call(false);

    setState(() {
      _isDevUnlocked = false;
      _showOtpInput = false;
      _currentOtp = null;
      _otpError = null;
    });

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Mode Pengembang telah dinonaktifkan.'),
        ),
      );
    }
  }

  Widget _buildOtpBox(
    TextEditingController controller,
    FocusNode currentFocus,
    FocusNode? nextFocus,
    FocusNode? prevFocus, {
    bool isLast = false,
  }) {
    return SizedBox(
      width: 52,
      height: 56,
      child: TextField(
        controller: controller,
        focusNode: currentFocus,
        keyboardType: TextInputType.number,
        textAlign: TextAlign.center,
        maxLength: 1,
        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
        decoration: InputDecoration(
          counterText: '',
          contentPadding: EdgeInsets.zero,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        ),
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        onChanged: (val) {
          if (val.isNotEmpty) {
            if (nextFocus != null) {
              nextFocus.requestFocus();
            } else if (isLast) {
              _verifyOtp();
            }
          } else if (val.isEmpty && prevFocus != null) {
            prevFocus.requestFocus();
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.white.withOpacity(0.1) : const Color(0xFFCBD5E1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.terminal_rounded, size: 20, color: theme.colorScheme.primary),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Mode Pengembang (Developer)',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              if (_isDevUnlocked)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16A34A).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'Aktif',
                    style: TextStyle(
                      color: Color(0xFF16A34A),
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),

          // Kondisi 1: Belum terhubung Telegram
          if (!_isConnected) ...[
            const Text(
              'Tekan tombol di bawah untuk membuka @desxam_bot di Telegram lalu klik START untuk menghubungkan akun Telegram Anda.',
              style: TextStyle(fontSize: 12),
            ),
            const SizedBox(height: 12),
            if (_isWaitingConnection) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Menunggu Anda menekan START di bot Telegram...',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _startConnectTelegram,
                  icon: const Icon(Icons.open_in_new_rounded, size: 16),
                  label: const Text('Buka Telegram Lagi'),
                ),
              ),
            ] else ...[
              SizedBox(
                width: double.infinity,
                height: 44,
                child: FilledButton.icon(
                  onPressed: _startConnectTelegram,
                  icon: const Icon(Icons.send_rounded, size: 18),
                  label: const Text('Hubungkan ke Telegram (@desxam_bot)'),
                ),
              ),
            ],
            if (_otpError != null) ...[
              const SizedBox(height: 8),
              Text(
                _otpError!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 12),
              ),
            ],
          ]

          // Kondisi 2: Terhubung ke Telegram
          else ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF16A34A).withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF16A34A).withOpacity(0.2)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: Color(0xFF16A34A),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      const Expanded(
                        child: Text(
                          'Terhubung dengan Telegram',
                          style: TextStyle(
                            color: Color(0xFF16A34A),
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      InkWell(
                        onTap: _disconnect,
                        child: const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                          child: Text(
                            'Putuskan',
                            style: TextStyle(
                              color: Colors.redAccent,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'ID Telegram: ${_telegramId ?? '-'}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  if (_telegramUsername != null && _telegramUsername!.isNotEmpty)
                    Text(
                      'Username: @$_telegramUsername',
                      style: const TextStyle(fontSize: 12),
                    ),
                  if (_telegramName != null && _telegramName!.isNotEmpty)
                    Text(
                      'Nama: $_telegramName',
                      style: const TextStyle(fontSize: 12),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            if (!_isDevUnlocked) ...[
              if (!_showOtpInput)
                SizedBox(
                  width: double.infinity,
                  height: 44,
                  child: FilledButton.icon(
                    onPressed: _isSendingOtp ? null : _sendOtp,
                    icon: _isSendingOtp
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Icon(Icons.key_rounded, size: 18),
                    label: Text(_isSendingOtp ? 'Mengirim OTP...' : 'Send OTP (4 Digit)'),
                  ),
                ),

              // Animasi 0.5 detik saat memunculkan 4 section input & button
              AnimatedCrossFade(
                duration: const Duration(milliseconds: 500),
                crossFadeState: _showOtpInput
                    ? CrossFadeState.showSecond
                    : CrossFadeState.showFirst,
                firstChild: const SizedBox.shrink(),
                secondChild: Column(
                  children: [
                    const SizedBox(height: 10),
                    const Text(
                      'Ketik 4 digit OTP yang dikirim bot Telegram:',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _buildOtpBox(_c1, _f1, _f2, null),
                        const SizedBox(width: 8),
                        _buildOtpBox(_c2, _f2, _f3, _f1),
                        const SizedBox(width: 8),
                        _buildOtpBox(_c3, _f3, _f4, _f2),
                        const SizedBox(width: 8),
                        _buildOtpBox(_c4, _f4, null, _f3, isLast: true),
                      ],
                    ),
                    if (_otpError != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        _otpError!,
                        style: const TextStyle(
                          color: Colors.redAccent,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _isSendingOtp ? null : _sendOtp,
                            child: const Text('Kirim Ulang OTP', style: TextStyle(fontSize: 12)),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: FilledButton(
                            onPressed: _verifyOtp,
                            child: const Text('Verifikasi', style: TextStyle(fontSize: 12)),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ] else ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: theme.colorScheme.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.check_circle_rounded, color: Color(0xFF16A34A), size: 20),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Akses Pengembang Aktif. Perangkat ini telah terverifikasi oleh akun Telegram Developer.',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton.icon(
                        onPressed: _deactivateDevMode,
                        icon: const Icon(Icons.lock_rounded, size: 16, color: Colors.redAccent),
                        label: const Text(
                          'Nonaktifkan Mode Pengembang',
                          style: TextStyle(color: Colors.redAccent, fontSize: 12),
                        ),
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Colors.redAccent),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class InformationPage extends StatefulWidget {
  const InformationPage({
    super.key,
    this.onDevModeUnlockedChanged,
  });

  final ValueChanged<bool>? onDevModeUnlockedChanged;

  @override
  State<InformationPage> createState() => _InformationPageState();
}

class _InformationPageState extends State<InformationPage> {
  int _versionTapCount = 0;
  DateTime? _lastTapTime;
  bool _isDevPanelVisible = false;
  final GlobalKey<DeveloperModeSectionState> _devKey = GlobalKey();

  void _onVersionTap() {
    final now = DateTime.now();
    if (_lastTapTime == null ||
        now.difference(_lastTapTime!) > const Duration(seconds: 2)) {
      _versionTapCount = 1;
    } else {
      _versionTapCount++;
    }
    _lastTapTime = now;

    if (_versionTapCount == 5) {
      _versionTapCount = 0;
      HapticFeedback.lightImpact();
      setState(() {
        _isDevPanelVisible = !_isDevPanelVisible;
      });
      if (_isDevPanelVisible) {
        Future.delayed(const Duration(milliseconds: 250), () {
          _devKey.currentState?.checkAndAutoSendOtpDaily();
        });
      }
    }
  }

  Future<void> _openDeveloperUrl(BuildContext context) async {
    const url = 'https://github.com/WarrenKu';
    final opened = await KioskService.openUrl(url);
    if (!opened && context.mounted) {
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Developer'),
          content: const Text('https://github.com/WarrenKu'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Tutup'),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 120),
      children: [
        Text(
          'Informasi ujian',
          style: theme.textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold),
        ),
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

        // Batas garis di bawah Data peserta
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 16),
          child: Divider(thickness: 1.2),
        ),

        Text(
          'Sistem & Pengembang',
          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 12),

        // Developer Link (Dapat di-klik ke github)
        ListTile(
          leading: const Icon(Icons.code_rounded),
          title: const Text('Developer'),
          subtitle: const Text('https://github.com/WarrenKu'),
          trailing: const Icon(Icons.open_in_new_rounded, size: 20),
          onTap: () => _openDeveloperUrl(context),
        ),

        // Versi Aplikasi dengan easter egg 5x tap tanpa efek visual ketukan
        InkWell(
          splashColor: Colors.transparent,
          highlightColor: Colors.transparent,
          hoverColor: Colors.transparent,
          focusColor: Colors.transparent,
          onTap: _onVersionTap,
          child: const ListTile(
            leading: Icon(Icons.info_outline_rounded),
            title: Text('Versi Aplikasi'),
            subtitle: Text('v1.0.0 (Build 1) - Release SMAN18 Batam'),
          ),
        ),

        // Menu tampilan yang nempel di bawah version setelah ditekan 5x
        AnimatedSize(
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeInOutCubic,
          child: _isDevPanelVisible
              ? DeveloperModeSection(
                  key: _devKey,
                  onDevModeUnlockedChanged: widget.onDevModeUnlockedChanged,
                )
              : const SizedBox.shrink(),
        ),

        // Status Koneksi API (untuk Dashboard Super-Admin nanti)
        ListTile(
          leading: const Icon(Icons.cloud_done_outlined),
          title: const Text('Status API'),
          subtitle: const Text('Siap terhubung ke API Dashboard'),
          trailing: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF16A34A).withOpacity(0.15),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF16A34A).withOpacity(0.4)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Color(0xFF16A34A),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                const Text(
                  'Online',
                  style: TextStyle(
                    color: Color(0xFF16A34A),
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
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
    required this.useGlassBar,
    required this.onThemeChanged,
    required this.onTestingModeChanged,
    required this.onGlassBarChanged,
    this.devModeUnlocked = false,
    this.onDevModeUnlockedChanged,
    this.devAntiScreenshot = true,
    this.devKioskPinning = true,
    this.devNoDetectViolations = false,
    this.devGuideLines = false,
    this.onDevAntiScreenshotChanged,
    this.onDevKioskPinningChanged,
    this.onDevNoDetectViolationsChanged,
    this.onDevGuideLinesChanged,
  });

  final bool isDark;
  final bool ignoreScheduleForTesting;
  final bool useGlassBar;
  final ValueChanged<bool> onThemeChanged;
  final ValueChanged<bool> onTestingModeChanged;
  final ValueChanged<bool> onGlassBarChanged;

  final bool devModeUnlocked;
  final ValueChanged<bool>? onDevModeUnlockedChanged;
  final bool devAntiScreenshot;
  final bool devKioskPinning;
  final bool devNoDetectViolations;
  final bool devGuideLines;
  final ValueChanged<bool>? onDevAntiScreenshotChanged;
  final ValueChanged<bool>? onDevKioskPinningChanged;
  final ValueChanged<bool>? onDevNoDetectViolationsChanged;
  final ValueChanged<bool>? onDevGuideLinesChanged;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(24, 32, 24, 120),
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
        SwitchListTile(
          value: useGlassBar,
          onChanged: onGlassBarChanged,
          title: const Text('Bilah Navigasi Liquid Glass'),
          subtitle: const Text('Efek kaca mengambang semi-transparan dengan blur (Liquid Glass).'),
        ),
        if (devModeUnlocked) ...[
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Divider(thickness: 1.2),
          ),
          Row(
            children: [
              const Icon(Icons.developer_mode_rounded, color: Colors.blueAccent, size: 20),
              const SizedBox(width: 8),
              Text(
                'Opsi Pengembang',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                      color: Colors.blueAccent,
                    ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            value: devModeUnlocked,
            onChanged: onDevModeUnlockedChanged,
            title: const Text('Mode Pengembang'),
            subtitle: const Text('Pengembang debug sistem'),
          ),
          SwitchListTile(
            value: devAntiScreenshot,
            onChanged: onDevAntiScreenshotChanged,
            title: const Text('Anti Screenshot (Redflag)'),
            subtitle: const Text(
              'Matikan untuk mengizinkan tangkapan layar / perekaman layar saat testing.',
            ),
          ),
          SwitchListTile(
            value: devKioskPinning,
            onChanged: onDevKioskPinningChanged,
            title: const Text('Mode Pin Layar (Kiosk)'),
            subtitle: const Text(
              'Matikan untuk menonaktifkan sematan layar otomatis (Screen Pinning).',
            ),
          ),
          SwitchListTile(
            value: devNoDetectViolations,
            onChanged: onDevNoDetectViolationsChanged,
            title: const Text('No Detect Pelanggaran'),
            subtitle: const Text(
              'Bypass batas 3x keluar aplikasi tanpa mengunci ujian saat testing.',
            ),
          ),
          SwitchListTile(
            value: devGuideLines,
            onChanged: onDevGuideLinesChanged,
            title: const Text('Garis Penunjuk Layar'),
            subtitle: const Text(
              'Tampilkan garis penunjuk presisi dan koordinat X/Y pada layar.',
            ),
          ),
        ],
      ],
    );
  }
}

class ExamSelectionPage extends StatelessWidget {
  const ExamSelectionPage({
    super.key,
    required this.exams,
    required this.ignoreScheduleForTesting,
    this.devAntiScreenshot = true,
    this.devKioskPinning = true,
    this.devNoDetectViolations = false,
    this.devGuideLines = false,
  });

  final List<ExamRecord> exams;
  final bool ignoreScheduleForTesting;
  final bool devAntiScreenshot;
  final bool devKioskPinning;
  final bool devNoDetectViolations;
  final bool devGuideLines;

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
      MaterialPageRoute(
        builder: (_) => ExamSessionPage(
          exam: exam,
          devAntiScreenshot: devAntiScreenshot,
          devKioskPinning: devKioskPinning,
          devNoDetectViolations: devNoDetectViolations,
          devGuideLines: devGuideLines,
        ),
      ),
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
  const ExamSessionPage({
    super.key,
    required this.exam,
    this.devAntiScreenshot = true,
    this.devKioskPinning = true,
    this.devNoDetectViolations = false,
    this.devGuideLines = false,
  });

  final ExamRecord exam;
  final bool devAntiScreenshot;
  final bool devKioskPinning;
  final bool devNoDetectViolations;
  final bool devGuideLines;

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
  bool _canGoBack = false;
  bool _canGoForward = false;
  bool _useGlassBar = true;
  String? _webError;
  Timer? _telemetryTimer;
  String _deviceId = '';
  String? _activeBroadcastMessage;
  String? _activeBroadcastTitle;
  Timer? _broadcastDismissTimer;

  Future<void> _sendTelemetry({String? overrideStatus, int? overrideLeaveCount}) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      var serverUrl = prefs.getString('dashboard_server_url')?.trim() ?? '';
      // Otomatis gunakan domain resmi SMAN 18 Batam (https://sman18.warren.my.id)
      if (serverUrl.isEmpty || serverUrl.contains('10.0.2.2') || serverUrl.contains('localhost')) {
        serverUrl = 'https://sman18.warren.my.id';
        await prefs.setString('dashboard_server_url', serverUrl);
      }

      final stats = await KioskService.getStats();
      final currentStatus = overrideStatus ??
          (_locked
              ? 'terkunci'
              : (_leaveCount > 0 ? 'keluar' : 'mengerjakan'));
      final currentLeave = overrideLeaveCount ?? _leaveCount;

      final payload = {
        'deviceId': _deviceId.isNotEmpty ? _deviceId : _deviceLabel,
        'name': _name,
        'className': _className,
        'subject': widget.exam.subject,
        'deviceLabel': _deviceLabel,
        'status': currentStatus,
        'leaveCount': currentLeave,
        'batteryLevel': stats['batteryLevel'] ?? 85,
        'isCharging': stats['isCharging'] ?? false,
        'temperature': stats['temperature'] ?? 36.0,
        'network': stats['network'] ?? 'Wi-Fi',
      };

      final uri = Uri.parse('$serverUrl/api/telemetry');
      final res = await http
          .post(
            uri,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode(payload),
          )
          .timeout(const Duration(seconds: 2));

      if (res.statusCode == 200 && mounted) {
        final data = jsonDecode(res.body);
        if (data is Map<String, dynamic>) {
          // 1. Remote Unlock command from Super-Admin
          if (data['shouldUnlock'] == true && _locked) {
            setState(() {
              _locked = false;
              _leaveCount = 0;
            });
          }

          // 2. Realtime Broadcast announcement from Super-Admin / Teacher
          if (data['broadcast'] != null && data['broadcast'] is Map<String, dynamic>) {
            final b = data['broadcast'] as Map<String, dynamic>;
            final bMsg = (b['message'] as String? ?? '').trim();
            final bTitle = (b['title'] as String? ?? 'PENGUMUMAN PENGAWAS').trim();

            if (bMsg.isNotEmpty && bMsg != _activeBroadcastMessage) {
              _broadcastDismissTimer?.cancel();
              setState(() {
                _activeBroadcastMessage = bMsg;
                _activeBroadcastTitle = bTitle;
              });

              // Auto dismiss floating overlay after 20 seconds
              _broadcastDismissTimer = Timer(const Duration(seconds: 20), () {
                if (mounted) {
                  setState(() {
                    _activeBroadcastMessage = null;
                    _activeBroadcastTitle = null;
                  });
                }
              });
            }
          }
        }
      }
    } catch (_) {}
  }

  Future<void> _checkNavigationHistory() async {
    if (!mounted) return;
    try {
      final canBack = await _webController.canGoBack();
      final canForward = await _webController.canGoForward();
      if (mounted && (canBack != _canGoBack || canForward != _canGoForward)) {
        setState(() {
          _canGoBack = canBack;
          _canGoForward = canForward;
        });
      }
    } catch (_) {}
  }

  @override
  void initState() {
    super.initState();
    unawaited(_setScreenSecurity(widget.devAntiScreenshot));
    WidgetsBinding.instance.addObserver(this);

    SharedPreferences.getInstance().then((prefs) {
      if (mounted) {
        setState(() {
          _useGlassBar = prefs.getBool('use_glass_bar') ??
              prefs.getBool('use_liquid_glass') ??
              true;
        });
      }
    });

    // Kiosk Mode & Layar Penuh Immersive Sticky
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    if (widget.devKioskPinning) {
      unawaited(KioskService.startLockTask());
    }

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
              _checkNavigationHistory();
            }
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _isLoadingWeb = false);
            _webController.runJavaScript(_identityListener);
            _checkNavigationHistory();
          },
          onUrlChange: (_) {
            _checkNavigationHistory();
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
    _telemetryTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      _sendTelemetry();
    });
  }

  @override
  void dispose() {
    _telemetryTimer?.cancel();
    _broadcastDismissTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_setScreenSecurity(false));
    if (widget.devKioskPinning) {
      unawaited(KioskService.stopLockTask());
    }
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    super.dispose();
  }

  Future<void> _setScreenSecurity(bool secure) async {
    try {
      await FlutterWindowManagerPlus.setSecure(secure);
    } catch (_) {}
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (widget.devNoDetectViolations) return;
    if (state != AppLifecycleState.paused || _locked) return;
    setState(() {
      _leaveCount += 1;
      _locked = _leaveCount >= 3;
    });
    _sendTelemetry(
      overrideStatus: _locked ? 'terkunci' : 'keluar',
      overrideLeaveCount: _leaveCount,
    );
  }

  Future<void> _readDeviceLabel() async {
    try {
      final info = await DeviceInfoPlugin().androidInfo;
      if (mounted) {
        setState(() {
          _deviceLabel = '${info.manufacturer} ${info.model}';
          _deviceId = info.id.isNotEmpty ? info.id : '${info.manufacturer}_${info.model}';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _deviceLabel = 'Android Device';
          _deviceId = 'DEV_${DateTime.now().millisecondsSinceEpoch}';
        });
      }
    }
    _sendTelemetry(overrideStatus: 'mengerjakan');
  }

  void _readIdentity(JavaScriptMessage message) {
    try {
      final data = jsonDecode(message.message) as Map<String, dynamic>;
      if (data['key'] == 'navChange') {
        _checkNavigationHistory();
        return;
      }
      final value = (data['value'] as String? ?? '').trim();
      if (value.isEmpty) return;
      setState(() {
        if (data['key'] == 'name') _name = value;
        if (data['key'] == 'class') _className = value;
      });
      debugPrint('Sesi Terdeteksi: $_name ($_className) - $_deviceLabel');
      _sendTelemetry();
    } catch (_) {}
  }

  void _restartWithToken() {
    Navigator.of(context).pop();
  }

  Future<void> _confirmExit() async {
    final shouldExit = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Keluar dari Ujian?'),
        content: const Text(
          'Pastikan kamu sudah menekan tombol "Kirim" / "Submit" pada Google Form sebelum keluar.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Batal'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Ya, Selesai'),
          ),
        ],
      ),
    );
    if (shouldExit == true && mounted) {
      unawaited(_sendTelemetry(overrideStatus: 'selesai'));
      if (widget.devKioskPinning) {
        await KioskService.stopLockTask();
      }
      if (mounted) Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final subjectTitle = widget.exam.subject.isEmpty ? 'Ujian' : widget.exam.subject;

    final scaffold = PopScope(
      canPop: false,
      child: Scaffold(
        appBar: AppBar(
          title: Text(subjectTitle),
          automaticallyImplyLeading: false,
          actions: [
            Container(
              margin: const EdgeInsets.symmetric(vertical: 10),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: _leaveCount > 0
                    ? theme.colorScheme.errorContainer
                    : theme.colorScheme.surfaceContainerHighest,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Text(
                  'Keluar: $_leaveCount/3',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: _leaveCount > 0
                        ? theme.colorScheme.onErrorContainer
                        : theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.exit_to_app),
              tooltip: 'Selesai ujian',
              onPressed: _confirmExit,
            ),
          ],
        ),
        body: Stack(
          children: [
            Column(
              children: [
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
                    child: WebViewWidget(controller: _webController),
                  ),
              ],
            ),
            // Floating Realtime Announcement Overlay (TIDAK MENGGESER SOAL / OVERLAY DI ATAS WEBVIEW)
            if (_activeBroadcastMessage != null)
              Positioned(
                top: 10,
                left: 14,
                right: 14,
                child: Material(
                  color: Colors.transparent,
                  elevation: 8,
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A).withValues(alpha: 0.96),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: const Color(0xFF38BDF8),
                        width: 1.5,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0284C7).withValues(alpha: 0.35),
                          blurRadius: 18,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0284C7).withValues(alpha: 0.22),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.campaign_rounded,
                            color: Color(0xFF38BDF8),
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    _activeBroadcastTitle ?? 'PENGUMUMAN PENGAWAS',
                                    style: const TextStyle(
                                      color: Color(0xFF38BDF8),
                                      fontSize: 12,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFEF4444),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text(
                                      'LIVE',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 9,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _activeBroadcastMessage!,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 13,
                                  height: 1.35,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        InkWell(
                          onTap: () {
                            _broadcastDismissTimer?.cancel();
                            setState(() {
                              _activeBroadcastMessage = null;
                              _activeBroadcastTitle = null;
                            });
                          },
                          borderRadius: BorderRadius.circular(16),
                          child: Padding(
                            padding: const EdgeInsets.all(4),
                            child: Icon(
                              Icons.close_rounded,
                              color: Colors.white.withValues(alpha: 0.7),
                              size: 18,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            if (!_locked && _webError == null)
              Positioned(
                bottom: 16,
                left: 0,
                right: 0,
                child: Center(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(_useGlassBar ? 24 : 16),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: _useGlassBar ? 10 : 0, sigmaY: _useGlassBar ? 10 : 0),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                        decoration: BoxDecoration(
                          color: _useGlassBar
                              ? const Color.fromRGBO(15, 23, 42, 0.64)
                              : const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(_useGlassBar ? 24 : 16),
                          border: Border.all(
                            color: _useGlassBar
                                ? Colors.white.withValues(alpha: 0.18)
                                : const Color(0xFF334155),
                            width: 1,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: _useGlassBar ? 0.25 : 0.45),
                              blurRadius: _useGlassBar ? 16 : 10,
                              offset: Offset(0, _useGlassBar ? 4 : 2),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: Icon(
                                Icons.arrow_back_ios_new_rounded,
                                size: 18,
                                color: _canGoBack
                                    ? Colors.white
                                    : Colors.white.withValues(alpha: 0.28),
                              ),
                              tooltip: _canGoBack ? 'Halaman sebelumnya' : null,
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              constraints: const BoxConstraints(minWidth: 48, minHeight: 40),
                              onPressed: _canGoBack
                                  ? () async {
                                      await _webController.runJavaScript(
                                          'window.__ujianKitaSave && window.__ujianKitaSave();');
                                      await _webController.goBack();
                                      await _checkNavigationHistory();
                                    }
                                  : null,
                            ),
                            Container(
                              height: 18,
                              width: 1,
                              color: Colors.white.withValues(alpha: 0.18),
                            ),
                            IconButton(
                              icon: const Icon(
                                Icons.refresh_rounded,
                                size: 21,
                                color: Colors.white,
                              ),
                              tooltip: 'Muat ulang',
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              constraints: const BoxConstraints(minWidth: 48, minHeight: 40),
                              onPressed: () async {
                                await _webController.runJavaScript(
                                    'window.__ujianKitaSave && window.__ujianKitaSave();');
                                setState(() => _isLoadingWeb = true);
                                await _webController.reload();
                                await _checkNavigationHistory();
                              },
                            ),
                            Container(
                              height: 18,
                              width: 1,
                              color: Colors.white.withValues(alpha: 0.18),
                            ),
                            IconButton(
                              icon: Icon(
                                Icons.arrow_forward_ios_rounded,
                                size: 18,
                                color: _canGoForward
                                    ? Colors.white
                                    : Colors.white.withValues(alpha: 0.28),
                              ),
                              tooltip: _canGoForward ? 'Halaman berikutnya' : null,
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                              constraints: const BoxConstraints(minWidth: 48, minHeight: 40),
                              onPressed: _canGoForward
                                  ? () async {
                                      await _webController.runJavaScript(
                                          'window.__ujianKitaSave && window.__ujianKitaSave();');
                                      await _webController.goForward();
                                      await _checkNavigationHistory();
                                    }
                                  : null,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
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

    if (widget.devGuideLines) {
      return DeveloperGuideLinesOverlay(child: scaffold);
    }
    return scaffold;
  }
}

const _identityListener = r'''
(() => {
  if (window.__ujianKitaIdentityReady) {
    if (typeof window.__ujianKitaRestore === 'function') window.__ujianKitaRestore();
    if (typeof window.__ujianKitaScan === 'function') window.__ujianKitaScan();
    return;
  }
  window.__ujianKitaIdentityReady = true;

  const normalize = (val) => (val || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const classify = (text) => {
    const clean = normalize(text);
    // Abaikan nomor ujian, nomor peserta, token, atau judul soal
    if (clean.includes('nomor') || clean.includes('nopeserta') || clean.includes('noujian') || clean.includes('token') || clean.includes('kartu') || clean.includes('soal')) {
      return null;
    }
    // Cek Kelas terlebih dahulu (misal: "Kelas", "KELAS", "Tingkat", "Rombel")
    if (clean.includes('kelas') || clean.includes('class') || clean.includes('rombel') || clean.includes('tingkat') || clean.includes('grade')) {
      return 'class';
    }
    // Cek Nama (misal: "Nama", "NAMA SISWA", "Nama Lengkap Peserta Ujian", "NAMA LENGKAP")
    if (clean.includes('nama') || clean.includes('name')) {
      return 'name';
    }
    if ((clean.includes('siswa') || clean.includes('peserta')) && !clean.includes('ujian')) {
      return 'name';
    }
    return null;
  };

  const report = (key, value) => {
    if (!key || !value) return;
    const cleanVal = value.trim();
    if (!cleanVal) return;
    try {
      if (window.UjianKita && window.UjianKita.postMessage) {
        window.UjianKita.postMessage(JSON.stringify({ key, value: cleanVal }));
      }
    } catch (_) {}
  };

  const notifyNav = () => {
    try {
      if (window.UjianKita && window.UjianKita.postMessage) {
        window.UjianKita.postMessage(JSON.stringify({ key: 'navChange' }));
      }
    } catch (_) {}
  };

  const getStorageKey = () => '__ujianKitaDraft_' + (window.location.pathname || 'form');

  const saveFormData = () => {
    try {
      const data = {};
      const questions = document.querySelectorAll('[role="listitem"], .Qr7Oae, .geS5n, .m7WMo');
      questions.forEach((q, idx) => {
        const headingEl = q.querySelector('[role="heading"], .M7eMe, .HoXoMd, .z12JJ');
        const heading = headingEl ? (headingEl.innerText || headingEl.textContent || '').trim() : ('q_' + idx);
        if (!heading) return;

        // 1. Input teks & textarea
        const txt = q.querySelector('input[type="text"], input:not([type]), textarea');
        if (txt && txt.value && txt.value.trim().length > 0) {
          data[heading] = { type: 'text', value: txt.value };
        }

        // 2. Radio pilihan ganda
        const checkedRadio = q.querySelector('[role="radio"][aria-checked="true"]');
        if (checkedRadio) {
          const val = checkedRadio.getAttribute('data-value') ||
                      checkedRadio.getAttribute('data-answer-value') ||
                      checkedRadio.getAttribute('aria-label') ||
                      checkedRadio.innerText;
          if (val && val.trim().length > 0) {
            data[heading] = { type: 'radio', value: val.trim() };
          }
        }

        // 3. Checkbox kotak centang
        const checkedBoxes = q.querySelectorAll('[role="checkbox"][aria-checked="true"]');
        if (checkedBoxes.length > 0) {
          const vals = [];
          checkedBoxes.forEach((b) => {
            const v = b.getAttribute('data-answer-value') ||
                      b.getAttribute('data-value') ||
                      b.getAttribute('aria-label') ||
                      b.innerText;
            if (v && v.trim().length > 0) vals.push(v.trim());
          });
          if (vals.length > 0) {
            data[heading] = { type: 'checkbox', value: vals };
          }
        }

        // 4. Dropdown pilihan
        const selectedOption = q.querySelector('[role="option"][aria-selected="true"], [role="option"].isSelected');
        if (selectedOption) {
          const val = selectedOption.getAttribute('data-value') || selectedOption.innerText;
          if (val && val.trim().length > 0 && !val.toLowerCase().startsWith('pilih') && !val.toLowerCase().startsWith('choose')) {
            data[heading] = { type: 'dropdown', value: val.trim() };
          }
        }
        const dropdownEl = q.querySelector('.vRMGwf.oJeWuf, .vRMGwf, [jsname="L9xktb"]');
        if (dropdownEl && dropdownEl.innerText) {
          const val = dropdownEl.innerText.trim();
          if (val && !val.toLowerCase().startsWith('pilih') && !val.toLowerCase().startsWith('choose')) {
            data[heading] = { type: 'dropdown', value: val };
          }
        }
      });

      const sKey = getStorageKey();
      let existing = {};
      try {
        existing = JSON.parse(localStorage.getItem(sKey) || '{}');
      } catch (_) {}
      const merged = Object.assign(existing, data);
      localStorage.setItem(sKey, JSON.stringify(merged));
    } catch (_) {}
  };

  const restoreFormData = () => {
    try {
      const sKey = getStorageKey();
      const savedStr = localStorage.getItem(sKey);
      if (!savedStr) return;
      const data = JSON.parse(savedStr);

      const questions = document.querySelectorAll('[role="listitem"], .Qr7Oae, .geS5n, .m7WMo');
      questions.forEach((q, idx) => {
        const headingEl = q.querySelector('[role="heading"], .M7eMe, .HoXoMd, .z12JJ');
        const heading = headingEl ? (headingEl.innerText || headingEl.textContent || '').trim() : ('q_' + idx);
        const item = data[heading];
        if (!item) return;

        // Restore Text
        if (item.type === 'text') {
          const txt = q.querySelector('input[type="text"], input:not([type]), textarea');
          if (txt && (!txt.value || txt.value.trim().length === 0)) {
            txt.value = item.value;
            txt.dispatchEvent(new Event('input', { bubbles: true }));
            txt.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        // Restore Radio
        if (item.type === 'radio') {
          const currentChecked = q.querySelector('[role="radio"][aria-checked="true"]');
          if (!currentChecked) {
            const radios = q.querySelectorAll('[role="radio"]');
            for (let i = 0; i < radios.length; i++) {
              const r = radios[i];
              const val = r.getAttribute('data-value') ||
                          r.getAttribute('data-answer-value') ||
                          r.getAttribute('aria-label') ||
                          r.innerText;
              if (val && val.trim() === item.value) {
                r.click();
                break;
              }
            }
          }
        }

        // Restore Checkbox
        if (item.type === 'checkbox' && Array.isArray(item.value)) {
          const boxes = q.querySelectorAll('[role="checkbox"]');
          boxes.forEach((b) => {
            const val = b.getAttribute('data-answer-value') ||
                        b.getAttribute('data-value') ||
                        b.getAttribute('aria-label') ||
                        b.innerText;
            if (val && item.value.includes(val.trim()) && b.getAttribute('aria-checked') !== 'true') {
              b.click();
            }
          });
        }

        // Restore Dropdown
        if (item.type === 'dropdown') {
          const currentText = q.querySelector('.vRMGwf.oJeWuf, .vRMGwf, [jsname="L9xktb"]');
          if (!currentText || currentText.innerText.toLowerCase().startsWith('pilih')) {
            const options = q.querySelectorAll('[role="option"]');
            for (let i = 0; i < options.length; i++) {
              const opt = options[i];
              const val = opt.getAttribute('data-value') || opt.innerText;
              if (val && val.trim() === item.value) {
                opt.click();
                break;
              }
            }
          }
        }
      });
    } catch (_) {}
  };

  const scan = () => {
    try {
      // Pindai semua kontainer pertanyaan di Google Form
      const questions = document.querySelectorAll('[role="listitem"], .Qr7Oae, .geS5n, .m7WMo');
      questions.forEach((q) => {
        const headingEl = q.querySelector('[role="heading"], .M7eMe, .HoXoMd, .z12JJ');
        const headingText = headingEl ? (headingEl.innerText || headingEl.textContent) : (q.innerText || '');
        const key = classify(headingText);
        if (!key) return;

        // A. Cek Input Teks (Nama atau Kelas yang diketik)
        const textInput = q.querySelector('input[type="text"], input:not([type]), textarea');
        if (textInput && textInput.value && textInput.value.trim().length > 0) {
          report(key, textInput.value);
        }

        // B. Cek Radio Button Pilihan (Google Form role="radio")
        const checkedRadio = q.querySelector('[role="radio"][aria-checked="true"]');
        if (checkedRadio) {
          const val = checkedRadio.getAttribute('data-value') ||
                      checkedRadio.getAttribute('data-answer-value') ||
                      checkedRadio.getAttribute('aria-label') ||
                      checkedRadio.innerText;
          if (val && val.trim().length > 0) {
            report(key, val);
          }
        }

        // C. Cek Checkbox Pilihan (Google Form role="checkbox")
        const checkedBox = q.querySelector('[role="checkbox"][aria-checked="true"]');
        if (checkedBox) {
          const val = checkedBox.getAttribute('data-answer-value') ||
                      checkedBox.getAttribute('data-value') ||
                      checkedBox.getAttribute('aria-label') ||
                      checkedBox.innerText;
          if (val && val.trim().length > 0) {
            report(key, val);
          }
        }

        // D. Cek Dropdown Google Form (role="option" yang terpilih atau span label)
        const selectedOption = q.querySelector('[role="option"][aria-selected="true"], [role="option"].isSelected');
        if (selectedOption) {
          const val = selectedOption.getAttribute('data-value') || selectedOption.innerText;
          if (val && val.trim().length > 0 && !val.trim().toLowerCase().startsWith('pilih') && !val.trim().toLowerCase().startsWith('choose')) {
            report(key, val);
          }
        }
        const dropdownTexts = q.querySelectorAll('.vRMGwf, [jsname="L9xktb"]');
        dropdownTexts.forEach((el) => {
          const val = (el.innerText || el.textContent || '').trim();
          if (val && !val.toLowerCase().startsWith('pilih') && !val.toLowerCase().startsWith('choose')) {
            report(key, val);
          }
        });

        // E. Cek Hidden Input entry Google Form yang terisi
        const hiddenInputs = q.querySelectorAll('input[type="hidden"]');
        hiddenInputs.forEach((h) => {
          if (h.name && h.name.startsWith('entry.') && !h.name.endsWith('_sentinel') && h.value && h.value.trim().length > 0) {
            report(key, h.value);
          }
        });
      });
    } catch (_) {}
  };

  window.__ujianKitaSave = saveFormData;
  window.__ujianKitaRestore = restoreFormData;
  window.__ujianKitaScan = scan;

  window.addEventListener('popstate', () => {
    notifyNav();
    setTimeout(restoreFormData, 250);
  });
  window.addEventListener('hashchange', () => {
    notifyNav();
    setTimeout(restoreFormData, 250);
  });

  // Listeners untuk menangkap ketikan, klik pilihan radio / checkbox, maupun perubahan dropdown
  document.addEventListener('input', () => {
    saveFormData();
    scan();
  }, true);
  document.addEventListener('change', () => {
    saveFormData();
    scan();
  }, true);
  document.addEventListener('click', () => {
    setTimeout(saveFormData, 100);
    setTimeout(scan, 120);
    setTimeout(saveFormData, 350);
    setTimeout(scan, 400);
    setTimeout(notifyNav, 450);
    setTimeout(notifyNav, 1200);
  }, true);

  // Interval otomatis agar selalu sinkron dan tersimpan
  setInterval(() => {
    saveFormData();
    scan();
  }, 1500);

  // Jalankan segera saat halaman selesai dimuat: pulihkan data & pindai identitas
  setTimeout(() => {
    restoreFormData();
    scan();
    notifyNav();
  }, 300);
  setTimeout(() => {
    restoreFormData();
    scan();
    notifyNav();
  }, 900);
  setTimeout(() => {
    restoreFormData();
    scan();
    notifyNav();
  }, 2000);
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
