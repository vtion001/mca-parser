<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

/**
 * MiniMax AI Service
 *
 * Uses MiniMax API (model m2.7) to analyze and provide qualifications for PDFs.
 * Integrates with the extraction pipeline to provide AI-powered insights.
 */
class MiniMaxService extends BaseAIService
{
    private const PLACEHOLDER_API_KEY = 'm2.7';

    protected function getProviderName(): string
    {
        return 'minimax';
    }

    protected function getDefaultApiKey(): string
    {
        return env('MINIMAX_API_KEY', self::PLACEHOLDER_API_KEY);
    }

    protected function getDefaultApiUrl(): string
    {
        return env('MINIMAX_API_URL', 'https://api.minimax.chat/v1');
    }

    protected function getPlaceholderApiKey(): string
    {
        return self::PLACEHOLDER_API_KEY;
    }

    /**
     * Call MiniMax API
     */
    protected function callApi(string $prompt): array
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
                return $this->parseResponse($content);
            }

            throw new \Exception('Unexpected response format from MiniMax API: ' . json_encode($data));
        }

        $errorBody = $response->body();
        $this->logger->error('MiniMax API error: ' . $errorBody);

        throw new \Exception('MiniMax API call failed with status: ' . $response->status());
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
