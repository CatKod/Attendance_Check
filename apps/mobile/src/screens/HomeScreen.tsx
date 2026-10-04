// ============================================================
// Màn hình chính - Điểm danh (F-MOB-ATT-01..06)
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCheckinStatus } from '@apes/shared-types';
import { useAuth } from '../context/AuthContext';
import { checkAttendance, ApiError } from '../api';
import { getNetworkInfo, type PhoneNetworkInfo } from '../network';
import { colors, font, radius, spacing } from '../theme';

const ROLE_LABEL: Record<string, string> = {
  student: 'Sinh viên',
  group_leader: 'Trưởng nhóm',
  lab_leader: 'Trưởng Lab',
  lab_manager: 'Chủ nghiệm Lab',
};

export default function HomeScreen() {
  const { session, windows, refresh } = useAuth();
  const [net, setNet] = useState<PhoneNetworkInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState<{ time: string; ssid?: string } | null>(null);

  const loadNetwork = useCallback(async () => {
    try {
      setNet(await getNetworkInfo());
    } catch {
      setNet(null);
    }
  }, []);

  useEffect(() => {
    void loadNetwork();
    void refresh();
  }, [loadNetwork, refresh]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadNetwork(), refresh()]);
    setRefreshing(false);
  }, [loadNetwork, refresh]);

  const status = getCheckinStatus(windows);
  const canAttend = status.state === 'open';

  // ------------------------------------------------------------
  // Điểm danh
  // ------------------------------------------------------------
  const doCheckin = useCallback(async () => {
    if (!session || busy) return;
    setBusy(true);

    try {
      // 1) Kiểm tra mạng (F-MOB-ATT-06: chỉ chấp nhận Wi-Fi)
      const info = await getNetworkInfo();
      setNet(info);

      if (info.isCellular) {
        throw new ApiError(
          'Bạn đang dùng dữ liệu di động (4G/5G). Vui lòng kết nối Wi-Fi Lab.',
          'CELLULAR',
          0
        );
      }

      if (!info.isWifi) {
        throw new ApiError(
          'Chưa kết nối Wi-Fi Lab. Vui lòng kết nối để điểm danh.',
          'NO_WIFI',
          0
        );
      }

      if (!info.ip) {
        throw new ApiError(
          'Không lấy được địa chỉ IP của thiết bị.',
          'NO_IP',
          0
        );
      }

      // 2) Gửi lên server
      const res = await checkAttendance({
        userId: session.userId,
        ip: info.ip,
        deviceId: session.deviceId,
      });

      if (res.success) {
        setDone({ time: res.time ?? '', ssid: res.wifi_ssid });
      } else if (res.already_attended) {
        setDone({ time: res.time ?? '' });
        Alert.alert('Đã điểm danh', res.warning ?? 'Bạn đã điểm danh hôm nay rồy.');
      }
    } catch (e) {
      if (e instanceof ApiError) {
        let msg = e.message;
        if (e.todayWindows && e.todayWindows.length > 0) {
          msg += `\n\nHôm nay điểm danh: ${e.todayWindows
            .map((w) => w.label)
            .join(' · ')}`;
        }
        Alert.alert('Không điểm danh được', msg);
      } else {
        Alert.alert('Lỗi', (e as Error).message);
      }
      void loadNetwork();
    } finally {
      setBusy(false);
    }
  }, [session, busy, loadNetwork]);

  if (!session) return null;

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {session.fullName.charAt(0)}
            </Text>
          </View>
          <Text style={styles.name}>{session.fullName}</Text>
          <Text style={styles.sub}>
            {session.mssv} · {session.khoa}
            {session.groupName ? ` · ${session.groupName}` : ''}
          </Text>
          <Text style={styles.role}>{ROLE_LABEL[session.role] ?? session.role}</Text>
        </View>

        {/* Trạng thái mạng */}
        <View style={styles.netRow}>
          <View
            style={[
              styles.netPill,
              {
                backgroundColor: net?.isWifi
                  ? colors.successLight
                  : net?.isCellular
                    ? colors.warningLight
                    : colors.dangerLight,
              },
            ]}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: net?.isWifi
                    ? colors.success
                    : net?.isCellular
                      ? colors.warning
                      : colors.danger,
                },
              ]}
            />
            <Text
              style={[
                styles.netText,
                {
                  color: net?.isWifi
                    ? colors.successDark
                    : net?.isCellular
                      ? colors.warning
                      : colors.danger,
                },
              ]}
            >
              {net?.isWifi
                ? 'Wi-Fi Lab'
                : net?.isCellular
                  ? 'Dữ liệu di động'
                  : 'Không có mạng'}
            </Text>
          </View>
          {net?.ip && <Text style={styles.ip}>{net.ip}</Text>}
        </View>

        {/* Kết quả điểm danh */}
        {done && (
          <View style={styles.successCard}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>Điểm danh thành công</Text>
            <Text style={styles.successTime}>{done.time}</Text>
            {done.ssid && <Text style={styles.successSsid}>{done.ssid}</Text>}
          </View>
        )}

        {/* Nút điểm danh */}
        {!done && (
          <>
            {canAttend ? (
              <TouchableOpacity
                style={[styles.checkinBtn, busy && styles.btnDisabled]}
                onPress={doCheckin}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#fff" size="large" />
                ) : (
                  <>
                    <Text style={styles.checkinBtnText}>ĐIỂM DANH</Text>
                    <Text style={styles.checkinBtnSub}>
                      {status.current?.label}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.closedCard}>
                <Text style={styles.closedTitle}>{status.message}</Text>
                {status.all.length > 0 && (
                  <Text style={styles.closedWindows}>
                    {status.all.map((w) => w.label).join('  ·  ')}
                  </Text>
                )}
                {status.state === 'upcoming' && status.next && (
                  <Text style={styles.upcomingHint}>
                    Còn {status.minutesToNext} phút nữa mở điểm danh
                  </Text>
                )}
              </View>
            )}
          </>
        )}

        {/* Lịch điểm danh hôm nay */}
        {status.all.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lịch điểm danh hôm nay</Text>
            {status.all.map((w) => {
              const isCurrent = status.current?.label === w.label;
              return (
                <View key={w.label} style={styles.windowRow}>
                  <View
                    style={[
                      styles.windowDot,
                      {
                        backgroundColor: isCurrent
                          ? colors.success
                          : colors.borderStrong,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.windowLabel,
                      isCurrent && { color: colors.successDark, fontWeight: '700' },
                    ]}
                  >
                    {w.label}
                  </Text>
                  {isCurrent && (
                    <View style={styles.openBadge}>
                      <Text style={styles.openBadgeText}>Đang mở</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Lưu ý */}
        <Text style={styles.footnote}>
          Điểm danh chỉ thành công khi kết nối đúng Wi-Fi Lab và trong khung giờ
          được mở. Mỗi ngày chỉ điểm danh được 1 lần.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  header: { alignItems: 'center', marginTop: spacing.md },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 30, fontWeight: '800', color: colors.primaryDark },
  name: { ...font.h2, marginTop: spacing.md, color: colors.text },
  sub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  role: { ...font.tiny, color: colors.textFaint, marginTop: 2 },

  netRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  netPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  netText: { ...font.tiny, fontWeight: '700' },
  ip: { ...font.tiny, color: colors.textFaint, fontFamily: 'monospace' },

  successCard: {
    backgroundColor: colors.successLight,
    borderRadius: radius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  successTitle: {
    ...font.bodyMedium,
    color: colors.successDark,
    marginTop: spacing.md,
  },
  successTime: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.successDark,
    marginTop: 4,
  },
  successSsid: { ...font.tiny, color: colors.successDark, marginTop: 2 },

  checkinBtn: {
    backgroundColor: colors.success,
    borderRadius: radius.xl,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.xl,
    shadowColor: colors.success,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  checkinBtnText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  checkinBtnSub: { ...font.small, color: 'rgba(255,255,255,0.85)', marginTop: 4 },

  closedCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  closedTitle: { ...font.bodyMedium, color: colors.text, textAlign: 'center' },
  closedWindows: {
    ...font.small,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontFamily: 'monospace',
  },
  upcomingHint: { ...font.tiny, color: colors.warning, marginTop: spacing.md },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  cardTitle: { ...font.bodyMedium, color: colors.text, marginBottom: spacing.md },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 6,
  },
  windowDot: { width: 8, height: 8, borderRadius: 4 },
  windowLabel: {
    ...font.small,
    color: colors.textMuted,
    fontFamily: 'monospace',
    flex: 1,
  },
  openBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  openBadgeText: { ...font.tiny, color: colors.successDark, fontWeight: '700' },

  footnote: {
    ...font.tiny,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 16,
  },
});
