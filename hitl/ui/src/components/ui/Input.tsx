import { InputHTMLAttributes, forwardRef } from 'react';
import { theme } from '../../theme/theme';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    const inputClasses = [
      'w-full',
      theme.colors.background.input,
      theme.text.primary,
      theme.borderRadius.md,
      theme.border.default,
      'px-4 py-2.5',
      'focus:outline-none',
      'focus:border-blue-500',
      'focus:ring-2',
      'focus:ring-blue-500/20',
      theme.transitions.normal,
      error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="space-y-2">
        {label && (
          <label className={`block ${theme.text.secondary} text-sm font-medium`}>
            {label}
          </label>
        )}
        <input ref={ref} className={inputClasses} {...props} />
        {error && <p className={`text-red-400 text-sm ${error ? 'flex items-center gap-1' : ''}`}>{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
