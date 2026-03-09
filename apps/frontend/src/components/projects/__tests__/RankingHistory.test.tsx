import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RankingHistory from '../RankingHistory';
import { apiClient } from '@/lib/api-client';
import type { RankHistory } from '@seo-saas/shared-types';

// Mock the API client
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
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

// Mock recharts
jest.mock('recharts', () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: ({ dataKey }: any) => <div data-testid={`line-${dataKey}`} />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
}));

describe('RankingHistory', () => {
  const mockRankHistory: RankHistory[] = [
    {
      keyword: 'seo tools',
      history: [
        { date: '2024-01-10', position: 15 },
        { date: '2024-01-11', position: 12 },
        { date: '2024-01-12', position: 10 },
      ],
    },
    {
      keyword: 'keyword research',
      history: [
        { date: '2024-01-10', position: 25 },
        { date: '2024-01-11', position: 22 },
        { date: '2024-01-12', position: 20 },
      ],
    },
  ];

  const projectId = 'test-project-id';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads and displays ranking history', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      rankings: mockRankHistory,
      pagination: { page: 1, pageSize: 50, totalCount: 2, totalPages: 1 },
    });

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      const keywordCards = screen.getAllByText('seo tools');
      expect(keywordCards.length).toBeGreaterThan(0);
    });

    const keywordResearchElements = screen.getAllByText('keyword research');
    expect(keywordResearchElements.length).toBeGreaterThan(0);
  });

  it('displays loading state while fetching data', () => {
    (apiClient.get as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<RankingHistory projectId={projectId} />);

    // Look for the spinner animation
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('displays error message on load failure', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('Failed to load'));

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load')).toBeInTheDocument();
    });

    expect(screen.getByText('Try again')).toBeInTheDocument();
  });

  it('displays empty state when no rankings exist', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      rankings: [],
      pagination: { page: 1, pageSize: 50, totalCount: 0, totalPages: 1 },
    });

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText(/no ranking data available yet/i)).toBeInTheDocument();
    });
  });

  it('displays ranking changes with up arrow for improvement', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      rankings: mockRankHistory,
      pagination: { page: 1, pageSize: 50, totalCount: 2, totalPages: 1 },
    });

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      // Check for up arrow (improvement)
      const arrows = screen.getAllByText('↑');
      expect(arrows.length).toBeGreaterThan(0);
    });

    // Position improved from 15 to 10 (change of 5) or from 25 to 20 (change of 5)
    // Just verify arrows are present, not the exact number
  });

  it('displays current rank position', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      rankings: mockRankHistory,
      pagination: { page: 1, pageSize: 50, totalCount: 2, totalPages: 1 },
    });

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('#10')).toBeInTheDocument(); // Latest rank for seo tools
    });

    expect(screen.getByText('#20')).toBeInTheDocument(); // Latest rank for keyword research
  });

  it('renders ranking chart', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      rankings: mockRankHistory,
      pagination: { page: 1, pageSize: 50, totalCount: 2, totalPages: 1 },
    });

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    expect(screen.getByText('Ranking Trends')).toBeInTheDocument();
  });

  it('filters by keyword', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      rankings: mockRankHistory,
      pagination: { page: 1, pageSize: 50, totalCount: 2, totalPages: 1 },
    });

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('Keyword')).toBeInTheDocument();
    });

    const keywordSelect = screen.getByRole('combobox');
    fireEvent.change(keywordSelect, { target: { value: 'seo tools' } });

    const applyButton = screen.getByRole('button', { name: /apply filters/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      const lastCallArg = (apiClient.get as jest.Mock).mock.calls.slice(-1)[0][0];
      expect(lastCallArg).toContain('keyword=seo');
    });
  });

  it('filters by date range', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      rankings: mockRankHistory,
      pagination: { page: 1, pageSize: 50, totalCount: 2, totalPages: 1 },
    });

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('Start Date')).toBeInTheDocument();
    });

    const dateInputs = screen.getAllByDisplayValue('');
    const startDateInput = dateInputs[0]; // First date input
    const endDateInput = dateInputs[1]; // Second date input

    fireEvent.change(startDateInput, { target: { value: '2024-01-10' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-12' } });

    const applyButton = screen.getByRole('button', { name: /apply filters/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      const lastCallArg = (apiClient.get as jest.Mock).mock.calls.slice(-1)[0][0];
      expect(lastCallArg).toContain('startDate=2024-01-10');
      expect(lastCallArg).toContain('endDate=2024-01-12');
    });
  });

  it('resets filters when reset button is clicked', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      rankings: mockRankHistory,
      pagination: { page: 1, pageSize: 50, totalCount: 2, totalPages: 1 },
    });

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('Keyword')).toBeInTheDocument();
    });

    // Set filters
    const keywordSelect = screen.getByRole('combobox');
    fireEvent.change(keywordSelect, { target: { value: 'seo tools' } });

    // Reset filters
    const resetButton = screen.getByRole('button', { name: /reset/i });
    fireEvent.click(resetButton);

    await waitFor(() => {
      const keywordSelectAfterReset = screen.getByRole('combobox') as HTMLSelectElement;
      expect(keywordSelectAfterReset.value).toBe('');
    });
  });

  it('displays keyword dropdown with all keywords', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      rankings: mockRankHistory,
      pagination: { page: 1, pageSize: 50, totalCount: 2, totalPages: 1 },
    });

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('Keyword')).toBeInTheDocument();
    });

    const keywordSelect = screen.getByRole('combobox');
    expect(keywordSelect).toHaveTextContent('All Keywords');
    expect(keywordSelect).toHaveTextContent('seo tools');
    expect(keywordSelect).toHaveTextContent('keyword research');
  });

  it('handles pagination', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      rankings: mockRankHistory,
      pagination: { page: 1, pageSize: 50, totalCount: 100, totalPages: 2 },
    });

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByTestId('pagination')).toBeInTheDocument();
    });

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      const lastCallArg = (apiClient.get as jest.Mock).mock.calls.slice(-1)[0][0];
      expect(lastCallArg).toContain('page=2');
    });
  });

  it('resets to first page when filters change', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      rankings: mockRankHistory,
      pagination: { page: 1, pageSize: 50, totalCount: 2, totalPages: 1 },
    });

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('Keyword')).toBeInTheDocument();
    });

    const keywordSelect = screen.getByRole('combobox');
    fireEvent.change(keywordSelect, { target: { value: 'seo tools' } });

    const applyButton = screen.getByRole('button', { name: /apply filters/i });
    fireEvent.click(applyButton);

    await waitFor(() => {
      const lastCallArg = (apiClient.get as jest.Mock).mock.calls.slice(-1)[0][0];
      expect(lastCallArg).toContain('page=1');
    });
  });

  it('displays ranking change cards for each keyword', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      rankings: mockRankHistory,
      pagination: { page: 1, pageSize: 50, totalCount: 2, totalPages: 1 },
    });

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      // Check that keyword cards are displayed
      const keywordCards = screen.getAllByRole('heading', { level: 4 });
      expect(keywordCards.length).toBeGreaterThan(0);
    });
  });

  it('calls API with correct endpoint and project ID', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({
      rankings: mockRankHistory,
      pagination: { page: 1, pageSize: 50, totalCount: 2, totalPages: 1 },
    });

    render(<RankingHistory projectId={projectId} />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining(`/api/rank/history/${projectId}`)
      );
    });
  });
});
