<?php

namespace App\Services\FieldMappers;

class HeadingParser
{
    /**
     * Extract bank statement fields from non-table section headings.
     * Account number and statement period are often embedded in headings like:
     *   ## MORTGAGE FINANCE CHECKING - 2400099108
     *   ## Statement Ending 11/30/2025
     */
    public function extractBankHeadingFields(string $text): array
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
}
