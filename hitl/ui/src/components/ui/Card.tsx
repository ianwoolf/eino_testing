import { ReactNode } from 'react';
import { theme } from '../../theme/theme';

export interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

export const Card = ({
  children,
  className = '',
  padding = 'lg',
  hoverable = false,
}: CardProps) => {
  const paddingClasses: Record<string, string> = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
  };

  const classes = [
    theme.colors.background.card,
    'backdrop-blur',
    'border-slate-700/50',
    theme.borderRadius.lg,
    theme.shadows.lg,
    paddingClasses[padding],
    hoverable && 'hover:border-slate-500/50 cursor-pointer',
    theme.transitions.normal,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes}>{children}</div>;
};
