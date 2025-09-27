import React, { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  autoResize?: boolean;
  minRows?: number;
  maxRows?: number;
  fullWidth?: boolean;
  loading?: boolean;
  required?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({
    className,
    label,
    error,
    helperText,
    autoResize = false,
    minRows = 3,
    maxRows = 10,
    fullWidth = false,
    loading = false,
    required = false,
    disabled,
    id,
    onChange,
    value,
    ...props
  }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperTextId = `${inputId}-helper`;
    
    const baseStyles = 'flex min-h-[80px] w-full rounded-md border bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-colors duration-200';
    
    const stateStyles = error 
      ? 'border-red-500 focus:ring-red-500 focus-visible:ring-red-500' 
      : 'border-gray-300 focus:ring-blue-500 focus-visible:ring-blue-500';

    const isDisabled = disabled || loading;

    // Auto-resize functionality
    const adjustHeight = () => {
      const textarea = textareaRef.current;
      if (!textarea || !autoResize) return;

      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      
      // Calculate the new height
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      const minHeight = lineHeight * minRows;
      const maxHeight = lineHeight * maxRows;
      
      // Set the new height within bounds
      const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;
    };

    // Handle change with auto-resize
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (onChange) {
        onChange(e);
      }
      adjustHeight();
    };

    // Adjust height on value change
    useEffect(() => {
      adjustHeight();
    }, [value, autoResize]);

    // Adjust height on mount
    useEffect(() => {
      adjustHeight();
    }, []);

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
          <textarea
            className={cn(
              baseStyles,
              stateStyles,
              loading && 'cursor-wait',
              className
            )}
            ref={(node) => {
              textareaRef.current = node;
              if (typeof ref === 'function') {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
            }}
            id={inputId}
            disabled={isDisabled}
            onChange={handleChange}
            value={value}
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={cn(
              error && errorId,
              helperText && helperTextId
            )}
            aria-required={required}
            {...props}
          />
          
          {loading && (
            <div className="absolute right-3 top-3 h-4 w-4" aria-hidden="true">
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

Textarea.displayName = 'Textarea';

export default Textarea;