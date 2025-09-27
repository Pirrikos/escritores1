import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  loading?: boolean;
  required?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    type = 'text',
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    fullWidth = false,
    loading = false,
    required = false,
    disabled,
    id,
    ...props
  }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperTextId = `${inputId}-helper`;
    
    const baseStyles = 'flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200';
    
    const stateStyles = error 
      ? 'border-red-500 focus:ring-red-500 focus-visible:ring-red-500' 
      : 'border-gray-300 focus:ring-blue-500 focus-visible:ring-blue-500';
    
    const iconPadding = leftIcon ? 'pl-10' : rightIcon || loading ? 'pr-10' : '';
    const isDisabled = disabled || loading;

    return (
      <div className={cn('space-y-2', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
              error && "text-red-700"
            )}
          >
            {label}
            {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true">
              {leftIcon}
            </div>
          )}
          
          <input
            type={type}
            className={cn(
              baseStyles,
              stateStyles,
              iconPadding,
              loading && 'cursor-wait',
              className
            )}
            ref={ref}
            id={inputId}
            disabled={isDisabled}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={cn(
              error && errorId,
              helperText && helperTextId
            )}
            aria-required={required}
            {...props}
          />
          
          {loading && (
            <div className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" aria-hidden="true">
              <svg
                className="animate-spin h-4 w-4 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
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
            </div>
          )}
          
          {!loading && rightIcon && (
            <div className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true">
              {rightIcon}
            </div>
          )}
        </div>
        
        {(error || helperText) && (
          <p 
            id={error ? errorId : helperTextId}
            className={cn(
              'text-sm',
              error ? 'text-red-600' : 'text-gray-600'
            )}
            role={error ? 'alert' : undefined}
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;