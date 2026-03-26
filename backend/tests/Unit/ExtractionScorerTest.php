<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Services\ExtractionScorer;

class ExtractionScorerTest extends TestCase
{
    private ExtractionScorer $scorer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->scorer = new ExtractionScorer();
    }

    public function test_returns_valid_scores_structure(): void
    {
        $result = $this->scorer->score(
            text: 'This is a well structured document with multiple paragraphs and proper formatting.',
            pageCount: 5,
            piiDetected: ['email@sample.com'],
            piiPatterns: ['/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-Z]{2,}/']
        );

        $this->assertArrayHasKey('scores', $result);
        $this->assertArrayHasKey('completeness', $result['scores']);
        $this->assertArrayHasKey('quality', $result['scores']);
        $this->assertArrayHasKey('pii_detection', $result['scores']);
        $this->assertArrayHasKey('overall', $result['scores']);
        $this->assertArrayHasKey('recommendations', $result);
    }

    public function test_scores_are_between_0_and_1(): void
    {
        $result = $this->scorer->score(
            text: 'This is a coherent sentence with proper English words and punctuation.',
            pageCount: 1,
            piiDetected: [],
            piiPatterns: []
        );

        foreach ($result['scores'] as $score) {
            $this->assertGreaterThanOrEqual(0.0, $score);
            $this->assertLessThanOrEqual(1.0, $score);
        }
    }

    public function test_overall_is_weighted_average(): void
    {
        $result = $this->scorer->score(
            text: 'Invoice #12345. Total due: \$500.00. Contact: test@example.com',
            pageCount: 1,
            piiDetected: ['test@example.com'],
            piiPatterns: ['/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-Z]{2,}/']
        );

        $expected = 0.4 * $result['scores']['completeness']
                  + 0.35 * $result['scores']['quality']
                  + 0.25 * $result['scores']['pii_detection'];

        $this->assertEqualsWithDelta($expected, $result['scores']['overall'], 0.02);
    }

    public function test_short_document_generates_completeness_recommendation(): void
    {
        $shortText = 'Hi';
        $result = $this->scorer->score($shortText, 1, [], []);

        $completenessRecs = array_filter($result['recommendations'], fn($r) => $r['type'] === 'completeness');
        $this->assertNotEmpty($completenessRecs);
    }

    public function test_quality_threshold_can_be_met(): void
    {
        $normalText = 'This is a coherent sentence with proper English words and punctuation marks. Let us verify the quality is high enough.';
        $result = $this->scorer->score($normalText, 1, [], []);

        $this->assertGreaterThanOrEqual(0.6, $result['scores']['quality']);
    }
}
