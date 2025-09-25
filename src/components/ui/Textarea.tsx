import React, { forwardRef } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  variant?: 'default' | 'filled' | 'outlined';
  fullWidth?: boolean;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ 
    label, 
    error, 
    helperText, 
    variant = 'default', 
    fullWidth = false,
    resize = 'vertical',
    className = '', 
    ...props 
  }, ref) => {
    const baseClasses = `
      px-3 py-2 text-sm transition-colors duration-200
      border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
      disabled:opacity-50 disabled:cursor-not-allowed
      min-h-[80px]
    `;

    const variantClasses = {
      default: `
        border-gray-300 bg-white text-gray-900
        hover:border-gray-400 focus:border-blue-500
        dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100
        dark:hover:border-gray-500 dark:focus:border-blue-400
      `,
      filled: `
        border-transparent bg-gray-100 text-gray-900
        hover:bg-gray-200 focus:bg-white focus:border-blue-500
        dark:bg-gray-700 dark:text-gray-100
        dark:hover:bg-gray-600 dark:focus:bg-gray-800 dark:focus:border-blue-400
      `,
      outlined: `
        border-2 border-gray-300 bg-transparent text-gray-900
        hover:border-gray-400 focus:border-blue-500
        dark:border-gray-600 dark:text-gray-100
        dark:hover:border-gray-500 dark:focus:border-blue-400
      `
    };

    const resizeClasses = {
      none: 'resize-none',
      vertical: 'resize-y',
      horizontal: 'resize-x',
      both: 'resize'
    };

    const errorClasses = error ? `
      border-red-500 focus:border-red-500 focus:ring-red-500
      dark:border-red-400 dark:focus:border-red-400 dark:focus:ring-red-400
    ` : '';

    const widthClasses = fullWidth ? 'w-full' : '';

    const textareaClasses = `
      ${baseClasses}
      ${variantClasses[variant]}
      ${errorClasses}
      ${widthClasses}
      ${resizeClasses[resize]}
      ${className}
    `.replace(/\s+/g, ' ').trim();

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={textareaClasses}
          {...props}
        />
        {(error || helperText) && (
          <p className={`mt-1 text-xs ${
            error 
              ? 'text-red-600 dark:text-red-400' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';

export default Textarea;