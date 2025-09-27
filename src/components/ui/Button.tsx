import React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant = 'primary',
    size = 'md',
    loading = false,
    error = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    loadingText,
    children,
    disabled,
    ...props
  }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    const variants = {
      primary: error 
        ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 focus-visible:ring-red-500 shadow-sm hover:shadow-md'
        : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 focus-visible:ring-blue-500 shadow-sm hover:shadow-md',
      secondary: error
        ? 'bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-500 focus-visible:ring-red-500 border border-red-300'
        : 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 focus-visible:ring-gray-500 border border-gray-300',
      outline: error
        ? 'border border-red-300 bg-transparent text-red-700 hover:bg-red-50 focus:ring-red-500 focus-visible:ring-red-500'
        : 'border border-gray-300 bg-transparent text-gray-700 hover:bg-gray-50 focus:ring-gray-500 focus-visible:ring-gray-500',
      ghost: error
        ? 'bg-transparent text-red-700 hover:bg-red-100 focus:ring-red-500 focus-visible:ring-red-500'
        : 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500 focus-visible:ring-gray-500',
      destructive: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 focus-visible:ring-red-500 shadow-sm hover:shadow-md'
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm gap-1.5',
      md: 'px-4 py-2 text-sm gap-2',
      lg: 'px-6 py-2.5 text-base gap-2',
      xl: 'px-8 py-3 text-lg gap-2.5'
    };

    const isDisabled = disabled || loading;
    const displayText = loading && loadingText ? loadingText : children;

    return (
      <button
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          loading && 'cursor-wait',
          className
        )}
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {!loading && leftIcon && <span className="flex-shrink-0" aria-hidden="true">{leftIcon}</span>}
        <span>{displayText}</span>
        {!loading && rightIcon && <span className="flex-shrink-0" aria-hidden="true">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export default Button;