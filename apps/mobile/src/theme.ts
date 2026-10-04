// ============================================================
// Theme cho Mobile App
// ============================================================

export const colors = {
  primary: '#f04030',
  primaryDark: '#d63324',
  primaryLight: '#fee2e0',

  success: '#10b981',
  successLight: '#d1fae5',
  successDark: '#047857',

  warning: '#f59e0b',
  warningLight: '#fef3c7',

  danger: '#ef4444',
  dangerLight: '#fee2e2',

  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',

  text: '#0f172a',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  textInverse: '#ffffff',
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const font = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyMedium: { fontSize: 15, fontWeight: '600' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  tiny: { fontSize: 11, fontWeight: '500' as const },
};
