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
            $response = Http::timeout(60)
                ->attach('file', file_get_contents($filePath), 'document.pdf')
                ->post($this->serviceUrl . '/extract');

            if ($response->successful()) {
                return $response->json();
            }

            Log::error('Docling service error: ' . $response->body());

            return [
                'success' => false,
                'error' => 'Failed to extract text from PDF',
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
