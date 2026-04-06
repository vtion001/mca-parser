# MCA PDF Scrubber - CSV Export Formats

The MCA PDF Scrubber supports 19 MoneyThumb-style CSV export formats for bank statement analysis. These exports are generated on the frontend from extracted transaction data.

---

## Export Types Overview

| Type | Filename | Description |
|------|----------|-------------|
| `all_transactions` | `all_transactions.csv` | All transactions from the statement |
| `credit_transactions` | `Credit_Transactions.csv` | Positive amount transactions (credits/deposits) |
| `daily_balances` | `Daily_Balances.csv` | Daily balance tracking |
| `daily_cash_flows` | `Daily_Cash_Flows.csv` | Daily cash flow with true cash flow |
| `incoming_transfers` | `Incoming_Transfers.csv` | Transfers IN from other accounts |
| `outgoing_transfers` | `Outgoing_Transfers.csv` | Transfers OUT to other accounts |
| `large_transactions` | `Large_Transactions.csv` | Large deposits (typically > $500) |
| `mca_transactions` | `MCA_Transactions.csv` | Merchant Cash Advance transactions |
| `monthly_cash_flows` | `Monthly_Cash_Flows.csv` | Monthly aggregated cash flows |
| `monthly_mca` | `Monthly_MCA.csv` | Monthly MCA summary |
| `monthly_negative_days` | `Monthly_Negative_Days.csv` | Days with negative balance |
| `non_true_credit_transactions` | `Non-True_Credit_Transactions.csv` | Credits that are NOT true deposits |
| `nsf_transactions` | `NSF_Transactions.csv` | Non-sufficient funds transactions |
| `overdraft_transactions` | `Overdraft_Transactions.csv` | Overdraft transactions |
| `repeating_transactions` | `Repeating_Transactions.csv` | Recurring/repeating transactions |
| `returned_transactions` | `Returned_Transactions.csv` | Returned items |
| `revenue_statistics` | `Revenue_Statistics.csv` | Revenue summary |
| `statements_summary` | `Statements_Summary.csv` | Statement summary |
| `true_credit_transactions` | `True_Credit_Transactions.csv` | True deposits (not transfers) |

---

## Transaction Classification

The system classifies transactions into the following categories:

### Tags
Transactions are tagged with categories:
- `transfer` - Internal or external transfers
- `wire` - Wire transfers
- `zelle` - Zelle payments
- `ach` - ACH transactions
- `mca` - Merchant Cash Advance transactions
- `nsf` - Non-sufficient funds
- `overdraft` - Overdraft transaction
- `returned` - Returned items

### Transfer Detection
A transaction is considered a **transfer** if its tags include:
- `transfer`
- `wire`
- `zelle`
- `ach`

### True vs Non-True Credits
- **True Credits:** Deposits that are NOT transfers (actual income)
- **Non-True Credits:** Deposits that ARE transfers (moving money between accounts)

---

## Export Format Details

### 1. All Transactions (`all_transactions.csv`)

**Purpose:** Complete record of all transactions.

**Fields:**
```
Statement, Date, Description, Amount, Memo, Number, Type
```

**Example:**
```
Statement,Date,Description,Amount,Memo,Number,Type
"April 2026",2026-04-01,"DEPOSIT","1500.00","Payroll",,Credit
"April 2026",2026-04-03,"UTILITY PAYMENT","-150.00","Electric",,Debit
```

---

### 2. Credit Transactions (`Credit_Transactions.csv`)

**Purpose:** All positive transactions (deposits).

**Fields:**
```
Account, Date, Description, Amount, Memo, Number, Type
```

**Filter:** `credit > 0`

---

### 3. Daily Balances (`Daily_Balances.csv`)

**Purpose:** Track daily running balance.

**Fields:**
```
Date, [Account] Balance, [Account] True Balance
```

**Calculation:**
- Balance = Running total from beginning balance
- True Balance = Running total excluding internal transfers

---

### 4. Daily Cash Flows (`Daily_Cash_Flows.csv`)

**Purpose:** Daily change in balance.

**Fields:**
```
Date, [Account] Cash Flow, [Account] True Cash Flow
```

**Calculation:**
- Cash Flow = Today's Balance - Yesterday's Balance
- True Cash Flow = Same but using True Balance

---

### 5. Incoming Transfers (`Incoming_Transfers.csv`)

**Purpose:** Money transferred IN from other accounts.

**Fields:**
```
Account, Date, Description, Amount, Memo, Number, Type
```

**Filter:** `credit > 0 AND isTransfer(tx) = true`

---

### 6. Outgoing Transfers (`Outgoing_Transfers.csv`)

**Purpose:** Money transferred OUT to other accounts.

**Fields:**
```
Account, Date, Description, Amount, Memo, Number, Type
```

**Filter:** `debit > 0 AND isTransfer(tx) = true`

---

### 7. Large Transactions (`Large_Transactions.csv`)

**Purpose:** Large deposits/withdrawals (typically > $500).

**Fields:**
```
Account, Date, Description, Amount, Memo, Number, Type
```

**Filter:** `credit > 500 OR debit > 500`

---

### 8. MCA Transactions (`MCA_Transactions.csv`)

**Purpose:** Merchant Cash Advance transactions.

**Fields:**
```
Account, Date, Description, Amount, Memo, Number, Type
```

**Filter:** `tag contains 'mca'`

---

### 9. Monthly Cash Flows (`Monthly_Cash_Flows.csv`)

**Purpose:** Monthly aggregated cash flows.

**Fields:**
```
Month, [Account] Cash Flow, [Account] True Cash Flow
```

**Calculation:** Sum of daily cash flows grouped by month (YYYY-MM)

---

### 10. Monthly MCA (`Monthly_MCA.csv`)

**Purpose:** Monthly MCA activity summary.

**Fields:**
```
Month, Work Days, Account, Lender, Withdrawal Count, Withdrawal Total, Deposit Total, Deposit Dates, Latest Withdrawal Amount
```

**Example:**
```
Month,Work Days,Account,Lender,Withdrawal Count,Withdrawal Total,Deposit Total,Deposit Dates,Latest Withdrawal Amount
2026-04,22,"ACME Corp","MCA Provider",3,1500.00,3000.00,"2026-04-05; 2026-04-12; 2026-04-19",500.00
```

---

### 11. Monthly Negative Days (`Monthly_Negative_Days.csv`)

**Purpose:** Track days with negative balance per month.

**Fields:**
```
Month, Work Days, Account, Lender, With. Count, With. Total, Avg Daily Bal, Low Bal, Neg Bal Days
```

**Example:**
```
Month,Work Days,Account,Lender,With. Count,With. Total,Avg Daily Bal,Low Bal,Neg Bal Days
2026-04,22,"ACME Corp","N/A",0,0,-150.25,-500.00,5
```

---

### 12. Non-True Credit Transactions (`Non-True_Credit_Transactions.csv`)

**Purpose:** Credits that are NOT true income (i.e., transfers from other accounts).

**Fields:**
```
Account, Date, Description, Amount, Memo, Number, Type
```

**Filter:** `credit > 0 AND isTransfer(tx) = true`

---

### 13. NSF Transactions (`NSF_Transactions.csv`)

**Purpose:** Non-sufficient funds transactions.

**Fields:**
```
Account, Date, Description, Amount, Memo, Number, Type
```

**Filter:** `tag contains 'nsf'`

---

### 14. Overdraft Transactions (`Overdraft_Transactions.csv`)

**Purpose:** Transactions that caused an overdraft.

**Fields:**
```
Account, Date, Description, Amount, Memo, Number, Type
```

**Filter:** `tag contains 'overdraft'`

---

### 15. Repeating Transactions (`Repeating_Transactions.csv`)

**Purpose:** Recurring transactions (same amount at regular intervals).

**Fields:**
```
Account, Date, Description, Amount, Memo, Number, Type
```

**Detection Logic:**
1. Group transactions by absolute amount
2. For each amount group with 2+ transactions:
   - Sort by date
   - Check if intervals between consecutive transactions are 3-35 days
   - If consistent interval pattern found, mark all as repeating

---

### 16. Returned Transactions (`Returned_Transactions.csv`)

**Purpose:** Returned items (reversed payments, refunds, etc.).

**Fields:**
```
Account, Date, Description, Amount, Memo, Number, Type
```

**Filter:** `tag contains 'returned'`

**Return Keywords:**
- reject, rejected, rejection
- cancel, cancelled, cancellation
- return, returned, returning, ret
- reverse, reversed, reversing, reversal
- refund, refunded, refunding
- fee waiver, fee waived, fee waive, waiver, waived

---

### 17. Revenue Statistics (`Revenue_Statistics.csv`)

**Purpose:** Revenue summary with monthly and annual projections.

**Fields:**
```
Label, Monthly, Annual
```

**Example:**
```
Label,Monthly,Annual
Revenue,15000.00,180000.00
True Revenue,13500.00,162000.00
Expenses,12000.00,144000.00
Profit,3000.00,36000.00
Balance/Days Negative,0,0
```

**Calculations:**
- Revenue = Total credits
- True Revenue = 90% of total credits
- Expenses = Total debits
- Profit = True Revenue - Expenses

---

### 18. Statements Summary (`Statements_Summary.csv`)

**Purpose:** Comprehensive statement summary.

**Fields:**
```
Account, Bank Name, Statement Month, Starting Balance, Total Credits, # Credits, True Credits, # True Credits, Total Debits, # Debits, Ending Balance, Avg Balance, Avg True Balance, Days Neg, # OD's, # NSF's, Low Days, MCA Withhold Percent
```

**Example:**
```
Account,Bank Name,Statement Month,Starting Balance,Total Credits,# Credits,True Credits,# True Credits,Total Debits,# Debits,Ending Balance,Avg Balance,Avg True Balance,Days Neg,# OD's,# NSF's,Low Days,MCA Withhold Percent
"ACME Corp","Bank of America","April 2026",10000.00,15000.00,15,13500.00,12,12000.00,45,13000.00,11500.00,10350.00,5,2,1,3,0
```

---

### 19. True Credit Transactions (`True_Credit_Transactions.csv`)

**Purpose:** True deposits (income) excluding transfers.

**Fields:**
```
Account, Date, Description, Amount, Memo, Number, Type
```

**Filter:** `credit > 0 AND isTransfer(tx) = false`

---

## Helper Functions

### Work Days Calculation

```typescript
function getWorkDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let workDays = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workDays++;
    }
  }
  return workDays;
}
```

### Daily Balance Calculation

```typescript
function buildDailyBalances(
  transactions: TransactionRow[],
  begBal: number | null
): { date: string; balance: number }[] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const balances: { date: string; balance: number }[] = [];
  let running = begBal ?? 0;
  for (const t of sorted) {
    running += (t.credit ?? 0) - (t.debit ?? 0);
    balances.push({ date: t.date, balance: running });
  }
  return balances;
}
```

### True Balance Calculation

```typescript
function buildTrueBalances(
  transactions: TransactionRow[],
  begBal: number | null
): { date: string; balance: number }[] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
  const balances: { date: string; balance: number }[] = [];
  let running = begBal ?? 0;
  for (const t of sorted) {
    // Only include non-transfer amounts in true balance
    if (!isTransfer(t)) {
      running += (t.credit ?? 0) - (t.debit ?? 0);
    }
    balances.push({ date: t.date, balance: running });
  }
  return balances;
}
```

### Transfer Detection

```typescript
function isTransfer(tx: TransactionRow): boolean {
  return tx.tags.some(tag =>
    tag.toLowerCase().includes('transfer') ||
    tag.toLowerCase().includes('wire') ||
    tag.toLowerCase().includes('zelle') ||
    tag.toLowerCase().includes('ach')
  );
}
```

### CSV Field Escaping

```typescript
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

---

## Transaction Data Interface

The exports use the following transaction data structure:

```typescript
interface TransactionRow {
  date: string;           // YYYY-MM-DD
  payee: string;         // Description/merchant
  description?: string;
  credit: number | null;  // Positive amount (deposit)
  debit: number | null;   // Negative amount (withdrawal)
  amount: number;          // Computed: credit - debit
  checkNumber?: string;
  memo?: string;
  tags: string[];         // Classification tags
}
```

---

## Export Configuration Interface

```typescript
interface ExportConfig {
  transactions: TransactionRow[];
  dailyBalances: { date: string; balance: number }[];
  trueBalances: { date: string; balance: number }[];
  begBal: number | null;
  endBal: number | null;
  accountName: string;
  bankName: string;
  statementPeriod: string;
  mcaPaymentsByMonth: { month: string; payments: number; count: number }[];
  revenueStats: {
    totalCredits: number;
    totalDebits: number;
    grossProfit: number;
    monthlyAvg: number;
  };
}
```
