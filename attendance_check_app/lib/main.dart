import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const String kEsp32BaseUrl = 'http://apes.local';
const String kAppsScriptUrl =
    'https://script.google.com/macros/s/AKfycbyX7lEcvmdzxBzqMD2C5oqrxrNK6IE-5UQiRNzvtIL5z7SPW8v7_cHvOTO4Fl8mG26vrA/exec';
const Duration kCreateTimeout = Duration(seconds: 20);
const Duration kStatusPollInterval = Duration(seconds: 1);
const Duration kStatusPollTimeout = Duration(seconds: 35);
const String kPrefsMssvKey = 'mssv';

const String kMsgNetworkError =
    '❌ Lỗi kết nối. Vui lòng kiểm tra Wi-Fi và thử lại.';
const String kMsgQueued = 'Đã gửi yêu cầu check-in, đang xử lý...';
const String kMsgSending = 'Đang gửi...';
const String kMsgSuccess = 'Check-in thành công';
const String kMsgAlreadyCheckedIn = 'Đã check-in rồi';
const String kMsgFailure = 'Check-in thất bại';
const String kMsgOutsideSession = 'Ngoài thời gian check-in';
const String kMsgPending = 'Đang xử lý...';

enum SnackKind { sending, success, alreadyCheckedIn, error, pending }

class _CheckinResult {
  const _CheckinResult({
    required this.isSuccess,
    required this.isAlreadyCheckedIn,
    required this.isTerminalFailure,
    required this.message,
  });

  final bool isSuccess;
  final bool isAlreadyCheckedIn;
  final bool isTerminalFailure;
  final String message;
}

class _MemberValidationResult {
  const _MemberValidationResult({
    required this.isActive,
    required this.isAlreadyCheckedIn,
    required this.message,
  });

  final bool isActive;
  final bool isAlreadyCheckedIn;
  final String message;
}

class _CheckinUiState {
  const _CheckinUiState({
    required this.text,
    required this.kind,
    required this.isBusy,
  });

  final String text;
  final SnackKind kind;
  final bool isBusy;
}

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
  String _statusText = '';
  SnackKind? _statusKind;

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
    final stored = prefs.getString(kPrefsMssvKey)?.trim();

    if (!mounted) return;

    setState(() {
      _mssv = (stored == null || stored.isEmpty) ? null : stored;
      _isLoading = false;
      _statusText = _mssv == null ? '' : 'Sẵn sàng check-in';
      _statusKind = _mssv == null ? null : SnackKind.pending;
    });
  }

  Future<void> _saveMssv() async {
    if (!_formKey.currentState!.validate()) return;

    final value = _mssvController.text.trim();
    final validation = await _validateMssv(value);
    if (validation == null) {
      return;
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(kPrefsMssvKey, value);

    if (!mounted) return;

    setState(() {
      _mssv = value;
      _statusText = validation.message;
      _statusKind = validation.isAlreadyCheckedIn
          ? SnackKind.alreadyCheckedIn
          : SnackKind.success;
    });

    _showSnack(validation.message,
        kind: validation.isAlreadyCheckedIn
            ? SnackKind.alreadyCheckedIn
            : SnackKind.success);
  }

  String _normalizedBaseUrl() {
    return kEsp32BaseUrl.endsWith('/')
        ? kEsp32BaseUrl.substring(0, kEsp32BaseUrl.length - 1)
        : kEsp32BaseUrl;
  }

  Future<_MemberValidationResult?> _validateMssv(String mssv) async {
    final uri = Uri.parse('$kAppsScriptUrl?action=validate_member&mssv=$mssv');
    try {
      final response = await http.get(uri).timeout(kCreateTimeout);
      final decoded = _tryDecodeJson(response.body);
      final status = decoded?['status']?.toString().trim().toLowerCase();
      final code = decoded?['code']?.toString().trim().toUpperCase();
      final message = decoded?['message']?.toString().trim();

      if (status == 'active' || code == 'MEMBER_ACTIVE') {
        return _MemberValidationResult(
          isActive: true,
          isAlreadyCheckedIn: false,
          message: 'MSSV hợp lệ, đã lưu.',
        );
      }

      if (status == 'inactive' || code == 'MEMBER_INACTIVE') {
        _showSnack(
          'MSSV có trong danh sách nhưng đang bị khóa.',
          kind: SnackKind.error,
        );
        return null;
      }

      if (status == 'not_found' || code == 'MEMBER_NOT_FOUND') {
        _showSnack(
          'MSSV không tồn tại trong danh sách.',
          kind: SnackKind.error,
        );
        return null;
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        return _MemberValidationResult(
          isActive: true,
          isAlreadyCheckedIn: false,
          message: message?.isNotEmpty == true ? message! : 'MSSV hợp lệ, đã lưu.',
        );
      }
    } catch (_) {
      _showSnack(
        'Không kiểm tra được danh sách MSSV lúc này.',
        kind: SnackKind.error,
      );
      return null;
    }

    return _MemberValidationResult(
      isActive: true,
      isAlreadyCheckedIn: false,
      message: 'MSSV hợp lệ, đã lưu.',
    );
  }

  Future<void> _sendCheckIn() async {
    final currentMssv = _mssv?.trim();
    if (currentMssv == null || currentMssv.isEmpty) return;

    setState(() {
      _isSending = true;
      _statusText = kMsgSending;
      _statusKind = SnackKind.sending;
    });

    _showSnack(kMsgSending, kind: SnackKind.sending);

    try {
      final baseUrl = _normalizedBaseUrl();
      final createUri = Uri.parse('$baseUrl/api/checkin');
      final createResponse = await http
          .post(
            createUri,
            headers: const {'Content-Type': 'application/json'},
            body: jsonEncode({'mssv': currentMssv}),
          )
          .timeout(kCreateTimeout);

      final createDecoded = _tryDecodeJson(createResponse.body);
      final createStatus =
          createDecoded?['status']?.toString().trim().toLowerCase();
      final createCode =
          createDecoded?['code']?.toString().trim().toUpperCase();
      final createMessage =
          createDecoded?['message']?.toString().trim();
      final requestId = _extractRequestId(createDecoded);
      debugPrint(
        '[GAS create] status=${createResponse.statusCode} '
        'code=${createCode ?? '-'} '
        'state=${createStatus ?? '-'} '
        'msg=${createMessage ?? '-'} '
        'requestId=${requestId ?? '-'}',
      );

      if (!mounted) return;

      if (createResponse.statusCode == 202 || createStatus == 'pending') {
        if (requestId == null || requestId.isEmpty) {
          _setFinalState(
            text: kMsgFailure,
            kind: SnackKind.error,
            showSnack: true,
          );
          return;
        }

        _setFinalState(
          text: kMsgPending,
          kind: SnackKind.pending,
          showSnack: true,
        );

        final finalResult = await _pollCheckinStatus(
          baseUrl: baseUrl,
          requestId: requestId,
        );

        if (!mounted) return;

        if (finalResult == null) {
          _setFinalState(
            text: kMsgFailure,
            kind: SnackKind.error,
            showSnack: true,
          );
          return;
        }

        _showResult(finalResult);
        return;
      }

      final directResult = _mapResponseToResult(
        statusCode: createResponse.statusCode,
        status: createStatus,
        code: createCode,
        message: createMessage,
        body: createResponse.body,
      );
      if (directResult.isTerminalFailure) {
        _setFinalState(
          text: directResult.message,
          kind: SnackKind.error,
          showSnack: true,
        );
        return;
      }
      _showResult(directResult);
    } on TimeoutException {
      _setFinalState(
        text: kMsgNetworkError,
        kind: SnackKind.error,
        showSnack: true,
      );
    } on SocketException {
      _setFinalState(
        text: kMsgNetworkError,
        kind: SnackKind.error,
        showSnack: true,
      );
    } on HttpException {
      _setFinalState(
        text: kMsgNetworkError,
        kind: SnackKind.error,
        showSnack: true,
      );
    } catch (_) {
      _setFinalState(
        text: kMsgNetworkError,
        kind: SnackKind.error,
        showSnack: true,
      );
    } finally {
      if (!mounted) return;
      setState(() {
        _isSending = false;
      });
    }
  }

  Future<_CheckinResult?> _pollCheckinStatus({
    required String baseUrl,
    required String requestId,
  }) async {
    final deadline = DateTime.now().add(kStatusPollTimeout);

    while (DateTime.now().isBefore(deadline)) {
      await Future<void>.delayed(kStatusPollInterval);

      try {
        final uri = Uri.parse('$baseUrl/api/status?requestId=$requestId');
        final response = await http.get(uri).timeout(kCreateTimeout);
        final decoded = _tryDecodeJson(response.body);
        final status = decoded?['status']?.toString().trim().toLowerCase();
        final code = decoded?['code']?.toString().trim().toUpperCase();
        final message = decoded?['message']?.toString().trim();

        debugPrint(
          '[GAS poll] status=${response.statusCode} '
          'code=${code ?? '-'} '
          'state=${status ?? '-'} '
          'msg=${message ?? '-'} '
          'requestId=${requestId}',
        );

        final result = _mapResponseToResult(
          statusCode: response.statusCode,
          status: status,
          code: code,
          message: message,
          body: response.body,
        );

        if (result.isSuccess || result.isAlreadyCheckedIn ||
            result.isTerminalFailure) {
          return result;
        }
      } on TimeoutException {
        continue;
      } on SocketException {
        continue;
      } on HttpException {
        continue;
      } catch (_) {
        continue;
      }
    }

    return null;
  }

  _CheckinResult _mapResponseToResult({
    required int statusCode,
    required String? status,
    required String? code,
    required String? message,
    required String body,
  }) {
    final bodyLower = body.toLowerCase();
    final messageLower = (message ?? '').toLowerCase();

    final isAlreadyCheckedIn =
        status == 'already_checked_in' ||
        code == 'ALREADY_CHECKED_IN' ||
        bodyLower.contains('"status":"already_checked_in"') ||
        bodyLower.contains('already_checked_in') ||
        bodyLower.contains('already checked in') ||
        bodyLower.contains('đã check-in rồi') ||
        bodyLower.contains('da check-in roi') ||
        bodyLower.contains('da check in roi') ||
        messageLower.contains('already checked in') ||
        messageLower.contains('đã check-in rồi') ||
        messageLower.contains('da check-in roi') ||
        messageLower.contains('da check in roi');

    final isSuccess =
        status == 'success' ||
        code == 'CHECKIN_OK' ||
        code == 'OK' ||
        bodyLower.contains('"status":"success"') ||
        bodyLower.contains('"ok":true') ||
        bodyLower.contains('check-in thành công') ||
        bodyLower.contains('check-in thanh cong');

    if (isAlreadyCheckedIn) {
      return _CheckinResult(
        isSuccess: false,
        isAlreadyCheckedIn: true,
        isTerminalFailure: false,
        message: kMsgAlreadyCheckedIn,
      );
    }

    if (isSuccess && statusCode >= 200 && statusCode < 300) {
      return _CheckinResult(
        isSuccess: true,
        isAlreadyCheckedIn: false,
        isTerminalFailure: false,
        message: kMsgSuccess,
      );
    }

    final isOutsideSession =
        status == 'error' && code == 'OUTSIDE_SESSION';
    final fallbackMessage =
        (message != null && message.isNotEmpty) ? message : kMsgFailure;
    return _CheckinResult(
      isSuccess: false,
      isAlreadyCheckedIn: false,
      isTerminalFailure: isOutsideSession,
      message: isOutsideSession ? kMsgOutsideSession : fallbackMessage,
    );
  }

  String? _extractRequestId(Map<String, dynamic>? decoded) {
    if (decoded == null) return null;
    final data = decoded['data'];
    if (data is Map<String, dynamic>) {
      final requestId = data['requestId']?.toString().trim();
      if (requestId != null && requestId.isNotEmpty) {
        return requestId;
      }
    }
    return null;
  }

  Map<String, dynamic>? _tryDecodeJson(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      }
    } catch (_) {
      // Ignore parse errors and fallback to generic messages.
    }
    return null;
  }

  void _showResult(_CheckinResult result) {
    if (result.isAlreadyCheckedIn) {
      _setFinalState(
        text: kMsgAlreadyCheckedIn,
        kind: SnackKind.alreadyCheckedIn,
        showSnack: true,
      );
      return;
    }

    if (result.isSuccess) {
      _setFinalState(
        text: kMsgSuccess,
        kind: SnackKind.success,
        showSnack: true,
      );
      return;
    }

    _setFinalState(
      text: result.message.isNotEmpty ? result.message : kMsgFailure,
      kind: SnackKind.error,
      showSnack: true,
    );
  }

  void _setFinalState({
    required String text,
    required SnackKind kind,
    required bool showSnack,
  }) {
    if (!mounted) return;
    setState(() {
      _statusText = text;
      _statusKind = kind;
    });
    if (showSnack) {
      _showSnack(text, kind: kind);
    }
  }

  void _showSnack(String message, {required SnackKind kind}) {
    if (!mounted) return;

    final color = switch (kind) {
      SnackKind.sending => const Color(0xFF546E7A),
      SnackKind.pending => const Color(0xFF1565C0),
      SnackKind.success => const Color(0xFF1B8A3B),
      SnackKind.alreadyCheckedIn => const Color(0xFF8E24AA),
      SnackKind.error => const Color(0xFFC62828),
    };

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
                        'Nhập MSSV',
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
                            return 'Vui lòng nhập MSSV.';
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
                          child: const Text('Lưu MSSV'),
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
    final statusColor = switch (_statusKind) {
      SnackKind.sending => const Color(0xFF546E7A),
      SnackKind.pending => const Color(0xFF1565C0),
      SnackKind.success => const Color(0xFF1B8A3B),
      SnackKind.alreadyCheckedIn => const Color(0xFF8E24AA),
      SnackKind.error => const Color(0xFFC62828),
      null => const Color(0xFF0B76F6),
    };

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
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.93),
                      borderRadius: BorderRadius.circular(28),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.08),
                          blurRadius: 24,
                          offset: const Offset(0, 14),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        Text(
                          'MSSV: $_mssv',
                          style: Theme.of(context)
                              .textTheme
                              .titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 12),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 250),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: statusColor.withOpacity(0.10),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: statusColor.withOpacity(0.25)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              if (_isSending)
                                const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(strokeWidth: 2.2),
                                )
                              else
                                Icon(
                                  _statusKind == SnackKind.success
                                      ? Icons.check_circle_outline
                                      : _statusKind == SnackKind.alreadyCheckedIn
                                          ? Icons.info_outline
                                          : _statusKind == SnackKind.error
                                              ? Icons.error_outline
                                              : Icons.wifi_tethering,
                                  color: statusColor,
                                ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  _statusText.isNotEmpty ? _statusText : 'Sẵn sàng check-in',
                                  textAlign: TextAlign.center,
                                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                        color: statusColor,
                                        fontWeight: FontWeight.w700,
                                      ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),
                        SizedBox(
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
                                  ? const Column(
                                      key: ValueKey('sending'),
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        SizedBox(
                                          width: 24,
                                          height: 24,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 3,
                                            valueColor: AlwaysStoppedAnimation<Color>(
                                              Colors.white,
                                            ),
                                          ),
                                        ),
                                        SizedBox(height: 12),
                                        Text(
                                          'ĐANG XỬ LÝ...',
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
                        const SizedBox(height: 12),
                      ],
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
}
