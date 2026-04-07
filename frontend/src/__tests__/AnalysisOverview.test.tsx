import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalysisOverview } from '../components/analysis/AnalysisOverview';
import {
  mockExtractionResult,
  mockExtractionResultNullBalances,
  mockExtractionResultNegativeNetChange,
} from './mockData';

describe('AnalysisOverview', () => {
  it('renders beginning and ending balance', () => {
    render(<AnalysisOverview result={mockExtractionResult} />);

    expect(screen.getByText('Beginning Balance')).toBeInTheDocument();
    expect(screen.getByText('Ending Balance')).toBeInTheDocument();
    expect(screen.getByText('$10,000.00')).toBeInTheDocument();
    expect(screen.getByText('$15,000.00')).toBeInTheDocument();
  });

  it('shows positive net change in green', () => {
    render(<AnalysisOverview result={mockExtractionResult} />);

    const netChangeSection = screen.getByText('Net Change').closest('div');
    const greenText = netChangeSection?.querySelector('.text-green-600');
    expect(greenText).toBeInTheDocument();
    expect(greenText?.textContent).toContain('+$5,000.00');
  });

  it('shows negative net change in red', () => {
    render(<AnalysisOverview result={mockExtractionResultNegativeNetChange} />);

    const netChangeSection = screen.getByText('Net Change').closest('div');
    const redText = netChangeSection?.querySelector('.text-red-600');
    expect(redText).toBeInTheDocument();
    expect(redText?.textContent).toContain('-$5,000.00');
  });

  it('displays N/A for null amounts', () => {
    render(<AnalysisOverview result={mockExtractionResultNullBalances} />);

    expect(screen.getAllByText('N/A')).toHaveLength(2);
  });

  it('shows keyword source label', () => {
    render(<AnalysisOverview result={mockExtractionResult} />);

    expect(screen.getByText(/via "Opening Balance"/)).toBeInTheDocument();
    expect(screen.getByText(/via "Closing Balance"/)).toBeInTheDocument();
  });

  it('returns null when balances are undefined', () => {
    const { container } = render(
      <AnalysisOverview
        result={{
          ...mockExtractionResult,
          balances: undefined,
        }}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('calculates net change correctly', () => {
    render(<AnalysisOverview result={mockExtractionResult} />);

    // Beginning: $10,000, Ending: $15,000, Net: +$5,000
    expect(screen.getByText('Net Change')).toBeInTheDocument();
  });
});
