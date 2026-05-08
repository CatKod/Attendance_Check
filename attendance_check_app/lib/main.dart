import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const String kEsp32BaseUrl = 'http://apes.local';
const Duration kRequestTimeout = Duration(milliseconds: 1500);
const String kPrefsMssvKey = 'mssv';

const String kMsgNetworkError =
    '\u274C L\u1ed7i: Kh\u00f4ng t\u00ecm th\u1ea5y h\u1ec7 th\u1ed1ng. Vui l\u00f2ng k\u1ebft n\u1ed1i Wi-Fi Lab!';
const String kMsgQueued =
    '\u2705 \u0110\u00e3 g\u1eedi y\u00eau c\u1ea7u check-in!';

void main() {
  runApp(const AttendanceApp());
}

class AttendanceApp extends StatelessWidget {
  const AttendanceApp({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFF0B76F6),
        brightness: Brightness.light,
      ),
      textTheme: GoogleFonts.spaceGroteskTextTheme(),
    );

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Attendance Tracking App',
      theme: theme,
      home: const AttendanceHome(),
    );
  }
}

class AttendanceHome extends StatefulWidget {
  const AttendanceHome({super.key});

  @override
  State<AttendanceHome> createState() => _AttendanceHomeState();
}

class _AttendanceHomeState extends State<AttendanceHome> {
  final TextEditingController _mssvController = TextEditingController();
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  bool _isLoading = true;
  bool _isSending = false;
  String? _mssv;

  @override
  void initState() {
    super.initState();
    _loadMssv();
  }

  @override
  void dispose() {
    _mssvController.dispose();
    super.dispose();
  }

  Future<void> _loadMssv() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString(kPrefsMssvKey);
    final trimmed = stored?.trim();

    if (!mounted) {
      return;
    }

    setState(() {
      _mssv = (trimmed == null || trimmed.isEmpty) ? null : trimmed;
      _isLoading = false;
    });
  }

  Future<void> _saveMssv() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final value = _mssvController.text.trim();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(kPrefsMssvKey, value);

    if (!mounted) {
      return;
    }

    setState(() {
      _mssv = value;
    });
  }

  Future<void> _sendCheckIn() async {
    final currentMssv = _mssv?.trim();
    if (currentMssv == null || currentMssv.isEmpty) {
      return;
    }

    setState(() {
      _isSending = true;
    });

    try {
        final baseUrl = kEsp32BaseUrl.endsWith('/')
          ? kEsp32BaseUrl.substring(0, kEsp32BaseUrl.length - 1)
          : kEsp32BaseUrl;
        final uri = Uri.parse('$baseUrl/api/checkin');
      final response = await http
          .post(
            uri,
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'mssv': currentMssv}),
          )
          .timeout(kRequestTimeout);

      if (!mounted) {
        return;
      }

      if (response.statusCode == 200) {
        _showSnack(kMsgQueued, success: true);
      } else {
        final serverMessage = _tryExtractMessage(response.body);
        _showSnack(
          serverMessage ?? 'Request failed. Please try again.',
          success: false,
        );
      }
    } on TimeoutException {
      _showSnack(kMsgNetworkError, success: false);
    } on SocketException {
      _showSnack(kMsgNetworkError, success: false);
    } on HttpException {
      _showSnack(kMsgNetworkError, success: false);
    } catch (_) {
      _showSnack(kMsgNetworkError, success: false);
    } finally {
      if (!mounted) {
        return;
      }
      setState(() {
        _isSending = false;
      });
    }
  }

  String? _tryExtractMessage(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        final message = decoded['message'];
        if (message is String && message.trim().isNotEmpty) {
          return message.trim();
        }
      }
    } catch (_) {
      // Ignore parse errors and fallback to generic messages.
    }

    return null;
  }

  void _showSnack(String message, {required bool success}) {
    if (!mounted) {
      return;
    }

    final color = success ? const Color(0xFF1B8A3B) : const Color(0xFFC62828);
    final messenger = ScaffoldMessenger.of(context);
    messenger
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: color,
          behavior: SnackBarBehavior.floating,
          duration: const Duration(seconds: 2),
        ),
      );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_mssv == null) {
      return _buildMssvInput();
    }

    return _buildCheckIn();
  }

  Widget _buildMssvInput() {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFE9F4FF),
              Color(0xFFF7FFF3),
            ],
          ),
        ),
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.92),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.08),
                      blurRadius: 20,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Nhap MSSV',
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w700),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _mssvController,
                        textInputAction: TextInputAction.done,
                        autocorrect: false,
                        enableSuggestions: false,
                        decoration: InputDecoration(
                          labelText: 'MSSV',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(16),
                          ),
                        ),
                        validator: (value) {
                          final trimmed = value?.trim() ?? '';
                          if (trimmed.isEmpty) {
                            return 'Vui long nhap MSSV.';
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 48,
                        child: ElevatedButton(
                          onPressed: _saveMssv,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0B76F6),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          child: const Text('Luu MSSV'),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCheckIn() {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomRight,
            colors: [
              Color(0xFFF2F8FF),
              Color(0xFFEFF8F2),
              Color(0xFFFDF8EE),
            ],
          ),
        ),
        child: Center(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: TweenAnimationBuilder<double>(
                tween: Tween(begin: 0.96, end: 1),
                duration: const Duration(milliseconds: 450),
                curve: Curves.easeOutCubic,
                builder: (context, scale, child) {
                  return Transform.scale(scale: scale, child: child);
                },
                child: SizedBox(
                  width: double.infinity,
                  height: 140,
                  child: ElevatedButton(
                    onPressed: _isSending ? null : _sendCheckIn,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0B76F6),
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(28),
                      ),
                      elevation: 8,
                      shadowColor: const Color(0xFF0B76F6).withOpacity(0.35),
                    ),
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 220),
                      child: _isSending
                          ? Row(
                              key: const ValueKey('sending'),
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: const [
                                SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 3,
                                    valueColor:
                                        AlwaysStoppedAnimation<Color>(Colors.white),
                                  ),
                                ),
                                SizedBox(width: 12),
                                Text(
                                  'DANG GUI...',
                                  style: TextStyle(
                                    fontSize: 20,
                                    letterSpacing: 1.2,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            )
                          : const Text(
                              'CHECK-IN',
                              key: ValueKey('ready'),
                              style: TextStyle(
                                fontSize: 28,
                                letterSpacing: 2,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
