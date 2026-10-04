// ============================================================
// Màn hình quét QR liên kết (F-MOB-AUTH-01, F-MOB-AUTH-02)
// Đây là màn hình DUY NHẤT cho lần đầu — không có form đăng nhập.
// ============================================================

import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseLinkPayload, tokenSecondsLeft } from '@apes/shared-types';
import { useAuth } from '../context/AuthContext';
import { colors, font, radius, spacing } from '../theme';

export default function ScanScreen() {
  const { claimFromQr } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBarcode = async ({ data }: BarcodeScanningResult) => {
    if (scanning) return;
    setScanning(true);
    setError(null);

    try {
      const payload = parseLinkPayload(data);

      if (!payload) {
        throw new Error('Mã QR không đúng định dạng của APES Lab.');
      }

      const left = tokenSecondsLeft(payload);
      if (left === 0) {
        throw new Error('Mã QR đã hết hạn. Vui lòng quét lại mã mới trên Desktop.');
      }

      const result = await claimFromQr(payload.t);

      // Hiển thị thông tin SV để đối chiếu trước khi vào app
      Alert.alert(
        'Liên kết thành công',
        `Xin chào ${result.user.full_name}\nMSSV: ${result.user.mssv}\n\n` +
          (result.binding === 'created'
            ? 'Đã liên kết điện thoại này với tài khoản của bạn.'
            : result.binding === 'reset_rebind'
              ? 'Đã liên kết lại sau khi Trưởng Lab reset.'
              : 'Điện thoại này đã được liên kết trước đó.'),
        [{ text: 'Bắt đầu', onPress: () => {} }]
      );
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      Alert.alert('Không liên kết được', msg);
      // Cho phép quét lại sau 2 giây
      setTimeout(() => {
        setScanning(false);
        setError(null);
      }, 2000);
    }
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Đang yêu cầu quyền camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.title}>Cần quyền camera</Text>
          <Text style={styles.muted}>
            Ứng dụng cần camera để quét mã QR liên kết từ máy Desktop tại phòng Lab.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Cho phép camera</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>A</Text>
        </View>
        <Text style={styles.headerTitle}>APES Lab</Text>
        <Text style={styles.headerSub}>Điểm danh sinh viên</Text>
      </View>

      {/* Camera */}
      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanning ? undefined : handleBarcode}
        />

        {/* Khung ngắm */}
        <View pointerEvents="none" style={styles.frameOverlay}>
          <View style={styles.frame} />
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      {/* Hướng dẫn */}
      <View style={styles.footer}>
        <Text style={styles.footerTitle}>Quét mã QR từ Desktop tại Lab</Text>
        <Text style={styles.muted}>
          Mở ứng dụng APES Lab trên máy tính tại phòng thí nghiệm, nhập MSSV của
          bạn rồi quét mã QR hiển thị trên màn hình.
        </Text>

        <View style={styles.steps}>
          <Step n={1} text="Đến phòng Lab, mở máy tính kiosk" />
          <Step n={2} text="Nhập MSSV của bạn trên kiosk" />
          <Step n={3} text="Quét mã QR hiển thị bằng ứng dụng này" />
        </View>

        <Text style={styles.note}>
          ⚠ Ứng dụng này không có chức năng đăng nhập bằng mật khẩu. Bạn chỉ
          liên kết được một lần duy nhất.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  header: { alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.md },
  logo: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  headerTitle: { ...font.h3, marginTop: spacing.sm, color: colors.text },
  headerSub: { ...font.small, color: colors.textMuted },

  cameraWrap: { margin: spacing.lg, borderRadius: radius.xl, overflow: 'hidden' },
  camera: { height: 280 },
  frameOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 200,
    height: 200,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  errorBanner: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    backgroundColor: 'rgba(239,68,68,0.95)',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { ...font.small, color: '#fff', textAlign: 'center' },

  footer: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  footerTitle: { ...font.bodyMedium, marginBottom: spacing.xs },
  muted: { ...font.small, color: colors.textMuted, textAlign: 'center' },
  title: { ...font.h2, color: colors.text, textAlign: 'center' },

  steps: { marginTop: spacing.lg, gap: spacing.sm },
  step: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: { ...font.tiny, color: colors.primaryDark, fontWeight: '700' },
  stepText: { ...font.small, color: colors.text, flex: 1 },

  note: {
    ...font.tiny,
    color: colors.textFaint,
    marginTop: spacing.lg,
    textAlign: 'center',
    lineHeight: 16,
  },

  primaryBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  primaryBtnText: { color: '#fff', ...font.bodyMedium },
});
