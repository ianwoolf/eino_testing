import { Status, getStatusStyles } from '../../theme/theme';

export interface StatusIndicatorProps {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export const StatusIndicator = ({
  status,
  size = 'md',
  showLabel = false,
  label,
  className = '',
}: StatusIndicatorProps) => {
  const styles = getStatusStyles(status);

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  };

  const dotClasses = [
    'rounded-full',
    sizeClasses[size],
    styles.solid,
    (status as string) === 'running' && 'animate-pulse',
    'shadow-lg',
    styles.glow,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={dotClasses} />
      {showLabel && <span className={`${styles.text} text-sm font-medium`}>{label || status}</span>}
    </div>
  );
};

// Node status indicator for workflow graph
export interface NodeStatusProps {
  status: 'pending' | 'running' | 'completed' | 'interrupted';
  showLabel?: boolean;
  className?: string;
}

export const NodeStatusIndicator = ({ status, showLabel = false, className = '' }: NodeStatusProps) => {
  const statusConfig: Record<string, { color: string; bgColor: string; borderColor: string }> = {
    pending: {
      color: 'fill-slate-800 stroke-slate-600',
      bgColor: 'bg-slate-800',
      borderColor: 'border-slate-600',
    },
    running: {
      color: 'fill-blue-600 stroke-blue-400',
      bgColor: 'bg-blue-600',
      borderColor: 'border-blue-400',
    },
    completed: {
      color: 'fill-emerald-600 stroke-emerald-400',
      bgColor: 'bg-emerald-600',
      borderColor: 'border-emerald-400',
    },
    interrupted: {
      color: 'fill-amber-500 stroke-amber-300',
      bgColor: 'bg-amber-500',
      borderColor: 'border-amber-300',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`w-3.5 h-3.5 border-2 rounded ${config.bgColor} ${config.borderColor} shadow-lg`} />
      {showLabel && <span className="text-xs text-slate-400 capitalize">{status}</span>}
    </div>
  );
};
