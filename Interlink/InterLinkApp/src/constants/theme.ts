/**
 * Interlink Design Tokens & Global Theme
 * Canonical colors, typography, spacing, radii, and shadows matching Interlink UI specifications.
 */

export const theme = {
  colors: {
    // Brand & Primary
    primary: '#17365D',        // Deep navy (brand header / high-trust elements)
    primaryHover: '#102642',
    primaryLight: '#234a7a',
    accent: '#2878C7',         // Active vibrant blue
    accentHover: '#1E63A8',
    blue: '#2563EB',           // Vibrant interactive blue (buttons, primary highlights)
    blueHover: '#1D4ED8',
    cyan: '#06B6D4',
    sky: '#38BDF8',

    // Deep Dark Space Backgrounds (Frontend Login exact palette)
    bgDarkGradientStart: '#06152D',
    bgDarkGradientMid: '#020617',
    bgDarkGradientEnd: '#0B1B36',

    // Canvas & Surfaces (Light mode / Main screens)
    canvas: '#F6F8FB',
    surface: '#FFFFFF',
    surfaceHover: '#F8FAFC',
    surfaceDark: 'rgba(15, 23, 42, 0.65)',
    surfaceDarkSolid: '#0F172A',
    surfaceDarker: '#090D16',

    // Borders
    border: '#E2E8F0',
    borderSubtle: '#EDF2F7',
    borderDark: '#1E293B',
    borderDarkGlow: 'rgba(59, 130, 246, 0.25)',

    // Typography
    textPrimary: '#17212F',
    textSecondary: '#5B6573',
    textMuted: '#94A3B8',
    textWhite: '#FFFFFF',
    textWhiteSecondary: '#94A3B8',
    textWhiteMuted: '#64748B',

    // Semantic Status
    success: '#10B981',
    successLight: 'rgba(16, 185, 129, 0.12)',
    warning: '#F59E0B',
    warningLight: 'rgba(245, 158, 11, 0.12)',
    danger: '#EF4444',
    dangerLight: 'rgba(239, 68, 68, 0.12)',
    info: '#3B82F6',
    infoLight: 'rgba(59, 130, 246, 0.12)',

    // Glow overlays
    ambientGlow1: 'rgba(37, 99, 235, 0.18)',
    ambientGlow2: 'rgba(56, 189, 248, 0.12)',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
    huge: 48,
  },

  radii: {
    xs: 4,
    sm: 6,
    md: 10,
    lg: 14,
    xl: 20,
    xxl: 24,
    full: 9999,
  },

  typography: {
    fontFamily: 'System',
    sizes: {
      xxs: 10,
      xs: 11,
      sm: 13,
      md: 15,
      lg: 17,
      xl: 20,
      xxl: 24,
      xxxl: 30,
      hero: 36,
    },
    weights: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
      heavy: '800' as const,
      black: '900' as const,
    },
  },

  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 15,
      elevation: 8,
    },
    blueGlow: {
      shadowColor: '#2563EB',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 6,
    },
  },
};

export type Theme = typeof theme;
