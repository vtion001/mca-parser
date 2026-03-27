<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * MiniMax AI Service
 * 
 * Uses MiniMax API (model m2.7) to analyze and provide qualifications for PDFs.
 * Integrates with the extraction pipeline to provide AI-powered insights.
 */
class MiniMaxService
{
    private string $apiKey;
    private string $apiUrl;
    private int $timeout;
    private LoggerInterface $logger;

    public function __construct(
        ?string $apiKey = null,
        ?string $apiUrl = null,
        ?int $timeout = null,
        ?LoggerInterface $logger = null
    ) {
        $this->apiKey = $apiKey ?? env('MINIMAX_API_KEY', 'm2.7');
        $this->apiUrl = $apiUrl ?? env('MINIMAX_API_URL', 'https://api.minimax.chat/v1');
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
     * 
     * @param string $markdown The extracted markdown text
     * @param array $documentType Detected document type
     * @param array $keyDetails Extracted key details
     * @param array $balances Beginning and ending balances
     * @return array AI analysis results
     */
    public function analyzeDocument(
        string $markdown,
        array $documentType,
        array $keyDetails,
        array $balances
    ): array {
        // Check if API key is configured
        if (empty($this->apiKey) || $this->apiKey === 'm2.7') {
            return $this->getFallbackAnalysis($markdown, $documentType, $keyDetails, $balances);
        }

        try {
            $prompt = $this->buildAnalysisPrompt($markdown, $documentType, $keyDetails, $balances);

            $response = $this->callMiniMax($prompt);

            return [
                'success' => true,
                'analysis' => $response,
            ];
        } catch (\Exception $e) {
            $this->logger->error('MiniMax AI analysis failed: ' . $e->getMessage());

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
        // Perform basic analysis without AI
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
                'recommendations' => ['Configure MiniMax API key for AI-powered analysis'],
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
        $truncatedMarkdown = substr($markdown, 0, 8000); // Limit to first 8000 chars
        
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
     * Extract content from MiniMax API response (handles multiple formats)
     */
    private function extractResponseContent(array $data): ?string
    {
        // Format 1: OpenAI-like (choices[0].message.content)
        if (isset($data['choices'][0]['message']['content'])) {
            return $data['choices'][0]['message']['content'];
        }

        // Format 2: MiniMax native (choices[0].delta.content or choices[0].text)
        if (isset($data['choices'][0]['delta']['content'])) {
            return $data['choices'][0]['delta']['content'];
        }

        if (isset($data['choices'][0]['text'])) {
            return $data['choices'][0]['text'];
        }

        // Format 3: Direct content field
        if (isset($data['content'])) {
            return $data['content'];
        }

        // Format 4: Response in base64 or other formats
        if (isset($data['choices'][0]['message'])) {
            $msg = $data['choices'][0]['message'];
            if (is_array($msg)) {
                return $msg['content'] ?? ($msg['text'] ?? null);
            }
        }

        return null;
    }

    /**
     * Call MiniMax API
     */
    private function callMiniMax(string $prompt): array
    {
        // Build the request payload for MiniMax Chat API
        // Using OpenAI-compatible endpoint format
        $payload = [
            'model' => 'MiniMax-Text-01',
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt,
                ],
            ],
            'temperature' => 0.3,
            'max_tokens' => 2000,
        ];

        $this->logger->debug('MiniMax API request: ' . json_encode(['url' => $this->apiUrl . '/text/chatcompletion_v2']));

        // Try MiniMax Chat API endpoint
        $response = Http::timeout($this->timeout)
            ->withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
            ])
            ->post($this->apiUrl . '/text/chatcompletion_v2', $payload);

        $this->logger->debug('MiniMax response status: ' . $response->status());
        $this->logger->debug('MiniMax response body: ' . $response->body());

        if ($response->successful()) {
            $data = $response->json();

            // Try different MiniMax response formats
            $content = $this->extractResponseContent($data);

            if ($content !== null) {
                return $this->parseJsonResponse($content);
            }

            throw new \Exception('Unexpected response format from MiniMax API: ' . json_encode($data));
        }

        $errorBody = $response->body();
        $this->logger->error('MiniMax API error: ' . $errorBody);

        throw new \Exception('MiniMax API call failed with status: ' . $response->status());
    }

    /**
     * Parse JSON from AI response
     */
    private function parseJsonResponse(string $content): array
    {
        // Try to extract JSON from the response (may be wrapped in markdown code blocks)
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

        // If JSON parsing fails, return the raw content
        $this->logger->warning('MiniMax response was not valid JSON, returning raw content');
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

            $response = $this->callMiniMax($prompt);

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
