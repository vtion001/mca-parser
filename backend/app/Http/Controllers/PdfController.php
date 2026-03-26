<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\DoclingService;
use App\Services\PdfAnalyzerService;

class PdfController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    public function __construct(
        private DoclingService $doclingService,
        private PdfAnalyzerService $analyzerService
    ) {}

    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:51200',
        ]);

        $file = $request->file('file');
        $filename = $file->getClientOriginalName();

        $result = $this->doclingService->extractText($file->getPathname());

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'error' => $result['error'] ?? 'PDF extraction failed',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'filename' => $filename,
            'page_count' => $result['page_count'] ?? 0,
            'text_length' => strlen($result['text']),
            'text' => $result['text'],
        ]);
    }

    public function analyze(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:51200',
        ]);

        $file = $request->file('file');
        $removePii = $request->boolean('remove_pii', true);

        $result = $this->doclingService->extractText($file->getPathname());

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'error' => $result['error'] ?? 'PDF extraction failed',
            ], 400);
        }

        $text = $result['text'];
        $analysis = $this->analyzerService->analyze($text);
        $scrubbedText = $this->analyzerService->scrub($text, $removePii);

        return response()->json([
            'success' => true,
            'filename' => $file->getClientOriginalName(),
            'page_count' => $result['page_count'] ?? 0,
            'analysis' => [
                'word_count' => $analysis['word_count'],
                'char_count' => $analysis['char_count'],
                'has_pii_indicators' => $analysis['has_pii_indicators'],
                'confidence_score' => $analysis['confidence_score'],
            ],
            'original_length' => strlen($text),
            'scrubbed_length' => strlen($scrubbedText),
            'scrubbed' => $removePii,
        ]);
    }

    public function scrub(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:51200',
        ]);

        $file = $request->file('file');
        $removePii = $request->boolean('remove_pii', true);

        $result = $this->doclingService->extractText($file->getPathname());

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'error' => $result['error'] ?? 'PDF extraction failed',
            ], 400);
        }

        $scrubbedText = $this->analyzerService->scrub($result['text'], $removePii);

        return response()->json([
            'success' => true,
            'filename' => $file->getClientOriginalName(),
            'original_text' => $result['text'],
            'scrubbed_text' => $scrubbedText,
            'original_length' => strlen($result['text']),
            'scrubbed_length' => strlen($scrubbedText),
            'pii_removed' => $removePii,
        ]);
    }
}
