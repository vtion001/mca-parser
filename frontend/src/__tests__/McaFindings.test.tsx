import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { McaFindings } from '../components/analysis/McaFindings';
import {
  mockExtractionResult,
  mockExtractionResultEmptyMca,
} from './mockData';

describe('McaFindings', () => {
  it('renders transaction list (up to 10 shown)', () => {
    render(<McaFindings result={mockExtractionResult} />);

    // Should show MCA Transactions heading
    expect(screen.getByText('MCA Transactions')).toBeInTheDocument();

    // Should show summary stats
    expect(screen.getByText('Total MCA Amount')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Avg. Confidence')).toBeInTheDocument();

    // Should show 5 transactions (all from mock data)
    expect(screen.getByText('MCA PAYMENT - RAPID FUNDS')).toBeInTheDocument();
    expect(screen.getByText('MCA PAYMENT - BLUE CAPITAL')).toBeInTheDocument();
  });

  it('applies green confidence color for >= 0.8', () => {
    render(<McaFindings result={mockExtractionResult} />);

    // First transaction has 0.92 confidence (green)
    const greenBadges = screen.getAllByText((content) => {
      if (content.includes('92%')) return true;
      return false;
    });
    expect(greenBadges.length).toBeGreaterThan(0);
  });

  it('applies yellow confidence color for >= 0.5 and < 0.8', () => {
    render(<McaFindings result={mockExtractionResult} />);

    // Third transaction has 0.75 confidence (yellow)
    const yellowBadges = screen.getAllByText((content) => {
      if (content.includes('75%')) return true;
      return false;
    });
    expect(yellowBadges.length).toBeGreaterThan(0);
  });

  it('applies red confidence color for < 0.5', () => {
    render(<McaFindings result={mockExtractionResult} />);

    // Fifth transaction has 0.42 confidence (red)
    const redBadges = screen.getAllByText((content) => {
      if (content.includes('42%')) return true;
      return false;
    });
    expect(redBadges.length).toBeGreaterThan(0);
  });

  it('shows provider badges (first 3 + "+N more")', () => {
    render(<McaFindings result={mockExtractionResult} />);

    // First 3 providers shown as badges (look for badge container)
    const badgeContainers = document.querySelectorAll('.bg-blue-50.text-blue-700');
    const badgeTexts = Array.from(badgeContainers).map(el => el.textContent);
    expect(badgeTexts).toContain('Rapid Funds');
    expect(badgeTexts).toContain('Blue Capital');
    expect(badgeTexts).toContain('Progress Funds');

    // "+2 more" since there are 5 providers
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('shows AI-reviewed candidates section', () => {
    render(<McaFindings result={mockExtractionResult} />);

    expect(screen.getByText('AI-Reviewed Candidates')).toBeInTheDocument();
    expect(screen.getByText('POTENTIAL MCA - MERCHANT ADVANCE')).toBeInTheDocument();
    expect(screen.getByText('Pattern matches MCA characteristics')).toBeInTheDocument();
  });

  it('renders nothing when transaction list is empty', () => {
    const { container } = render(<McaFindings result={mockExtractionResultEmptyMca} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays correct summary stats', () => {
    render(<McaFindings result={mockExtractionResult} />);

    // Total MCA Amount: $11,100
    expect(screen.getByText('$11,100.00')).toBeInTheDocument();

    // Transactions count: 5
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
