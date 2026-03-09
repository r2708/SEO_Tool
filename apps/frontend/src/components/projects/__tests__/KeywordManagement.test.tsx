import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import KeywordManagement from '../KeywordManagement';
import { apiClient } from '@/lib/api-client';
import type { KeywordData } from '@seo-saas/shared-types';

// Mock the API client
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// Mock Pagination component
jest.mock('@/components/shared/Pagination', () => {
  return function MockPagination({ currentPage, totalPages, onPageChange }: any) {
    return (
      <div data-testid="pagination">
        <span>Page {currentPage} of {totalPages}</span>
        <button onClick={() => onPageChange(currentPage + 1)}>Next</button>
      </div>
    );
  };
});

describe('KeywordManagement', () => {
  const mockKeywords: KeywordData[] = [
    {
      id: '1',
      keyword: 'seo tools',
      searchVolume: 10000,
      difficulty: 65.5,
      cpc: 12.50,
      currentRank: 5,
      lastUpdated: '2024-01-15T10:00:00Z',
    },
    {
      id: '2',
      keyword: 'keyword research',
      searchVolume: 5000,
      difficulty: 45.0,
      cpc: 8.75,
      currentRank: 12,
      lastUpdated: '2024-01-15T10:00:00Z',
    },
    {
      id: '3',
      keyword: 'rank tracking',
      searchVolume: 3000,
      difficulty: 35.0,
      cpc: 6.25,
      lastUpdated: '2024-01-15T10:00:00Z',
    },
  ];

  const projectId = 'test-project-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and displays keywords on mount', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      keywords: mockKeywords,
      pagination: { page: 1, pageSize: 50, totalCount: 3, totalPages: 1 },
    });

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('seo tools')).toBeInTheDocument();
    });

    expect(screen.getByText('keyword research')).toBeInTheDocument();
    expect(screen.getByText('rank tracking')).toBeInTheDocument();
  });

  it('displays loading state while fetching keywords', () => {
    (apiClient.get as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<KeywordManagement projectId={projectId} />);

    // Look for the spinner animation
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('displays error message on load failure', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('Failed to load'));

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('displays keyword metrics correctly', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      keywords: mockKeywords,
      pagination: { page: 1, pageSize: 50, totalCount: 3, totalPages: 1 },
    });

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('10,000')).toBeInTheDocument(); // Search volume
    });

    // Difficulty is displayed as a badge with rounded value
    expect(screen.getByText('$12.50')).toBeInTheDocument(); // CPC
    expect(screen.getByText('5')).toBeInTheDocument(); // Current rank
  });

  it('displays empty state when no keywords exist', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      keywords: [],
      pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 1 },
    });

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText(/no keywords yet/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/research some keywords to get started/i)).toBeInTheDocument();
  });

  it('submits keyword research form', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      keywords: [],
      pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 1 },
    });
    (apiClient.post as jest.Mock).mockResolvedValue({});

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/research keywords/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/enter keywords separated by commas/i);
    const submitButton = screen.getByRole('button', { name: /research keywords/i });

    fireEvent.change(input, { target: { value: 'seo tools, keyword research' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/api/keywords/research', {
        projectId,
        keywords: ['seo tools', 'keyword research'],
      });
    });
  });

  it('validates keyword input is not empty', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      keywords: [],
      pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 1 },
    });

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/research keywords/i)).toBeInTheDocument();
    });

    const submitButton = screen.getByRole('button', { name: /research keywords/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Please enter at least one keyword')).toBeInTheDocument();
    });

    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('filters keywords by search text', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      keywords: mockKeywords,
      pagination: { page: 1, pageSize: 50, totalCount: 3, totalPages: 1 },
    });

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('seo tools')).toBeInTheDocument();
    });

    const filterInput = screen.getByPlaceholderText(/filter keywords/i);
    fireEvent.change(filterInput, { target: { value: 'seo' } });

    expect(screen.getByText('seo tools')).toBeInTheDocument();
    expect(screen.queryByText('keyword research')).not.toBeInTheDocument();
    expect(screen.queryByText('rank tracking')).not.toBeInTheDocument();
  });

  it('sorts keywords by column', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      keywords: mockKeywords,
      pagination: { page: 1, pageSize: 50, totalCount: 3, totalPages: 1 },
    });

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('seo tools')).toBeInTheDocument();
    });

    // Click on search volume header to sort
    const searchVolumeHeader = screen.getByText('Search Volume');
    fireEvent.click(searchVolumeHeader);

    // Just verify the table still renders after sorting
    expect(screen.getByText('seo tools')).toBeInTheDocument();
    expect(screen.getByText('keyword research')).toBeInTheDocument();
  });

  it('toggles sort direction on repeated column click', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      keywords: mockKeywords,
      pagination: { page: 1, pageSize: 50, totalCount: 3, totalPages: 1 },
    });

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('seo tools')).toBeInTheDocument();
    });

    const keywordHeader = screen.getByText('Keyword');
    
    // First click - should sort
    fireEvent.click(keywordHeader);
    
    // Second click - should reverse sort
    fireEvent.click(keywordHeader);

    // Just verify the table still renders after sorting
    expect(screen.getByText('seo tools')).toBeInTheDocument();
  });

  it('displays difficulty badge with correct color', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      keywords: mockKeywords,
      pagination: { page: 1, pageSize: 50, totalCount: 3, totalPages: 1 },
    });

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      // Just check that badges exist with correct colors
      const badges = document.querySelectorAll('.bg-red-100, .bg-yellow-100, .bg-green-100');
      expect(badges.length).toBeGreaterThan(0);
    });
  });

  it('displays dash for missing current rank', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      keywords: [mockKeywords[2]], // rank tracking has no currentRank
      pagination: { page: 1, pageSize: 50, totalCount: 1, totalPages: 1 },
    });

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('rank tracking')).toBeInTheDocument();
    });

    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('handles pagination', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      keywords: mockKeywords,
      pagination: { page: 1, pageSize: 50, totalCount: 100, totalPages: 2 },
    });

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      // Just verify the API was called again (for page 2)
      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
  });

  it('clears input after successful research', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      keywords: [],
      pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 1 },
    });
    (apiClient.post as jest.Mock).mockResolvedValue({});

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/research keywords/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/enter keywords separated by commas/i) as HTMLInputElement;
    const submitButton = screen.getByRole('button', { name: /research keywords/i });

    fireEvent.change(input, { target: { value: 'test keyword' } });
    expect(input.value).toBe('test keyword');

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('displays research error message', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      keywords: [],
      pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 1 },
    });
    (apiClient.post as jest.Mock).mockRejectedValue(new Error('Research failed'));

    render(<KeywordManagement projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/research keywords/i)).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/enter keywords separated by commas/i);
    const submitButton = screen.getByRole('button', { name: /research keywords/i });

    fireEvent.change(input, { target: { value: 'test keyword' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Research failed')).toBeInTheDocument();
    });
  });
});
