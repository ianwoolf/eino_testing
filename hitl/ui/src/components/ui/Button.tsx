import { ButtonVariant, ButtonSize, theme } from '../../theme/theme';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) => {
  const baseClasses = 'font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-50';

  const variantClasses: Record<ButtonVariant, string> = {
    primary: `bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 ${theme.colors.status.info.glow} shadow-lg`,
    secondary: `bg-slate-700 text-white hover:bg-slate-600 focus:ring-slate-500`,
    success: `bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 ${theme.colors.status.success.glow} shadow-lg`,
    danger: `bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 ${theme.colors.status.error.glow} shadow-lg`,
    warning: `bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500 ${theme.colors.status.warning.glow} shadow-lg`,
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  };

  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    theme.transitions.normal,
    fullWidth && 'w-full',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
};
