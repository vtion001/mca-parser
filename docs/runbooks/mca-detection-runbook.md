# MCA Detection Runbook

## Overview

MCA (Merchant Cash Advance) detection identifies transactions in bank statements that represent MCA funding, which is a form of alternative business financing. The detection uses a **3-stage hybrid pipeline**.

---

## The 3-Stage Detection Pipeline

### Stage 1: Pre-Filter (Provider Database Lookup)

**Class:** `McaDetectionService::detect()` → `matchMcaProvider()`

Transactions are checked against a JSON provider database (`data/mcas.json`) using:

1. **Exact match** — Provider name or abbreviation normalized and looked up in `providerMap`
2. **Abbreviation match** — Provider abbreviations normalized (non-alphanumeric chars stripped) and matched
3. **Fuzzy match** — Equivalence groups generate all possible variations of a name for matching

**Equivalence groups** allow fuzzy matching of common MCA synonyms:
```php
['partner', 'partners']
['funding', 'fund', 'funds']
['merchant', 'mer']
['capital', 'cap']
['advance', 'adv']
['lending', 'lend', 'lending']
['finance', 'fin', 'financing', 'financial']
['payments', 'payment', 'pymt']
```

**Example:** "SBL FUNDING LLC" → "sblfunding" matches via fuzzy equivalence group → provider found.

**Output:** Transactions matching a known MCA provider receive `confidence: 0.95` (exact) or `0.90` (abbreviation) or `0.85` (fuzzy).

---

### Stage 2: Keyword Scoring

**Class:** `McaDetectionService::scoreTransaction()`

Transactions not matched in Stage 1 are scored 0.0–1.0 based on keyword matching:

| Keyword Type | Keywords | Score Contribution |
|-------------|----------|---------------------|
| Strong keywords | `capital`, `funding`, `advance`, `mca`, `loc`, `credit`, `factor`, `finance`, `ondeck`, `forward`, `loan`, `lending`, `merchant`, `merchantcash` | +0.25 per match |
| Weak keywords (requires co-occurring strong keyword) | `solutions`, `partners`, `group`, `llc`, `business`, `services`, `payment`, `payments` | +0.1 per match |
| Multiple strong keywords (2+) | — | +0.15 bonus |
| Explicit `mca` in text | — | +0.3 |
| MCA pattern + number | e.g., `FUND` + `12345` | +0.1 |

**Score thresholds:**
- `>= 0.7` → Confirmed MCA (`source: 'keyword_match'`)
- `>= 0.2` → Borderline candidate for Stage 3 (`candidates` array)
- `< 0.2` → Not MCA

**Excluded processors** (return 0.0 immediately unless they match an MCA product pattern):
```
stripe, square, toast, clover, venmo, cashapp, zelle, shopify
```

**MCA product patterns from payment processors** (NOT excluded):
```
paypal working capital, stripe capital, square capital, shopify capital
```

---

### Stage 3: AI Review (Borderline Candidates)

**Class:** `McaAiService::analyzeCandidates()`

Transactions scoring 0.2–0.7 in Stage 2 are passed to the AI service for final classification. The AI service uses OpenRouter (Google Gemini) to determine whether borderline transactions represent real MCA activity.

**Note:** `analyzeCandidates()` is called by the AI service but the actual wiring to pass borderline candidates to AI is not fully implemented in the active `ProcessPdfExtraction` path. Currently borderline candidates remain in the `candidates` array in the response.

---

## MCA Detection Response Shape

```json
{
  "transactions": [
    {
      "description": "SBL FUNDING LLC",
      "amount": -15000.00,
      "date": "01/15/2024",
      "is_mca": true,
      "mca_provider": "SBL Funding",
      "confidence": 0.95,
      "source": "provider_match",
      "match_type": "exact"
    },
    {
      "description": "ABC CAPITAL PAYMENT",
      "amount": -2500.00,
      "date": "02/01/2024",
      "is_mca": true,
      "mca_provider": null,
      "confidence": 0.75,
      "source": "keyword_match",
      "match_type": "keyword"
    }
  ],
  "candidates": [
    {
      "description": "SBL FUND",
      "amount": -500.00,
      "date": "03/01/2024",
      "score": 0.35
    }
  ],
  "summary": {
    "total_mca_transactions": 2,
    "total_mca_amount": 17500.00,
    "unique_providers": ["SBL Funding"],
    "average_confidence": 0.85
  }
}
```

---

## Adding a New MCA Provider

**Warning: `data/mcas.json` currently does not exist.** You must create it before MCA provider-based detection can work.

### Step 1: Create the provider database

Create `backend/data/mcas.json`:

```json
[
  {
    "name": "SBL Funding",
    "abbreviations": ["SBL", "SBLF"],
    "keywords": ["sbl", "funding"],
    "website": "https://sblfunding.com"
  },
  {
    "name": "Another MCA Provider",
    "abbreviations": ["AMP", "AMER"],
    "keywords": ["another", "merchant", "capital"],
    "website": "https://example.com"
  }
]
```

### Step 2: Add provider-specific patterns

Each provider entry supports:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Full provider name (used in response) |
| `abbreviations` | No | Array of abbreviations (normalized and matched) |
| `keywords` | No | Additional keywords for matching |
| `website` | No | For documentation |

### Step 3: Verify loading

The service loads providers lazily and caches in-memory:

```php
// First call reads JSON from disk
$providers = $mcaDetectionService->loadProviders();

// Subsequent calls use cached array
$providers = $mcaDetectionService->loadProviders();
```

To force a reload (e.g., after adding a provider):

```php
// In a Laravel tinker session or custom command:
$mcaDetectionService = app(\App\Services\McaDetectionService::class);
// The providers array is private and not directly resettable
// → Restart the worker to clear the in-memory cache
```

---

## Transaction Classification Tags

The `TransactionClassificationService` categorizes all transactions (not just MCA):

| Category | Detection Method |
|----------|-------------------|
| `mca` | McaDetectionService score >= 0.7 or provider match |
| `nsf` | Keywords: `nsf`, `non-sufficient`, `returned`, `overdraft fee` |
| `transfer` | Keywords: `transfer`, `xfer`, `internal transfer`, `owner's draw` |
| `payment` | Default for regular outgoing payments |
| `deposit` | Positive amounts, not MCA |
| `unknown` | Cannot be classified |

---

## Fallback Behavior When AI Is Unavailable

### When OpenRouter API Key Is Missing

`OpenRouterService::analyzeDocument()` returns `success: false` with error `'AI service unavailable - using basic analysis'` and provides a fallback analysis based on regex/PII detection.

### When OpenRouter API Call Fails

`BaseAIService::analyzeDocument()` catches all exceptions and returns fallback. The extraction pipeline continues without interruption — the job does not fail.

### MCA-Specific Fallback

`AiAnalysisStep` triggers a secondary fallback via `McaAiService::extractTransactionSummary()`:

- Triggered when: AI `success: false` OR `transaction_summary` is `null` OR `credit_count === 0`
- **Bug:** `credit_count === 0` is a valid result (a statement with only debits) and should NOT trigger fallback. See `PIPELINE_ISSUE_LOG.md #1`.

The fallback computes basic transaction totals from the markdown:
```php
[
    'credit_count' => count of positive-amount transactions,
    'debit_count' => count of negative-amount transactions,
    'total_amount_credits' => sum of positive amounts,
    'total_amount_debits' => sum of abs(negative amounts),
]
```

### No AI Circuit Breaker

There is no consecutive failure counter. Every request attempts the AI API, fails, then falls back. During a prolonged outage, this adds ~100-200ms latency per request for no benefit.

---

## Debugging MCA Detection

### Enable verbose logging

Add to `config/logging.php` or runtime:

```php
Log::channel('single')->debug('MCA Detection', [
    'transaction' => $description,
    'score' => $score,
    'matched_provider' => $providerMatch,
]);
```

### Test scoring in isolation

```bash
php artisan tinker

>>> $svc = app(\App\Services\McaDetectionService::class);
>>> $svc->scoreTransaction('SBL FUNDING LLC');
=> 0.95  // strong keywords hit

>>> $svc->scoreTransaction('STRIPE CAP PAYMENT');
=> 0.0   // excluded processor, no MCA product pattern match

>>> $svc->scoreTransaction('STRIPE CAPITAL');
=> 0.7   // matches 'stripe capital' MCA product pattern, not excluded
```

### Check what providers are loaded

```bash
php artisan tinker

>>> $svc = app(\App\Services\McaDetectionService::class);
>>> $providers = $svc->loadProviders();
=> []  // Empty because data/mcas.json doesn't exist yet
```

---

## Known Limitations

1. **`data/mcas.json` missing** — Provider database doesn't exist. All Stage 1 detection returns no matches until created.

2. **Strict processor exclusion** — "STRIPE CAP" (no space, no "capital") is excluded despite being a real MCA product. See `PIPELINE_ISSUE_LOG.md #7`.

3. **credit_count=0 fallback bug** — Stage 3 fallback triggers on valid zero-credit statements. See `PIPELINE_ISSUE_LOG.md #1`.

4. **Borderline candidates not forwarded to AI** — Stage 3 (`analyzeCandidates()`) is defined but not wired in the active `ProcessPdfExtraction` path. Candidates remain un-reviewed.

5. **Amount regex ReDoS risk** — `BalanceExtractorService::amountPattern` has nested quantifiers. See `PIPELINE_ISSUE_LOG.md #6`.
