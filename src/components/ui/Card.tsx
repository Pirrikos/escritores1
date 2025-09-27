import React from 'react';
import { cn } from '@/lib/utils';

export interface CardProps {
  children?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'outlined' | 'elevated' | 'filled';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

export interface CardHeaderProps {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export interface CardBodyProps {
  children?: React.ReactNode;
  className?: string;
}

export interface CardFooterProps {
  children?: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right' | 'between';
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, className, variant = 'default', padding = 'md', hover = false, ...props }, ref) => {
    const baseStyles = 'rounded-lg transition-all duration-200';
    
    const variantStyles = {
      default: 'bg-white border border-gray-200',
      outlined: 'bg-white border-2 border-gray-300',
      elevated: 'bg-white shadow-lg border border-gray-100',
      filled: 'bg-gray-50 border border-gray-200',
    };

    const paddingStyles = {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };

    const hoverStyles = hover ? 'hover:shadow-md hover:border-gray-300' : '';

    return (
      <div
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          paddingStyles[padding],
          hoverStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className, title, subtitle, action, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-start justify-between space-y-1.5', className)}
        {...props}
      >
        <div className="space-y-1.5">
          {title && (
            <h3 className="text-lg font-semibold leading-none tracking-tight text-gray-900">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-gray-600">
              {subtitle}
            </p>
          )}
          {children}
        </div>
        {action && (
          <div className="flex-shrink-0">
            {action}
          </div>
        )}
      </div>
    );
  }
);

const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('text-sm text-gray-700', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className, align = 'left', ...props }, ref) => {
    const alignStyles = {
      left: 'justify-start',
      center: 'justify-center',
      right: 'justify-end',
      between: 'justify-between',
    };

    return (
      <div
        ref={ref}
        className={cn('flex items-center', alignStyles[align], className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardBody.displayName = 'CardBody';
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardBody, CardFooter };
export default Card;