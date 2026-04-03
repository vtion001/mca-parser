<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DoclingService
{
    private string $serviceUrl;

    public function __construct()
    {
        $this->serviceUrl = config('services.docling.url', 'http://localhost:8001');
    }

    public function extractText(string $filePath): array
    {
        try {
            // Use 600 second timeout (10 min) for high-quality table extraction
            $response = Http::timeout(600)
                ->attach('file', file_get_contents($filePath), 'document.pdf')
                ->post($this->serviceUrl . '/extract');

            if ($response->successful()) {
                return $response->json();
            }

            $body = $response->body();
            $statusCode = $response->status();
            Log::error('Docling service error', [
                'status' => $statusCode,
                'body' => $body,
            ]);

            // Return the actual error from docling service if available
            $errorData = json_decode($body, true);
            $errorMsg = 'Failed to extract text from PDF';
            if (!empty($errorData['detail'])) {
                $errorMsg = 'Docling error: ' . $errorData['detail'];
            } elseif (!empty($errorData['error'])) {
                $errorMsg = 'Docling error: ' . $errorData['error'];
            } elseif ($statusCode === 502) {
                $errorMsg = 'Docling service unavailable (502) - all replicas may be down or restarting';
            } elseif ($statusCode === 503) {
                $errorMsg = 'Docling service unavailable (503) - service is overloaded';
            }

            return [
                'success' => false,
                'error' => $errorMsg,
            ];
        } catch (\Exception $e) {
            Log::error('Docling service exception: ' . $e->getMessage());

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    public function extractFromUrl(string $url): array
    {
        try {
            $response = Http::timeout(120)
                ->post($this->serviceUrl . '/extract-url', [
                    'url' => $url,
                ]);

            if ($response->successful()) {
                return $response->json();
            }

            return [
                'success' => false,
                'error' => 'Failed to extract text from URL',
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
