import React, { useState, useRef, useEffect, useId } from 'react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
  className?: string;
  loading?: boolean;
  required?: boolean;
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = 'Seleccionar...',
      disabled = false,
      multiple = false,
      searchable = false,
      label,
      error,
      helperText,
      fullWidth = false,
      className,
      loading = false,
      required = false,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const selectRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const selectId = useId();
    const errorId = useId();
    const helperTextId = useId();

    const filteredOptions = searchable && searchTerm
      ? options.filter(option =>
          option.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : options;

    const selectedOptions = multiple
      ? options.filter(option => Array.isArray(value) && value.includes(option.value))
      : options.find(option => option.value === value);

    const displayValue = multiple
      ? Array.isArray(selectedOptions) && selectedOptions.length > 0
        ? `${selectedOptions.length} seleccionado${selectedOptions.length > 1 ? 's' : ''}`
        : placeholder
      : selectedOptions && !Array.isArray(selectedOptions)
      ? selectedOptions.label
      : placeholder;

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearchTerm('');
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
      if (isOpen && searchable && searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, [isOpen, searchable]);

    const handleToggle = () => {
      if (!disabled && !loading) {
        setIsOpen(!isOpen);
        setSearchTerm('');
      }
    };

    const handleOptionClick = (optionValue: string) => {
      if (multiple) {
        const currentValues = Array.isArray(value) ? value : [];
        const newValues = currentValues.includes(optionValue)
          ? currentValues.filter(v => v !== optionValue)
          : [...currentValues, optionValue];
        onChange?.(newValues);
      } else {
        onChange?.(optionValue);
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    const baseStyles = 'relative flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
    const errorStyles = error ? 'border-red-500 focus:ring-red-500' : '';

    return (
      <div className={cn('space-y-2', fullWidth && 'w-full')} ref={ref} {...props}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
          >
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative" ref={selectRef}>
          <div
            className={cn(
              baseStyles,
              errorStyles,
              disabled || loading ? 'cursor-not-allowed' : 'cursor-pointer',
              className
            )}
            onClick={handleToggle}
            id={selectId}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={`${selectId}-listbox`}
            aria-haspopup="listbox"
            aria-invalid={error ? 'true' : 'false'}
            aria-describedby={cn(
              error && errorId,
              helperText && helperTextId
            )}
            aria-required={required}
            aria-disabled={disabled || loading}
            tabIndex={disabled || loading ? -1 : 0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleToggle();
              }
            }}
          >
            <span className={cn(
              'block truncate',
              !selectedOptions || (Array.isArray(selectedOptions) && selectedOptions.length === 0)
                ? 'text-gray-500'
                : 'text-gray-900'
            )}>
              {displayValue}
            </span>
            
            <div className="flex items-center space-x-2">
              {loading && (
                <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-blue-600 rounded-full" />
              )}
              <svg
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {isOpen && !loading && (
            <div 
              id={`${selectId}-listbox`}
              className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-300 bg-white py-1 shadow-lg"
              role="listbox"
              aria-labelledby={selectId}
            >
              {searchable && (
                <div className="px-3 py-2">
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Buscar..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Buscar opciones"
                  />
                </div>
              )}

              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No se encontraron opciones
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = multiple
                    ? Array.isArray(value) && value.includes(option.value)
                    : value === option.value;

                  return (
                    <div
                      key={option.value}
                      className={cn(
                        'relative cursor-pointer select-none px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none',
                        option.disabled && 'cursor-not-allowed opacity-50',
                        isSelected && 'bg-blue-50 text-blue-600'
                      )}
                      onClick={() => !option.disabled && handleOptionClick(option.value)}
                      role="option"
                      aria-selected={isSelected}
                      tabIndex={option.disabled ? -1 : 0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (!option.disabled) {
                            handleOptionClick(option.value);
                          }
                        }
                      }}
                    >
                      <div className="flex items-center">
                        {multiple && (
                          <div className={cn(
                            'mr-2 h-4 w-4 rounded border border-gray-300 flex items-center justify-center',
                            isSelected && 'bg-blue-600 border-blue-600'
                          )}>
                            {isSelected && (
                              <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        )}
                        <span className="block truncate">{option.label}</span>
                        {!multiple && isSelected && (
                          <svg className="ml-auto h-4 w-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
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
          >
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Select;