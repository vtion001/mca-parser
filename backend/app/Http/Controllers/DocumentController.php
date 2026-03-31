<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DocumentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Document::query();

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

        return response()->json([
            'data' => $documents->items(),
            'meta' => [
                'current_page' => $documents->currentPage(),
                'last_page' => $documents->lastPage(),
                'per_page' => $documents->perPage(),
                'total' => $documents->total(),
            ],
        ]);
    }

    public function show(string $id): JsonResponse
    {
        $query = Document::with('batches');

        // Check if id is numeric (integer ID) or string (UUID/filename)
        if (is_numeric($id)) {
            $document = $query->find((int) $id);
        } else {
            // Try to find by filename with exact match, or with .pdf extension
            $document = $query->where('filename', $id)
                ->orWhere('filename', $id . '.pdf')
                ->first();
        }

        if (!$document) {
            return response()->json(['error' => 'Document not found'], 404);
        }

        return response()->json(['data' => $document]);
    }

    public function destroy(int $id): JsonResponse
    {
        $document = Document::find($id);

        if (!$document) {
            return response()->json(['error' => 'Document not found'], 404);
        }

        // Remove from batches first
        $document->batches()->detach();
        $document->delete();

        return response()->json(['message' => 'Document deleted successfully']);
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $document = Document::find($id);

        if (!$document) {
            return response()->json(['error' => 'Document not found'], 404);
        }

        $request->validate([
            'status' => 'required|in:pending,processing,complete,failed',
        ]);

        $document->update(['status' => $request->input('status')]);

        return response()->json(['data' => $document]);
    }
}
