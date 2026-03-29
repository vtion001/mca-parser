<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/**
 * OpenRouter AI Service
 *
 * Uses OpenRouter API to analyze and provide qualifications for PDFs.
 * OpenRouter provides access to multiple AI models including GPT-3.5, Claude, etc.
 */
class OpenRouterService extends BaseAIService
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
        $this->model = $model ?? config('services.openrouter.model', 'openai/gpt-3.5-turbo');
    }

    protected function getProviderName(): string
    {
        return 'openrouter';
    }

    protected function getDefaultApiKey(): string
    {
        return config('services.openrouter.api_key', '');
    }

    protected function getDefaultApiUrl(): string
    {
        return config('services.openrouter.api_url', 'https://openrouter.ai/api/v1');
    }

    /**
     * Call OpenRouter API
     */
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
                return $this->parseResponse($content);
            }

            throw new \Exception('Unexpected response format from OpenRouter API: ' . json_encode($data));
        }

        $errorBody = $response->body();
        $this->logger->error('OpenRouter API error: ' . $errorBody);

        throw new \Exception('OpenRouter API call failed with status: ' . $response->status());
    }

    /**
     * Backward-compatible alias for parseResponse
     */
    protected function parseJsonResponse(string $content): array
    {
        return $this->parseResponse($content);
    }

    /**
     * Backward-compatible alias for buildPrompt
     */
    protected function buildAnalysisPrompt(
        string $markdown,
        array $documentType,
        array $keyDetails,
        array $balances
    ): string {
        return $this->buildPrompt($markdown, $documentType, $keyDetails, $balances);
    }
}
