<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Jobs\ProcessPdfExtraction;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CustomerDocumentController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    /**
     * Upload a PDF document for processing
     *
     * POST /api/v1/customer/documents/upload
     */
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:51200',
            'business_id' => 'nullable|string|max:255',
            'document_type' => 'nullable|string|max:100',
            'upload_date' => 'nullable|date',
        ]);

        $accountId = $request->attributes->get('account_id') ?? 1;

        $file = $request->file('file');
        $originalFilename = $file->getClientOriginalName();

        // Store file to persistent storage
        $filename = Str::uuid() . '.pdf';
        $filePath = Storage::disk('local')->putFileAs('pdfs', $file, $filename);

        // Determine document type if not provided
        $documentType = $request->input('document_type', 'bank_statement');

        // Create Document record
        $document = Document::create([
            'account_id' => $accountId,
            'filename' => $filename,
            'original_filename' => $originalFilename,
            'file_path' => Storage::disk('local')->path($filePath),
            'status' => Document::STATUS_PENDING,
            'document_type' => $documentType,
            'key_details' => [
                'business_id' => $request->input('business_id'),
                'upload_date' => $request->input('upload_date', now()->toDateString()),
            ],
        ]);

        $jobId = (string) Str::uuid();

        // Dispatch processing job
        ProcessPdfExtraction::dispatch($jobId, $document->file_path, $document->id);

        return response()->json([
            'success' => true,
            'job_id' => $jobId,
            'document_id' => $document->id,
            'status' => 'processing',
            'message' => 'Document uploaded successfully and is being processed',
        ], 201);
    }

    /**
     * List customer's documents
     *
     * GET /api/v1/customer/documents
     */
    public function index(Request $request): JsonResponse
    {
        $accountId = $request->attributes->get('account_id') ?? 1;

        $query = Document::query()->forAccount($accountId);

        // Filter by status if provided
        if ($request->has('status')) {
            $query->where('status', $request->input('status'));
        }

        // Filter by document type if provided
        if ($request->has('document_type')) {
            $query->where('document_type', $request->input('document_type'));
        }

        // Order by most recent first
        $query->orderBy('created_at', 'desc');

        // Paginate results
        $perPage = $request->input('per_page', 20);
        $documents = $query->paginate($perPage);

        // Transform documents to include extracted data summary
        $transformedItems = collect($documents->items())->map(function ($doc) {
            return $this->transformDocument($doc);
        });

        return response()->json([
            'success' => true,
            'data' => $transformedItems,
            'meta' => [
                'current_page' => $documents->currentPage(),
                'last_page' => $documents->lastPage(),
                'per_page' => $documents->perPage(),
                'total' => $documents->total(),
            ],
        ]);
    }

    /**
     * Get a single document with extraction results
     *
     * GET /api/v1/customer/documents/{id}
     */
    public function show(Request $request, int $id): JsonResponse
    {
        $accountId = $request->attributes->get('account_id') ?? 1;

        $document = Document::query()
            ->forAccount($accountId)
            ->find($id);

        if (!$document) {
            return response()->json([
                'success' => false,
                'error' => 'Document not found',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $this->transformDocument($document, true),
        ]);
    }

    /**
     * Delete a document
     *
     * DELETE /api/v1/customer/documents/{id}
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $accountId = $request->attributes->get('account_id') ?? 1;

        $document = Document::query()
            ->forAccount($accountId)
            ->find($id);

        if (!$document) {
            return response()->json([
                'success' => false,
                'error' => 'Document not found',
            ], 404);
        }

        // Remove from batches first
        $document->batches()->detach();

        // Delete the file if it exists
        if ($document->file_path && Storage::disk('local')->exists('pdfs/' . $document->filename)) {
            Storage::disk('local')->delete('pdfs/' . $document->filename);
        }

        $document->delete();

        return response()->json([
            'success' => true,
            'message' => 'Document deleted successfully',
        ]);
    }

    /**
     * Transform document for API response
     */
    private function transformDocument(Document $document, bool $full = false): array
    {
        $data = [
            'id' => $document->id,
            'filename' => $document->original_filename ?? $document->filename,
            'status' => $document->status,
            'document_type' => $document->document_type,
            'created_at' => $document->created_at->toIso8601String(),
            'updated_at' => $document->updated_at->toIso8601String(),
        ];

        // Include balance summary if available
        if ($document->balances) {
            $data['balance_summary'] = [
                'beginning' => $document->balances['beginning_balance']['amount'] ?? null,
                'ending' => $document->balances['ending_balance']['amount'] ?? null,
            ];
        }

        // Include transaction summary if available
        if (isset($document->transaction_classification['summary'])) {
            $data['transaction_summary'] = $document->transaction_classification['summary'];
        }

        // Include MCA findings summary if available
        if (isset($document->mca_findings['summary'])) {
            $data['mca_summary'] = [
                'mca_transactions' => $document->mca_findings['summary']['total_mca_transactions'] ?? 0,
                'mca_amount' => $document->mca_findings['summary']['total_mca_amount'] ?? 0,
                'mca_providers' => $document->mca_findings['summary']['unique_providers'] ?? [],
            ];
        }

        // Include AI analysis summary if available
        if ($document->ai_analysis) {
            $data['ai_summary'] = [
                'qualification_score' => $document->ai_analysis['qualification_score'] ?? null,
                'recommendation' => $document->ai_analysis['recommendation'] ?? null,
            ];
        }

        // Include full data if requested
        if ($full) {
            $data['balances'] = $document->balances;
            $data['key_details'] = $document->key_details;
            $data['scores'] = $document->scores;
            $data['pii_breakdown'] = $document->pii_breakdown;
            $data['ai_analysis'] = $document->ai_analysis;
            $data['mca_findings'] = $document->mca_findings;
            $data['transaction_classification'] = $document->transaction_classification;
            $data['page_count'] = $document->page_count;
            $data['error'] = $document->error;
        }

        return $data;
    }
}
