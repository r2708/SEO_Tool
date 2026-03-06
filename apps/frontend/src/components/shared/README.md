# Shared Components

This directory contains reusable UI components used throughout the application.

## LoadingSpinner

A reusable loading spinner component with customizable size and text.

### Props

- `size?: 'small' | 'medium' | 'large'` - Size of the spinner (default: 'medium')
- `variant?: 'centered' | 'inline'` - Display variant (default: 'centered')
- `text?: string` - Optional loading text to display
- `className?: string` - Additional CSS classes

### Usage

```tsx
import { LoadingSpinner } from '@/components/shared';

// Basic usage
<LoadingSpinner />

// With text
<LoadingSpinner text="Loading data..." />

// Different sizes
<LoadingSpinner size="small" text="Loading..." />
<LoadingSpinner size="large" text="Loading dashboard..." />

// Inline variant
<LoadingSpinner variant="inline" size="small" text="Loading..." />
```

## ErrorBoundary

A React error boundary component that catches rendering errors and displays a fallback UI.

### Props

- `children: ReactNode` - Child components to wrap
- `fallback?: ReactNode` - Custom fallback UI (optional)
- `onError?: (error: Error, errorInfo: React.ErrorInfo) => void` - Error callback (optional)

### Features

- Catches JavaScript errors in child component tree
- Displays user-friendly error message
- Shows error details in development mode
- Provides "Try Again" and "Go Back" buttons
- Logs errors to console in development

### Usage

```tsx
import { ErrorBoundary } from '@/components/shared';

// Basic usage
<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>

// With custom fallback
<ErrorBoundary fallback={<CustomErrorUI />}>
  <YourComponent />
</ErrorBoundary>

// With error handler
<ErrorBoundary onError={(error, errorInfo) => {
  // Log to error tracking service
  console.error('Error caught:', error, errorInfo);
}}>
  <YourComponent />
</ErrorBoundary>
```

## Pagination

A pagination component for navigating through paginated data.

See `Pagination.tsx` for implementation details.
