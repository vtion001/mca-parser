import type { ParsedStatement, TransactionRow } from '../types/transactions';

let _idCounter = 0;
function generateId(): string {
  return `txn_${Date.now()}_${++_idCounter}`;
}

// ─── Amount Parsing ──────────────────────────────────────────────────────────

function parseAmount(raw: string): number | null {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.replace(/[$,()]/g, '').trim();
  const isNegative = cleaned.startsWith('-') || (cleaned.startsWith('(') && cleaned.endsWith(')'));
  const numStr = cleaned.replace(/[()]/g, '').replace(/^-/, '');
  const n = parseFloat(numStr);
  if (isNaN(n)) return null;
  return isNegative ? -n : n;
}

// ─── Date Parsing ───────────────────────────────────────────────────────────

function parseDate(raw: string): string {
  if (!raw || raw.trim() === '') return '';
  const trimmed = raw.trim();
  const mdyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    const year = y.length === 2 ? `20${y}` : y;
    return `${m.padStart(2, '0')}/${d.padStart(2, '0')}/${year}`;
  }
  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'];
  const longMatch = trimmed.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})/i);
  if (longMatch) {
    const monthIdx = monthNames.indexOf(longMatch[1].toLowerCase());
    if (monthIdx >= 0) {
      return `${String(monthIdx + 1).padStart(2, '0')}/${longMatch[2].padStart(2, '0')}/${longMatch[3]}`;
    }
  }
  return trimmed;
}

// ─── Markdown Table Parser (docling-native format) ─────────────────────────────────
// Docling's export_to_markdown() produces GFM tables where:
//   - Section headers are rows whose cells contain keywords like "Withdrawals / Debits", "Checks", "Deposits / Credits"
//   - Transaction rows have format: [Date] | [Amount] | [Description]   (3-column)
//   - Check rows have format: [Number] | [Date] | [Amount] repeating     (6+ column)
//   - Summary rows have format: [count] | [section name] | [total amount]  (3-column summary)

type SectionType = 'unknown' | 'withdrawals' | 'deposits' | 'checks';

/** Split a markdown table row into clean cell strings. */
function splitRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed || trimmed === '|') return [];
  const inner = trimmed.replace(/^\||\|$/g, '');
  return inner.split('|').map(c => c.trim()).filter(c => c.length > 0);
}

/** Is this a GFM table separator row?  e.g.  |---|---|---| */
function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every(cell => /^-{3,}$/.test(cell) || /^:-+$/.test(cell) || /:-?:/.test(cell));
}

/** "Looks like a date" — handles mm/dd, mm-dd, mm/dd/yyyy, yyyy-mm-dd, MMM DD, YYYY */
function looksLikeDate(s: string): boolean {
  const t = s.trim();
  // Must contain a separator between two number groups (to avoid matching plain 6-digit numbers)
  // mm/dd or mm-dd (with optional year suffix)
  if (/^\d{1,2}[\/\-]\d{1,2}([\/\-]\d{2,4})?$/.test(t)) return true;
  // yyyy-mm-dd
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(t)) return true;
  // "November 15, 2025" style
  if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/.test(t)) return true;
  return false;
}

/** Try to parse a string as a dollar amount. */
function tryParseAmount(s: string): number | null {
  const t = s.trim();
  if (!/^\$?[\d,.\-()]+$/.test(t)) return null;
  const cleaned = t.replace(/[$,()]/g, '').trim();
  const isNeg = t.startsWith('(') || t.startsWith('-');
  const numStr = cleaned.replace(/[()]/g, '').replace(/^-/, '');
  const n = parseFloat(numStr);
  if (isNaN(n)) return null;
  return isNeg ? -n : n;
}

/** Determine section type by scanning ALL cells for section keywords.
 *  Docling puts section names in the first cell of multi-column rows. */
function detectSectionType(cells: string[]): SectionType {
  if (cells.length < 1) return 'unknown';
  const allText = cells.map(c => c.toLowerCase()).join(' ');
  if (/checks?\s+totaling/i.test(allText)) return 'checks';
  if (/^checks?\s*$/i.test(cells[0] ?? '')) return 'checks';
  if (/withdrawals?\s*\/?\s*debits?/i.test(allText)) return 'withdrawals';
  if (/deposits?\s*\/?\s*credits?/i.test(allText)) return 'deposits';
  if (/electronic\s*(credits?|debits?)/i.test(allText)) {
    if (/credit/.test(allText)) return 'deposits';
    if (/debit|withdrawal/.test(allText)) return 'withdrawals';
  }
  return 'unknown';
}

/** Is this a column header row? (first cell is "date", "description", etc.) */
function isColumnHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const first = cells[0].toLowerCase().trim();
  const headerWords = ['date', 'description', 'amount', 'memo', 'balance', 'payee', 'transaction', 'number', 'type'];
  if (headerWords.some(w => first === w)) return true;
  // If ALL cells look like short lowercase header labels, skip
  if (cells.every(c => /^[a-z]{2,12}$/.test(c.trim()))) return true;
  return false;
}

/** Is this a section summary/totals row? e.g. "38 checks totaling $122,356.96" */
function isSectionSummaryRow(cells: string[]): boolean {
  if (cells.length < 1) return false;
  const first = cells[0].toLowerCase();
  const allText = cells.map(c => c.toLowerCase()).join(' ');
  if (/^\d+\s+checks?\s+totaling/i.test(first)) return true;
  if (/\d+\s+items?\s+totaling/i.test(allText)) return true;
  return false;
}

/** Parse a checks-table row (6+ columns: Number, Date, Amount repeating). */
function parseChecksRow(cells: string[]): Array<{ date: string; amount: string; checkNumber: string }> {
  const results: Array<{ date: string; amount: string; checkNumber: string }> = [];
  for (let i = 0; i + 2 < cells.length; i += 3) {
    const numCell = cells[i]?.trim() ?? '';
    const dateCell = cells[i + 1]?.trim() ?? '';
    const amtCell = cells[i + 2]?.trim() ?? '';
    if (!numCell || !dateCell || !amtCell) continue;
    if (/^number$/i.test(numCell)) continue;
    if (!/^\d+\s*\*?\s*i?\s*$/i.test(numCell)) continue;
    if (!looksLikeDate(dateCell)) continue;
    if (tryParseAmount(amtCell) === null) continue;
    results.push({ date: dateCell, amount: amtCell, checkNumber: numCell.replace(/\s+/g, ' ') });
  }
  return results;
}

/** Parse a 3-column transaction row: [Date] | [Amount] | [Description]
 *  Returns null if the row doesn't look like a transaction. */
function parseTransactionRow(cells: string[], sectionType: SectionType): { date: string; amount: string; description: string; isCredit: boolean } | null {
  if (cells.length < 2) return null;

  // First cell must be a date for transaction rows
  const first = cells[0].trim();
  if (!looksLikeDate(first)) return null;

  let amount = '';
  let isCredit = sectionType === 'deposits';
  let description = '';

  for (let i = 1; i < cells.length; i++) {
    const cell = cells[i].trim();
    if (!cell) continue;
    const amt = tryParseAmount(cell);
    if (amt !== null && !amount) {
      amount = cell;
      if (sectionType === 'unknown') {
        isCredit = amt >= 0;
      }
    } else {
      if (description) description += ' ' + cell;
      else description = cell;
    }
  }

  if (!amount) return null;
  return { date: first, amount, description, isCredit };
}

export function parseTransactionsFromMarkdown(markdown: string): ParsedStatement {
  const lines = markdown.split('\n');
  const transactions: TransactionRow[] = [];
  let accountNumber = '';
  let statementPeriod = '';
  let beginningBalance: number | null = null;
  let endingBalance: number | null = null;

  // ── Extract account number and period from heading lines ──────────────────────
  const accountMatch = markdown.match(/Account\s+Number:\s*(\d+)/m);
  if (accountMatch) accountNumber = accountMatch[1];
  const headingMatch = markdown.match(/##\s*[A-Z][A-Z\s]+\s*[-–]?\s*(\d{6,14})/m);
  if (headingMatch) accountNumber = accountNumber || headingMatch[1];
  const periodMatch = markdown.match(
    /(?:Statement\s+Period\s+Date|Analysis\s+Period):\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*[-–]\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/m
  );
  if (periodMatch) statementPeriod = `${periodMatch[1]} - ${periodMatch[2]}`;

  // ── Extract balances ─
  const begBalMatch = markdown.match(/Beginning\s+Balance\s+\$?([\d,]+\.?\d*)/m);
  if (begBalMatch) beginningBalance = parseAmount(begBalMatch[1]);
  const endBalMatch = markdown.match(/Ending\s+Balance\s+\$?([\d,]+\.?\d*)/m);
  if (endBalMatch) endingBalance = parseAmount(endBalMatch[1]);

  // ── Also extract from key-detail markdown tables (Account Summary block) ─
  const keyDetailRe = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|?\s*$/;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '|' || trimmed.startsWith('#')) continue;
    const m = trimmed.match(keyDetailRe);
    if (m) {
      const [, label, value] = m.map((s: string) => s.trim());
      const labelLower = label.toLowerCase();
      if (labelLower.includes('account') && labelLower.includes('number')) {
        accountNumber = accountNumber || value.replace(/[*]/g, '');
      } else if (labelLower.includes('period') || labelLower.includes('statement')) {
        statementPeriod = statementPeriod || value;
      } else if (labelLower.includes('beginning') || labelLower.includes('opening')) {
        if (beginningBalance === null) beginningBalance = parseAmount(value);
      } else if (labelLower.includes('ending') || labelLower.includes('closing')) {
        if (endingBalance === null) endingBalance = parseAmount(value);
      }
    }
  }

  // ── PASS: Scan lines — identify sections, then parse transactions ─────────────
  let currentSection: SectionType = 'unknown';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cells = splitRow(line);

    if (cells.length < 1) continue;
    if (isSeparatorRow(cells)) continue;

    // Update current section when we hit a section header
    const detected = detectSectionType(cells);
    if (detected !== 'unknown') {
      currentSection = detected;
      continue; // skip the header row itself
    }

    // Skip column header rows (Date | Amount | Description)
    if (isColumnHeaderRow(cells)) continue;
    // Skip section summary rows (e.g. "38 checks totaling $122,356.96")
    if (isSectionSummaryRow(cells)) continue;

    // ── Parse Checks (6-column repeating: Number | Date | Amount × N) ───────
    if (currentSection === 'checks') {
      const parsedChecks = parseChecksRow(cells);
      for (const { date, amount, checkNumber } of parsedChecks) {
        const debit = tryParseAmount(amount);
        if (debit === null) continue;
        transactions.push({
          id: generateId(),
          date: parseDate(date),
          payee: `Check ${checkNumber}`,
          debit: Math.abs(debit),
          credit: null,
          balance: null,
          memo: '',
          checkNumber,
          tags: [],
          isTrue: false,
          isReviewed: false,
        });
      }
      continue;
    }

    // ── Parse 3-column transaction rows ──────────────────────────────────────
    const parsed = parseTransactionRow(cells, currentSection);
    if (!parsed) continue;

    // Skip pure-numeric descriptions (card numbers, reference numbers embedded in OCR)
    if (/^\d+$/.test(parsed.description.trim())) continue;
    // Skip rows with description shorter than 2 meaningful chars
    if (parsed.description.replace(/[*_`#\s]/g, '').length < 2) continue;

    const debitAmt = tryParseAmount(parsed.amount);
    const debit = parsed.isCredit ? null : (debitAmt !== null ? Math.abs(debitAmt) : null);
    const credit = parsed.isCredit ? (debitAmt !== null ? Math.abs(debitAmt) : null) : null;

    if (debit === null && credit === null) continue;

    transactions.push({
      id: generateId(),
      date: parseDate(parsed.date),
      payee: parsed.description.replace(/[*_`#]/g, '').trim(),
      debit,
      credit,
      balance: null,
      memo: '',
      checkNumber: extractCheckNumber(parsed.description),
      tags: [],
      isTrue: false,
      isReviewed: false,
    });
  }

  // ── Fallback: any 8-14 digit number in the markdown ─────────────────────────
  if (!accountNumber) {
    const rawMatch = markdown.match(/\b(\d{8,14})\b/m);
    if (rawMatch) accountNumber = rawMatch[1];
  }

  return {
    accountNumber,
    accountName: '',
    statementPeriod,
    transactions,
    beginningBalance,
    endingBalance,
  };
}

// ─── Auto-tagging ───────────────────────────────────────────────────────────

export function autoTag(description: string, credit: number | null = null, debit: number | null = null): string[] {
  const desc = description.toLowerCase();
  const tags: string[] = [];
  const isCredit = credit !== null && credit > 0;
  const isDebit = debit !== null && debit > 0;

  if (desc.includes('wire from') || desc.includes('wire to') || desc.includes('wire transfer')) {
    tags.push('Wire');
    tags.push('Transfer');
  } else if (desc.includes('ach') || desc.includes('xfr xfer') || desc.includes('zelle') || desc.includes('direct dep')) {
    tags.push('Transfer');
  } else if (desc.includes('mca') || desc.includes('merchant cash advance')) {
    tags.push('MCA');
  } else if (isCredit || desc.includes('deposit') || desc.includes('refund') || desc.includes('reversal') || desc.includes('correction')) {
    tags.push('Inflows');
  } else if (isDebit || desc.includes('payment') || desc.includes('fee') || desc.includes('charge')) {
    tags.push('All Other Debits');
  } else {
    tags.push('Non-Descript Revenue');
  }

  const amount = credit ?? debit ?? 0;
  if (Math.abs(amount) > 100_000) tags.push('Large/Unusual');
  if (desc.includes('overdraft') || desc.includes('nsf') || desc.includes('returned')) {
    tags.push('Returned Item');
  }

  return [...new Set(tags)];
}

function extractCheckNumber(description: string): string {
  const match = description.match(/(?:check|chk|#)\s*(\d+)/i);
  return match ? match[1] : '';
}

// ─── Tag helpers ─────────────────────────────────────────────────────────────

export function getTagColor(tag: string): { bg: string; text: string; border: string } {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    'MCA': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'MCA Related': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'Transfer': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    'Credit Card Payment Processor': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    'Inflows': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    'All Other Debits': { bg: 'bg-bw-100', text: 'text-bw-700', border: 'border-bw-200' },
    'Returned Item': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
    'Non-Descript Revenue': { bg: 'bg-bw-50', text: 'text-bw-500', border: 'border-bw-200' },
    'Large/Unusual': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    'Overdraft': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  };
  return map[tag] ?? { bg: 'bg-bw-50', text: 'text-bw-600', border: 'border-bw-200' };
}
