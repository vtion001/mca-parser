<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Models\Document;
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
        $originalFilename = $file->getClientOriginalName();

        // Store file to persistent storage
        $filename = Str::uuid() . '.pdf';
        $filePath = Storage::disk('local')->putFileAs('pdfs', $file, $filename);

        // Create Document record before dispatching so results can be persisted
        $document = Document::create([
            'filename' => $filename,
            'original_filename' => $originalFilename,
            'file_path' => Storage::disk('local')->path($filePath),
            'status' => Document::STATUS_PENDING,
        ]);

        $jobId = (string) Str::uuid();

        // Dispatch with documentId so the job can persist results to the DB record
        ProcessPdfExtraction::dispatch($jobId, $document->file_path, $document->id);

        return response()->json([
            'success' => true,
            'job_id' => $jobId,
            'document_id' => $document->id,
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
