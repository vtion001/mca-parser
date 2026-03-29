// Profile with real markdown from API
const https = require('http');

function fetchDoc(id) {
  return new Promise((resolve, reject) => {
    const req = https.get(`http://localhost:8000/api/v1/documents/${id}`, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

async function main() {
  const doc21 = await fetchDoc(21);
  const markdown = doc21.data.markdown || '';
  console.log('Real markdown size:', markdown.length, 'chars,', markdown.split('\n').length, 'lines');

  // Measure parse time
  const start = Date.now();

  const tableRowRe = /^\|\s*([^\|]+?)\s*\|\s*([^\|]+?)\s*\|\s*([^\|]*?)\s*\|\s*([^\|]*?)\s*\|\s*([^\|]*?)\s*\|/;
  const SECTION_HEADER_KEYWORDS = [
    'checks', 'withdrawals', 'deposits', 'credits', 'debits', 'balance',
    'beginning balance', 'ending balance', 'opening balance', 'closing balance',
    'total', 'subtotal', 'summary', 'beginning', 'ending', 'opening', 'closing',
    ' withdrawals / debits', ' deposits / credits',
  ];

  function isNoisePayee(payee) {
    const trimmed = payee.trim().toLowerCase();
    if (!trimmed) return true;
    if (/^[\s\|\-\+=\*]+$/.test(trimmed)) return true;
    if (/^\d+$/.test(trimmed)) return true;
    if (SECTION_HEADER_KEYWORDS.some(kw => trimmed.startsWith(kw))) return true;
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

  const transactions = [];
  const lines = markdown.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '|' || trimmed.startsWith('#') || trimmed.startsWith('---')) continue;
    const m = trimmed.match(tableRowRe);
    if (!m) continue;

    const [, dateRaw, description, debitRaw, creditRaw] = m.map(s => s.trim());
    if (dateRaw.toLowerCase().includes('date')) continue;
    if (description.toLowerCase().includes('description')) continue;
    if (description.toLowerCase().includes('transaction')) continue;

    const payee = description.replace(/[*_`#]/g, '').trim();
    if (isNoisePayee(payee)) continue;

    const debit = parseAmount(debitRaw);
    const credit = parseAmount(creditRaw);

    if (!payee && debit === null && credit === null) continue;
    if (payee.length < 2) continue;

    transactions.push({ date: dateRaw, payee, debit, credit });
  }

  console.log('Parse time:', Date.now() - start, 'ms');
  console.log('Transactions parsed:', transactions.length);
  console.log('First 5:', transactions.slice(0, 5).map(t => ({payee: t.payee.slice(0,40), debit: t.debit, credit: t.credit})));
  console.log('Last 5:', transactions.slice(-5).map(t => ({payee: t.payee.slice(0,40), debit: t.debit, credit: t.credit})));
}

main().catch(console.error);
