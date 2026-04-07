import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalysisDetailed } from '../components/analysis/AnalysisDetailed';
import {
  mockExtractionResult,
  mockExtractionResultFallbackAI,
} from './mockData';

describe('AnalysisDetailed', () => {
  it('renders full ExtractionResult with all sections', () => {
    render(<AnalysisDetailed result={mockExtractionResult} />);

    // Header
    expect(screen.getByText('AI Document Analysis')).toBeInTheDocument();

    // Score badge
    expect(screen.getByText('Score: 8/10')).toBeInTheDocument();

    // Document Validity
    expect(screen.getByText('Valid Financial Document')).toBeInTheDocument();

    // PII Indicators
    expect(screen.getByText('PII Indicators')).toBeInTheDocument();
    expect(screen.getByText(/SSN: Found/)).toBeInTheDocument();
    expect(screen.getByText(/Account #: Found/)).toBeInTheDocument();

    // Transaction Summary
    expect(screen.getByText('Transaction Summary')).toBeInTheDocument();
    expect(screen.getByText('Credits')).toBeInTheDocument();
    expect(screen.getByText('Debits')).toBeInTheDocument();

    // Risk Indicators
    expect(screen.getByText('Risk Indicators')).toBeInTheDocument();
    expect(screen.getByText('Large/unusual transactions detected')).toBeInTheDocument();

    // Recommendations
    expect(screen.getByText('AI Recommendations')).toBeInTheDocument();
  });

  it('shows Basic badge for fallback AI analysis', () => {
    render(<AnalysisDetailed result={mockExtractionResultFallbackAI} />);

    expect(screen.getByText('Basic')).toBeInTheDocument();
  });

  it('returns null when ai_analysis.analysis is missing', () => {
    const resultWithoutAI = {
      ...mockExtractionResult,
      ai_analysis: undefined,
    };
    const { container } = render(<AnalysisDetailed result={resultWithoutAI} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays risk indicator bullets', () => {
    render(<AnalysisDetailed result={mockExtractionResult} />);

    expect(screen.getByText('Large/unusual transactions detected')).toBeInTheDocument();
  });

  it('displays recommendations with numbering', () => {
    render(<AnalysisDetailed result={mockExtractionResult} />);

    // First recommendation
    expect(screen.getByText('Review large transactions with management')).toBeInTheDocument();
  });

  it('displays transaction credits and debits correctly', () => {
    render(<AnalysisDetailed result={mockExtractionResult} />);

    // Credits: 15, +$25,000
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText('+$25,000')).toBeInTheDocument();

    // Debits: 12, -$20,000
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('-$20,000')).toBeInTheDocument();
  });
});
