import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RankingChart from '../RankingChart';
import { apiClient } from '@/lib/api-client';
import type { RankHistory } from '@seo-saas/shared-types';

// Mock the API client
jest.mock('@/lib/api-client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

// Mock LoadingSpinner
jest.mock('@/components/shared', () => ({
  LoadingSpinner: ({ text }: { text: string }) => <div data-testid="loading-spinner">{text}</div>,
}));

// Mock recharts to avoid rendering issues in tests
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

describe('RankingChart', () => {
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

  it('displays loading state while fetching data', () => {
    (apiClient.get as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<RankingChart projectId={projectId} />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading ranking data...')).toBeInTheDocument();
  });

  it('loads and displays ranking chart', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ rankings: mockRankHistory });

    render(<RankingChart projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('Ranking History')).toBeInTheDocument();
    });

    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('displays error message on load failure', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<RankingChart projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Rankings')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('retries loading data when retry button is clicked', async () => {
    (apiClient.get as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ rankings: mockRankHistory });

    render(<RankingChart projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Ranking History')).toBeInTheDocument();
    });

    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('displays empty state when no data available', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ rankings: [] });

    render(<RankingChart projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('No ranking data available for the selected filters')).toBeInTheDocument();
    });
  });

  it('filters by keyword', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ rankings: mockRankHistory });

    render(<RankingChart projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('Keyword')).toBeInTheDocument();
    });

    const keywordInput = screen.getByPlaceholderText(/filter by keyword/i);
    fireEvent.change(keywordInput, { target: { value: 'seo tools' } });

    await waitFor(() => {
      const callArg = (apiClient.get as jest.Mock).mock.calls[1][0];
      expect(callArg).toContain('keyword=seo');
    });
  });

  it('filters by date range', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ rankings: mockRankHistory });

    render(<RankingChart projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('Start Date')).toBeInTheDocument();
    });

    const dateInputs = screen.getAllByDisplayValue('');
    const startDateInput = dateInputs[0];
    const endDateInput = dateInputs[1];

    fireEvent.change(startDateInput, { target: { value: '2024-01-10' } });
    fireEvent.change(endDateInput, { target: { value: '2024-01-12' } });

    await waitFor(() => {
      // Just verify the API was called multiple times (initial + date changes)
      expect(apiClient.get).toHaveBeenCalled();
      expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(1);
    });
  });

  it('clears filters when clear button is clicked', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ rankings: mockRankHistory });

    render(<RankingChart projectId={projectId} keyword="test" startDate="2024-01-01" />);

    await waitFor(() => {
      expect(screen.getByText('Clear Filters')).toBeInTheDocument();
    });

    const clearButton = screen.getByText('Clear Filters');
    fireEvent.click(clearButton);

    await waitFor(() => {
      const keywordInput = screen.getByPlaceholderText(/filter by keyword/i) as HTMLInputElement;
      expect(keywordInput.value).toBe('');
    });
  });

  it('renders chart with correct data structure', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ rankings: mockRankHistory });

    render(<RankingChart projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    // Check that lines are rendered for each keyword
    expect(screen.getByTestId('line-seo tools')).toBeInTheDocument();
    expect(screen.getByTestId('line-keyword research')).toBeInTheDocument();
  });

  it('calls API with correct endpoint and project ID', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ rankings: mockRankHistory });

    render(<RankingChart projectId={projectId} />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining(`/api/rank/history/${projectId}`)
      );
    });
  });

  it('includes initial filters in API call', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ rankings: mockRankHistory });

    render(
      <RankingChart
        projectId={projectId}
        keyword="seo tools"
        startDate="2024-01-01"
        endDate="2024-01-31"
      />
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled();
    });

    const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
    expect(callArg).toContain('keyword=seo');
    expect(callArg).toContain('startDate=2024-01-01');
    expect(callArg).toContain('endDate=2024-01-31');
  });

  it('renders filter controls', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ rankings: mockRankHistory });

    render(<RankingChart projectId={projectId} />);

    await waitFor(() => {
      expect(screen.getByText('Keyword')).toBeInTheDocument();
    });

    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByText('End Date')).toBeInTheDocument();
  });

  it('updates data when filters change', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({ rankings: mockRankHistory });

    render(<RankingChart projectId={projectId} />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    const keywordInput = screen.getByPlaceholderText(/filter by keyword/i);
    fireEvent.change(keywordInput, { target: { value: 'new keyword' } });

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
  });
});
