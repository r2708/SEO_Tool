# Frontend Testing

This directory contains all tests for the SEO SaaS Platform frontend.

## Test Structure

```
src/
├── __tests__/           # Test files
│   ├── components/      # Component tests
│   ├── lib/            # Utility tests
│   └── integration/    # Integration tests
└── components/         # Source components
```

## Setup

### Dependencies

The frontend uses Jest and React Testing Library:

- `jest`: Test runner
- `@testing-library/react`: React component testing utilities
- `@testing-library/jest-dom`: Custom Jest matchers for DOM
- `@testing-library/user-event`: User interaction simulation

### Configuration

**jest.config.js**: Jest configuration with Next.js integration
**jest.setup.js**: Global test setup and mocks

## Running Tests

### Run All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage
```bash
npm test -- --coverage
```

### Specific Test File
```bash
npm test -- LoginForm.test.tsx
```

## Writing Tests

### Component Tests

Test React components in isolation:

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from '@/components/auth/LoginForm';

describe('LoginForm', () => {
  it('renders login form', () => {
    render(<LoginForm />);
    
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('validates email format', async () => {
    render(<LoginForm />);
    
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);
    
    expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
  });

  it('submits form with valid data', async () => {
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });
    
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
  });
});
```

### Testing Hooks

Test custom React hooks:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '@/lib/hooks/useAuth';

describe('useAuth', () => {
  it('loads user from token', async () => {
    localStorage.setItem('token', 'valid-token');
    
    const { result } = renderHook(() => useAuth());
    
    await waitFor(() => {
      expect(result.current.user).toBeDefined();
      expect(result.current.loading).toBe(false);
    });
  });

  it('handles login', async () => {
    const { result } = renderHook(() => useAuth());
    
    await result.current.login('test@example.com', 'password123');
    
    expect(result.current.user).toBeDefined();
    expect(localStorage.getItem('token')).toBeDefined();
  });
});
```

### Mocking API Calls

Mock API client for testing:

```typescript
import { apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    request: jest.fn(),
  },
}));

describe('ProjectList', () => {
  it('fetches and displays projects', async () => {
    const mockProjects = [
      { id: '1', domain: 'example.com', name: 'Test Project' }
    ];
    
    (apiClient.request as jest.Mock).mockResolvedValue({
      projects: mockProjects
    });
    
    render(<ProjectList />);
    
    expect(await screen.findByText('example.com')).toBeInTheDocument();
  });
});
```

### Testing User Interactions

Use `@testing-library/user-event` for realistic user interactions:

```typescript
import userEvent from '@testing-library/user-event';

describe('KeywordTable', () => {
  it('filters keywords by search term', async () => {
    const user = userEvent.setup();
    render(<KeywordTable keywords={mockKeywords} />);
    
    const searchInput = screen.getByPlaceholderText(/search/i);
    await user.type(searchInput, 'seo');
    
    expect(screen.getByText('seo optimization')).toBeInTheDocument();
    expect(screen.queryByText('content marketing')).not.toBeInTheDocument();
  });
});
```

## Test Categories

### Component Tests (Task 23.4)

Test individual UI components:

- **Authentication Forms**: Login, register forms with validation
- **Dashboard Metrics**: Metrics cards, data display
- **Project Management**: Project list, forms, detail views
- **Keyword Table**: Table rendering, sorting, filtering
- **Ranking Chart**: Chart rendering with data
- **Audit Results**: SEO audit results display

### Integration Tests

Test complete user flows:

- Navigation between pages
- Form submission and data persistence
- Authentication flow
- API integration

## Best Practices

1. **Test User Behavior**: Test what users see and do, not implementation details
2. **Accessibility**: Use accessible queries (getByRole, getByLabelText)
3. **Async Operations**: Use waitFor for async state updates
4. **Cleanup**: Tests clean up automatically with React Testing Library
5. **Mock External Dependencies**: Mock API calls, router, external services
6. **Descriptive Tests**: Use clear test descriptions
7. **Arrange-Act-Assert**: Structure tests clearly

## Common Patterns

### Testing Forms

```typescript
// Render form
render(<MyForm />);

// Fill inputs
fireEvent.change(screen.getByLabelText(/field/i), {
  target: { value: 'test value' }
});

// Submit
fireEvent.click(screen.getByRole('button', { name: /submit/i }));

// Assert
expect(mockSubmit).toHaveBeenCalled();
```

### Testing Loading States

```typescript
render(<MyComponent />);

// Check loading state
expect(screen.getByText(/loading/i)).toBeInTheDocument();

// Wait for data
await waitFor(() => {
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
});

// Check data displayed
expect(screen.getByText('Data')).toBeInTheDocument();
```

### Testing Error States

```typescript
(apiClient.request as jest.Mock).mockRejectedValue(
  new Error('API Error')
);

render(<MyComponent />);

expect(await screen.findByText(/error/i)).toBeInTheDocument();
```

## Troubleshooting

### "Not wrapped in act(...)" Warning

This warning appears when state updates happen outside React's awareness. Use `waitFor`:

```typescript
await waitFor(() => {
  expect(screen.getByText('Updated')).toBeInTheDocument();
});
```

### "Unable to find element" Error

Element might not be rendered yet. Use `findBy` queries which wait:

```typescript
// Instead of getByText (synchronous)
expect(screen.getByText('Text')).toBeInTheDocument();

// Use findByText (async)
expect(await screen.findByText('Text')).toBeInTheDocument();
```

### Mock Not Working

Ensure mocks are defined before imports:

```typescript
// Mock first
jest.mock('@/lib/api-client');

// Then import
import { MyComponent } from '@/components/MyComponent';
```

## CI/CD Integration

```yaml
# Example GitHub Actions
- name: Install Dependencies
  run: npm install

- name: Run Frontend Tests
  run: npm test --workspace=@seo-saas/frontend
  env:
    NEXT_PUBLIC_API_URL: http://localhost:3001
```
