# Path 4: MCA Detection and Transaction Classification

## 1. CALL_FLOW_TRACE

### Pipeline Integration

MCA detection and transaction classification run as **post-processing steps** in `PdfExtractionPipeline::runPostProcessing()` (lines 121-133), after all pipeline steps complete:

```
PdfExtractionPipeline.runPostProcessing()
  ├── McaAiService.detect()            [92% progress]
  │     ├── McaDetectionService.detect()
  │     │     ├── loadProviders()     ← loads data/mcas.json (empty if missing)
  │     │     ├── extractTransactions() ← parses markdown into txns
  │     │     ├── matchMcaProvider()   ← Stage 1: exact/abbreviation/fuzzy match
  │     │     │     └── fuzzyMatch()   ← equivalence-group fuzzy matching
  │     │     └── scoreTransaction()   ← Stage 2: keyword scoring
  │     └── McaAiService.analyzeCandidates()  [borderline only, Stage 3]
  │           ├── buildMcaPrompt()
  │           ├── callApi()            ← OpenRouter API
  │           └── parseAiResponse() / fallbackAnalysis()
  │
  └── TransactionClassificationService.detect()  [95% progress]
        ├── extractTransactions()
        └── classifyBatch()
              └── classify()          ← keyword matching per category
```

### 3-Stage MCA Detection Pipeline

| Stage | Trigger | Service | Output |
|-------|---------|---------|--------|
| **1. Pre-filter (provider match)** | Every transaction | `McaDetectionService.matchMcaProvider()` | `is_mca=true, confidence=0.85-0.95, source=provider_match` |
| **2. Keyword scoring** | Non-provider-match txns | `McaDetectionService.scoreTransaction()` | score >= 0.7: `is_mca=true`; score 0.2-0.7: candidate for AI |
| **3. AI review** | Borderline candidates (score 0.2-0.7) | `McaAiService.analyzeCandidates()` | confirmed/rejected with reasoning |

### Transaction Classification (Parallel, Not Staged)

`TransactionClassificationService` classifies each transaction into mutually non-exclusive tags:
- `return` — reversals, refunds, fee waivers
- `internal_transfer` — own-account transfers
- `wire` — ACH, wire, SWIFT, NEFT, RTGS
- `line_of_credit` — loans, credit lines
- `lender` — specific lender names
- `cash_app` — Zelle, Venmo, Cash App

Unlike MCA detection, classification is single-pass keyword matching with no fallback or AI stage.

### Key Data Dependencies

- `PipelineContext.markdown` — extracted PDF text (from DoclingExtractionStep)
- `PipelineContext.keyDetails` — document-type-specific fields
- `PipelineContext.balances` — beginning/ending balance amounts
- `data/mcas.json` — MCA provider database (abbreviations, names) — **file missing in codebase**

---

## 2. FAILURE_MODES

### Stage 1 — Provider Database Missing

**File:** `McaDetectionService.php:83-95`

`loadProviders()` reads `data/mcas.json`. The glob search for this file returns no results — the file does not exist in the repository. When the file is missing:
- `$this->providers = []` and `$this->providerMap = []`
- `matchMcaProvider()` always returns `null` (lines 321, 330, 340)
- **All known-MCA-provider matches are silently skipped**
- Stage 1 produces zero results; every transaction falls to Stage 2 keyword scoring

**Impact:** HIGH — No confirmed MCA transactions from known providers can ever be detected.

---

### Stage 1 — Fuzzy Match Collision (Equivalence Group Exhaustion)

**File:** `McaDetectionService.php:386-413`

`fuzzyMatch()` generates all combinations of equivalence-group expansions and checks against `providerMap`. The Cartesian product of all equivalence groups can produce a large number of variants. With 7 groups and no pruning:
- The combinatorial explosion is bounded by word count (~10 words → manageable)
- But the `generateCombinations()` + string comparison loop has no early exit optimization
- If `providerMap` is large (hundreds of providers), this becomes O(n * combos) with no caching

**Impact:** LOW (bounded by word count), MEDIUM under adversarial provider names.

---

### Stage 2 — Over-Aggressive Payment Processor Exclusion

**File:** `McaDetectionService.php:259-265` (Issue #7 from PIPELINE_ISSUE_LOG)

```php
if (!$isMcaProduct) {
    foreach ($this->excludedProcessors as $processor) {
        if (strpos($descLower, $processor) !== false) {
            return 0.0;  // Hard disqualification
        }
    }
}
```

MCA product patterns (`mcaProductPatterns`) are checked first (lines 252-257). But `mcaProductPatterns` uses **exact string substr matching**, not word-boundary matching.

Examples that fail to match despite being real MCA products:
- `"STRIPE CAP"`, `"STRIPE CAPITAL"` — strpos matches `"stripe capital"` but spacing matters
- `"stripe cap"` — lowercase but missing "working"
- `"PAYPAL WC"` — abbreviation not in the 4 exact phrases

Additionally, once excluded, `scoreTransaction()` returns `0.0` immediately — no further scoring occurs. The entire transaction is disqualified even if it contains strong MCA keywords alongside the processor name.

**Impact:** MEDIUM — Real MCA transactions from payment processors are silently missed.

---

### Stage 2 — Keyword Scoring Threshold Arbitrariness

**File:** `McaDetectionService.php:271-305`

`scoreTransaction()` awards:
- +0.25 per strong keyword match (max 5 strong matches = 1.25, capped at 1.0)
- +0.1 per weak keyword (only counted if strong keyword exists)
- +0.15 bonus for 2+ strong keywords
- +0.3 for explicit `\bmca\b` pattern
- +0.1 for MCA-pattern + number combo

The threshold of 0.7 for confirmed MCA and 0.2 for AI-candidate was lowered from 0.4 (line 177 comment) to catch `"SBL FUNDING"` which scores 0.35. This is empirically tuned but not validated against a test corpus.

**Impact:** LOW — May produce inconsistent results across document formats.

---

### Stage 3 — AI Service Fallback Produces Low-Confidence Results

**File:** `McaAiService.php:257-300`

When the OpenRouter API is unavailable or the API key is missing:
- `fallbackAnalysis()` uses a hardcoded list of 11 indicators
- Confidence is always set to `0.5` regardless of actual match quality
- Source is marked `prefilter_fallback` — indistinguishable from a real AI review

Additionally, when AI call fails with an exception, `analyzeCandidates()` (line 114) catches it and falls back silently. The exception is logged but the caller has no way to know the AI review actually failed.

**Impact:** MEDIUM — Borderline candidates may be misclassified with artificially low confidence.

---

### Stage 3 — AI Response JSON Parsing Failure

**File:** `McaAiService.php:171-209`

`parseAiResponse()` relies on `classifications` array from the AI response. If the AI returns malformed JSON or the `classifications` key is missing:
- Falls through to `parseRawResponse()` which applies a simple keyword heuristic
- This heuristic (lines 223-230) has lower coverage than the main scoring logic

**Impact:** LOW — Fallback heuristic covers most cases, but confidence is lower.

---

### Transaction Classification — Missing NSF Category

**File:** `TransactionClassificationService.php`

NSF (Non-Sufficient Funds) transactions are **not classified** — no NSF keywords exist in any category. A returned check or ACH rejection would be classified as `return` (which covers reversals) but not specifically flagged as NSF.

The `return` tag covers: reject, cancel, return, reverse, refund, fee waiver.
NSF-specific indicators (e.g., "nsf", "insufficient funds", "bounced", "returned item fee") are absent.

**Impact:** LOW — NSF transactions are partially covered by `return` but not specifically identified.

---

### Transaction Extraction — Both Services Duplicate Parsing Logic

Both `McaDetectionService::extractTransactions()` (line 418) and `TransactionClassificationService::extractTransactions()` (line 310) implement near-identical transaction parsing:
- Same `isNonTransactionLine()` logic
- Same `extractAmount()`, `extractDate()`, `extractDescription()`
- Same date pattern regex

If the extraction logic has a bug, it affects both services identically. The duplication means two separate regex-based parsers can diverge behaviorally.

**Impact:** MEDIUM — Maintenance burden; inconsistent parsing between MCA and classification results.

---

## 3. TESTING_REQUIREMENTS

### Stage 1 — Provider Matching

| Test Case | Input | Expected |
|-----------|-------|----------|
| Exact provider name | `"APEX FUNDING SOLUTIONS"` (in `mcas.json`) | `is_mca=true, confidence=0.95, match_type=exact` |
| Abbreviation match | `"APXFND"` (abbreviation for APEX FUNDING in `mcas.json`) | `is_mca=true, confidence=0.90, match_type=abbreviation` |
| Fuzzy match (equivalence groups) | `"APEX FUNDING"` → fuzzy variations | `is_mca=true, confidence=0.85, match_type=fuzzy` |
| **Missing provider file** | Any known provider name | Falls through to keyword scoring; no provider match results |
| Provider name with typo | `"APEX FUNDN"` | Should fuzzy-match if within edit distance; test tolerance |

**Note:** Cannot write behavioral tests for provider matching until `data/mcas.json` exists with known test providers.

---

### Stage 2 — Keyword Scoring

| Test Case | Input | Expected Score |
|-----------|-------|----------------|
| Strong keyword alone | `"FUNDING"`, amount `-500` | >= 0.7 (confirmed MCA) |
| Multiple strong keywords | `"CAPITAL FUNDING"` | >= 0.7 (confirmed MCA) |
| Weak keyword only | `"PARTNERS LLC"` | 0.0 (no strong keyword) |
| Explicit MCA | `"MCA PAYMENT"` | >= 0.7 (`\bmca\b` bonus + strong keyword) |
| Payment processor — plain | `"STRIPE"` | 0.0 (hard exclusion) |
| Payment processor — MCA product | `"STRIPE CAPITAL"` | > 0.0 (MCA product override; score depends on keywords) |
| Abbreviated processor | `"STRIPE CAP"` | **Must not score 0.0** — Issue #7 regression test |
| Borderline case | `"SBL FUNDING"` | 0.2-0.7 (candidate for AI) |
| Empty description | `""` | 0.0 |
| Amount + number combo | `"FUNDING 123456"` | +0.1 bonus |

---

### Stage 3 — AI Review

| Test Case | Input | Expected |
|-----------|-------|----------|
| AI available, confirms candidate | 3 borderline candidates, AI returns `is_mca=true` for all | All 3 in `confirmed_mca`, source=`ai_review` |
| AI available, rejects candidate | 2 borderline candidates, AI returns `is_mca=false` | `rejected=2` |
| AI unavailable (no API key) | Any candidates | All go through `fallbackAnalysis()`, source=`prefilter_fallback`, confidence=0.5 |
| AI throws exception | Candidates + API timeout | `fallbackAnalysis()` used, exception logged |
| Empty candidates | `[]` | `total_reviewed=0, confirmed_mca=0, rejected=0` |
| Malformed AI JSON response | AI returns text without `classifications` key | Falls back to `parseRawResponse()` heuristic |

---

### Transaction Classification

| Test Case | Input | Expected Tags |
|-----------|-------|---------------|
| Return transaction | `"ACH RETURN DEBIT"`, amount `-100` | `['return']`, confidence=0.95 |
| Internal transfer | `"TRANSFER TO SAVINGS"`, amount `-500` | `['internal_transfer']`, confidence=0.90 |
| Wire transfer | `"WIRE INCOMING"`, amount `+5000` | `['wire']`, confidence=0.90 |
| Line of credit | `"ON DECK PAYMENT"`, amount `-300` | `['line_of_credit']`, confidence=0.85 |
| Lender | `"ARENA FUNDING"`, amount `-250` | `['lender']`, confidence=0.85 |
| Cash app | `"ZELLE PAYMENT"`, amount `-50` | `['cash_app']`, confidence=0.90 |
| Multiple tags | `"RETURN WIRE FROM ARENA"` | `['return', 'wire', 'lender']` — all applicable |
| NSF (insufficient funds) | `"NSF FEE"`, amount `-35` | Currently: no specific tag (partially `return` if covered) |

---

### Integration Tests

| Test | Description |
|------|-------------|
| Full pipeline with MCA document | PDF with known MCA transactions → all 3 stages run → correct `mcaFindings` |
| Full pipeline with no MCA document | PDF with no MCA → empty `transactions`, empty `candidates` |
| Full pipeline with mixed borderline | Some confirmed, some borderline → borderline go to AI → `candidates_reviewed` populated |
| Cache hit with MCA results | Same PDF processed twice → second call returns cached `mcaFindings` |
| Empty markdown | `markdown=""` → both services return empty results gracefully |

---

## 4. HIGH_RISK_ISSUES (from PIPELINE_ISSUE_LOG.md)

### Issue #7 — McaDetectionService: scoreTransaction() ignores candidates with 0.0

**File:** `McaDetectionService.php:259-263`

**Risk:** MEDIUM — Payment processor MCA products are excluded via hard `return 0.0` unless they match one of 4 exact phrases. Abbreviation variants (e.g., `"STRIPE CAP"`) cause false negatives.

**Fix required:** Replace `strpos()` exact matching on `mcaProductPatterns` with word-boundary-aware matching, and downgrade the hard `return 0.0` to a scored exclusion that still allows strong MCA indicators to override.

---

### Issue #10 — Missing: No circuit breaker on AI service calls

**File:** `BaseAIService.php:77-90` (affects `McaAiService.callApi()`)

**Risk:** MEDIUM — During prolonged OpenRouter outages, every `analyzeCandidates()` call attempts the API, fails, and falls back. This adds unnecessary latency per request with no circuit breaker to short-circuit after N consecutive failures.

**Fix required:** Add consecutive failure counter with exponential backoff or "degraded mode" that skips AI calls entirely until a cooldown period expires.

---

### Issue #1 — AiAnalysisStep: Logic inversion on fallback condition

**File:** `AiAnalysisStep.php:32-34`

**Risk:** MEDIUM — `credit_count === 0` triggers fallback, but 0 is a valid count (all-debit statement). This overwrites correct AI-computed summaries with fallback values for legitimate zero-credit statements.

**Fix required:** Change `|| $txnSummary['credit_count'] === 0` to only trigger on `=== null` (missing key).

---

### Issue #2 — AiAnalysisStep: Fallback only runs when AI partially succeeds

**File:** `AiAnalysisStep.php:37-44`

**Risk:** MEDIUM — When `aiAnalysis['success']` is `false` (AI completely failed), the computed summary is attached but `success` remains `false`. Callers cannot distinguish "failed with computed fallback" from "failed with no data."

**Fix required:** Add a distinct flag (e.g., `has_fallback_summary: true`) or set `success: true` when a valid fallback is available.

---

### Critical Missing File — data/mcas.json

**Risk:** HIGH — The entire Stage 1 provider-matching pipeline is non-functional because `loadProviders()` reads a file that does not exist in the repository. All MCA detection falls back to keyword scoring only.

---

### Duplicate Transaction Extraction Logic

**Risk:** MEDIUM — Both `McaDetectionService::extractTransactions()` and `TransactionClassificationService::extractTransactions()` implement identical parsing. Bugs affect both simultaneously; fixes must be applied twice.

**Fix required:** Extract common parsing logic into a shared `TransactionParser` utility class used by both services.
