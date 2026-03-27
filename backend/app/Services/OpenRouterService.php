<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * OpenRouter AI Service
 *
 * Uses OpenRouter API to analyze and provide qualifications for PDFs.
 * OpenRouter provides access to multiple AI models including GPT-3.5, Claude, etc.
 */
class OpenRouterService
{
    private string $apiKey;
    private string $apiUrl;
    private string $model;
    private int $timeout;
    private LoggerInterface $logger;

    public function __construct(
        ?string $apiKey = null,
        ?string $apiUrl = null,
        ?string $model = null,
        ?int $timeout = null,
        ?LoggerInterface $logger = null
    ) {
        $this->apiKey = $apiKey ?? config('services.openrouter.api_key', '');
        $this->apiUrl = $apiUrl ?? config('services.openrouter.api_url', 'https://openrouter.ai/api/v1');
        $this->model = $model ?? config('services.openrouter.model', 'openai/gpt-3.5-turbo');
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
     * Analyze PDF content and provide qualifications
     */
    public function analyzeDocument(
        string $markdown,
        array $documentType,
        array $keyDetails,
        array $balances
    ): array {
        // Check if API key is configured
        if (empty($this->apiKey)) {
            return $this->getFallbackAnalysis($markdown, $documentType, $keyDetails, $balances);
        }

        try {
            $prompt = $this->buildAnalysisPrompt($markdown, $documentType, $keyDetails, $balances);

            $response = $this->callOpenRouter($prompt);

            return [
                'success' => true,
                'analysis' => $response,
            ];
        } catch (\Exception $e) {
            $this->logger->error('OpenRouter AI analysis failed: ' . $e->getMessage());

            return $this->getFallbackAnalysis($markdown, $documentType, $keyDetails, $balances);
        }
    }

    /**
     * Provide fallback analysis when API is unavailable
     */
    private function getFallbackAnalysis(
        string $markdown,
        array $documentType,
        array $keyDetails,
        array $balances
    ): array {
        $wordCount = str_word_count($markdown);
        $charCount = strlen($markdown);
        $hasSsn = preg_match('/\d{3}-\d{2}-\d{4}/', $markdown);
        $hasEmail = preg_match('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $markdown);
        $hasPhone = preg_match('/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/', $markdown);

        $totalCredits = 0;
        $totalDebits = 0;
        preg_match_all('/\$?(-?)\d{1,3}(?:,\d{3})*(?:\.\d{2})?/', $markdown, $amounts);
        foreach ($amounts[0] as $amount) {
            $value = (float) preg_replace('/[$,]/', '', $amount);
            if ($value > 0) {
                $totalCredits += $value;
            } else {
                $totalDebits += abs($value);
            }
        }

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
                    'total_amount_credits' => $totalCredits > 0 ? round($totalCredits, 2) : null,
                    'total_amount_debits' => $totalDebits > 0 ? round($totalDebits, 2) : null,
                ],
                'risk_indicators' => [
                    'has_large_unusual_transactions' => false,
                    'has_overdraft_signs' => false,
                    'has_high_fee_pattern' => false,
                    'has_returned_items' => false,
                    'details' => [],
                ],
                'recommendations' => ['Configure OpenRouter API key for AI-powered analysis'],
            ],
        ];
    }

    /**
     * Build analysis prompt for the AI
     */
    private function buildAnalysisPrompt(
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
     * Call OpenRouter API
     */
    private function callOpenRouter(string $prompt): array
    {
        $payload = [
            'model' => $this->model,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt,
                ],
            ],
            'temperature' => 0.3,
            'max_tokens' => 2000,
        ];

        $this->logger->debug('OpenRouter API request', [
            'url' => $this->apiUrl . '/chat/completions',
            'model' => $this->model,
        ]);

        $response = Http::timeout($this->timeout)
            ->withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
                'HTTP-Referer' => config('app.url', 'http://localhost:8000'),
                'X-Title' => config('app.name', 'MCA PDF Scrubber'),
            ])
            ->post($this->apiUrl . '/chat/completions', $payload);

        $this->logger->debug('OpenRouter response status: ' . $response->status());

        if ($response->successful()) {
            $data = $response->json();

            // OpenRouter uses OpenAI-compatible response format
            if (isset($data['choices'][0]['message']['content'])) {
                $content = $data['choices'][0]['message']['content'];
                return $this->parseJsonResponse($content);
            }

            throw new \Exception('Unexpected response format from OpenRouter API: ' . json_encode($data));
        }

        $errorBody = $response->body();
        $this->logger->error('OpenRouter API error: ' . $errorBody);

        throw new \Exception('OpenRouter API call failed with status: ' . $response->status());
    }

    /**
     * Parse JSON from AI response
     */
    private function parseJsonResponse(string $content): array
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

        $this->logger->warning('OpenRouter response was not valid JSON, returning raw content');
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

            $response = $this->callOpenRouter($prompt);

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
}
