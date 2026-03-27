<?php

namespace App\Services;

class ExtractionScorer
{
    public function score(string $text, int $pageCount, array $piiDetected, array $piiPatterns): array
    {
        $completeness = $this->calculateCompleteness($text, $pageCount);
        $quality = $this->calculateQuality($text);
        $piiDetection = $this->calculatePiiScore($piiDetected, $piiPatterns);

        $overall = (0.4 * $completeness) + (0.35 * $quality) + (0.25 * $piiDetection);

        $recommendations = $this->generateRecommendations($completeness, $quality, $piiDetection, $text);

        // Build PII breakdown showing which patterns were found
        $piiBreakdown = $this->buildPiiBreakdown($piiDetected, $piiPatterns);

        return [
            'scores' => [
                'completeness' => round($completeness, 2),
                'quality' => round($quality, 2),
                'pii_detection' => round($piiDetection, 2),
                'overall' => round($overall, 2),
            ],
            'pii_breakdown' => $piiBreakdown,
            'recommendations' => $recommendations,
        ];
    }

    /**
     * Build detailed breakdown of which PII patterns were detected
     */
    private function buildPiiBreakdown(array $detected, array $patterns): array
    {
        $breakdown = [];
        $patternNames = array_keys($patterns);

        foreach ($patternNames as $name) {
            $breakdown[$name] = [
                'found' => in_array($name, $detected),
                'label' => $this->getPatternLabel($name),
            ];
        }

        return $breakdown;
    }

    /**
     * Get human-readable label for PII pattern
     */
    private function getPatternLabel(string $name): string
    {
        return match($name) {
            'ssn' => 'Social Security Number',
            'email' => 'Email Address',
            'phone' => 'Phone Number',
            default => ucfirst($name),
        };
    }

    private function calculateCompleteness(string $text, int $pageCount): float
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

        $hasStructure = preg_match('/[.\!\\?]+/', $text) ? 0.1 : 0;
        $pageScore = min(1.0, $pageCount / 5);

        return min(0.95, 0.7 + $hasStructure + ($pageScore * 0.15));
    }

    private function calculateQuality(string $text): float
    {
        $garbledRatio = $this->calculateGarbledRatio($text);
        $hasFormatting = preg_match('/[#*_\-\d]/', $text) ? 0.1 : 0;
        $hasUppercase = preg_match('/[A-Z]/', $text) ? 0.1 : 0;

        $baseScore = 0.6;
        $coherence = (1 - $garbledRatio) * 0.6;

        return min(0.95, $baseScore + $coherence + $hasFormatting + $hasUppercase);
    }

    private function calculateGarbledRatio(string $text): float
    {
        $chars = mb_str_split($text);
        if (count($chars) === 0) {
            return 0.0;
        }

        $garbled = 0;
        foreach ($chars as $char) {
            $ord = mb_ord($char);
            if ($ord > 127 && !preg_match('/[áéíóúñüäößàèìòùâêîôû]/i', $char)) {
                $garbled++;
            }
        }

        return $garbled / count($chars);
    }

    private function calculatePiiScore(array $detected, array $patterns): float
    {
        if (empty($patterns)) {
            return 0.5;
        }

        $foundCount = count($detected);
        $patternCount = count($patterns);

        if ($foundCount === 0) {
            return 0.3;
        }

        return min(0.95, $foundCount / $patternCount + 0.5);
    }

    private function generateRecommendations(float $completeness, float $quality, float $piiDetection, string $text, array $piiDetected = [], array $piiPatterns = []): array
    {
        $recommendations = [];

        if ($quality < 0.6) {
            $recommendations[] = [
                'type' => 'quality',
                'message' => 'Low text quality detected - possible scan artifact or garbled text',
            ];
        }

        if ($completeness < 0.6) {
            $recommendations[] = [
                'type' => 'completeness',
                'message' => 'Document appears short - verify all pages were extracted',
            ];
        }

        if ($piiDetection < 0.5 && strlen($text) > 500) {
            $recommendations[] = [
                'type' => 'pii',
                'message' => 'Limited PII detected - document may not contain sensitive data patterns',
            ];
        }

        return $recommendations;
    }
}
