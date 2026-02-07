/**
 * HITL UI Design System Theme
 * Provides a consistent, technical, and modern look across all components
 */

export const theme = {
  text: {
    primary: 'text-white',
    secondary: 'text-slate-300',
    tertiary: 'text-slate-400',
    muted: 'text-slate-500',
  },

  border: {
    default: 'border-slate-700/50',
    focus: 'border-blue-500',
    hover: 'border-slate-500/50',
  },

  colors: {
    // Primary brand colors
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
      800: '#1e40af',
      900: '#1e3a8a',
      950: '#172554',
    },

    // Status colors
    status: {
      success: {
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/30',
        text: 'text-emerald-400',
        solid: 'bg-emerald-600',
        solidHover: 'hover:bg-emerald-700',
        glow: 'shadow-emerald-500/25',
      },
      error: {
        bg: 'bg-red-500/10',
        border: 'border-red-500/30',
        text: 'text-red-400',
        solid: 'bg-red-600',
        solidHover: 'hover:bg-red-700',
        glow: 'shadow-red-500/25',
      },
      warning: {
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/30',
        text: 'text-amber-400',
        solid: 'bg-amber-600',
        solidHover: 'hover:bg-amber-700',
        glow: 'shadow-amber-500/25',
      },
      info: {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30',
        text: 'text-blue-400',
        solid: 'bg-blue-600',
        solidHover: 'hover:bg-blue-700',
        glow: 'shadow-blue-500/25',
      },
      neutral: {
        bg: 'bg-slate-500/10',
        border: 'border-slate-500/30',
        text: 'text-slate-400',
        solid: 'bg-slate-600',
        solidHover: 'hover:bg-slate-700',
        glow: 'shadow-slate-500/25',
      },
      pending: {
        bg: 'bg-orange-500/10',
        border: 'border-orange-500/30',
        text: 'text-orange-400',
        solid: 'bg-orange-600',
        solidHover: 'hover:bg-orange-700',
        glow: 'shadow-orange-500/25',
      },
    },

    // Base colors
    background: {
      primary: 'bg-slate-950',
      secondary: 'bg-slate-900',
      tertiary: 'bg-slate-800/50',
      card: 'bg-slate-800/50',
      input: 'bg-slate-900/50',
    },
  },

  spacing: {
    xs: '0.25rem',    // 4px
    sm: '0.5rem',     // 8px
    md: '0.75rem',    // 12px
    lg: '1rem',       // 16px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '2rem',    // 32px
  },

  borderRadius: {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  },

  fontSize: {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
  },

  fontWeight: {
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  },

  shadows: {
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg',
    xl: 'shadow-xl',
  },

  transitions: {
    default: 'transition-all',
    fast: 'transition-all duration-150',
    normal: 'transition-all duration-200',
    slow: 'transition-all duration-300',
  },
} as const;

export type Theme = typeof theme;

// Status type for components
export type Status = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'pending';

// Helper function to get status styles
export const getStatusStyles = (status: Status) => {
  return theme.colors.status[status];
};

// Button size variants
export type ButtonSize = 'sm' | 'md' | 'lg';

// Button variant types
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning';
