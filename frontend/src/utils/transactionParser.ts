// Barrel re-export — all parsing logic lives in ./parsing/
export {
  parseDate,
  looksLikeDate,
  monthNames,
  parseAmount,
  tryParseAmount,
  detectSectionType,
  isColumnHeaderRow,
  isSectionSummaryRow,
  isSeparatorRow,
  type SectionType,
  parseChecksRow,
  type ParsedCheck,
  parseTransactionRow,
  parseTransactionsFromMarkdown,
} from './parsing';

// ─── Auto-tagging ───────────────────────────────────────────────────────────

export function autoTag(
  description: string,
  credit: number | null = null,
  debit: number | null = null,
): string[] {
  const desc = description.toLowerCase();
  const tags: string[] = [];
  const isCredit = credit !== null && credit > 0;
  const isDebit = debit !== null && debit > 0;

  if (desc.includes('wire from') || desc.includes('wire to') || desc.includes('wire transfer')) {
    tags.push('Wire');
    tags.push('Transfer');
  } else if (
    desc.includes('ach') ||
    desc.includes('xfr xfer') ||
    desc.includes('zelle') ||
    desc.includes('direct dep')
  ) {
    tags.push('Transfer');
  } else if (desc.includes('mca') || desc.includes('merchant cash advance')) {
    tags.push('MCA');
  } else if (
    isCredit ||
    desc.includes('deposit') ||
    desc.includes('refund') ||
    desc.includes('reversal') ||
    desc.includes('correction')
  ) {
    tags.push('Inflows');
  } else if (isDebit || desc.includes('payment') || desc.includes('fee') || desc.includes('charge')) {
    tags.push('All Other Debits');
  } else {
    tags.push('Non-Descript Revenue');
  }

  const amount = credit ?? debit ?? 0;
  if (Math.abs(amount) > 100_000) tags.push('Large/Unusual');
  if (
    desc.includes('overdraft') ||
    desc.includes('nsf') ||
    desc.includes('returned')
  ) {
    tags.push('Returned Item');
  }

  return [...new Set(tags)];
}

// ─── Tag helpers ─────────────────────────────────────────────────────────────

export function getTagColor(tag: string): { bg: string; text: string; border: string } {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    'MCA': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'MCA Related': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'Transfer': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    'Credit Card Payment Processor': {
      bg: 'bg-orange-50',
      text: 'text-orange-700',
      border: 'border-orange-200',
    },
    'Inflows': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    'All Other Debits': { bg: 'bg-bw-100', text: 'text-bw-700', border: 'border-bw-200' },
    'Returned Item': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    'Non-Descript Revenue': { bg: 'bg-bw-50', text: 'text-bw-500', border: 'border-bw-200' },
    'Large/Unusual': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    'Overdraft': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  };
  return map[tag] ?? { bg: 'bg-bw-50', text: 'text-bw-600', border: 'border-bw-200' };
}
