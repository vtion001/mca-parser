<?php

namespace App\Services;

use App\Services\FieldMappers\BankStatementTableParser;
use App\Services\FieldMappers\FieldValueCleaner;
use App\Services\FieldMappers\GarbageDetector;
use App\Services\FieldMappers\HeadingParser;

class FieldMapper
{
    private array $fieldSchemas = [
        'invoice' => [
            ['name' => 'vendor', 'label' => 'Vendor', 'patterns' => ['vendor', 'bill to', 'from:', 'company']],
            ['name' => 'amount', 'label' => 'Amount', 'patterns' => ['total due', 'amount due', 'total:', '\$[\d,]+\.\d{2}']],
            ['name' => 'date', 'label' => 'Date', 'patterns' => ['date:', 'dated']],
            ['name' => 'invoice_number', 'label' => 'Invoice #', 'patterns' => ['invoice', 'inv-', '#\d+']],
        ],
        'contract' => [
            ['name' => 'parties', 'label' => 'Parties', 'patterns' => ['party of the first', 'agreement between', 'party a', 'party b']],
            ['name' => 'effective_date', 'label' => 'Effective Date', 'patterns' => ['effective date', 'dated', 'commencing']],
            ['name' => 'terms', 'label' => 'Terms', 'patterns' => ['term of', 'period of', 'duration', 'months']],
        ],
        'receipt' => [
            ['name' => 'merchant', 'label' => 'Merchant', 'patterns' => ['merchant', 'store', 'vendor']],
            ['name' => 'date', 'label' => 'Date', 'patterns' => ['date:', '\d{1,2}/\d{1,2}/\d{2,4}']],
            ['name' => 'total', 'label' => 'Total', 'patterns' => ['total:', 'grand total', '\$[\d,]+\.\d{2}']],
        ],
        'bank_statement' => [
            ['name' => 'account_number', 'label' => 'Account Number', 'patterns' => ['/Account Number:\s*[\d]+/']],
            ['name' => 'account_type', 'label' => 'Account Type', 'patterns' => ['/Account Type:\s*.+/']],
            ['name' => 'statement_period', 'label' => 'Statement Period', 'patterns' => ['/Statement Period Date:\s*.+/']],
            ['name' => 'number_of_days', 'label' => 'Number of Days in Period', 'patterns' => ['/Number of Days in Period\s+\|\s+(\d+)/', '/Number of Days in Period\s+(\d+)/']],
            ['name' => 'banking_center', 'label' => 'Banking Center', 'patterns' => ['/Banking Center:\s*.+/']],
            ['name' => 'banking_center_phone', 'label' => 'Banking Center Phone', 'patterns' => ['/Banking Center Phone:\s*.+/']],
            ['name' => 'beginning_balance', 'label' => 'Beginning Balance', 'patterns' => ['/Beginning Balance\s+\|\s+\$[\d,]+\.\d+/', '/Beginning Balance\s+\$\s*[\d,]+\.\d+/']],
            ['name' => 'ending_balance', 'label' => 'Ending Balance', 'patterns' => ['/Ending Balance\s+\|\s+\$[\d,]+\.\d+/', '/Ending Balance\s+\$\s*[\d,]+\.\d+/']],
            ['name' => 'physical_address', 'label' => 'Physical Address', 'patterns' => ['/^[A-Z][A-Za-z\s]+\d+\s+[A-Za-z\s]+\s+(?:MI?|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\s+[\d-]+/m']],
        ],
        'generic' => [
            ['name' => 'name', 'label' => 'Name', 'patterns' => ['name:', 'contact:', 'person']],
            ['name' => 'email', 'label' => 'Email', 'patterns' => ['/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/']],
            ['name' => 'phone', 'label' => 'Phone', 'patterns' => ['/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/']],
            ['name' => 'date', 'label' => 'Date', 'patterns' => ['/\d{1,2}\/\d{1,2}\/\d{2,4}/']],
        ],
    ];

    public function map(string $text, string $documentType): array
    {
        $schema = $this->fieldSchemas[$documentType] ?? $this->fieldSchemas['generic'];
        $results = [];

        // For bank_statement, also try to parse the markdown table structure
        if ($documentType === 'bank_statement') {
            $tableParser = new BankStatementTableParser();
            $tableFields = $tableParser->extractBankStatementTableFields($text);
            foreach ($tableFields as $field) {
                $results[] = [
                    'field' => $field['field'],
                    'label' => $field['label'],
                    'value' => $field['value'],
                    'page' => 1,
                    'confidence' => 0.9,
                    'matched_pattern' => 'table_parse',
                ];
            }

            // Also extract from section headings (non-table context)
            $headingParser = new HeadingParser();
            $headingFields = $headingParser->extractBankHeadingFields($text);
            foreach ($headingFields as $field) {
                $alreadyFound = array_filter($results, fn($r) => $r['field'] === $field['field']);
                if (empty($alreadyFound)) {
                    $results[] = $field;
                }
            }
        }

        $garbageDetector = new GarbageDetector();

        foreach ($schema as $field) {
            foreach ($field['patterns'] as $pattern) {
                $value = null;
                if ($this->matchPattern($pattern, $text, $value)) {
                    // Guard: skip obviously garbage values (reconciliation boilerplate)
                    if ($field['name'] === 'date' && $garbageDetector->isGarbageValue($value)) {
                        continue;
                    }
                    // Avoid duplicate fields (table parse already found it)
                    $alreadyFound = array_filter($results, fn($r) => $r['field'] === $field['name']);
                    if (empty($alreadyFound)) {
                        $results[] = [
                            'field' => $field['name'],
                            'label' => $field['label'],
                            'value' => $value,
                            'page' => 1,
                            'confidence' => 0.85,
                            'matched_pattern' => is_string($pattern) && str_starts_with($pattern, '/') ? 'regex' : 'keyword',
                        ];
                    }
                    break;
                }
            }
        }

        return $results;
    }

    private function humanLabel(string $fieldName): string
    {
        return ucwords(str_replace('_', ' ', $fieldName));
    }

    private function matchPattern(string $pattern, string $text, ?string &$value): bool
    {
        if (str_starts_with($pattern, '/') && preg_match('#^/.+/[a-z]*$#i', $pattern)) {
            $regex = substr($pattern, 1, -1);
            if (preg_match('#' . $regex . '#', $text, $matches)) {
                // Prefer capture group (index 1) if present, otherwise fall back to full match
                $value = trim($matches[ count($matches) > 1 ? 1 : 0 ]);
                // Strip the label prefix for clean values (e.g. "Account Number: 123" → "123")
                $value = preg_replace('#^[^:]+:\s*#', '', $value);
                return true;
            }
        } else {
            $patternLower = strtolower($pattern);
            $textLower = strtolower($text);
            $pos = strpos($textLower, $patternLower);
            if ($pos !== false) {
                $lineStart = strrpos(substr($text, 0, $pos), "\n");
                $lineStart = $lineStart === false ? 0 : $lineStart + 1;
                $lineEnd = strpos($text, "\n", $pos);
                $lineEnd = $lineEnd === false ? strlen($text) : $lineEnd;
                $line = substr($text, $lineStart, $lineEnd - $lineStart);

                if (preg_match('#:\s*(.+)#', $line, $m)) {
                    $value = trim($m[1]);
                    return true;
                }
            }
        }
        return false;
    }
}
