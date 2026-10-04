// ============================================================
// Màn hình thông tin cá nhân (F-MOB-PROF-01..04)
// Chỉ đọc — không sửa, không đăng xuất.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getNetworkInfo, type PhoneNetworkInfo } from '../network';
import { colors, font, radius, spacing } from '../theme';

const ROLE_LABEL: Record<string, string> = {
  student: 'Sinh viên',
  group_leader: 'Trưởng nhóm',
  lab_leader: 'Trưởng Lab',
  lab_manager: 'Chủ nghiệm Lab',
};

interface AttendanceRow {
  id: string;
  check_in_time: string;
  method: string;
  ip_address: string | null;
}

export default function ProfileScreen() {
  const { session, supabase } = useAuth();
  const [net, setNet] = useState<PhoneNetworkInfo | null>(null);
  const [history, setHistory] = useState<AttendanceRow[]>([]);
  const [stats, setStats] = useState<{ total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    try {
      setNet(await getNetworkInfo());

      if (supabase) {
        const { data } = await supabase
          .from('attendance')
          .select('id, check_in_time, method, ip_address')
          .order('check_in_time', { ascending: false })
          .limit(30);

        setHistory((data as AttendanceRow[]) ?? []);

        const { count } = await supabase
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.userId);

        setStats({ total: count ?? 0 });
      }
    } catch {
      /* im lặng */
    } finally {
      setLoading(false);
    }
  }, [session, supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (!session) return null;

  const linkedAt = new Date(session.linkedAt).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.pageTitle}>Thông tin cá nhân</Text>

        {/* Hồ sơ */}
        <View style={styles.card}>
          <View style={styles.profileHead}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {session.fullName.charAt(0)}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.name}>{session.fullName}</Text>
              <Text style={styles.mssv}>{session.mssv}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>
                  {ROLE_LABEL[session.role] ?? session.role}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <InfoRow label="Họ tên" value={session.fullName} />
          <InfoRow label="MSSV" value={session.mssv} mono />
          <InfoRow label="Khoa" value={session.khoa} />
          <InfoRow label="Nhóm" value={session.groupName ?? 'Chưa phân nhóm'} />
        </View>

        {/* Thống kê */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tổng quan chuyên cần</Text>
          <View style={styles.statsRow}>
            <StatBox
              label="Đã điểm danh"
              value={stats?.total ?? 0}
              tone="success"
            />
            <StatBox
              label="Tỷ lệ có mặt"
              value={`${stats && stats.total > 0 ? 100 : 0}%`}
              tone="primary"
            />
          </View>
        </View>

        {/* Thiết bị liên kết (F-MOB-PROF-03) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thiết bị đã liên kết</Text>

          <DeviceRow
            kind="Desktop"
            value={net?.deviceModel ?? '—'}
            detail="Liên kết qua máy kiosk tại Lab"
          />
          <View style={styles.divider} />
          <DeviceRow
            kind="Mobile"
            value={net?.deviceModel || 'Điện thoại này'}
            detail={`Liên kết ngày ${linkedAt}`}
          />
          <View style={styles.divider} />
          <DeviceRow
            kind="Device ID"
            value={session.deviceId}
            detail="Định danh thiết bị"
            mono
          />
        </View>

        {/* Lịch sử (F-MOB-HIS-04) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lịch sử điểm danh</Text>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : history.length === 0 ? (
            <Text style={styles.empty}>Chưa có lịch sử điểm danh</Text>
          ) : (
            history.map((row) => {
              const d = new Date(row.check_in_time);
              const time = d.toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Ho_Chi_Minh',
              });
              const date = d.toLocaleDateString('vi-VN', {
                weekday: 'short',
                day: '2-digit',
                month: '2-digit',
                timeZone: 'Asia/Ho_Chi_Minh',
              });

              return (
                <View key={row.id} style={styles.historyRow}>
                  <View style={styles.historyDot} />
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyDate}>{date}</Text>
                    <Text style={styles.historyMethod}>
                      {row.method === 'desktop'
                        ? 'Máy tính Lab'
                        : row.method === 'mobile_wifi'
                          ? 'Điện thoại (Wi-Fi)'
                          : 'Thủ công'}
                      {row.ip_address ? ` · ${row.ip_address}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.historyTime}>{time}</Text>
                </View>
              );
            })
          )}
        </View>

        {/* Bảo mật */}
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            🔒 Ứng dụng không có chức năng đăng xuất. Nếu bạn mất điện thoại hoặc
            bị mất tài khoản, vui lòng liên hệ Trưởng Lab để được reset.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

function DeviceRow({
  kind,
  value,
  detail,
  mono,
}: {
  kind: string;
  value: string;
  detail: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.deviceRow}>
      <View style={styles.deviceIcon}>
        <Text style={styles.deviceIconText}>
          {kind === 'Desktop' ? '🖥' : kind === 'Mobile' ? '📱' : '🔑'}
        </Text>
      </View>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceKind}>{kind}</Text>
        <Text style={[styles.deviceValue, mono && styles.mono]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.deviceDetail}>{detail}</Text>
      </View>
    </View>
  );
}

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: 'success' | 'primary';
}) {
  return (
    <View style={styles.statBox}>
      <Text
        style={[
          styles.statValue,
          { color: tone === 'success' ? colors.success : colors.primary },
        ]}
      >
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  pageTitle: { ...font.h1, color: colors.text, marginBottom: spacing.lg },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cardTitle: { ...font.bodyMedium, color: colors.text, marginBottom: spacing.md },

  profileHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 26, fontWeight: '800', color: colors.primaryDark },
  profileInfo: { flex: 1 },
  name: { ...font.h3, color: colors.text },
  mssv: { ...font.small, color: colors.textMuted, fontFamily: 'monospace' },
  roleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 4,
  },
  roleBadgeText: { ...font.tiny, color: colors.primaryDark, fontWeight: '700' },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: spacing.md,
  },
  infoLabel: { ...font.small, color: colors.textMuted },
  infoValue: {
    ...font.small,
    color: colors.text,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  mono: { fontFamily: 'monospace', fontSize: 11 },

  statsRow: { flexDirection: 'row', gap: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  statValue: { fontSize: 28, fontWeight: '800' },
  statLabel: { ...font.tiny, color: colors.textMuted, marginTop: 2 },

  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceIconText: { fontSize: 18 },
  deviceInfo: { flex: 1 },
  deviceKind: { ...font.tiny, color: colors.textFaint },
  deviceValue: { ...font.small, color: colors.text, fontWeight: '600' },
  deviceDetail: { ...font.tiny, color: colors.textFaint },

  loader: { marginVertical: spacing.lg },
  empty: {
    ...font.small,
    color: colors.textFaint,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  historyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  historyInfo: { flex: 1 },
  historyDate: { ...font.small, color: colors.text, fontWeight: '600' },
  historyMethod: { ...font.tiny, color: colors.textFaint },
  historyTime: { ...font.small, color: colors.textMuted, fontFamily: 'monospace' },

  notice: { backgroundColor: colors.warningLight, borderRadius: radius.md, padding: spacing.md },
  noticeText: { ...font.tiny, color: '#92400e', lineHeight: 16 },
});
