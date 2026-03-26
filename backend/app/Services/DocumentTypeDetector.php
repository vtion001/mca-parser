<?php

namespace App\Services;

class DocumentTypeDetector
{
    private array $typeSchemas = [
        'invoice' => [
            'keywords' => ['invoice', 'bill to', 'total due', 'amount due', 'inv-', 'invoice #'],
            'weight' => 1.0,
        ],
        'contract' => [
            'keywords' => ['agreement', 'party of the first', 'effective date', 'terms of', 'hereby agrees'],
            'weight' => 1.0,
        ],
        'receipt' => [
            'keywords' => ['receipt', 'merchant', ' purchased', ' subtotal', ' total:'],
            'weight' => 1.0,
        ],
        'report' => [
            'keywords' => ['executive summary', 'introduction', 'conclusion', 'methodology', 'findings'],
            'weight' => 0.9,
        ],
        'form' => [
            'keywords' => ['name:', 'address:', 'date of birth', 'signature', 'section'],
            'weight' => 0.8,
        ],
    ];

    public function detect(string $text): array
    {
        $textLower = strtolower($text);
        $scores = [];

        foreach ($this->typeSchemas as $type => $schema) {
            $matches = 0;
            foreach ($schema['keywords'] as $keyword) {
                if (str_contains($textLower, $keyword)) {
                    $matches++;
                }
            }
            if ($matches > 0) {
                $scores[$type] = min(1.0, ($matches / count($schema['keywords'])) * $schema['weight']);
            }
        }

        if (empty($scores)) {
            return ['type' => 'unknown', 'confidence' => 0.0];
        }

        arsort($scores);
        $bestType = array_key_first($scores);
        $bestScore = $scores[$bestType];

        return [
            'type' => $bestType,
            'confidence' => round($bestScore, 2),
        ];
    }
}
