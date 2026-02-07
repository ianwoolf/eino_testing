import { Status, getStatusStyles } from '../../theme/theme';

export interface BadgeProps {
  status: Status;
  children: React.ReactNode;
  className?: string;
}

export const Badge = ({ status, children, className = '' }: BadgeProps) => {
  const styles = getStatusStyles(status);

  const classes = [
    'px-2.5 py-1 rounded-md text-xs font-medium',
    styles.bg,
    styles.border,
    styles.text,
    'border',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{children}</span>;
};

// Status badge with predefined labels
export interface StatusBadgeProps {
  status: 'completed' | 'error' | 'interrupted' | 'pending' | 'running';
  className?: string;
}

export const StatusBadge = ({ status, className = '' }: StatusBadgeProps) => {
  const statusMap: Record<string, Status> = {
    completed: 'success',
    error: 'error',
    interrupted: 'warning',
    pending: 'pending',
    running: 'info',
  };

  return (
    <Badge status={statusMap[status]} className={className}>
      {status}
    </Badge>
  );
};
