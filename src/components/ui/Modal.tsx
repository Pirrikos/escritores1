import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

export interface ModalHeaderProps {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export interface ModalBodyProps {
  children?: React.ReactNode;
  className?: string;
}

export interface ModalFooterProps {
  children?: React.ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right' | 'between';
}

const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  ({
    isOpen,
    onClose,
    children,
    title,
    size = 'md',
    closeOnOverlayClick = true,
    closeOnEscape = true,
    showCloseButton = true,
    className,
    ...props
  }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    const sizeStyles = {
      sm: 'max-w-md',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl',
      full: 'max-w-full mx-4',
    };

    useEffect(() => {
      if (isOpen) {
        // Store the currently focused element
        previousActiveElement.current = document.activeElement as HTMLElement;
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Show modal with animation
        setIsVisible(true);
        
        // Focus the modal
        setTimeout(() => {
          modalRef.current?.focus();
        }, 100);
      } else {
        setIsVisible(false);
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        // Restore focus to the previously focused element
        if (previousActiveElement.current) {
          previousActiveElement.current.focus();
        }
      }

      return () => {
        document.body.style.overflow = '';
      };
    }, [isOpen]);

    useEffect(() => {
      const handleEscape = (event: KeyboardEvent) => {
        if (closeOnEscape && event.key === 'Escape' && isOpen) {
          onClose();
        }
      };

      if (isOpen) {
        document.addEventListener('keydown', handleEscape);
      }

      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }, [isOpen, closeOnEscape, onClose]);

    const handleOverlayClick = (event: React.MouseEvent) => {
      if (closeOnOverlayClick && event.target === event.currentTarget) {
        onClose();
      }
    };

    const handleModalClick = (event: React.MouseEvent) => {
      event.stopPropagation();
    };

    if (!isOpen) {
      return null;
    }

    return (
      <div
        className={cn(
          'fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300',
          isVisible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
        {/* Overlay */}
        <div
          className={cn(
            'absolute inset-0 bg-black transition-opacity duration-300',
            isVisible ? 'opacity-50' : 'opacity-0'
          )}
        />

        {/* Modal */}
        <div
          ref={modalRef}
          className={cn(
            'relative w-full transform rounded-lg bg-white shadow-xl transition-all duration-300',
            sizeStyles[size],
            isVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
            className
          )}
          onClick={handleModalClick}
          tabIndex={-1}
          {...props}
        >
          {(title || showCloseButton) && (
            <ModalHeader
              title={title}
              onClose={onClose}
              showCloseButton={showCloseButton}
            />
          )}
          {children}
        </div>
      </div>
    );
  }
);

const ModalHeader = React.forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ children, className, title, onClose, showCloseButton = true, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center justify-between border-b border-gray-200 px-6 py-4',
          className
        )}
        {...props}
      >
        <div className="flex-1">
          {title && (
            <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
          )}
          {children}
        </div>
        {showCloseButton && onClose && (
          <button
            type="button"
            className="ml-4 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={onClose}
            aria-label="Cerrar modal"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

const ModalBody = React.forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('px-6 py-4', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);

const ModalFooter = React.forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ children, className, align = 'right', ...props }, ref) => {
    const alignStyles = {
      left: 'justify-start',
      center: 'justify-center',
      right: 'justify-end',
      between: 'justify-between',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center space-x-3 border-t border-gray-200 px-6 py-4',
          alignStyles[align],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Modal.displayName = 'Modal';
ModalHeader.displayName = 'ModalHeader';
ModalBody.displayName = 'ModalBody';
ModalFooter.displayName = 'ModalFooter';

export { Modal, ModalHeader, ModalBody, ModalFooter };
export default Modal;