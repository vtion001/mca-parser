<?php

namespace App\Services\FieldMappers;

class BankStatementTableParser
{
    /**
     * Extract bank statement fields from markdown table rows.
     * Tables have two possible structures:
     *   A) | date | label | value | [label | value]*   (date in first cell, label/value pairs follow)
     *   B) | label | value | [label | value]*         (no date, label/value pairs from start)
     * We detect which format by checking if the first cell is a date (pure numeric).
     */
    public function extractBankStatementTableFields(string $text): array
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
                    $cleanValue = (new FieldValueCleaner())->cleanFieldValue($fieldName, trim($valueCell));
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

    public function detectBankFieldName(string $cell): ?string
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

    public function humanLabel(string $fieldName): string
    {
        return ucwords(str_replace('_', ' ', $fieldName));
    }
}
