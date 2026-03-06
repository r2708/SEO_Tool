import React from 'react';

export type SpinnerSize = 'small' | 'medium' | 'large';
export type SpinnerVariant = 'centered' | 'inline';

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  text?: string;
  className?: string;
}

const sizeClasses: Record<SpinnerSize, string> = {
  small: 'h-4 w-4 border-2',
  medium: 'h-8 w-8 border-2',
  large: 'h-12 w-12 border-4',
};

const textSizeClasses: Record<SpinnerSize, string> = {
  small: 'text-sm',
  medium: 'text-base',
  large: 'text-lg',
};

export default function LoadingSpinner({
  size = 'medium',
  variant = 'centered',
  text,
  className = '',
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={`flex items-center ${variant === 'centered' ? 'justify-center' : ''} ${className}`}>
      <div
        className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}
        role="status"
        aria-label="Loading"
      />
      {text && (
        <span className={`ml-3 text-gray-600 ${textSizeClasses[size]}`}>
          {text}
        </span>
      )}
    </div>
  );

  if (variant === 'centered') {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        {spinner}
      </div>
    );
  }

  return spinner;
}
