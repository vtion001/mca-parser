<?php

namespace App\Services;

/**
 * Balance Extractor Service
 * 
 * Extracts beginning and ending balances from bank statements.
 * Based on Part 4 of the BSS Backend Knowledge Base.
 */
class BalanceExtractorService
{
    /**
     * Beginning Balance Keywords
     */
    private array $beginningKeywords = [
        'previous balance',
        'starting balance',
        'beginning balance',
        'balance last statement',
        'balance previous statement',
        'last statement',
        'beginning statement',
        'previous statement',
        'starting',
    ];

    /**
     * Ending Balance Keywords
     */
    private array $endingKeywords = [
        'ending balance',
        'current balance',
        'balance this statement',
        'balance ending statement',
        'this statement',
        'ending statement',
        'ending',
    ];

    /**
     * Amount regex pattern that handles:
     * - 1,234.56
     * - -1,234.56
     * - 1234.56-
     * - -$1,234.56
     * - $1,234.56
     */
    private string $amountPattern = '/-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?-?/';

    /**
     * Extract balances from markdown text
     * 
     * @param string $text The extracted text from the PDF
     * @return array{beginning_balance: array{amount: float|null, keyword: string|null, raw_text: string|null}, ending_balance: array{amount: float|null, keyword: string|null, raw_text: string|null}}
     */
    public function extractBalances(string $text): array
    {
        $lines = explode("\n", $text);
        
        $beginningBalance = $this->findBeginningBalance($lines);
        $endingBalance = $this->findEndingBalance($lines);

        return [
            'beginning_balance' => $beginningBalance,
            'ending_balance' => $endingBalance,
        ];
    }

    /**
     * Find beginning balance using keyword matching
     */
    private function findBeginningBalance(array $lines): array
    {
        $lineCount = count($lines);
        
        for ($i = 0; $i < $lineCount; $i++) {
            $line = $lines[$i];
            $lineLower = strtolower($line);
            
            foreach ($this->beginningKeywords as $keyword) {
                if (str_contains($lineLower, $keyword)) {
                    // Try current line first
                    $amount = $this->extractAmount($line);
                    if ($amount !== null) {
                        return [
                            'amount' => $amount,
                            'keyword' => $keyword,
                            'raw_text' => trim($line),
                        ];
                    }
                    
                    // Check next line if keyword found but no amount on current line
                    if ($i + 1 < $lineCount) {
                        $nextLine = $lines[$i + 1];
                        $amount = $this->extractAmount($nextLine);
                        if ($amount !== null) {
                            return [
                                'amount' => $amount,
                                'keyword' => $keyword,
                                'raw_text' => trim($line) . ' ' . trim($nextLine),
                            ];
                        }
                    }
                }
            }
        }

        return [
            'amount' => null,
            'keyword' => null,
            'raw_text' => null,
        ];
    }

    /**
     * Find ending balance using keyword matching
     */
    private function findEndingBalance(array $lines): array
    {
        $lineCount = count($lines);
        
        for ($i = 0; $i < $lineCount; $i++) {
            $line = $lines[$i];
            $lineLower = strtolower($line);
            
            foreach ($this->endingKeywords as $keyword) {
                if (str_contains($lineLower, $keyword)) {
                    // Try current line first
                    $amount = $this->extractAmount($line);
                    if ($amount !== null) {
                        return [
                            'amount' => $amount,
                            'keyword' => $keyword,
                            'raw_text' => trim($line),
                        ];
                    }
                    
                    // Check next line if keyword found but no amount on current line
                    if ($i + 1 < $lineCount) {
                        $nextLine = $lines[$i + 1];
                        $amount = $this->extractAmount($nextLine);
                        if ($amount !== null) {
                            return [
                                'amount' => $amount,
                                'keyword' => $keyword,
                                'raw_text' => trim($line) . ' ' . trim($nextLine),
                            ];
                        }
                    }
                }
            }
        }

        return [
            'amount' => null,
            'keyword' => null,
            'raw_text' => null,
        ];
    }

    /**
     * Extract amount from a line using regex pattern
     * 
     * Handles:
     * - 1,234.56
     * - -1,234.56
     * - 1234.56-
     * - -$1,234.56
     * - $1,234.56
     */
    private function extractAmount(string $line): ?float
    {
        // Find all amounts in the line
        preg_match_all($this->amountPattern, $line, $matches);
        
        if (empty($matches[0])) {
            return null;
        }

        // Find the largest amount (likely the balance)
        $largestAmount = null;
        
        foreach ($matches[0] as $match) {
            $amount = $this->parseAmount($match);
            if ($amount !== null) {
                // Skip very small amounts (likely not balances)
                if (abs($amount) > 1) {
                    if ($largestAmount === null || abs($amount) > abs($largestAmount)) {
                        $largestAmount = $amount;
                    }
                }
            }
        }

        return $largestAmount;
    }

    /**
     * Parse amount string to float
     */
    private function parseAmount(string $amountStr): ?float
    {
        // Remove $, commas, and trailing minus
        $cleaned = preg_replace('/[$,]/', '', $amountStr);
        
        // Handle trailing minus (e.g., "1234.56-")
        $isNegative = false;
        if (str_ends_with($cleaned, '-')) {
            $isNegative = true;
            $cleaned = substr($cleaned, 0, -1);
        }
        
        // Handle leading minus
        if (str_starts_with($cleaned, '-')) {
            $isNegative = true;
            $cleaned = substr($cleaned, 1);
        }

        if (!is_numeric($cleaned)) {
            return null;
        }

        $value = (float) $cleaned;
        return $isNegative ? -$value : $value;
    }
}
