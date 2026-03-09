import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../page';
import { apiClient } from '@/lib/api-client';
import type { DashboardMetrics } from '@seo-saas/shared-types';

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

describe('DashboardPage', () => {
  const mockMetrics: DashboardMetrics = {
    totalKeywords: 150,
    averageRank: 12.5,
    rankChange: 5.2,
    totalProjects: 3,
    recentScores: [
      {
        projectId: 'proj-1',
        projectName: 'Example.com',
        score: 85,
        date: '2024-01-15T10:00:00Z',
      },
      {
        projectId: 'proj-2',
        projectName: 'Test Site',
        score: 72,
        date: '2024-01-14T10:00:00Z',
      },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays loading spinner while fetching data', () => {
    (apiClient.get as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<DashboardPage />);

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByText('Loading dashboard...')).toBeInTheDocument();
  });

  it('displays dashboard metrics after successful load', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(mockMetrics);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Check metrics cards
    expect(screen.getByText('150')).toBeInTheDocument(); // Total Keywords
    expect(screen.getByText('12.5')).toBeInTheDocument(); // Average Rank
    expect(screen.getByText('+5.2%')).toBeInTheDocument(); // Rank Change
    expect(screen.getByText('3')).toBeInTheDocument(); // Total Projects
  });

  it('displays metric labels correctly', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(mockMetrics);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Total Keywords')).toBeInTheDocument();
    });

    expect(screen.getByText('Average Rank')).toBeInTheDocument();
    expect(screen.getByText('Rank Change')).toBeInTheDocument();
    expect(screen.getByText('Total Projects')).toBeInTheDocument();
  });

  it('displays recent SEO scores', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(mockMetrics);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent SEO Scores')).toBeInTheDocument();
    });

    expect(screen.getByText('Example.com')).toBeInTheDocument();
    expect(screen.getByText('Test Site')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('72')).toBeInTheDocument();
  });

  it('displays message when no SEO scores available', async () => {
    const metricsWithoutScores = {
      ...mockMetrics,
      recentScores: [],
    };

    (apiClient.get as jest.Mock).mockResolvedValue(metricsWithoutScores);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No SEO audits performed yet')).toBeInTheDocument();
    });
  });

  it('displays error message on load failure', async () => {
    (apiClient.get as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Error Loading Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Network error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('retries loading data when retry button is clicked', async () => {
    (apiClient.get as jest.Mock)
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockMetrics);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /retry/i });
    retryButton.click();

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('formats rank change with positive sign', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(mockMetrics);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('+5.2%')).toBeInTheDocument();
    });
  });

  it('formats negative rank change correctly', async () => {
    const metricsWithNegativeChange = {
      ...mockMetrics,
      rankChange: -3.5,
    };

    (apiClient.get as jest.Mock).mockResolvedValue(metricsWithNegativeChange);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('-3.5%')).toBeInTheDocument();
    });
  });

  it('displays N/A for average rank when no rankings exist', async () => {
    const metricsWithoutRank = {
      ...mockMetrics,
      averageRank: 0,
    };

    (apiClient.get as jest.Mock).mockResolvedValue(metricsWithoutRank);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('N/A')).toBeInTheDocument();
    });
  });

  it('applies correct color class for positive rank change', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(mockMetrics);

    render(<DashboardPage />);

    await waitFor(() => {
      const rankChangeElement = screen.getByText('+5.2%');
      expect(rankChangeElement).toHaveClass('text-green-600');
    });
  });

  it('applies correct color class for negative rank change', async () => {
    const metricsWithNegativeChange = {
      ...mockMetrics,
      rankChange: -3.5,
    };

    (apiClient.get as jest.Mock).mockResolvedValue(metricsWithNegativeChange);

    render(<DashboardPage />);

    await waitFor(() => {
      const rankChangeElement = screen.getByText('-3.5%');
      expect(rankChangeElement).toHaveClass('text-red-600');
    });
  });

  it('formats dates correctly in recent scores', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(mockMetrics);

    render(<DashboardPage />);

    await waitFor(() => {
      // Date should be formatted as locale date string
      const dateElements = screen.getAllByText(/\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(dateElements.length).toBeGreaterThan(0);
    });
  });

  it('calls API with correct endpoint', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue(mockMetrics);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/api/dashboard');
    });
  });
});
