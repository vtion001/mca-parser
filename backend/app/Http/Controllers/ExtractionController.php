<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use App\Jobs\ProcessPdfExtraction;

class ExtractionController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    public function fullExtract(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:51200',
        ]);

        $file = $request->file('file');
        $filePath = $file->getPathname();
        $jobId = (string) Str::uuid();

        ProcessPdfExtraction::dispatch($jobId, $filePath);

        return response()->json([
            'success' => true,
            'job_id' => $jobId,
            'status' => 'processing',
        ]);
    }

    public function progress(string $jobId): JsonResponse
    {
        $progress = Cache::get("extraction_progress_{$jobId}");

        if (!$progress) {
            return response()->json([
                'success' => false,
                'error' => 'Job not found',
            ], 404);
        }

        return response()->json($progress);
    }
}
