<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;

/**
 * MCA Detection Service - Hybrid Pre-Filtering
 *
 * Implements Python-like pre-filtering for MCA transaction detection:
 * - Loads MCA provider database
 * - Fuzzy abbreviation matching using equivalence groups
 * - Keyword-based scoring
 * - Returns candidates for AI review
 */
class McaDetectionService
{
    /**
     * MCA Equivalence groups for fuzzy matching
     * Maps synonyms to a common token
     */
    private array $equivalents = [
        ['partner', 'partners'],
        ['funding', 'fund', 'funds'],
        ['merchant', 'mer'],
        ['capital', 'cap'],
        ['advance', 'adv'],
        ['lending', 'lend', 'lending'],
        ['finance', 'fin', 'financing', 'financial'],
        ['payments', 'payment', 'pymt'],
    ];

    /**
     * Strong MCA keywords - high confidence indicators
     */
    private array $strongKeywords = [
        'capital', 'funding', 'advance', 'mca', 'loc',
        'credit', 'factor', 'finance', 'ondeck', 'forward',
        'loan', 'lending', 'merchant', 'merchantcash',
    ];

    /**
     * Weak keywords - require co-occurrence with strong keywords
     */
    private array $weakKeywords = [
        'solutions', 'partners', 'group', 'llc',
        'business', 'services', 'payment', 'payments',
    ];

    /**
     * Payment processor names to exclude (unless linked to MCA)
     * Note: Some processors have MCA products (e.g., PayPal Working Capital)
     * which should NOT be excluded.
     */
    private array $excludedProcessors = [
        'stripe', 'square', 'toast', 'clover',
        'venmo', 'cashapp', 'zelle', 'shopify',
    ];

    /**
     * MCA product patterns from payment processors - NOT excluded
     */
    private array $mcaProductPatterns = [
        'paypal working capital',
        'stripe capital',
        'square capital',
        'shopify capital',
    ];

    /**
     * MCA Provider database
     */
    private ?array $providers = null;

    /**
     * Provider lookup map (lowercase name => provider data)
     */
    private ?array $providerMap = null;

    /**
     * Load MCA providers from JSON file
     */
    public function loadProviders(): array
    {
        if ($this->providers !== null) {
            return $this->providers;
        }

        $path = base_path('data/mcas.json');

        if (!file_exists($path)) {
            $this->providers = [];
            $this->providerMap = [];
            return $this->providers;
        }

        $this->providers = json_decode(file_get_contents($path), true) ?? [];

        // Build lookup map for fast matching
        $this->providerMap = [];
        foreach ($this->providers as $provider) {
            $key = strtolower($provider['name']);
            $this->providerMap[$key] = $provider;

            // Also index by each abbreviation
            foreach ($provider['abbreviations'] as $abbrev) {
                $abbrevKey = strtolower(preg_replace('/[^a-z0-9]/', '', $abbrev));
                if (!isset($this->providerMap[$abbrevKey])) {
                    $this->providerMap[$abbrevKey] = $provider;
                }
            }
        }

        return $this->providers;
    }

    /**
     * Detect MCA transactions from extracted markdown/bank statement text
     *
     * @param string $markdown The extracted text content
     * @param array $keyDetails Key details extracted from document
     * @param array $balances Balance information
     * @return array MCA findings
     */
    public function detect(string $markdown, array $keyDetails = [], array $balances = []): array
    {
        $this->loadProviders();

        // Parse transactions from markdown if available
        $transactions = $this->extractTransactions($markdown);

        if (empty($transactions)) {
            return $this->emptyResult();
        }

        $mcaTransactions = [];
        $candidates = [];

        foreach ($transactions as $transaction) {
            $description = $transaction['description'] ?? '';
            $normalizedDesc = $this->normalizeText($description);

            // Step 1: Check against known MCA providers (exact/fuzzy match)
            $providerMatch = $this->matchMcaProvider($normalizedDesc);

            if ($providerMatch) {
                $mcaTransactions[] = [
                    'description' => $description,
                    'amount' => $transaction['amount'] ?? null,
                    'date' => $transaction['date'] ?? null,
                    'is_mca' => true,
                    'mca_provider' => $providerMatch['name'],
                    'confidence' => $providerMatch['confidence'],
                    'source' => 'provider_match',
                    'match_type' => $providerMatch['match_type'],
                ];
                continue;
            }

            // Step 2: Keyword-based scoring
            $score = $this->scoreTransaction($normalizedDesc);

            if ($score >= 0.7) {
                // High confidence - treat as MCA
                $mcaTransactions[] = [
                    'description' => $description,
                    'amount' => $transaction['amount'] ?? null,
                    'date' => $transaction['date'] ?? null,
                    'is_mca' => true,
                    'mca_provider' => null,
                    'confidence' => $score,
                    'source' => 'keyword_match',
                    'match_type' => 'keyword',
                ];
            } elseif ($score >= 0.2) {
                // Borderline confidence - candidate for AI review
                // Lowered from 0.4 to 0.2 to catch borderline MCAs like "SBL FUNDING" (scores 0.35)
                // which represent real MCA transactions that should not be missed
                $candidates[] = [
                    'description' => $description,
                    'amount' => $transaction['amount'] ?? null,
                    'date' => $transaction['date'] ?? null,
                    'score' => $score,
                ];
            }
        }

        return [
            'transactions' => $mcaTransactions,
            'candidates' => $candidates,
            'summary' => $this->buildSummary($mcaTransactions),
        ];
    }

    /**
     * Extract transaction summary from markdown text
     * Used as fallback when AI is unavailable
     *
     * @param string $markdown The extracted text content
     * @return array Transaction summary with credit/debit counts and totals
     */
    public function extractTransactionSummary(string $markdown): array
    {
        $transactions = $this->extractTransactions($markdown);

        if (empty($transactions)) {
            return [
                'credit_count' => null,
                'debit_count' => null,
                'total_amount_credits' => null,
                'total_amount_debits' => null,
            ];
        }

        $creditCount = 0;
        $debitCount = 0;
        $totalCredits = 0.0;
        $totalDebits = 0.0;

        foreach ($transactions as $transaction) {
            $amount = $transaction['amount'] ?? null;
            if ($amount === null) {
                continue;
            }

            if ($amount > 0) {
                $creditCount++;
                $totalCredits += $amount;
            } elseif ($amount < 0) {
                $debitCount++;
                $totalDebits += abs($amount);
            }
        }

        return [
            'credit_count' => $creditCount,
            'debit_count' => $debitCount,
            'total_amount_credits' => round($totalCredits, 2),
            'total_amount_debits' => round($totalDebits, 2),
        ];
    }

    /**
     * Score a transaction description for MCA likelihood
     */
    public function scoreTransaction(string $description): float
    {
        $descLower = strtolower($description);

        // Skip excluded processors UNLESS they match MCA product patterns
        $isMcaProduct = false;
        foreach ($this->mcaProductPatterns as $pattern) {
            if (strpos($descLower, $pattern) !== false) {
                $isMcaProduct = true;
                break;
            }
        }

        if (!$isMcaProduct) {
            foreach ($this->excludedProcessors as $processor) {
                // Use word-boundary regex to avoid excluding MCA product names like "STRIPE CAP"
                // "stripe" alone → exclude, "stripe capital" → do NOT exclude
                if (preg_match('/\b' . preg_quote($processor, '/') . '\b/i', $descLower)) {
                    return 0.0;
                }
            }
        }

        $score = 0.0;
        $strongMatches = 0;
        $weakMatches = 0;

        // Check strong keywords
        foreach ($this->strongKeywords as $keyword) {
            if (strpos($descLower, $keyword) !== false) {
                $strongMatches++;
                $score += 0.25;
            }
        }

        // Check weak keywords (only count if strong keyword also present)
        foreach ($this->weakKeywords as $keyword) {
            if (strpos($descLower, $keyword) !== false) {
                if ($strongMatches > 0) {
                    $weakMatches++;
                    $score += 0.1;
                }
            }
        }

        // Bonus for multiple strong keywords
        if ($strongMatches >= 2) {
            $score += 0.15;
        }

        // Check for MCA-specific patterns
        if (preg_match('/\bmca\b/i', $descLower)) {
            $score += 0.3;
        }

        // Check for common MCA company name patterns
        if (preg_match('/(fund|cap|adv|fin|lend|mer)/i', $descLower) && preg_match('/\d+/', $descLower)) {
            $score += 0.1;
        }

        // Cap at 1.0
        return min(1.0, $score);
    }

    /**
     * Match description against known MCA providers
     */
    public function matchMcaProvider(string $description): ?array
    {
        if (empty($this->providerMap)) {
            $this->loadProviders();
        }

        $normalized = $this->normalizeText($description);
        $normalizedNoSpaces = preg_replace('/[^a-z0-9]/', '', $normalized);

        // Try exact match in provider map
        if (isset($this->providerMap[$normalized])) {
            return [
                'name' => $this->providerMap[$normalized]['name'],
                'confidence' => 0.95,
                'match_type' => 'exact',
            ];
        }

        // Try abbreviation match (normalized)
        if (isset($this->providerMap[$normalizedNoSpaces])) {
            return [
                'name' => $this->providerMap[$normalizedNoSpaces]['name'],
                'confidence' => 0.90,
                'match_type' => 'abbreviation',
            ];
        }

        // Try fuzzy matching using equivalence groups
        $fuzzyMatch = $this->fuzzyMatch($normalized);
        if ($fuzzyMatch) {
            return $fuzzyMatch;
        }

        return null;
    }

    /**
     * Generate all possible variations of a name using equivalence groups
     */
    private function generateCombinations(array $words): array
    {
        $options = [];

        foreach ($words as $word) {
            $matched = false;
            foreach ($this->equivalents as $group) {
                if (in_array($word, $group, true)) {
                    $options[] = $group;
                    $matched = true;
                    break;
                }
            }
            if (!$matched) {
                $options[] = [$word];
            }
        }

        // Cartesian product
        $combinations = [[]];
        foreach ($options as $option) {
            $newCombinations = [];
            foreach ($combinations as $combo) {
                foreach ($option as $item) {
                    $newCombinations[] = array_merge($combo, [$item]);
                }
            }
            $combinations = $newCombinations;
        }

        return $combinations;
    }

    /**
     * Fuzzy match using equivalence groups
     */
    private function fuzzyMatch(string $description): ?array
    {
        $words = preg_split('/[\s\-_]+/', $description);
        $words = array_filter($words, fn($w) => strlen($w) > 1);

        if (count($words) < 2) {
            return null;
        }

        $combinations = $this->generateCombinations($words);

        foreach ($combinations as $combo) {
            $joined = strtolower(implode('', $combo));
            $joinedSpaces = strtolower(implode(' ', $combo));

            foreach ($this->providerMap as $key => $provider) {
                if ($joined === $key || $joinedSpaces === $key) {
                    return [
                        'name' => $provider['name'],
                        'confidence' => 0.85,
                        'match_type' => 'fuzzy',
                    ];
                }
            }
        }

        return null;
    }

    /**
     * Extract transactions from markdown text
     */
    private function extractTransactions(string $markdown): array
    {
        $transactions = [];

        // Look for transaction-like patterns in markdown
        // Pattern: date followed by description and amount
        $lines = explode("\n", $markdown);

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            // Skip headers, totals, and other non-transaction lines
            if ($this->isNonTransactionLine($line)) {
                continue;
            }

            // Handle markdown table rows (lines containing | separators)
            if ($this->isTableRow($line)) {
                $tableTxn = $this->extractTableRowTransaction($line);
                if ($tableTxn) {
                    $transactions[] = $tableTxn;
                    continue;
                }
            }

            // Extract amount if present
            $amount = $this->extractAmount($line);

            // Extract date if present
            $date = $this->extractDate($line);

            // Extract description (remove date and amount)
            $description = preg_replace($this->getDatePattern(), '', $line);
            $description = preg_replace('/[\$]?[\d,]+\.?\d*/', '', $description);
            $description = trim($description);

            if (strlen($description) > 3 && strlen($description) < 200) {
                $transactions[] = [
                    'description' => $description,
                    'amount' => $amount,
                    'date' => $date,
                ];
            }
        }

        return $transactions;
    }

    /**
     * Check if a line is a markdown table row
     */
    private function isTableRow(string $line): bool
    {
        // Table rows contain | separators and are not header/separator rows
        if (strpos($line, '|') === false) {
            return false;
        }
        // Skip markdown table separator rows like |---|---|---|
        if (preg_match('/^\s*\|[\s\-:|]+\|\s*$/', $line)) {
            return false;
        }
        return true;
    }

    /**
     * Extract transaction from a markdown table row
     */
    private function extractTableRowTransaction(string $line): ?array
    {
        // Split by | and filter empty parts
        $cells = array_filter(array_map('trim', explode('|', $line)), fn($c) => $c !== '');
        $cells = array_values($cells);

        if (count($cells) < 2) {
            return null;
        }

        // Try to identify which cell is date, description, and amount
        $date = null;
        $description = null;
        $amount = null;

        foreach ($cells as $i => $cell) {
            // Check if this cell looks like a date
            $cellDate = $this->extractDate($cell);
            if ($cellDate && $date === null) {
                $date = $cellDate;
                continue;
            }

            // Check if this cell looks like an amount
            $cellAmount = $this->extractAmount($cell);
            if ($cellAmount !== null && $amount === null) {
                $amount = $cellAmount;
                continue;
            }
        }

        // Description is typically the non-date, non-amount cell
        // Try to find a meaningful description cell
        foreach ($cells as $i => $cell) {
            $cellTrimmed = trim($cell);
            // Skip if it's just a date or amount
            if ($cellTrimmed === $date) continue;
            if ($cellTrimmed === (string)$amount) continue;

            // Skip very short or numeric-only cells
            if (strlen($cellTrimmed) < 3) continue;
            if (is_numeric(preg_replace('/[,\$\-\s]/', '', $cellTrimmed))) continue;

            // Skip cells that look like balance labels
            if (preg_match('/(balance|total|subtotal|opening|closing)/i', $cellTrimmed)) {
                continue;
            }

            // This looks like a description
            if ($description === null) {
                $description = $cellTrimmed;
            }
        }

        if ($description === null && count($cells) >= 2) {
            // Fallback: use the last non-date cell as description
            foreach (array_reverse($cells) as $cell) {
                $cellTrimmed = trim($cell);
                if ($cellTrimmed !== $date && strlen($cellTrimmed) > 3) {
                    $description = $cellTrimmed;
                    break;
                }
            }
        }

        if ($description && (strlen($description) > 3 && strlen($description) < 200)) {
            return [
                'description' => $description,
                'amount' => $amount,
                'date' => $date,
            ];
        }

        return null;
    }

    /**
     * Check if line is likely not a transaction
     */
    private function isNonTransactionLine(string $line): bool
    {
        $lineLower = strtolower($line);

        // Skip pipe-separated header lines like "Date | Description | Amount"
        if (preg_match('/^\s*(date|description|amount|debit|credit|balance)\s*\|/i', $line)) {
            return true;
        }

        // Skip balance lines regardless of position (beginning, middle, end of line)
        // These often appear as: "01/31/2024 | Ending Balance | $9,200.00"
        if (preg_match('/(beginning|ending|opening|closing)\s+balance/i', $line)) {
            return true;
        }

        $skipPatterns = [
            '/^(total|sum|amount)\s+/i',
            '/^page\s+\d+/i',
            '/^(account|statement|bank)\s+/i',
            '/^-+$/',
            '/^===+$/',
            '/^(date|description|amount|debit|credit|balance)$/i',
            '/^#+\s*/',  // Headers
        ];

        foreach ($skipPatterns as $pattern) {
            if (preg_match($pattern, $line)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Extract amount from text
     */
    private function extractAmount(string $text): ?float
    {
        // Match dollar amounts: $1,234.56 or -$1,234.56 or 1,234.56 or -1,234.56 or 1,234.56-
        // Pattern captures: optional leading minus, optional $, optional spaces, digits with commas, decimal
        // Also captures the minus sign position relative to the amount
        if (preg_match('/(-?)\s*\$?\s*([\d,]+\.\d{2})/', $text, $matches)) {
            $amount = (float) str_replace(',', '', $matches[2]);
            // Check if there was a minus sign before the amount
            // Handle: -$500.00, -500.00, $-500.00, WITHDRAWAL -250.00
            if (!empty($matches[1]) || str_contains($text, '-$') || preg_match('/\s-\d/', $text)) {
                $amount = -$amount;
            }
            return $amount;
        }

        return null;
    }

    /**
     * Extract date from text
     */
    private function extractDate(string $text): ?string
    {
        // Match various date formats
        $patterns = [
            '/(\d{1,2}\/\d{1,2}\/\d{2,4})/',
            '/(\d{4}-\d{2}-\d{2})/',
            '/([A-Za-z]{3}\s+\d{1,2},?\s+\d{4})/',
        ];

        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                return $matches[1];
            }
        }

        return null;
    }

    /**
     * Get date pattern for removal
     */
    private function getDatePattern(): string
    {
        return '/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}|[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}/';
    }

    /**
     * Normalize text for matching
     */
    private function normalizeText(string $text): string
    {
        return strtolower(trim($text));
    }

    /**
     * Build summary from MCA transactions
     */
    private function buildSummary(array $mcaTransactions): array
    {
        $totalAmount = 0;
        $providers = [];

        foreach ($mcaTransactions as $txn) {
            if (isset($txn['amount']) && is_numeric($txn['amount'])) {
                $totalAmount += abs($txn['amount']);
            }
            if (!empty($txn['mca_provider'])) {
                $providers[$txn['mca_provider']] = true;
            }
        }

        $avgConfidence = 0;
        if (!empty($mcaTransactions)) {
            $sum = array_sum(array_column($mcaTransactions, 'confidence'));
            $avgConfidence = $sum / count($mcaTransactions);
        }

        return [
            'total_mca_transactions' => count($mcaTransactions),
            'total_mca_amount' => round($totalAmount, 2),
            'unique_providers' => array_keys($providers),
            'average_confidence' => round($avgConfidence, 2),
        ];
    }

    /**
     * Return empty result structure
     */
    private function emptyResult(): array
    {
        return [
            'transactions' => [],
            'candidates' => [],
            'summary' => [
                'total_mca_transactions' => 0,
                'total_mca_amount' => 0,
                'unique_providers' => [],
                'average_confidence' => 0,
            ],
        ];
    }
}
