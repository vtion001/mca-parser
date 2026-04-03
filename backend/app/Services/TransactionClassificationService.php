<?php

namespace App\Services;

/**
 * Transaction Classification Service
 *
 * Implements BSS Backend-style transaction classification for bank statements:
 * - RETURN: Refunds, reversals, returned items, fee waivers
 * - INTERNAL_TRANSFER: Account transfers between owned accounts
 * - WIRE: Wire transfers, ACH, SWIFT, NEFT, RTGS
 * - LINE_OF_CREDIT: Loans, credit lines, PayPal credit, etc.
 * - LENDER: Specific lender identifications
 * - CASHAPP: Cash app, Zelle, Venmo, Square, Shopify payments
 *
 * Based on BSS Backend TableKeywords and classification patterns.
 */
class TransactionClassificationService
{
    /**
     * Return transaction keywords
     * These indicate a reversal, refund, or returned payment
     */
    private array $returnKeywords = [
        'reject', 'rejected', 'rejection',
        'cancel', 'cancelled', 'cancellation',
        'return', 'returned', 'returning', 'ret',
        'reverse', 'reversed', 'reversing', 'reversal',
        'refund', 'refunded', 'refunding',
        'fee waiver', 'fee waived', 'fee waive', 'waiver', 'waived',
    ];

    /**
     * Internal transfer keywords
     * These indicate transfers between accounts owned by the same entity
     */
    private array $internalTransferKeywords = [
        'ib transfer from',
        'ib transfer to',
        'transfer between accounts',
        'funds transfer to',
        'funds transfer from',
        'online transfer to',
        'online transfer from',
        'self transfer',
        'own account transfer',
        'transfer to self',
        'transfer from acct',
        'transfer to acct',
        'transfer from account',
        'transfer to account',
        'transfer to savings',
        'transfer to checking',
        'transfer to chk',
        'transfer to sav',
        'trsf from reg sav',
        'trsf from chk',
        'trsf from account',
        'trsf to savings',
        'trsf to checking',
        'internal transfer',
        'internal',
        'overdraft transfer',
        'own transfer',
        'from account',
        'from checking account',
        'from savings account',
        'to checking account',
        'to savings account',
        'internet tfr from checking',
        'internet tfr from savings',
        'internet tfri from checking',
        'internet tfri from savings',
        'ach transfer from',
        'ach transfer to',
        'ach credit',
        'ach debit',
    ];

    /**
     * Wire transfer keywords
     */
    private array $wireKeywords = [
        'wire transfer',
        'wire xfr',
        'incoming wire',
        'outgoing wire',
        'wire in',
        'wire out',
        'wire payment',
        'wire received',
        'wire sent',
        'wire dep',
        'wire deposit',
        'neft',
        'rtgs',
        'imps',
        'swift transfer',
        'swift payment',
    ];

    /**
     * Line of credit / loan keywords
     */
    private array $lineOfCreditKeywords = [
        'line of credit',
        'lineofcredit',
        'lineof credit',
        'line ofcredit',
        'loan',
        'loans',
        'headway capital',
        'headwaycapital',
        'head way capital',
        'headway',
        'blue vine',
        'bluevine',
        'fundbox',
        'fund box',
        'sbfs',
        'on deck',
        'ondeck',
        'paypal credit',
        'paypal loan',
        'intuit financing',
        'intuitfinancing',
        'intuit',
        'webbank',
        'web bank',
        'headway capital',
        'lending',
    ];

    /**
     * Lender-specific keywords
     */
    private array $lenderKeywords = [
        'arena',
        'afs',
        'dlp',
        'east hudson',
        'easthudson',
        'hudson',
        'united first',
        'unitedfirst',
        'global funding experts',
        'globalfundingexperts',
        'gfe',
        'global capital experts',
        'globalcapitalexperts',
        'gce',
        'g&g',
        'fenix',
        'fratello',
        'fundamental capital',
        'fundamentalcapital',
        'fundworks',
        'fund works',
        'highland hill',
        'highlandhill',
        'high land hill',
        'high landhill',
        'mulligan',
        'qfs',
        'rbm',
        'silverline',
        'silver line',
        'whiteroad capital',
        'whiteroadcapital',
        'white road capital',
        'whiteroad',
        'white road',
        'credit key',
        'creditkey',
        'ford credit',
        'fordcredit',
    ];

    /**
     * Cash app / payment processor keywords
     * Note: Some processors have MCA products which are handled separately
     */
    private array $cashAppKeywords = [
        'cash app',
        'cashapp',
        'zelle',
        'venmo',
    ];

    /**
     * Classify a single transaction
     *
     * @param string $description Transaction description
     * @param float|null $amount Transaction amount
     * @return array Classification results with tags and confidence
     */
    public function classify(string $description, ?float $amount = null): array
    {
        $descLower = strtolower($this->normalizeText($description));
        $tags = [];
        $confidence = 0.0;

        // Check for RETURN transactions
        if ($this->matchesKeywords($descLower, $this->returnKeywords)) {
            $tags[] = 'return';
            $confidence = 0.95;
        }

        // Check for INTERNAL TRANSFER
        if ($this->matchesKeywords($descLower, $this->internalTransferKeywords)) {
            $tags[] = 'internal_transfer';
            $confidence = max($confidence, 0.90);
        }

        // Check for WIRE transfers
        if ($this->matchesKeywords($descLower, $this->wireKeywords)) {
            $tags[] = 'wire';
            $confidence = max($confidence, 0.90);
        }

        // Check for LINE OF CREDIT / LOAN
        if ($this->matchesKeywords($descLower, $this->lineOfCreditKeywords)) {
            $tags[] = 'line_of_credit';
            $confidence = max($confidence, 0.85);
        }

        // Check for LENDER
        if ($this->matchesKeywords($descLower, $this->lenderKeywords)) {
            $tags[] = 'lender';
            $confidence = max($confidence, 0.85);
        }

        // Check for CASH APP / PAYMENT PROCESSORS
        if ($this->matchesKeywords($descLower, $this->cashAppKeywords)) {
            $tags[] = 'cash_app';
            $confidence = max($confidence, 0.90);
        }

        return [
            'tags' => $tags,
            'is_classified' => !empty($tags),
            'confidence' => $confidence,
            'has_withdrawal' => $amount !== null && $amount < 0,
            'has_deposit' => $amount !== null && $amount > 0,
        ];
    }

    /**
     * Classify multiple transactions
     *
     * @param array $transactions Array of transactions with 'description' and optional 'amount'
     * @return array Classification results
     */
    public function classifyBatch(array $transactions): array
    {
        $results = [];
        $summary = [
            'total' => count($transactions),
            'return' => 0,
            'internal_transfer' => 0,
            'wire' => 0,
            'line_of_credit' => 0,
            'lender' => 0,
            'cash_app' => 0,
        ];

        foreach ($transactions as $transaction) {
            $description = $transaction['description'] ?? '';
            $amount = $transaction['amount'] ?? null;
            $result = $this->classify($description, $amount);

            $results[] = array_merge($transaction, [
                'classification' => $result,
            ]);

            // Count tags
            foreach ($result['tags'] as $tag) {
                if (isset($summary[$tag])) {
                    $summary[$tag]++;
                }
            }
        }

        return [
            'transactions' => $results,
            'summary' => $summary,
        ];
    }

    /**
     * Extract and classify transactions from markdown text
     *
     * @param string $markdown The extracted text content
     * @return array Classification results
     */
    public function detect(string $markdown): array
    {
        $transactions = $this->extractTransactions($markdown);

        if (empty($transactions)) {
            return $this->emptyResult();
        }

        return $this->classifyBatch($transactions);
    }

    /**
     * Extract transactions from markdown text
     */
    private function extractTransactions(string $markdown): array
    {
        $transactions = [];
        $lines = explode("\n", $markdown);

        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;

            if ($this->isNonTransactionLine($line)) {
                continue;
            }

            $amount = $this->extractAmount($line);
            $date = $this->extractDate($line);
            $description = $this->extractDescription($line);

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
     * Check if line is likely not a transaction
     */
    private function isNonTransactionLine(string $line): bool
    {
        // Skip pipe-separated header lines
        if (preg_match('/^\s*(date|description|amount|debit|credit|balance)\s*\|/i', $line)) {
            return true;
        }

        // Skip balance lines
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
            '/^#+\s*/',
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
        // Match dollar amounts with optional negative sign
        if (preg_match('/(-?)\s*\$?\s*([\d,]+\.\d{2})/', $text, $matches)) {
            $amount = (float) str_replace(',', '', $matches[2]);
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
     * Extract description (remove date and amount)
     */
    private function extractDescription(string $line): string
    {
        $description = preg_replace($this->getDatePattern(), '', $line);
        $description = preg_replace('/-?\$?\s*[\d,]+\.\d{2}/', '', $description);
        $description = preg_replace('/\|/', '', $description);
        return trim($description);
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
     * Check if description matches any keyword
     */
    private function matchesKeywords(string $descLower, array $keywords): bool
    {
        foreach ($keywords as $keyword) {
            // Use word boundary matching for better accuracy
            $pattern = '/\b' . preg_quote($keyword, '/') . '\b/i';
            if (preg_match($pattern, $descLower)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Return empty result structure
     */
    private function emptyResult(): array
    {
        return [
            'transactions' => [],
            'summary' => [
                'total' => 0,
                'return' => 0,
                'internal_transfer' => 0,
                'wire' => 0,
                'line_of_credit' => 0,
                'lender' => 0,
                'cash_app' => 0,
            ],
        ];
    }
}
