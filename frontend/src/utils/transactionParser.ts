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

// ─── Date Parsing ────────────────────────────────────────────────────────────

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

// ─── Noise Filters ───────────────────────────────────────────────────────────

const SECTION_HEADER_KEYWORDS = [
  'checks', 'withdrawals', 'deposits', 'credits', 'debits', 'balance',
  'beginning balance', 'ending balance', 'opening balance', 'closing balance',
  'total', 'subtotal', 'summary', 'beginning', 'ending', 'opening', 'closing',
  ' withdrawals / debits', ' deposits / credits', 'analysis period',
  'transactions',
];

const IS_NOISE_PAYEE = [
  /^\s*[-_=~]{3,}\s*$/,           // Separator lines: --- or ___ or ===
  /^\s*[\|\+\\*]{3,}\s*$/,        // | | | or + + + etc.
  /^\s*[\s\W]*$/,                 // Only symbols / whitespace
  /^\s*page\s+\d+\s*$/i,         // "Page 1"
  /^\s*statement\s+period/i,
  /^\s*account\s+summary/i,
  /^\s*transaction\s+detail/i,
  /^\s*balance\s+forward/i,
  /^\s*analysis period/i,
  /^\s*standard monthly service charge$/i,
  /^checks?\s*$/i,
  /^withdrawals?\s*$/i,
  /^deposits?\s*$/i,
  /^credits?\s*$/i,
  /^debits?\s*$/i,
  /^ withdrawals \/ debits\s*$/i,
  /^ deposits \/ credits\s*$/i,
  /^ ending\s+balance\s*$/i,
  /^ beginning\s+balance\s*$/i,
  /^ available\s+balance\s*$/i,
  /^ indicates gap in check sequence/i,
  /^ number$/i,
  /^ date$/i,
  /^ paid$/i,
  /^ electronic image$/i,
  /^ i = electronic image$/i,
  // "134 items totaling" — section summary rows
  /^\d+\s+items?\s+totaling/i,
];

function isNoisePayee(payee: string): boolean {
  const trimmed = payee.trim().toLowerCase();
  if (!trimmed) return true;
  // Empty or pure symbols
  if (/^[\s\|\-\+=\*]+$/.test(trimmed)) return true;
  // Pure numeric (like "18273.9", "14154.4" — reference numbers, not amounts)
  if (/^\d+(\.\d+)?$/.test(trimmed)) return true;
  // Matches section header keywords at start
  if (SECTION_HEADER_KEYWORDS.some(kw => trimmed.startsWith(kw))) return true;
  // Matches any noise pattern
  if (IS_NOISE_PAYEE.some(re => re.test(trimmed))) return true;
  // Too short noise
  if (trimmed.length < 2) return true;
  return false;
}

function isNoiseDate(date: string): boolean {
  const trimmed = date.trim();
  // Numbers alone (like "38", "134" — page numbers or section counts)
  if (/^\d+$/.test(trimmed)) return true;
  // Section names that happen to be matched as dates
  if (SECTION_HEADER_KEYWORDS.some(kw => trimmed.toLowerCase().includes(kw))) return true;
  // A date field that's actually a label (e.g. "Number", "Date Paid", "Amount")
  if (/^(number|date|paid|amount|description|memo|balance|check|chk)\s*$/i.test(trimmed)) return true;
  // Check number + optional asterisk pattern (e.g. "3650*i", "3670*i") — not a date
  if (/^\d+\s*\*?\s*i?\s*$/i.test(trimmed)) return true;
  // "i = Electronic Image" or similar check register notes in date field
  if (/^=\s*\w+/.test(trimmed)) return true;
  return false;
}

// ─── Markdown Table Parser (cell-based, format-agnostic) ──────────────────────

type SectionType = 'unknown' | 'withdrawals' | 'deposits' | 'checks';

/** Split a markdown table row into clean cell strings.
 *  Handles:  | A | B | C |   and also:  A | B | C
 *  Leading/trailing pipes are stripped; each cell is individually trimmed. */
function splitRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed || trimmed === '|') return [];
  // Strip leading/trailing | then split by |
  const inner = trimmed.replace(/^\||\|$/g, '');
  return inner.split('|').map(c => c.trim()).filter(c => c.length > 0);
}

/** Is this a GFM table separator row?  e.g.  |---|---|---| */
function isSeparatorRow(cells: string[]): boolean {
  return cells.every(cell => /^-{3,}$/.test(cell) || /^:-+$/.test(cell) || /:-?:/.test(cell));
}

/** Detect section type from raw line text (before splitRow filtering).
 *  Works on both full row text and cell arrays. */
function detectSectionTypeFromText(text: string): SectionType {
  const t = text.toLowerCase();
  if (!t.trim()) return 'unknown';

  // Checks section: "Checks" alone or "Checks  N checks totaling $X"
  if (/^checks?\b/i.test(t.trim()) && /checks?\s+totaling/i.test(t)) return 'checks';
  if (/^checks?\s*$/i.test(t.trim())) return 'checks';

  // Withdrawals / Debits section
  if (/withdrawals?\s*\/?\s*debits?/i.test(t)) return 'withdrawals';

  // Deposits / Credits section
  if (/deposits?\s*\/?\s*credits?/i.test(t)) return 'deposits';

  // Electronic credits/debits
  if (/electronic\s*(credits?|debits?)/i.test(t)) {
    if (/credit/.test(t)) return 'deposits';
    if (/debit|withdrawal/.test(t)) return 'withdrawals';
  }

  return 'unknown';
}

/** Identify which cell is the date, which is the amount (credit or debit),
 *  and which is the description / payee.
 *  Strategy: scan cells; first date-like → date; first $-amount → amount;
 *  remaining text → description. */
interface ParsedCells {
  date: string;
  description: string;
  amount: string;   // raw amount string e.g. "$1,234.56"
  isCredit: boolean;
}

function parseCells(cells: string[], sectionType: SectionType): ParsedCells | null {
  let date = '';
  let description = '';
  let amount = '';
  let isCredit = false;

  for (const cell of cells) {
    const t = cell.trim();
    if (!t) continue;

    // Check if this cell is a date
    if (!date && looksLikeDate(t)) {
      date = t;
      continue;
    }

    // Check if this cell is a dollar amount
    const amt = tryParseAmount(t);
    if (amt !== null && !amount) {
      amount = t;
      // Deposits section → credit; Withdrawals → debit; Unknown section:
      // negative numbers are debits, positive are credits
      if (sectionType === 'deposits') {
        isCredit = true;
      } else if (sectionType === 'withdrawals') {
        isCredit = false;
      } else {
        isCredit = amt >= 0;
      }
      continue;
    }

    // Remaining cells contribute to description
    if (description) description += ' ' + t;
    else description = t;
  }

  if (!date && !amount) return null; // Not a data row
  return { date, description, amount, isCredit };
}

/** Parse a checks table row which has 6 columns: Number, Date, Amount, Number, Date, Amount (repeating).
 *  Returns multiple transactions per row. */
function parseChecksRow(cells: string[]): ParsedCells[] {
  const results: ParsedCells[] = [];
  // Must have 6+ cells in groups of 3
  for (let i = 0; i + 2 < cells.length; i += 3) {
    const numCell = cells[i]?.trim();
    const dateCell = cells[i + 1]?.trim();
    const amtCell = cells[i + 2]?.trim();
    if (!numCell || !dateCell || !amtCell) continue;
    // Skip if "Number" header text appears in first cell
    if (/^number$/i.test(numCell)) continue;
    // Check number must be mostly digits
    if (!/^\d+\s*\*?\s*i?\s*$/i.test(numCell)) continue;
    if (!looksLikeDate(dateCell)) continue;
    if (tryParseAmount(amtCell) === null) continue;
    results.push({ date: dateCell, description: `Check ${numCell.replace(/\s+/g, ' ')}`, amount: amtCell, isCredit: false });
  }
  return results;
}

/** "Looks like a date" — mm/dd/yyyy, dd/mm/yyyy, yyyy-mm-dd, mm/dd, or MMM DD, YYYY */
function looksLikeDate(s: string): boolean {
  const t = s.trim();
  // mm/dd/yyyy or dd/mm/yyyy or yyyy-mm-dd (with year)
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(t)) return true;
  // yyyy-mm-dd
  if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(t)) return true;
  // mm/dd or dd/mm (standalone 2-field date without year)
  if (/^\d{1,2}[\/\-]\d{1,2}$/.test(t)) return true;
  // "November 15, 2025" style
  if (/^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/.test(t)) return true;
  return false;
}

/** Try to parse a string as a dollar amount.
 *  Returns the numeric value (negative for debits in parens), or null if not a dollar amount. */
function tryParseAmount(s: string): number | null {
  const t = s.trim();
  // Must start with $ or be a bare number
  if (!/^\$?[\d,.\-()]+$/.test(t)) return null;
  const cleaned = t.replace(/[$,()]/g, '').trim();
  const isNeg = t.startsWith('(') || t.startsWith('-');
  const numStr = cleaned.replace(/[()]/g, '').replace(/^-/, '');
  const n = parseFloat(numStr);
  if (isNaN(n)) return null;
  return isNeg ? -n : n;
}

export function parseTransactionsFromMarkdown(markdown: string): ParsedStatement {
  const lines = markdown.split('\n');
  const transactions: TransactionRow[] = [];
  let accountNumber = '';
  let accountName = '';
  let statementPeriod = '';
  let beginningBalance: number | null = null;
  let endingBalance: number | null = null;

  // ─ Metadata: scan all lines for key details ─
  const keyDetailRe = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|?\s*$/;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '|' || trimmed.startsWith('#')) continue;
    const m = trimmed.match(keyDetailRe);
    if (m) {
      const [, label, value] = m.map((s: string) => s.trim());
      const labelLower = label.toLowerCase();
      if (labelLower.includes('account') && labelLower.includes('number')) {
        accountNumber = value.replace(/[*]/g, '');
      } else if (labelLower.includes('period') || labelLower.includes('statement')) {
        statementPeriod = value;
      } else if (labelLower.includes('beginning') || labelLower.includes('opening')) {
        beginningBalance = parseAmount(value);
      } else if (labelLower.includes('ending') || labelLower.includes('closing')) {
        endingBalance = parseAmount(value);
      }
    }
  }

  // ── Extract account number and period from heading lines ──────────────────────
  // e.g. "## MORTGAGE FINANCE CHECKING - 2400099108" or "Account Number: 7935054275"
  const headingMatch = markdown.match(/##\s*[A-Z][A-Z\s]+\s*[-–]?\s*(\d{6,14})/m);
  if (headingMatch) accountNumber = accountNumber || headingMatch[1];
  const accountMatch = markdown.match(/Account\s+Number:\s*(\d+)/m);
  if (accountMatch) accountNumber = accountNumber || accountMatch[1];
  // Statement period: "Statement Period Date: 10/1/2025 - 10/31/2025" or "Analysis Period: 09/01/25 - 09/30/25"
  const periodMatch = markdown.match(/(?:Statement\s+Period\s+Date|Analysis\s+Period):\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*[-–]\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/m);
  if (periodMatch) statementPeriod = statementPeriod || `${periodMatch[1]} - ${periodMatch[2]}`;

  // ── Extract balances from "Beginning Balance $X" and "Ending Balance $Y" patterns ─
  const begBalMatch = markdown.match(/Beginning\s+Balance\s+\$?([\d,]+\.?\d*)/m);
  if (begBalMatch && beginningBalance === null) beginningBalance = parseAmount(begBalMatch[1]);
  const endBalMatch = markdown.match(/Ending\s+Balance\s+\$?([\d,]+\.?\d*)/m);
  if (endBalMatch && endingBalance === null) endingBalance = parseAmount(endBalMatch[1]);

  // ── PASS 1: Pre-scan lines to build section type map ─────────────────────────
  // Section headers can be 1-cell rows (trailing empty cells get filtered).
  // To avoid missing them, we pre-detect section types from raw line text.
  const sectionMap = new Map<number, SectionType>();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const raw = line.replace(/^\s*\|\s*|\s*\|\s*$/g, '').trim(); // strip outer pipes
    const detected = detectSectionTypeFromText(raw);
    if (detected !== 'unknown') {
      sectionMap.set(i, detected);
    }
  }

  // ── PASS 2: Parse transactions using section map ──────────────────────────────
  let currentSection: SectionType = 'unknown';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cells = splitRow(line);

    // Update current section if this line is a section header
    if (sectionMap.has(i)) {
      currentSection = sectionMap.get(i)!;
      continue; // skip the section header row itself
    }

    // Must have at least 2 cells to be a data row
    if (cells.length < 2) continue;
    // Skip GFM separator rows
    if (isSeparatorRow(cells)) continue;
    // Skip pure header rows (all cells look like column labels)
    if (isColumnHeaderRow(cells)) continue;
    // Skip section summary rows ("16 item(s) totaling $2,288,779.56")
    if (isSectionSummaryRow(cells)) continue;

    // Handle checks table specially (6-column repeating format)
    if (currentSection === 'checks') {
      const parsedChecks = parseChecksRow(cells);
      for (const parsed of parsedChecks) {
        const amount = tryParseAmount(parsed.amount);
        const debit = amount !== null ? Math.abs(amount) : null;
        if (debit === null) continue;
        if (parsed.description.replace(/[*_`#\s]/g, '').length < 2) continue;
        transactions.push({
          id: generateId(),
          date: parseDate(parsed.date),
          payee: parsed.description.replace(/[*_`#]/g, '').trim(),
          debit,
          credit: null,
          balance: null,
          memo: '',
          checkNumber: extractCheckNumber(parsed.description),
          tags: [],
          isTrue: false,
          isReviewed: false,
        });
      }
      continue;
    }

    // Parse 3-column rows (Withdrawals / Deposits)
    const parsed = parseCells(cells, currentSection);
    if (!parsed) continue;

    // Skip if date or description looks like noise
    if (isNoiseDate(parsed.date)) continue;
    if (isNoisePayee(parsed.description)) continue;

    const amount = tryParseAmount(parsed.amount);
    const debit = parsed.isCredit ? null : (amount !== null ? Math.abs(amount) : null);
    const credit = parsed.isCredit ? (amount !== null ? Math.abs(amount) : null) : null;
    const balance = null; // not reliably in 3-col format

    // Reject rows where both debit and credit are null (not a real transaction)
    if (debit === null && credit === null) continue;
    // Reject rows with no meaningful description
    if (parsed.description.replace(/[*_`#\s]/g, '').length < 2) continue;

    transactions.push({
      id: generateId(),
      date: parseDate(parsed.date),
      payee: parsed.description.replace(/[*_`#]/g, '').trim(),
      debit,
      credit,
      balance,
      memo: '',
      checkNumber: extractCheckNumber(parsed.description),
      tags: [],
      isTrue: false,
      isReviewed: false,
    });
  }

  // ── Fallback: any 8-14 digit number in the markdown (likely account number) ────
  if (!accountNumber) {
    const rawMatch = markdown.match(/\b(\d{8,14})\b/m);
    if (rawMatch) accountNumber = rawMatch[1];
  }

  return {
    accountNumber,
    accountName,
    statementPeriod,
    transactions,
    beginningBalance,
    endingBalance,
  };
}

function isColumnHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  // "date", "description", "amount", "memo", "balance" etc as first cell
  const first = cells[0].toLowerCase().trim();
  const headerWords = ['date', 'description', 'amount', 'memo', 'balance', 'payee', 'transaction', 'number', 'type'];
  if (headerWords.some(w => first === w)) return true;
  // If ALL cells look like short header labels, skip
  if (cells.every(c => /^[a-z]{2,8}$/.test(c.trim()))) return true;
  return false;
}

function isSectionSummaryRow(cells: string[]): boolean {
  const allText = cells.map(c => c.toLowerCase()).join(' ');
  if (/\d+\s+items?\s+totaling/i.test(allText)) return true;
  if (/total/i.test(allText) && /(?:credits?|debits?|withdrawals?|deposits?)/i.test(allText)) return true;
  return false;
}

// ─── Auto-tagging ───────────────────────────────────────────────────────────

export function autoTag(description: string, credit: number | null = null, debit: number | null = null): string[] {
  const desc = description.toLowerCase();
  const tags: string[] = [];
  const isCredit = credit !== null && credit > 0;
  const isDebit = debit !== null && debit > 0;

  // ─ Wire transfers ─────────────────────────────────────────────
  if (desc.includes('wire from') || desc.includes('wire to') || desc.includes('wire transfer')) {
    tags.push('Wire');
    tags.push('Transfer');
  }
  // ─ ACH / electronic transfers ─────────────────────────────────
  else if (desc.includes('ach') || desc.includes('xfr xfer') || desc.includes('zelle') || desc.includes('direct dep')) {
    tags.push('Transfer');
  }
  // ─ MCA transactions ───────────────────────────────────────────
  else if (desc.includes('mca') || desc.includes('merchant cash advance')) {
    tags.push('MCA');
  }
  // ─ Standard deposits / inflows ────────────────────────────────
  else if (isCredit || desc.includes('deposit') || desc.includes('refund') || desc.includes('reversal') || desc.includes('correction')) {
    tags.push('Inflows');
  }
  // ─ Standard debits / outflows ─────────────────────────────────
  else if (isDebit || desc.includes('payment') || desc.includes('fee') || desc.includes('charge')) {
    tags.push('All Other Debits');
  }
  // ─ Catch-all ─────────────────────────────────────────────────
  else {
    tags.push('Non-Descript Revenue');
  }

  // ─ Risk modifiers ────────────────────────────────────────────
  const amount = credit ?? debit ?? 0;
  if (Math.abs(amount) > 100_000) {
    tags.push('Large/Unusual');
  }
  if (desc.includes('overdraft') || desc.includes('nsf') || desc.includes('returned')) {
    tags.push('Returned Item');
  }

  // Deduplicate
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
