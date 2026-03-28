<?php

namespace App\Services;

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
            $tableFields = $this->extractBankStatementTableFields($text);
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
            $headingFields = $this->extractBankHeadingFields($text);
            foreach ($headingFields as $field) {
                $alreadyFound = array_filter($results, fn($r) => $r['field'] === $field['field']);
                if (empty($alreadyFound)) {
                    $results[] = $field;
                }
            }
        }

        foreach ($schema as $field) {
            foreach ($field['patterns'] as $pattern) {
                $value = null;
                if ($this->matchPattern($pattern, $text, $value)) {
                    // Guard: skip obviously garbage values (reconciliation boilerplate)
                    if ($field['name'] === 'date' && $this->isGarbageValue($value)) {
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

    /**
     * Extract bank statement fields from markdown table rows.
     * Tables have two possible structures:
     *   A) | date | label | value | [label | value]*   (date in first cell, label/value pairs follow)
     *   B) | label | value | [label | value]*         (no date, label/value pairs from start)
     * We detect which format by checking if the first cell is a date (pure numeric).
     */
    private function extractBankStatementTableFields(string $text): array
    {
        $fields = [];
        $lines = explode("\n", $text);

        foreach ($lines as $line) {
            // Only process table data rows (start with |)
            if (!str_starts_with(trim($line), '|')) {
                continue;
            }

            // Skip separator rows (contain only |, -, spaces, and colons)
            $trimmed = trim($line);
            if (preg_match('/^\|[\s\-|:]*\|$/', $trimmed)) {
                continue;
            }

            // Split by | and clean up each cell
            $cells = array_map(fn($cell) => trim($cell), explode('|', $line));
            array_shift($cells); // Remove leading empty cell
            array_pop($cells);   // Remove trailing empty cell

            if (count($cells) < 2) {
                continue;
            }

            // Detect table format by checking if first cell is a date/pure-number cell
            // Format A: first cell is date (e.g. "12/01", "12/31") → skip it, pair from index 1
            // Format B: first cell is a label → pair from index 0
            $firstIsDate = preg_match('#^\d[\d\/\-\s]*$#', strtolower($cells[0])) === 1
                && !str_contains(strtolower($cells[0]), 'balance')
                && !str_contains(strtolower($cells[0]), 'days');
            $startIdx = $firstIsDate ? 1 : 0;

            // Walk through cells in pairs: (label, value)
            for ($i = $startIdx; $i + 1 < count($cells); $i += 2) {
                $labelCell = $cells[$i];
                $valueCell = $cells[$i + 1] ?? '';

                // Skip if label cell is empty or pure numeric (not a field label)
                if ($labelCell === '' || preg_match('#^\d[\d\/\-\s]*$#', strtolower($labelCell))) {
                    continue;
                }

                $fieldName = $this->detectBankFieldName($labelCell);
                if ($fieldName && trim($valueCell) !== '') {
                    $cleanValue = $this->cleanFieldValue($fieldName, trim($valueCell));
                    if ($cleanValue !== '') {
                        $fields[$fieldName] = [
                            'field' => $fieldName,
                            'label' => $this->humanLabel($fieldName),
                            'value' => $cleanValue,
                        ];
                    }
                }
            }
        }

        return array_values($fields);
    }

    private function detectBankFieldName(string $cell): ?string
    {
        $cellLower = strtolower(trim($cell));

        // Strip trailing " | ..." from cells that contain "Label | Value" format
        // e.g. "Beginning Balance | $(1,785.93)" → "Beginning Balance"
        $cellLower = preg_replace('#\s*\|\s*.+$#', '', $cellLower);
        $cellLower = trim($cellLower);

        if ($cellLower === '') {
            return null;
        }

        // Skip cells that are pure numbers, dates, or symbols
        if (preg_match('#^\d[\d\/\-\s]*$#', $cellLower)) {
            return null;
        }

        // Direct lookup table for known bank statement labels
        $fieldMap = [
            'account number'          => 'account_number',
            'account #'              => 'account_number',
            'acct #'                 => 'account_number',
            'account_num'            => 'account_number',
            'number of days'         => 'number_of_days',
            'days in period'         => 'number_of_days',
            'account type'           => 'account_type',
            'banking center'         => 'banking_center',
            'branch'                 => 'banking_center',
            'banking center phone'   => 'banking_center_phone',
            'branch phone'           => 'banking_center_phone',
            'beginning balance'      => 'beginning_balance',
            'begin balance'           => 'beginning_balance',
            'ending balance'         => 'ending_balance',
            'end balance'             => 'ending_balance',
            'total deposits'         => 'total_deposits',
            'total credits'          => 'total_credits',
            'total withdrawals'       => 'total_withdrawals',
            'total debits'           => 'total_debits',
            'service charge'         => 'service_charge',
            'statement period'       => 'statement_period',
        ];

        foreach ($fieldMap as $label => $fieldName) {
            if (str_contains($cellLower, $label)) {
                return $fieldName;
            }
        }

        return null;
    }

    private function cleanFieldValue(string $fieldName, string $value): string
    {
        // Strip leading "Label | " from cells that contain "Label | Value" format.
        // The label can contain word chars, spaces, hyphens, dots, slashes, commas.
        // e.g. "Beginning Balance | $(1,785.93)" → "$(1,785.93)"
        // e.g. "Ending Balance    | $11,069.11" → "$11,069.11"
        // We strip the label (everything before and including the last " | ") and keep the rest.
        if (str_contains($value, '|')) {
            $lastPipePos = strrpos($value, '|');
            $possibleLabel = substr($value, 0, $lastPipePos);
            $possibleValue = substr($value, $lastPipePos + 1);
            // If the "label" part before the pipe contains at least one letter (is textual),
            // and the "value" part is non-empty, treat it as a "Label | Value" cell
            if (preg_match('/[A-Za-z]/', $possibleLabel) && trim($possibleValue) !== '') {
                $value = $possibleValue;
            }
        }

        // For monetary fields, clean up dollar and parentheses formatting
        if (in_array($fieldName, ['beginning_balance', 'ending_balance', 'total_deposits', 'total_withdrawals', 'total_credits', 'total_debits', 'service_charge'])) {
            $value = preg_replace('/^\$\s*/', '', $value); // strip leading $
            // If accounting format: (123.45) → -123.45
            if (preg_match('/^\(([^)]+)\)$/', $value, $m)) {
                $value = '-' . $m[1];
            }
        }

        // Remove any remaining pipe characters
        $value = str_replace('|', '', $value);

        return trim($value);
    }

    /**
     * Extract bank statement fields from non-table section headings.
     * Account number and statement period are often embedded in headings like:
     *   ## MORTGAGE FINANCE CHECKING - 2400099108
     *   ## Statement Ending 11/30/2025
     */
    private function extractBankHeadingFields(string $text): array
    {
        $fields = [];

        // Account number from heading: "## ACCOUNT TYPE - 2400099108" or "## ACCOUNT TYPE 2400099108"
        if (preg_match('/##\s*[A-Z][A-Z\s]+\s*[-–]?\s*(\d{6,14})/m', $text, $acctMatch)) {
            $fields['account_number'] = [
                'field' => 'account_number',
                'label' => 'Account Number',
                'value' => $acctMatch[1],
                'page' => 1,
                'confidence' => 0.95,
                'matched_pattern' => 'heading_parse',
            ];
        }

        // Statement period from heading: "## Statement Ending 11/30/2025"
        if (preg_match('/##\s*Statement\s+Ending\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/m', $text, $periodMatch)) {
            $fields['statement_period'] = [
                'field' => 'statement_period',
                'label' => 'Statement Period',
                'value' => $periodMatch[1],
                'page' => 1,
                'confidence' => 0.95,
                'matched_pattern' => 'heading_parse',
            ];
        }

        // Bank name from header section (e.g. "Texas Capital Bank")
        if (preg_match('/^(Texas Capital Bank|Bank of America|Wells Fargo|JPMorgan|Chase|Citibank|US Bank|First National|PNC|Capital One|U.S. Bank)/m', $text, $bankMatch)) {
            $fields['bank_name'] = [
                'field' => 'bank_name',
                'label' => 'Bank Name',
                'value' => $bankMatch[1],
                'page' => 1,
                'confidence' => 0.9,
                'matched_pattern' => 'heading_parse',
            ];
        }

        return array_values($fields);
    }

    /**
     * Returns true if the extracted value looks like reconciliation boilerplate
     * rather than a real field value. These values contain generic instruction
     * text that the generic regex patterns sometimes match.
     */
    private function isGarbageValue(string $value): bool
    {
        $valueLower = strtolower(trim($value));
        $garbagePhrases = [
            'this is provided to help you balance',
            'your checkbook',
            'bank balance',
            'checks outstanding',
            'other bank charges',
            'deposits not shown',
            'activity charge',
            'should agree with your',
            'beginning balance',
            'ending balance',
        ];
        foreach ($garbagePhrases as $phrase) {
            if (str_contains($valueLower, $phrase)) {
                return true;
            }
        }
        // Also flag very long values (>150 chars) that aren't money amounts
        if (strlen($value) > 150 && !preg_match('/^\$?[\d,]+\.\d{2}$/', trim($value))) {
            return true;
        }
        return false;
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
