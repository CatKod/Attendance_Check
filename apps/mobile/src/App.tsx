// ============================================================
// Root component - quyết định màn hình nào hiển thị
//
// F-MOB-AUTH-06: Từ lần thứ 2 trở đi tự động vào màn hình chính
// ============================================================

import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './context/AuthContext';
import ScanScreen from './screens/ScanScreen';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import { colors, font, spacing } from './theme';

type Tab = 'home' | 'profile';

function Shell() {
  const { ready, session } = useAuth();
  const [tab, setTab] = useState<Tab>('home');

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Đang kiểm tra liên kết...</Text>
      </View>
    );
  }

  // Chưa liên kết → màn quét QR
  if (!session) {
    return <ScanScreen />;
  }

  // Đã liên kết → app chính (F-MOB-AUTH-06: auto-login)
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {tab === 'home' ? <HomeScreen /> : <ProfileScreen />}
      </View>

      {/* Tab bar — KHÔNG có nút đăng xuất (F-MOB-AUTH-07) */}
      <View style={styles.tabBar}>
        <TabButton
          active={tab === 'home'}
          onPress={() => setTab('home')}
          icon="✓"
          label="Điểm danh"
        />
        <TabButton
          active={tab === 'profile'}
          onPress={() => setTab('profile')}
          icon="👤"
          label="Cá nhân"
        />
      </View>
    </View>
  );
}

function TabButton({
  active,
  onPress,
  icon,
  label,
}: {
  active: boolean;
  onPress: () => void;
  icon: string;
  label: string;
}) {
  return (
    <TouchableOpacity
      style={styles.tabBtn}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={styles.tabIcon}>{icon}</Text>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
      {active && <View style={styles.tabIndicator} />}
    </TouchableOpacity>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <Shell />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1 },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: spacing.md,
  },
  loadingText: { ...font.small, color: colors.textMuted },

  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.card,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    position: 'relative',
  },
  tabIcon: { fontSize: 20 },
  tabLabel: { ...font.tiny, color: colors.textFaint, marginTop: 2 },
  tabLabelActive: { color: colors.primary, fontWeight: '700' },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});
