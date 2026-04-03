<?php

namespace App\Services;

use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

/**
 * MCA AI Service - Extends BaseAIService for AI-powered MCA validation
 *
 * Uses OpenRouter (Google Gemini) for AI analysis of borderline MCA candidates.
 * Implements confidence scoring and provider identification.
 */
class McaAiService extends BaseAIService
{
    private string $model;

    public function __construct(
        ?string $apiKey = null,
        ?string $apiUrl = null,
        ?string $model = null,
        ?int $timeout = null,
        ?LoggerInterface $logger = null
    ) {
        parent::__construct($apiKey, $apiUrl, $timeout, $logger);
        $this->model = $model ?? config('services.openrouter.model', 'google/gemini-3.1-pro-preview');
    }

    protected function getProviderName(): string
    {
        return 'mca-openrouter';
    }

    protected function getDefaultApiKey(): string
    {
        return config('services.openrouter.api_key', '');
    }

    protected function getDefaultApiUrl(): string
    {
        return config('services.openrouter.api_url', 'https://openrouter.ai/api/v1');
    }

    protected function getPlaceholderApiKey(): string
    {
        return '';
    }

    protected function callApi(string $prompt): array
    {
        $payload = [
            'model' => $this->model,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt,
                ],
            ],
            'temperature' => 0.1,
            'max_tokens' => 1500,
        ];

        $response = \Illuminate\Support\Facades\Http::timeout($this->timeout)
            ->withHeaders([
                'Authorization' => 'Bearer ' . $this->apiKey,
                'Content-Type' => 'application/json',
                'HTTP-Referer' => config('app.url', 'http://localhost:8000'),
                'X-Title' => config('app.name', 'MCA PDF Scrubber'),
            ])
            ->post($this->apiUrl . '/chat/completions', $payload);

        if ($response->successful()) {
            $data = $response->json();
            if (isset($data['choices'][0]['message']['content'])) {
                $content = $data['choices'][0]['message']['content'];
                return $this->parseResponse($content);
            }
            throw new \Exception('Unexpected response format from OpenRouter API');
        }

        throw new \Exception('OpenRouter API call failed: ' . $response->status());
    }

    /**
     * Analyze borderline MCA candidates for final classification
     *
     * @param array $candidates Transactions that scored 0.4-0.7 in pre-filter
     * @param string $markdown Full document markdown for context
     * @return array AI-analyzed MCA findings
     */
    public function analyzeCandidates(array $candidates, string $markdown = ''): array
    {
        if (empty($candidates)) {
            return [
                'reviewed' => [],
                'summary' => [
                    'total_reviewed' => 0,
                    'confirmed_mca' => 0,
                    'rejected' => 0,
                ],
            ];
        }

        // Check if API is available
        if (empty($this->apiKey) || $this->apiKey === $this->getPlaceholderApiKey()) {
            return $this->fallbackAnalysis($candidates);
        }

        try {
            $prompt = $this->buildMcaPrompt($candidates, $markdown);
            $response = $this->callApi($prompt);

            return $this->parseAiResponse($response, $candidates);
        } catch (\Exception $e) {
            $this->logger->error('MCA AI analysis failed: ' . $e->getMessage());
            return $this->fallbackAnalysis($candidates);
        }
    }

    /**
     * Build prompt for MCA analysis
     */
    private function buildMcaPrompt(array $candidates, string $context): string
    {
        $candidateList = '';
        foreach ($candidates as $i => $c) {
            $candidateList .= ($i + 1) . ". Description: \"" . ($c['description'] ?? '') . "\", Amount: " . ($c['amount'] ?? 'N/A') . ", Date: " . ($c['date'] ?? 'N/A') . "\n";
        }

        $truncatedContext = substr($context, 0, 3000);

        return <<<PROMPT
You are an MCA (Merchant Cash Advance) transaction classification expert.

Given the following transaction candidates, classify each as MCA or not MCA.

## Candidates
{$candidateList}

## Context (first 3000 chars of document)
{$truncatedContext}

## Classification Criteria
An MCA transaction typically:
- Is a recurring debit/_payment_ to a financing company
- Contains keywords: funding, capital, advance, loan, lending, merchant cash, finance, factor
- Often shows fixed amounts on regular intervals (daily/weekly)
- May reference known MCA providers

Payment processors (Stripe, Square, PayPal) are NOT MCAs unless linked to a specific merchant financing product.

## Output Format
Return JSON with your classification:
{
  "classifications": [
    {
      "index": 1,
      "is_mca": true/false,
      "mca_provider": "provider name if identified, null otherwise",
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation"
    }
  ]
}
PROMPT;
    }

    /**
     * Parse AI response into structured format
     */
    private function parseAiResponse(array $response, array $candidates): array
    {
        $reviewed = [];

        // Handle raw response format
        if (isset($response['raw_response'])) {
            return $this->parseRawResponse($response['raw_response'], $candidates);
        }

        $classifications = $response['classifications'] ?? [];

        foreach ($classifications as $classification) {
            $idx = $classification['index'] ?? 0;
            if (isset($candidates[$idx - 1])) {
                $candidate = $candidates[$idx - 1];
                $reviewed[] = [
                    'description' => $candidate['description'],
                    'amount' => $candidate['amount'],
                    'date' => $candidate['date'],
                    'is_mca' => $classification['is_mca'] ?? false,
                    'mca_provider' => $classification['mca_provider'] ?? null,
                    'confidence' => $classification['confidence'] ?? 0.5,
                    'source' => 'ai_review',
                    'reasoning' => $classification['reasoning'] ?? '',
                ];
            }
        }

        $confirmed = count(array_filter($reviewed, fn($r) => $r['is_mca']));

        return [
            'reviewed' => $reviewed,
            'summary' => [
                'total_reviewed' => count($reviewed),
                'confirmed_mca' => $confirmed,
                'rejected' => count($reviewed) - $confirmed,
            ],
        ];
    }

    /**
     * Parse raw text response when JSON parsing fails
     */
    private function parseRawResponse(string $raw, array $candidates): array
    {
        $reviewed = [];

        // Try to extract classification info from raw text
        foreach ($candidates as $i => $candidate) {
            $desc = strtolower($candidate['description'] ?? '');

            // Simple heuristic fallback
            $isMca = false;
            $keywords = ['funding', 'capital', 'advance', 'mca', 'loan', 'lending', 'merchant'];
            foreach ($keywords as $kw) {
                if (strpos($desc, $kw) !== false) {
                    $isMca = true;
                    break;
                }
            }

            $reviewed[] = [
                'description' => $candidate['description'],
                'amount' => $candidate['amount'],
                'date' => $candidate['date'],
                'is_mca' => $isMca,
                'mca_provider' => null,
                'confidence' => 0.6,
                'source' => 'ai_review_fallback',
                'reasoning' => 'Parsed from raw response',
            ];
        }

        return [
            'reviewed' => $reviewed,
            'summary' => [
                'total_reviewed' => count($reviewed),
                'confirmed_mca' => count(array_filter($reviewed, fn($r) => $r['is_mca'])),
                'rejected' => 0,
            ],
        ];
    }

    /**
     * Fallback analysis when AI is unavailable
     */
    private function fallbackAnalysis(array $candidates): array
    {
        $this->logger->info('Using fallback analysis for MCA candidates');

        $reviewed = [];
        foreach ($candidates as $candidate) {
            $desc = strtolower($candidate['description'] ?? '');

            // Fallback uses broader indicators since we can't AI-verify
            // Be inclusive to avoid missing real MCAs
            $isMca = false;
            $strongIndicators = [
                'mca', 'merchant cash', 'funding advance', 'cap advance', 'fin advance',
                'funding', 'capital', 'lending', 'advance', 'loan',
            ];

            foreach ($strongIndicators as $indicator) {
                if (strpos($desc, $indicator) !== false) {
                    $isMca = true;
                    break;
                }
            }

            $reviewed[] = [
                'description' => $candidate['description'],
                'amount' => $candidate['amount'],
                'date' => $candidate['date'],
                'is_mca' => $isMca,
                'mca_provider' => null,
                'confidence' => 0.5,
                'source' => 'prefilter_fallback',
                'reasoning' => 'Fallback analysis (AI unavailable)',
            ];
        }

        return [
            'reviewed' => $reviewed,
            'summary' => [
                'total_reviewed' => count($reviewed),
                'confirmed_mca' => count(array_filter($reviewed, fn($r) => $r['is_mca'])),
                'rejected' => count($reviewed) - count(array_filter($reviewed, fn($r) => $r['is_mca'])),
            ],
        ];
    }

    /**
     * Detect MCA transactions - main entry point combining pre-filter and AI
     */
    public function detect(string $markdown, array $keyDetails = [], array $balances = []): array
    {
        $detectionService = app(McaDetectionService::class);
        $preFilterResults = $detectionService->detect($markdown, $keyDetails, $balances);

        $mcaTransactions = $preFilterResults['transactions'] ?? [];
        $candidates = $preFilterResults['candidates'] ?? [];

        // If we have candidates and AI is available, run AI analysis
        $aiResults = ['reviewed' => [], 'summary' => ['total_reviewed' => 0]];
        if (!empty($candidates)) {
            $aiResults = $this->analyzeCandidates($candidates, $markdown);
        }

        // Merge AI-reviewed candidates into MCA transactions
        foreach ($aiResults['reviewed'] as $reviewed) {
            if ($reviewed['is_mca']) {
                $mcaTransactions[] = $reviewed;
            }
        }

        // Rebuild summary
        $summary = $this->buildMergedSummary($mcaTransactions, $aiResults);

        return [
            'transactions' => $mcaTransactions,
            'candidates_reviewed' => $aiResults['reviewed'],
            'summary' => $summary,
        ];
    }

    /**
     * Build merged summary from all MCA findings
     */
    private function buildMergedSummary(array $mcaTransactions, array $aiResults): array
    {
        $totalAmount = 0;
        $providers = [];

        foreach ($mcaTransactions as $txn) {
            if (isset($txn['amount']) && is_numeric($txn['amount'])) {
                $totalAmount += abs($txn['amount']);
            }
            if (!empty($txn['mca_provider'])) {
                $providers[$txn['mca_provider']] = true;
            }
        }

        $avgConfidence = 0;
        if (!empty($mcaTransactions)) {
            $sum = array_sum(array_column($mcaTransactions, 'confidence'));
            $avgConfidence = $sum / count($mcaTransactions);
        }

        return [
            'total_mca_transactions' => count($mcaTransactions),
            'total_mca_amount' => round($totalAmount, 2),
            'unique_providers' => array_keys($providers),
            'average_confidence' => round($avgConfidence, 2),
            'ai_reviewed_candidates' => $aiResults['summary']['total_reviewed'] ?? 0,
            'ai_confirmed_mca' => $aiResults['summary']['confirmed_mca'] ?? 0,
        ];
    }

    /**
     * Extract transaction summary from markdown text
     * Delegates to McaDetectionService for transaction parsing
     *
     * @param string $markdown The extracted text content
     * @return array Transaction summary with credit/debit counts and totals
     */
    public function extractTransactionSummary(string $markdown): array
    {
        $detectionService = app(McaDetectionService::class);
        return $detectionService->extractTransactionSummary($markdown);
    }
}
