<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Services\OpenRouterService;
use PHPUnit\Framework\Attributes\Test;

class OpenRouterServiceTest extends TestCase
{
    private OpenRouterService $service;

    protected function setUp(): void
    {
        parent::setUp();
        // Create service with empty API key to test fallback behavior
        $this->service = new OpenRouterService('', '', 'test-model', 5);
    }

    public function test_analyze_document_returns_valid_structure(): void
    {
        $markdown = 'Sample bank statement with $1,000.00 beginning balance and $2,000.00 ending balance.';
        $documentType = ['type' => 'bank_statement', 'confidence' => 0.85];
        $keyDetails = [
            ['label' => 'Account', 'value' => '1234', 'field' => 'account']
        ];
        $balances = [
            'beginning_balance' => ['amount' => 1000.00, 'keyword' => 'beginning balance', 'raw_text' => 'Beginning Balance $1,000.00'],
            'ending_balance' => ['amount' => 2000.00, 'keyword' => 'ending balance', 'raw_text' => 'Ending Balance $2,000.00'],
        ];

        $result = $this->service->analyzeDocument($markdown, $documentType, $keyDetails, $balances);

        $this->assertArrayHasKey('success', $result);
        $this->assertArrayHasKey('analysis', $result);
    }

    public function test_analyze_document_returns_fallback_when_no_api_key(): void
    {
        $markdown = 'Sample bank statement content with $1,000 beginning balance.';
        $documentType = ['type' => 'bank_statement', 'confidence' => 0.85];
        $keyDetails = [
            ['label' => 'Account', 'value' => '1234', 'field' => 'account']
        ];
        $balances = [
            'beginning_balance' => ['amount' => 1000.00, 'keyword' => 'beginning balance', 'raw_text' => 'Beginning Balance $1,000'],
            'ending_balance' => ['amount' => 2000.00, 'keyword' => 'ending balance', 'raw_text' => 'Ending Balance $2,000'],
        ];

        $result = $this->service->analyzeDocument($markdown, $documentType, $keyDetails, $balances);

        // Should return fallback analysis since no API key
        $this->assertFalse($result['success']);
        $this->assertEquals('AI service unavailable - using basic analysis', $result['error']);
        $this->assertArrayHasKey('analysis', $result);
        $this->assertArrayHasKey('qualification_score', $result['analysis']);
    }

    public function test_quick_qualification_returns_valid_structure(): void
    {
        $markdown = 'This is a bank statement.';
        $documentType = ['type' => 'bank_statement', 'confidence' => 0.9];

        $result = $this->service->quickQualification($markdown, $documentType);

        $this->assertArrayHasKey('success', $result);
    }

    public function test_analyze_document_handles_empty_markdown(): void
    {
        $markdown = '';
        $documentType = ['type' => 'unknown', 'confidence' => 0.0];
        $keyDetails = [];
        $balances = [
            'beginning_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
            'ending_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
        ];

        $result = $this->service->analyzeDocument($markdown, $documentType, $keyDetails, $balances);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('success', $result);
    }

    public function test_analyze_document_handles_null_balance_amounts(): void
    {
        $markdown = 'Statement with no detected balances';
        $documentType = ['type' => 'bank_statement', 'confidence' => 0.5];
        $keyDetails = [];
        $balances = [
            'beginning_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
            'ending_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
        ];

        $result = $this->service->analyzeDocument($markdown, $documentType, $keyDetails, $balances);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('success', $result);
    }

    public function test_quick_qualification_handles_empty_document(): void
    {
        $markdown = '';
        $documentType = ['type' => 'unknown', 'confidence' => 0.0];

        $result = $this->service->quickQualification($markdown, $documentType);

        $this->assertIsArray($result);
        $this->assertArrayHasKey('success', $result);
    }

    public function test_parse_json_response_handles_json_with_markdown(): void
    {
        $jsonContent = json_encode([
            'qualification_score' => 8,
            'is_valid_document' => true,
            'completeness' => ['score' => 7, 'is_complete' => true, 'concerns' => []],
            'pii_found' => ['has_ssn' => false, 'has_account_numbers' => true, 'locations' => ['page 1']],
            'transaction_summary' => ['credit_count' => 10, 'debit_count' => 15, 'total_amount_credits' => 5000, 'total_amount_debits' => 3000],
            'risk_indicators' => ['has_large_unusual_transactions' => false, 'has_overdraft_signs' => false, 'has_high_fee_pattern' => true, 'has_returned_items' => false, 'details' => ['Monthly fee detected']],
            'recommendations' => ['Document looks standard']
        ]);

        $wrappedContent = "```json\n" . $jsonContent . "\n```";

        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('parseJsonResponse');
        $method->setAccessible(true);

        $result = $method->invoke($this->service, $wrappedContent);

        $this->assertEquals(8, $result['qualification_score']);
        $this->assertTrue($result['is_valid_document']);
    }

    public function test_parse_json_response_handles_raw_json(): void
    {
        $jsonContent = json_encode([
            'qualification_score' => 6,
            'is_valid_document' => false
        ]);

        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('parseJsonResponse');
        $method->setAccessible(true);

        $result = $method->invoke($this->service, $jsonContent);

        $this->assertEquals(6, $result['qualification_score']);
        $this->assertFalse($result['is_valid_document']);
    }

    public function test_parse_json_response_handles_invalid_json(): void
    {
        $invalidContent = "This is not JSON at all";

        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('parseJsonResponse');
        $method->setAccessible(true);

        $result = $method->invoke($this->service, $invalidContent);

        $this->assertArrayHasKey('raw_response', $result);
        $this->assertEquals('This is not JSON at all', $result['raw_response']);
    }

    public function test_build_analysis_prompt_contains_document_info(): void
    {
        $markdown = 'Test bank statement content';
        $documentType = ['type' => 'bank_statement', 'confidence' => 0.9];
        $keyDetails = [
            ['label' => 'Account Number', 'value' => '****1234'],
            ['label' => 'Statement Date', 'value' => '01/01/2024']
        ];
        $balances = [
            'beginning_balance' => ['amount' => 1000.00, 'keyword' => 'beginning balance', 'raw_text' => 'Beginning Balance: $1,000.00'],
            'ending_balance' => ['amount' => 2000.00, 'keyword' => 'ending balance', 'raw_text' => 'Ending Balance: $2,000.00'],
        ];

        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('buildAnalysisPrompt');
        $method->setAccessible(true);

        $prompt = $method->invoke($this->service, $markdown, $documentType, $keyDetails, $balances);

        $this->assertStringContainsString('bank_statement', $prompt);
        $this->assertStringContainsString('0.9', $prompt);
        $this->assertStringContainsString('Account Number', $prompt);
        $this->assertStringContainsString('****1234', $prompt);
        $this->assertStringContainsString('1000', $prompt);
        $this->assertStringContainsString('2000', $prompt);
    }

    public function test_build_analysis_prompt_truncates_long_markdown(): void
    {
        $longMarkdown = str_repeat('A', 15000);
        $documentType = ['type' => 'test', 'confidence' => 0.5];
        $keyDetails = [];
        $balances = [
            'beginning_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
            'ending_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
        ];

        $reflection = new \ReflectionClass($this->service);
        $method = $reflection->getMethod('buildAnalysisPrompt');
        $method->setAccessible(true);

        $prompt = $method->invoke($this->service, $longMarkdown, $documentType, $keyDetails, $balances);

        $this->assertLessThanOrEqual(12000, strlen($prompt));
    }

    public function test_fallback_analysis_detects_ssn(): void
    {
        $markdown = 'SSN: 123-45-6789 found in document';
        $documentType = ['type' => 'bank_statement', 'confidence' => 0.5];
        $keyDetails = [];
        $balances = [
            'beginning_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
            'ending_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
        ];

        $result = $this->service->analyzeDocument($markdown, $documentType, $keyDetails, $balances);

        $this->assertTrue($result['analysis']['pii_found']['has_ssn']);
    }

    public function test_fallback_analysis_detects_account_numbers(): void
    {
        $markdown = 'Account Number: 1234567890 found';
        $documentType = ['type' => 'bank_statement', 'confidence' => 0.5];
        $keyDetails = [];
        $balances = [
            'beginning_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
            'ending_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
        ];

        $result = $this->service->analyzeDocument($markdown, $documentType, $keyDetails, $balances);

        $this->assertFalse($result['success']); // Using fallback
        $this->assertTrue($result['analysis']['pii_found']['has_account_numbers']);
    }

    public function test_fallback_analysis_detects_phone(): void
    {
        $markdown = 'Call us at 555-123-4567';
        $documentType = ['type' => 'bank_statement', 'confidence' => 0.5];
        $keyDetails = [];
        $balances = [
            'beginning_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
            'ending_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
        ];

        $result = $this->service->analyzeDocument($markdown, $documentType, $keyDetails, $balances);

        $this->assertFalse($result['success']); // Using fallback
    }

    public function test_fallback_analysis_calculates_completeness(): void
    {
        $shortMarkdown = 'Short doc';
        $documentType = ['type' => 'bank_statement', 'confidence' => 0.5];
        $keyDetails = [];
        $balances = [
            'beginning_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
            'ending_balance' => ['amount' => null, 'keyword' => null, 'raw_text' => null],
        ];

        $result = $this->service->analyzeDocument($shortMarkdown, $documentType, $keyDetails, $balances);

        $this->assertArrayHasKey('completeness', $result['analysis']);
        $this->assertFalse($result['analysis']['completeness']['is_complete']);
        $this->assertNotEmpty($result['analysis']['completeness']['concerns']);
    }
}
