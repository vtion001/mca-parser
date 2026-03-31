<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * Abstract base class for AI document analysis services.
 *
 * Provides shared logic for prompt building, response parsing,
 * fallback analysis, and the main document analysis workflow.
 */
abstract class BaseAIService
{
    protected string $apiKey;
    protected string $apiUrl;
    protected int $timeout;
    protected LoggerInterface $logger;

    public function __construct(
        ?string $apiKey = null,
        ?string $apiUrl = null,
        ?int $timeout = null,
        ?LoggerInterface $logger = null
    ) {
        $this->apiKey = $apiKey ?? $this->getDefaultApiKey();
        $this->apiUrl = $apiUrl ?? $this->getDefaultApiUrl();
        $this->timeout = $timeout ?? 120;
        $this->logger = $logger ?? new NullLogger();
    }

    /**
     * Set logger (for Laravel integration)
     */
    public function setLogger(LoggerInterface $logger): void
    {
        $this->logger = $logger;
    }

    /**
     * Returns the provider name (e.g., "minimax" or "openrouter")
     */
    abstract protected function getProviderName(): string;

    /**
     * Returns the default API key from configuration
     */
    abstract protected function getDefaultApiKey(): string;

    /**
     * Returns the default API URL from configuration
     */
    abstract protected function getDefaultApiUrl(): string;

    /**
     * Call the AI provider API with the given prompt.
     * Must be implemented by concrete classes.
     */
    abstract protected function callApi(string $prompt): array;

    /**
     * Analyze PDF content and provide qualifications
     */
    public function analyzeDocument(
        string $markdown,
        array $documentType,
        array $keyDetails,
        array $balances
    ): array {
        // Check if API key is configured
        if (empty($this->apiKey) || $this->apiKey === $this->getPlaceholderApiKey()) {
            return $this->getFallbackAnalysis($markdown, $documentType, $keyDetails, $balances);
        }

        try {
            $prompt = $this->buildPrompt($markdown, $documentType, $keyDetails, $balances);

            $response = $this->callApi($prompt);

            return [
                'success' => true,
                'analysis' => $response,
            ];
        } catch (\Exception $e) {
            $this->logger->error($this->getProviderName() . ' AI analysis failed: ' . $e->getMessage());

            return $this->getFallbackAnalysis($markdown, $documentType, $keyDetails, $balances);
        }
    }

    /**
     * Provide fallback analysis when API is unavailable
     */
    protected function getFallbackAnalysis(
        string $markdown,
        array $documentType,
        array $keyDetails,
        array $balances
    ): array {
        $hasSsn = preg_match('/\d{3}-\d{2}-\d{4}/', $markdown);

        // Don't attempt to sum dollar amounts from markdown - the regex matches
        // table headers, balance figures, and other non-transaction amounts,
        // producing unrealistic totals. Return null for transaction totals instead.
        $totalCredits = null;
        $totalDebits = null;

        return [
            'success' => false,
            'error' => 'AI service unavailable - using basic analysis',
            'analysis' => [
                'qualification_score' => 5,
                'is_valid_document' => strlen($markdown) > 100,
                'completeness' => [
                    'score' => min(10, strlen($markdown) / 100),
                    'is_complete' => strlen($markdown) > 500,
                    'concerns' => strlen($markdown) < 500 ? ['Document may be too short'] : [],
                ],
                'pii_found' => [
                    'has_ssn' => (bool) $hasSsn,
                    'has_account_numbers' => (bool) preg_match('/\d{4,}/', $markdown),
                    'locations' => [],
                ],
                'transaction_summary' => [
                    'credit_count' => null,
                    'debit_count' => null,
                    'total_amount_credits' => $totalCredits,
                    'total_amount_debits' => $totalDebits,
                ],
                'risk_indicators' => [
                    'has_large_unusual_transactions' => false,
                    'has_overdraft_signs' => false,
                    'has_high_fee_pattern' => false,
                    'has_returned_items' => false,
                    'details' => [],
                ],
                'recommendations' => ['Configure ' . $this->getProviderName() . ' API key for AI-powered analysis'],
            ],
        ];
    }

    /**
     * Build analysis prompt for the AI
     */
    protected function buildPrompt(
        string $markdown,
        array $documentType,
        array $keyDetails,
        array $balances
    ): string {
        $truncatedMarkdown = substr($markdown, 0, 8000);

        $keyDetailsText = '';
        foreach ($keyDetails as $detail) {
            $keyDetailsText .= "- {$detail['label']}: {$detail['value']}\n";
        }

        $prompt = <<<EOT
You are an AI document analysis agent specializing in bank statements and financial documents.

## Document Information
- Document Type: {$documentType['type']}
- Type Confidence: {$documentType['confidence']}

## Key Details Extracted
{$keyDetailsText}

## Balances
- Beginning Balance: {$balances['beginning_balance']['amount']} (Keyword: {$balances['beginning_balance']['keyword']})
- Ending Balance: {$balances['ending_balance']['amount']} (Keyword: {$balances['ending_balance']['keyword']})

## Document Content (First 8000 characters)
{$truncatedMarkdown}

## Analysis Tasks
Please provide a comprehensive analysis including:

1. **Document Qualification** - Is this a valid bank statement or financial document? Rate the quality from 1-10.

2. **Completeness Check** - Does the document appear complete? Are there any signs of truncation or missing pages?

3. **PII Indicators** - Are there any Social Security numbers, account numbers, or other sensitive data visible?

4. **Transaction Summary** - Brief summary of transaction activity (credits, debits, total count if detectable)

5. **Risk Indicators** - Any red flags such as:
   - Large unusual transactions
   - Signs of overdraft
   - Fee patterns
   - Returned items

6. **Recommendations** - Any suggestions for the user regarding this document

Please respond in JSON format with the following structure:
{
    "qualification_score": <1-10>,
    "is_valid_document": <true/false>,
    "completeness": {
        "score": <1-10>,
        "is_complete": <true/false>,
        "concerns": [<list of concerns>]
    },
    "pii_found": {
        "has_ssn": <true/false>,
        "has_account_numbers": <true/false>,
        "locations": [<descriptions of where found>]
    },
    "transaction_summary": {
        "credit_count": <number or null>,
        "debit_count": <number or null>,
        "total_amount_credits": <number or null>,
        "total_amount_debits": <number or null>
    },
    "risk_indicators": {
        "has_large_unusual_transactions": <true/false>,
        "has_overdraft_signs": <true/false>,
        "has_high_fee_pattern": <true/false>,
        "has_returned_items": <true/false>,
        "details": [<list of specific observations>]
    },
    "recommendations": [<list of recommendations>]
}

EOT;

        return $prompt;
    }

    /**
     * Parse JSON from AI response
     */
    protected function parseResponse(string $content): array
    {
        $jsonStr = $content;

        // Remove markdown code block markers if present
        if (preg_match('/```json\s*(.*?)\s*```/s', $content, $matches)) {
            $jsonStr = $matches[1];
        } elseif (preg_match('/```\s*(.*?)\s*```/s', $content, $matches)) {
            $jsonStr = $matches[1];
        }

        $decoded = json_decode(trim($jsonStr), true);

        if (json_last_error() === JSON_ERROR_NONE) {
            return $decoded;
        }

        $this->logger->warning($this->getProviderName() . ' response was not valid JSON, returning raw content');
        return [
            'raw_response' => $content,
            'parse_error' => json_last_error_msg(),
        ];
    }

    /**
     * Quick qualification check - faster version for initial screening
     */
    public function quickQualification(string $markdown, array $documentType): array
    {
        try {
            $prompt = "Analyze this document briefly and tell me if it's a valid bank statement or financial document. ";
            $prompt .= "Document type: " . $documentType['type'] . " (confidence: " . $documentType['confidence'] . "). ";
            $prompt .= "First 2000 chars: " . substr($markdown, 0, 2000) . ". ";
            $prompt .= "Respond with JSON: {\"is_valid\": true/false, \"score\": 1-10, \"reason\": \"brief explanation\"}";

            $response = $this->callApi($prompt);

            return [
                'success' => true,
                'result' => $response,
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Returns the placeholder API key that indicates no real key is configured.
     * Override in subclass if different placeholder is used.
     */
    protected function getPlaceholderApiKey(): string
    {
        return '';
    }
}
