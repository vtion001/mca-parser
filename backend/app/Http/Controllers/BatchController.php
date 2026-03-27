<?php

namespace App\Http\Controllers;

use App\Models\Batch;
use App\Models\Document;
use App\Jobs\ProcessPdfExtraction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BatchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Batch::query()->with('documents');

        // Filter by status if provided
        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }

        // Order by most recent first
        $query->orderBy('created_at', 'desc');

        // Paginate results
        $perPage = $request->input('per_page', 20);
        $batches = $query->paginate($perPage);

        return response()->json([
            'data' => $batches->items(),
            'meta' => [
                'current_page' => $batches->currentPage(),
                'last_page' => $batches->lastPage(),
                'per_page' => $batches->perPage(),
                'total' => $batches->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'nullable|string|max:255',
            'document_ids' => 'required|array',
            'document_ids.*' => 'integer|exists:documents,id',
        ]);

        $documentIds = $request->input('document_ids');
        $batchName = $request->input('name', 'Batch ' . now()->format('Y-m-d H:i'));

        // Create batch
        $batch = Batch::create([
            'name' => $batchName,
            'status' => Batch::STATUS_PENDING,
            'total_documents' => count($documentIds),
            'completed_documents' => 0,
        ]);

        // Attach documents to batch
        foreach ($documentIds as $order => $documentId) {
            $batch->documents()->attach($documentId, ['processing_order' => $order]);
        }

        $batch->load('documents');

        return response()->json(['data' => $batch], 201);
    }

    public function show(int $id): JsonResponse
    {
        $batch = Batch::with(['documents' => function ($query) {
            $query->orderBy('document_batches.processing_order');
        }])->find($id);

        if (!$batch) {
            return response()->json(['error' => 'Batch not found'], 404);
        }

        return response()->json(['data' => $batch]);
    }

    public function addDocuments(Request $request, int $id): JsonResponse
    {
        $batch = Batch::find($id);

        if (!$batch) {
            return response()->json(['error' => 'Batch not found'], 404);
        }

        if ($batch->status !== Batch::STATUS_PENDING) {
            return response()->json(['error' => 'Cannot add documents to a processing or completed batch'], 400);
        }

        $request->validate([
            'document_ids' => 'required|array',
            'document_ids.*' => 'integer|exists:documents,id',
        ]);

        $documentIds = $request->input('document_ids');
        $currentCount = $batch->documents()->count();

        foreach ($documentIds as $order => $documentId) {
            $batch->documents()->attach($documentId, ['processing_order' => $currentCount + $order]);
        }

        // Update total count
        $batch->update(['total_documents' => $batch->documents()->count()]);
        $batch->load('documents');

        return response()->json(['data' => $batch]);
    }

    public function startProcessing(int $id): JsonResponse
    {
        $batch = Batch::with('documents')->find($id);

        if (!$batch) {
            return response()->json(['error' => 'Batch not found'], 404);
        }

        if ($batch->status === Batch::STATUS_PROCESSING) {
            return response()->json(['error' => 'Batch is already processing'], 400);
        }

        if ($batch->documents()->count() === 0) {
            return response()->json(['error' => 'Batch has no documents'], 400);
        }

        $batch->markAsProcessing();
        $batch->update(['completed_documents' => 0]);

        // Dispatch jobs for each document
        foreach ($batch->documents as $order => $document) {
            $jobId = (string) Str::uuid();
            ProcessPdfExtraction::dispatch($jobId, $document->file_path, $document->id, $batch->id);
        }

        return response()->json([
            'data' => $batch,
            'message' => 'Batch processing started',
        ]);
    }

    public function getProgress(int $id): JsonResponse
    {
        $batch = Batch::with(['documents' => function ($query) {
            $query->select('documents.id', 'filename', 'status');
        }])->find($id);

        if (!$batch) {
            return response()->json(['error' => 'Batch not found'], 404);
        }

        return response()->json([
            'data' => [
                'id' => $batch->id,
                'name' => $batch->name,
                'status' => $batch->status,
                'total_documents' => $batch->total_documents,
                'completed_documents' => $batch->completed_documents,
                'progress_percent' => $batch->getProgressPercent(),
                'documents' => $batch->documents,
            ],
        ]);
    }
}
