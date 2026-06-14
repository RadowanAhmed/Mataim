// Premium dark theme for driver app
export const COLORS = {
  // Base background colors
  dark_primary: '#1E1E24',        // Main dark background
  dark_secondary: '#2A2A33',      // Card/elevated surfaces
  dark_tertiary: '#3A3A44',       // Borders and subtle dividers

  // Accent colors (chosen for high contrast + premium feel)
  accent_primary: '#FF5722',      // Deep Orange - primary actions, buttons
  accent_secondary: '#673AB7',    // Deep Purple - secondary actions, highlights

  // Alternative accent combinations (for future use)
  accent_electric_blue: '#1E90FF',
  accent_neon_green: '#00FF85',

  // Text colors
  text_primary: '#F7F7F7',         // Main text (off-white)
  text_secondary: '#D1D1D6',       // Secondary/dimmed text
  text_tertiary: '#9CA3AF',        // Disabled/hint text
  text_white: '#FFFFFF',           // Pure white for contrast

  // Status colors
  status_success: '#10B981',       // Green - success, delivered
  status_warning: '#FBBF24',       // Amber - warning
  status_error: '#EF4444',         // Red - error, cancelled
  status_info: '#3B82F6',          // Blue - info, in progress

  // Semantic colors
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Transparencies (for overlays)
  overlay_light: 'rgba(255, 255, 255, 0.1)',
  overlay_dark: 'rgba(0, 0, 0, 0.3)',
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const BORDER_RADIUS = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 999,
} as const;

export const TYPOGRAPHY = {
  // Headings
  h1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700' as const,
  },
  h2: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700' as const,
  },
  h3: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '600' as const,
  },
  h4: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  // Body text
  body_lg: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400' as const,
  },
  body_base: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400' as const,
  },
  body_sm: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400' as const,
  },
  // Labels
  label_lg: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  label_base: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
  },
  label_sm: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600' as const,
  },
  // Caption
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400' as const,
  },
} as const;

export const SHADOWS = {
  // iOS shadows
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  // Android elevation (unified with iOS-like appearance)
  elevation_sm: 2,
  elevation_md: 4,
  elevation_lg: 8,
} as const;
