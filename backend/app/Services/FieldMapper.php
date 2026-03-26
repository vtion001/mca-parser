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

        foreach ($schema as $field) {
            foreach ($field['patterns'] as $pattern) {
                $value = null;
                if ($this->matchPattern($pattern, $text, $value)) {
                    $results[] = [
                        'field' => $field['name'],
                        'label' => $field['label'],
                        'value' => $value,
                        'page' => 1,
                        'confidence' => 0.85,
                        'matched_pattern' => $pattern,
                    ];
                    break;
                }
            }
        }

        return $results;
    }

    private function matchPattern(string $pattern, string $text, ?string &$value): bool
    {
        if (str_starts_with($pattern, '/') && preg_match('/^\/.+\/[a-z]*$/i', $pattern)) {
            $regex = substr($pattern, 1, -1);
            if (preg_match('/' . $regex . '/', $text, $matches)) {
                $value = trim($matches[0]);
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

                if (preg_match('/:\s*(.+)/', $line, $m)) {
                    $value = trim($m[1]);
                    return true;
                }
            }
        }
        return false;
    }
}
