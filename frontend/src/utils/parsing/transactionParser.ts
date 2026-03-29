import type { ParsedStatement, TransactionRow } from '../../types/transactions';
import { parseDate, looksLikeDate } from './dateParser';
import { parseAmount, tryParseAmount } from './amountParser';
import {
  detectSectionType,
  isColumnHeaderRow,
  isSectionSummaryRow,
  isSeparatorRow,
  type SectionType,
} from './sectionDetector';
import { parseChecksRow } from './checksParser';

let _idCounter = 0;
function generateId(): string {
  return `txn_${Date.now()}_${++_idCounter}`;
}

/** Split a markdown table row into clean cell strings. */
function splitRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed || trimmed === '|') return [];
  const inner = trimmed.replace(/^\||\|$/g, '');
  return inner.split('|').map(c => c.trim()).filter(c => c.length > 0);
}

function extractCheckNumber(description: string): string {
  const match = description.match(/(?:check|chk|#)\s*(\d+)/i);
  return match ? match[1] : '';
}

/** Parse a 3-column transaction row: [Date] | [Amount] | [Description]
 *  Returns null if the row doesn't look like a transaction.
 *
 *  Key insight: in Docling's 3-column format, the SECOND cell is always the amount.
 *  If the second cell is NOT an amount (e.g., "Beginning Balance"), it's an Account Summary
 *  row — not a transaction — and must be rejected. */
export function parseTransactionRow(
  cells: string[],
  sectionType: SectionType,
): { date: string; amount: string; description: string; isCredit: boolean } | null {
  if (cells.length < 2) return null;

  // First cell must be a date
  const first = cells[0].trim();
  if (!looksLikeDate(first)) return null;

  // CRITICAL: Second cell must be an amount. If it's text like "Beginning Balance",
  // this is an Account Summary row — not a transaction. Reject it.
  if (cells.length >= 2) {
    const second = cells[1].trim();
    if (second && tryParseAmount(second) === null) return null;
  }

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
    /(?:Statement\s+Period\s+Date|Analysis\s+Period):\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s*[-–—]\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/m
  );
  if (periodMatch) statementPeriod = `${periodMatch[1]} - ${periodMatch[2]}`;

  // ── Extract balances ─
  // Handle Docling format: "Beginning Balance | $(1,785.93)" or "Beginning Balance | $1,234.56"
  const begBalMatch = markdown.match(/Beginning\s+Balance\s+\|\s*\$?([\d,]+\.?\d*)/m)
    ?? markdown.match(/Beginning\s+Balance\s+\$([\d,]+\.?\d*)/m);
  if (begBalMatch) beginningBalance = parseAmount(begBalMatch[1]);
  const endBalMatch = markdown.match(/Ending\s+Balance\s+\|\s*\$?([\d,]+\.?\d*)/m)
    ?? markdown.match(/Ending\s+Balance\s+\$([\d,]+\.?\d*)/m);
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
    // Detect checks format: first cell is a check number pattern (digits + optional * or i)
    const firstCell = cells[0]?.trim() ?? '';
    const isChecksRow = /^\d+\s*\*?\s*i?\s*$/.test(firstCell);
    if (currentSection === 'checks' || isChecksRow) {
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
