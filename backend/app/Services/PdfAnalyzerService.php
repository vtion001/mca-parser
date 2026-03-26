<?php

namespace App\Services;

class PdfAnalyzerService
{
    public function analyze(string $text): array
    {
        $wordCount = str_word_count($text);
        $charCount = strlen(preg_replace('/\s+/', '', $text));
        $hasPii = $this->checkPiiIndicators($text);
        $confidence = $this->calculateConfidence($text);

        return [
            'word_count' => $wordCount,
            'char_count' => $charCount,
            'has_pii_indicators' => $hasPii,
            'confidence_score' => $confidence,
        ];
    }

    public function scrub(string $text, bool $removePii = true): string
    {
        if (!$removePii) {
            return $text;
        }

        $patterns = [
            '/\b\d{3}-\d{2}-\d{4}\b/' => '[SSN]',
            '/\b\d{9}\b/' => '[ID]',
            '/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/' => '[CARD]',
            '/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/' => '[EMAIL]',
            '/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/' => '[PHONE]',
            '/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/' => '[DATE]',
        ];

        $scrubbed = $text;
        foreach ($patterns as $pattern => $replacement) {
            $scrubbed = preg_replace($pattern, $replacement, $scrubbed);
        }

        return $scrubbed;
    }

    private function checkPiiIndicators(string $text): bool
    {
        $piiKeywords = [
            'ssn', 'social security', 'password', 'secret',
            'credit card', 'bank account', 'routing number',
            'driver license', 'passport', 'date of birth',
            'email', 'phone', 'address', 'dob',
        ];

        $textLower = strtolower($text);

        foreach ($piiKeywords as $keyword) {
            if (str_contains($textLower, $keyword)) {
                return true;
            }
        }

        return false;
    }

    private function calculateConfidence(string $text): float
    {
        $length = strlen($text);

        if ($length < 100) {
            return 0.3;
        }

        if ($length < 500) {
            return 0.5;
        }

        if ($length < 2000) {
            return 0.7;
        }

        $hasStructure = preg_match('/[\.\!\?]+/', $text);
        $hasUppercase = preg_match('/[A-Z]/', $text);
        $hasNumbers = preg_match('/\d+/', $text);

        $score = 0.7;

        if ($hasStructure) $score += 0.05;
        if ($hasUppercase) $score += 0.05;
        if ($hasNumbers) $score += 0.05;

        return min(0.95, $score);
    }
}
