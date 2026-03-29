// Quick profiling of the transaction parser
const tableRowRe = /^\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]*?)\s*\|\s*([^\|]*?)\s*\|\s*([^\|]*?)\s*\|/;

function isNoisePayee(payee) {
  const trimmed = payee.trim().toLowerCase();
  if (!trimmed) return true;
  if (/^[\s\|\-\+=\*]+$/.test(trimmed)) return true;
  if (/^\d+$/.test(trimmed)) return true;
  return false;
}

function parseAmount(raw) {
  if (!raw || raw.trim() === '') return null;
  const cleaned = raw.replace(/[$,()]/g, '').trim();
  const isNegative = cleaned.startsWith('-') || (cleaned.startsWith('(') && cleaned.endsWith(')'));
  const numStr = cleaned.replace(/[()]/g, '').replace(/^-/, '');
  const n = parseFloat(numStr);
  return isNaN(n) ? null : (isNegative ? -n : n);
}

// Build a ~40K char markdown string simulating bank statement
const header = `| Account Summary - 7935054275 | Account Summary - 7935054275 |
| --- | --- |
`;
const rowTemplate = '| 12/01 | ANALYSIS PERIOD: 11/01/25 - 11/30/25 | $1,500.00 | $3,683.00 | $12.00 |\n';
const markdown = header + rowTemplate.repeat(1500);

console.log('Markdown size:', markdown.length, 'chars,', markdown.split('\n').length, 'lines');

const start = Date.now();
const lines = markdown.split('\n');
let matchCount = 0;
let noiseCount = 0;
let amountCount = 0;

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed === '|' || trimmed.startsWith('#') || trimmed.startsWith('---')) continue;

  const m = trimmed.match(tableRowRe);
  if (!m) continue;

  const [, dateRaw, description, debitRaw, creditRaw] = m.map(s => s.trim());
  matchCount++;

  if (isNoisePayee(description)) {
    noiseCount++;
    continue;
  }

  const debit = parseAmount(debitRaw);
  const credit = parseAmount(creditRaw);
  if (debit !== null || credit !== null) amountCount++;
}

console.log('Parse time:', Date.now() - start, 'ms');
console.log('Matches:', matchCount, 'noise filtered:', noiseCount, 'with amounts:', amountCount);
