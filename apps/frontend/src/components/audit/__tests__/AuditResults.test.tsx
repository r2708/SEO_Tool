import { render, screen } from '@testing-library/react';
import AuditResults from '../AuditResults';
import type { SEOAnalysis } from '@seo-saas/shared-types';

describe('AuditResults', () => {
  const mockAnalysis: SEOAnalysis = {
    url: 'https://example.com',
    score: 85,
    analysis: {
      title: {
        content: 'Example Domain - SEO Tools',
        length: 27,
        optimal: true,
      },
      metaDescription: {
        content: 'This is a comprehensive meta description for the example domain that provides detailed information about the page content.',
        length: 125,
        optimal: false,
      },
      headings: {
        h1Count: 1,
        h2Count: 5,
        structure: ['H1: Main Title', 'H2: Section 1', 'H2: Section 2'],
      },
      images: {
        total: 10,
        missingAlt: 2,
      },
      links: {
        internal: 15,
        broken: ['https://example.com/broken-link'],
      },
    },
    recommendations: [
      'Add alt text to all images',
      'Fix broken links',
      'Increase meta description length',
    ],
    analyzedAt: '2024-01-15T10:00:00Z',
  };

  it('displays overall SEO score', () => {
    render(<AuditResults analysis={mockAnalysis} />);

    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });

  it('displays analyzed URL and timestamp', () => {
    render(<AuditResults analysis={mockAnalysis} />);

    expect(screen.getByText('https://example.com')).toBeInTheDocument();
    expect(screen.getByText(/analyzed on/i)).toBeInTheDocument();
  });

  it('displays title analysis with optimal badge', () => {
    render(<AuditResults analysis={mockAnalysis} />);

    expect(screen.getByText('Example Domain - SEO Tools')).toBeInTheDocument();
    expect(screen.getByText('Length: 27 characters')).toBeInTheDocument();
    expect(screen.getByText('✓ Optimal')).toBeInTheDocument();
  });

  it('displays meta description analysis with warning', () => {
    render(<AuditResults analysis={mockAnalysis} />);

    expect(screen.getByText(/this is a comprehensive meta description/i)).toBeInTheDocument();
    expect(screen.getByText('Length: 125 characters')).toBeInTheDocument();
    expect(screen.getByText('⚠ Needs Attention')).toBeInTheDocument();
  });

  it('displays heading structure counts', () => {
    render(<AuditResults analysis={mockAnalysis} />);

    expect(screen.getByText('1')).toBeInTheDocument(); // H1 count
    expect(screen.getByText('5')).toBeInTheDocument(); // H2 count
    expect(screen.getByText('H1 Tags')).toBeInTheDocument();
    expect(screen.getByText('H2 Tags')).toBeInTheDocument();
  });

  it('displays heading hierarchy', () => {
    render(<AuditResults analysis={mockAnalysis} />);

    expect(screen.getByText('H1: Main Title')).toBeInTheDocument();
    expect(screen.getByText('H2: Section 1')).toBeInTheDocument();
    expect(screen.getByText('H2: Section 2')).toBeInTheDocument();
  });

  it('displays image analysis', () => {
    render(<AuditResults analysis={mockAnalysis} />);

    expect(screen.getByText('10')).toBeInTheDocument(); // Total images
    expect(screen.getByText('2')).toBeInTheDocument(); // Missing alt
    expect(screen.getByText('Total Images')).toBeInTheDocument();
    expect(screen.getByText('Missing Alt Text')).toBeInTheDocument();
  });

  it('displays link analysis', () => {
    render(<AuditResults analysis={mockAnalysis} />);

    expect(screen.getByText('15')).toBeInTheDocument(); // Internal links
    expect(screen.getByText('Internal Links')).toBeInTheDocument();
  });

  it('displays broken links', () => {
    render(<AuditResults analysis={mockAnalysis} />);

    expect(screen.getByText(/broken links found/i)).toBeInTheDocument();
    expect(screen.getByText('https://example.com/broken-link')).toBeInTheDocument();
  });

  it('displays recommendations', () => {
    render(<AuditResults analysis={mockAnalysis} />);

    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Add alt text to all images')).toBeInTheDocument();
    expect(screen.getByText('Fix broken links')).toBeInTheDocument();
    expect(screen.getByText('Increase meta description length')).toBeInTheDocument();
  });

  it('applies correct color for excellent score', () => {
    render(<AuditResults analysis={mockAnalysis} />);

    const scoreElement = screen.getByText('85');
    expect(scoreElement).toHaveClass('text-green-600');
  });

  it('applies correct color for good score', () => {
    const goodAnalysis = { ...mockAnalysis, score: 65 };
    render(<AuditResults analysis={goodAnalysis} />);

    const scoreElement = screen.getByText('65');
    expect(scoreElement).toHaveClass('text-yellow-600');
    expect(screen.getByText('Good')).toBeInTheDocument();
  });

  it('applies correct color for fair score', () => {
    const fairAnalysis = { ...mockAnalysis, score: 45 };
    render(<AuditResults analysis={fairAnalysis} />);

    const scoreElement = screen.getByText('45');
    expect(scoreElement).toHaveClass('text-orange-600');
    expect(screen.getByText('Fair')).toBeInTheDocument();
  });

  it('applies correct color for poor score', () => {
    const poorAnalysis = { ...mockAnalysis, score: 25 };
    render(<AuditResults analysis={poorAnalysis} />);

    const scoreElement = screen.getByText('25');
    expect(scoreElement).toHaveClass('text-red-600');
    expect(screen.getByText('Needs Improvement')).toBeInTheDocument();
  });

  it('displays warning for title too short', () => {
    const shortTitleAnalysis = {
      ...mockAnalysis,
      analysis: {
        ...mockAnalysis.analysis,
        title: {
          content: 'Short',
          length: 5,
          optimal: false,
        },
      },
    };

    render(<AuditResults analysis={shortTitleAnalysis} />);

    expect(screen.getByText(/title is too short/i)).toBeInTheDocument();
  });

  it('displays warning for title too long', () => {
    const longTitleAnalysis = {
      ...mockAnalysis,
      analysis: {
        ...mockAnalysis.analysis,
        title: {
          content: 'This is a very long title that exceeds the optimal character count',
          length: 67,
          optimal: false,
        },
      },
    };

    render(<AuditResults analysis={longTitleAnalysis} />);

    expect(screen.getByText(/title is too long/i)).toBeInTheDocument();
  });

  it('displays warning for meta description too short', () => {
    const shortMetaAnalysis = {
      ...mockAnalysis,
      analysis: {
        ...mockAnalysis.analysis,
        metaDescription: {
          content: 'Short description',
          length: 17,
          optimal: false,
        },
      },
    };

    render(<AuditResults analysis={shortMetaAnalysis} />);

    expect(screen.getByText(/meta description is too short/i)).toBeInTheDocument();
  });

  it('displays success message when no broken links', () => {
    const noBrokenLinksAnalysis = {
      ...mockAnalysis,
      analysis: {
        ...mockAnalysis.analysis,
        links: {
          internal: 15,
          broken: [],
        },
      },
    };

    render(<AuditResults analysis={noBrokenLinksAnalysis} />);

    expect(screen.getByText('✓ No broken links detected')).toBeInTheDocument();
  });

  it('displays success message when all images have alt text', () => {
    const allAltTextAnalysis = {
      ...mockAnalysis,
      analysis: {
        ...mockAnalysis.analysis,
        images: {
          total: 10,
          missingAlt: 0,
        },
      },
    };

    render(<AuditResults analysis={allAltTextAnalysis} />);

    expect(screen.getByText('✓ All images have alt text')).toBeInTheDocument();
  });

  it('displays warning for multiple H1 tags', () => {
    const multipleH1Analysis = {
      ...mockAnalysis,
      analysis: {
        ...mockAnalysis.analysis,
        headings: {
          h1Count: 3,
          h2Count: 5,
          structure: [],
        },
      },
    };

    render(<AuditResults analysis={multipleH1Analysis} />);

    expect(screen.getByText('⚠ Multiple H1s')).toBeInTheDocument();
  });

  it('displays warning for missing H1 tag', () => {
    const noH1Analysis = {
      ...mockAnalysis,
      analysis: {
        ...mockAnalysis.analysis,
        headings: {
          h1Count: 0,
          h2Count: 5,
          structure: [],
        },
      },
    };

    render(<AuditResults analysis={noH1Analysis} />);

    expect(screen.getByText('⚠ Missing H1')).toBeInTheDocument();
  });

  it('displays warning for no H2 tags', () => {
    const noH2Analysis = {
      ...mockAnalysis,
      analysis: {
        ...mockAnalysis.analysis,
        headings: {
          h1Count: 1,
          h2Count: 0,
          structure: [],
        },
      },
    };

    render(<AuditResults analysis={noH2Analysis} />);

    expect(screen.getByText('⚠ No H2s found')).toBeInTheDocument();
  });

  it('displays warning for insufficient internal links', () => {
    const fewLinksAnalysis = {
      ...mockAnalysis,
      analysis: {
        ...mockAnalysis.analysis,
        links: {
          internal: 2,
          broken: [],
        },
      },
    };

    render(<AuditResults analysis={fewLinksAnalysis} />);

    expect(screen.getByText('⚠ Consider adding more internal links')).toBeInTheDocument();
  });

  it('displays message when no title found', () => {
    const noTitleAnalysis = {
      ...mockAnalysis,
      analysis: {
        ...mockAnalysis.analysis,
        title: {
          content: '',
          length: 0,
          optimal: false,
        },
      },
    };

    render(<AuditResults analysis={noTitleAnalysis} />);

    expect(screen.getByText('(No title found)')).toBeInTheDocument();
  });

  it('displays message when no meta description found', () => {
    const noMetaAnalysis = {
      ...mockAnalysis,
      analysis: {
        ...mockAnalysis.analysis,
        metaDescription: {
          content: '',
          length: 0,
          optimal: false,
        },
      },
    };

    render(<AuditResults analysis={noMetaAnalysis} />);

    expect(screen.getByText('(No meta description found)')).toBeInTheDocument();
  });
});
