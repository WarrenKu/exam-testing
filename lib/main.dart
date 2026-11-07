import 'dart:async';
import 'dart:convert';
import 'dart:ui';

import 'package:csv/csv.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_windowmanager_plus/flutter_windowmanager_plus.dart';
import 'package:http/http.dart' as http;
import 'package:webview_flutter/webview_flutter.dart';

const tokenSheetUrl =
    'https://docs.google.com/spreadsheets/d/1mMANbRElvGLNAViBzOqY1UND5CY8wR6WNQRg1lpSKb0/export?format=csv';

void main() {
  runApp(const UjianKitaApp());
}

class UjianKitaApp extends StatefulWidget {
  const UjianKitaApp({super.key});

  @override
  State<UjianKitaApp> createState() => _UjianKitaAppState();
}

class _UjianKitaAppState extends State<UjianKitaApp> {
  bool _isDark = false;
  bool _ignoreScheduleForTesting = true;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'UjianKita Test',
      themeMode: _isDark ? ThemeMode.dark : ThemeMode.light,
      theme: _theme(Brightness.light),
      darkTheme: _theme(Brightness.dark),
      home: SplashScreen(
        onReady: () => Navigator.of(context).pushReplacement(
          MaterialPageRoute(
            builder: (_) => ExamShell(
              isDark: _isDark,
              ignoreScheduleForTesting: _ignoreScheduleForTesting,
              onThemeChanged: (value) => setState(() => _isDark = value),
              onTestingModeChanged: (value) =>
                  setState(() => _ignoreScheduleForTesting = value),
            ),
          ),
        ),
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
    Future<void>.delayed(const Duration(milliseconds: 900), widget.onReady);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.fact_check_rounded, size: 72, color: colors.primary),
            const SizedBox(height: 20),
            Text('UjianKita', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text('Memuat sesi ujian', style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 28),
            const SizedBox(width: 28, height: 28, child: CircularProgressIndicator()),
          ],
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
      final records = await TokenSheetRepository().load();
      final exam = records.where((record) => record.token.toUpperCase() == enteredToken.toUpperCase()).firstOrNull;
      if (exam == null) {
        setState(() => _message = 'Token tidak ditemukan di jadwal ujian.');
        return;
      }
      if (exam.formUrl.isEmpty) {
        setState(() => _message = 'Token ditemukan, tetapi link soal belum tersedia.');
        return;
      }
      if (!widget.ignoreScheduleForTesting && !exam.isScheduledToday) {
        setState(() => _message = 'Ujian ini dijadwalkan pada hari ${exam.day}.');
        return;
      }
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ExamSessionPage(exam: exam)),
      );
    } on SheetException catch (error) {
      setState(() => _message = error.message);
    } catch (_) {
      setState(() => _message = 'Token tidak dapat diperiksa. Periksa koneksi internet.');
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
        Text('Masukkan token dari pengawas untuk membuka jadwal dan soal.', style: theme.textTheme.bodyLarge),
        const SizedBox(height: 36),
        TextField(
          controller: _tokenController,
          autocorrect: false,
          textCapitalization: TextCapitalization.characters,
          decoration: const InputDecoration(
            labelText: 'Token ujian',
            hintText: 'Contoh: token dari pengawas',
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
            label: Text(_isLoading ? 'Memeriksa token' : 'Buka ujian'),
          ),
        ),
        if (_message != null) ...[
          const SizedBox(height: 18),
          Semantics(
            liveRegion: true,
            child: Text(_message!, style: TextStyle(color: theme.colorScheme.error)),
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
            const Text('Aplikasi ini membaca jadwal dari Spreadsheet saat token diperiksa. Jangan gunakan sebagai rilis sekolah karena token Sheet publik dapat dilihat oleh orang yang memiliki link.'),
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
          subtitle: Text('Nama dan kelas dibaca saat diketik pada halaman awal Google Form dalam aplikasi.'),
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
  String _deviceLabel = 'Memeriksa perangkat';
  int _leaveCount = 0;
  bool _locked = false;

  @override
  void initState() {
    super.initState();
    unawaited(_setScreenSecurity(true));
    WidgetsBinding.instance.addObserver(this);
    _webController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel('UjianKita', onMessageReceived: _readIdentity)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) => _webController.runJavaScript(_identityListener),
        ),
      )
      ..loadRequest(Uri.parse(widget.exam.formUrl));
    _readDeviceLabel();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_setScreenSecurity(false));
    super.dispose();
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
    final info = await DeviceInfoPlugin().androidInfo;
    if (mounted) setState(() => _deviceLabel = '${info.manufacturer} ${info.model}');
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

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return PopScope(
      canPop: false,
      child: Scaffold(
        appBar: AppBar(
          title: Text(widget.exam.subject),
          automaticallyImplyLeading: false,
          actions: [
            Padding(
              padding: const EdgeInsets.only(right: 16),
              child: Center(child: Text('Keluar: $_leaveCount/3')),
            ),
          ],
        ),
        body: Stack(
          children: [
            WebViewWidget(controller: _webController),
            Align(
              alignment: Alignment.topCenter,
              child: Material(
                color: theme.colorScheme.secondaryContainer,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Text('Sesi: $_name · $_className · $_deviceLabel', maxLines: 1, overflow: TextOverflow.ellipsis),
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
                          const Text('Aplikasi telah ditinggalkan tiga kali. Masukkan token lagi untuk memulai sesi uji baru.', textAlign: TextAlign.center),
                          const SizedBox(height: 20),
                          FilledButton(onPressed: _restartWithToken, child: const Text('Kembali ke token')),
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
  Future<List<ExamRecord>> load() async {
    final response = await http.get(Uri.parse(tokenSheetUrl));
    if (response.statusCode != 200) {
      throw const SheetException('Spreadsheet token tidak dapat dibuka.');
    }
    final rows = const CsvToListConverter(shouldParseNumbers: false).convert(response.body);
    if (rows.length < 2) throw const SheetException('Spreadsheet token belum memiliki jadwal.');
    final header = rows.first.map((cell) => cell.toString().trim().toUpperCase()).toList();
    final required = ['MAPEL', 'KELAS', 'SESI', 'TOKEN', 'DURASI', 'HARI', 'LINK SOAL'];
    if (required.any((name) => !header.contains(name))) {
      throw const SheetException('Kolom Spreadsheet tidak sesuai format token.');
    }
    final index = {for (var position = 0; position < header.length; position++) header[position]: position};
    return rows.skip(1).map((row) => ExamRecord.fromRow(row, index)).where((record) => record.token.isNotEmpty).toList();
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

  factory ExamRecord.fromRow(List<dynamic> row, Map<String, int> index) {
    String value(String name) {
      final position = index[name]!;
      return position < row.length ? row[position].toString().trim() : '';
    }
    return ExamRecord(
      subject: value('MAPEL'),
      classLevel: value('KELAS'),
      session: value('SESI'),
      token: value('TOKEN'),
      durationMinutes: value('DURASI'),
      day: value('HARI'),
      formUrl: value('LINK SOAL'),
    );
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
    return dayNames[DateTime.now().weekday] == day.toUpperCase();
  }
}

extension FirstOrNullExtension<T> on Iterable<T> {
  T? get firstOrNull {
    final iterator = this.iterator;
    return iterator.moveNext() ? iterator.current : null;
  }
}
