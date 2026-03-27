# Multi-File Processing Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable processing of multiple PDFs with persistent storage, batch processing, and comparative analysis.

**Architecture:**
- Store processed documents in MySQL database (replacing Cache-based storage)
- Create Document, Batch, DocumentBatch Eloquent models
- Add backend API endpoints for CRUD operations and batch processing
- Frontend uses real API calls instead of mock data
- Process files sequentially in batches, storing each result

**Tech Stack:** Laravel 11, MySQL, React 18 + TypeScript, Axios

---

## Task 1: Database Migrations

**Files:**
- Create: `backend/database/migrations/2026_03_27_000001_create_documents_table.php`
- Create: `backend/database/migrations/2026_03_27_000002_create_batches_table.php`
- Create: `backend/database/migrations/2026_03_27_000003_create_document_batches_table.php`

- [ ] **Step 1: Create documents migration**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->string('filename');
            $table->string('original_filename');
            $table->string('file_path')->nullable();
            $table->enum('status', ['pending', 'processing', 'complete', 'failed'])->default('pending');
            $table->string('document_type')->nullable();
            $table->decimal('type_confidence', 5, 4)->nullable();
            $table->longText('markdown')->nullable();
            $table->longText('ocr_text')->nullable();
            $table->integer('page_count')->nullable();
            $table->json('key_details')->nullable();
            $table->json('balances')->nullable();
            $table->json('scores')->nullable();
            $table->json('pii_breakdown')->nullable();
            $table->json('recommendations')->nullable();
            $table->json('ai_analysis')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
```

- [ ] **Step 2: Run migration**

Run: `cd /Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/backend && php artisan migrate`

Expected: Migration creates tables successfully

- [ ] **Step 3: Commit**

```bash
git add database/migrations/2026_03_27_*.php
git commit -m "feat: add documents, batches, document_batches migrations"
```

---

## Task 2: Eloquent Models

**Files:**
- Create: `backend/app/Models/Document.php`
- Create: `backend/app/Models/Batch.php`
- Create: `backend/app/Models/DocumentBatch.php`

- [ ] **Step 1: Create Document model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Document extends Model
{
    protected $fillable = [
        'filename',
        'original_filename',
        'file_path',
        'status',
        'document_type',
        'type_confidence',
        'markdown',
        'ocr_text',
        'page_count',
        'key_details',
        'balances',
        'scores',
        'pii_breakdown',
        'recommendations',
        'ai_analysis',
        'error_message',
    ];

    protected $casts = [
        'key_details' => 'array',
        'balances' => 'array',
        'scores' => 'array',
        'pii_breakdown' => 'array',
        'recommendations' => 'array',
        'ai_analysis' => 'array',
        'type_confidence' => 'decimal:4',
    ];

    public function batches(): HasMany
    {
        return $this->hasMany(DocumentBatch::class)->with('batch');
    }

    public function isComplete(): bool
    {
        return $this->status === 'complete';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    public function qualificationScore(): ?float
    {
        return $this->ai_analysis['qualification_score'] ?? null;
    }
}
```

- [ ] **Step 2: Create Batch model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Batch extends Model
{
    protected $fillable = [
        'name',
        'status',
        'total_documents',
        'completed_documents',
        'failed_documents',
    ];

    protected $casts = [
        'total_documents' => 'integer',
        'completed_documents' => 'integer',
        'failed_documents' => 'integer',
    ];

    public function documentBatches(): HasMany
    {
        return $this->hasMany(DocumentBatch::class);
    }

    public function documents()
    {
        return $this->hasManyThrough(
            Document::class,
            DocumentBatch::class,
            'batch_id',
            'id',
            'id',
            'document_id'
        );
    }

    public function isComplete(): bool
    {
        return $this->completed_documents + $this->failed_documents >= $this->total_documents;
    }

    public function progressPercent(): int
    {
        if ($this->total_documents === 0) return 0;
        return (int) round(($this->completed_documents / $this->total_documents) * 100);
    }
}
```

- [ ] **Step 3: Create DocumentBatch model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentBatch extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'document_id',
        'batch_id',
        'status',
        'processed_at',
    ];

    protected $casts = [
        'processed_at' => 'datetime',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add app/Models/Document.php app/Models/Batch.php app/Models/DocumentBatch.php
git commit -m "feat: add Document, Batch, DocumentBatch models"
```

---

## Task 3: Update ProcessPdfExtraction Job

**Files:**
- Modify: `backend/app/Jobs/ProcessPdfExtraction.php`

- [ ] **Step 1: Update job to accept document_id and save to database**

```php
<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use App\Models\Document;
use App\Services\DoclingService;
use App\Services\DocumentTypeDetector;
use App\Services\FieldMapper;
use App\Services\ExtractionScorer;
use App\Services\PdfAnalyzerService;
use App\Services\BalanceExtractorService;
use App\Services\OpenRouterService;

class ProcessPdfExtraction implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 300;

    private int $documentId;
    private int $batchId;

    public function __construct(int $documentId, int $batchId = 0)
    {
        $this->documentId = $documentId;
        $this->batchId = $batchId;
    }

    public function handle(
        DoclingService $doclingService,
        DocumentTypeDetector $typeDetector,
        FieldMapper $fieldMapper,
        ExtractionScorer $scorer,
        PdfAnalyzerService $analyzer,
        BalanceExtractorService $balanceExtractor,
        OpenRouterService $openRouterService
    ): void {
        $document = Document::find($this->documentId);
        if (!$document) {
            Log::error("Document {$this->documentId} not found");
            return;
        }

        $document->update(['status' => 'processing']);

        try {
            // Check if file exists
            if (!Storage::exists($document->file_path)) {
                throw new \Exception('PDF file not found: ' . $document->file_path);
            }

            $filePath = Storage::path($document->file_path);

            // Part 1: Text Extraction
            $this->updateDocumentProgress($document, 'extracting', 'Extracting text from PDF...', 10);

            $extractResult = $doclingService->extractText($filePath);

            if (!$extractResult['success']) {
                throw new \Exception('Extraction failed: ' . ($extractResult['error'] ?? 'Unknown error'));
            }

            $markdown = $extractResult['text'];
            $ocrText = $extractResult['ocr_text'] ?? '';
            $pageCount = $extractResult['page_count'] ?? 1;

            $fullMarkdown = $markdown;
            if (!empty($ocrText)) {
                $fullMarkdown = $markdown . "\n\n## Image OCR Content\n\n" . $ocrText;
            }

            // Part 2: Document Type Detection
            $this->updateDocumentProgress($document, 'detecting_type', 'Detecting document type...', 35);
            $docType = $typeDetector->detect($fullMarkdown);

            // Part 3: Field Mapping
            $this->updateDocumentProgress($document, 'mapping_fields', 'Mapping key details...', 55);
            $keyDetails = $fieldMapper->map($fullMarkdown, $docType['type']);

            // Part 4: Quality Scoring
            $this->updateDocumentProgress($document, 'analyzing_quality', 'Analyzing extraction quality...', 75);

            $piiPatterns = $this->getPiiPatterns();
            $piiDetected = $this->detectPiiPatterns($fullMarkdown, $piiPatterns);
            $scoreResult = $scorer->score($fullMarkdown, $pageCount, $piiDetected, $piiPatterns);

            // Part 5: Balance Extraction
            $this->updateDocumentProgress($document, 'extracting_balances', 'Extracting balances...', 80);
            $balances = $balanceExtractor->extractBalances($fullMarkdown);

            // Part 6: AI Analysis
            $this->updateDocumentProgress($document, 'ai_analysis', 'Running AI analysis...', 90);
            $aiAnalysis = $openRouterService->analyzeDocument(
                $fullMarkdown,
                $docType,
                $keyDetails,
                $balances
            );

            // Save results to document
            $document->update([
                'status' => 'complete',
                'markdown' => $fullMarkdown,
                'ocr_text' => $ocrText,
                'page_count' => $pageCount,
                'document_type' => $docType['type'],
                'type_confidence' => $docType['confidence'],
                'key_details' => $keyDetails,
                'balances' => $balances,
                'scores' => $scoreResult['scores'],
                'pii_breakdown' => $scoreResult['pii_breakdown'],
                'recommendations' => $scoreResult['recommendations'],
                'ai_analysis' => $aiAnalysis['analysis'] ?? null,
            ]);

            // Update batch if part of one
            if ($this->batchId > 0) {
                $this->updateBatchProgress();
            }

            Log::info("Document {$this->documentId} processed successfully");

        } catch (\Exception $e) {
            Log::error("Document {$this->documentId} processing failed: " . $e->getMessage());
            $document->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);

            if ($this->batchId > 0) {
                $this->updateBatchProgress(true);
            }
        }
    }

    private function updateDocumentProgress(Document $document, string $stage, string $label, int $percent): void
    {
        $document->update([
            'status' => 'processing',
        ]);
        Cache::put("document_progress_{$document->id}", [
            'stage' => $stage,
            'stage_label' => $label,
            'progress_percent' => $percent,
        ], now()->addHours(24));
    }

    private function updateBatchProgress(bool $failed = false): void
    {
        $batch = Batch::find($this->batchId);
        if (!$batch) return;

        $completed = $batch->documentBatches()
            ->where('status', 'complete')
            ->count();
        $failedCount = $batch->documentBatches()
            ->where('status', 'failed')
            ->count();

        $batch->update([
            'completed_documents' => $completed,
            'failed_documents' => $failedCount,
            'status' => ($completed + $failedCount) >= $batch->total_documents ? 'complete' : 'processing',
        ]);
    }

    private function getPiiPatterns(): array
    {
        return [
            'ssn' => '/\d{3}-\d{2}-\d{4}/',
            'email' => '/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/',
            'phone' => '/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/',
        ];
    }

    private function detectPiiPatterns(string $text, array $patterns): array
    {
        $detected = [];
        foreach ($patterns as $name => $pattern) {
            if (preg_match($pattern, $text)) {
                $detected[] = $name;
            }
        }
        return $detected;
    }
}
```

- [ ] **Step 2: Run tests to verify**

Run: `cd /Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/backend && ./vendor/bin/phpunit`

Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add app/Jobs/ProcessPdfExtraction.php
git commit -m "feat: update ProcessPdfExtraction to save to database"
```

---

## Task 4: DocumentController API

**Files:**
- Create: `backend/app/Http/Controllers/DocumentController.php`

- [ ] **Step 1: Create DocumentController**

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use App\Models\Document;
use App\Jobs\ProcessPdfExtraction;

class DocumentController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    public function index(Request $request): JsonResponse
    {
        $query = Document::query();

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('original_filename', 'like', "%{$search}%")
                  ->orWhere('document_type', 'like', "%{$search}%");
            });
        }

        $documents = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $documents,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'files.*' => 'required|file|mimes:pdf|max:51200',
        ]);

        $files = $request->file('files');
        $createdDocuments = [];

        foreach ($files as $file) {
            $path = $file->store('pdfs/' . date('Y/m'), 'local');

            $document = Document::create([
                'filename' => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
                'original_filename' => $file->getClientOriginalName(),
                'file_path' => $path,
                'status' => 'pending',
            ]);

            ProcessPdfExtraction::dispatch($document->id);

            $createdDocuments[] = $document;
        }

        return response()->json([
            'success' => true,
            'data' => $createdDocuments,
            'count' => count($createdDocuments),
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $document = Document::findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $document,
        ]);
    }

    public function progress(int $id): JsonResponse
    {
        $document = Document::findOrFail($id);

        $progress = Cache::get("document_progress_{$id}");

        return response()->json([
            'success' => true,
            'status' => $document->status,
            'progress' => $progress,
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $document = Document::findOrFail($id);

        if ($document->file_path && Storage::exists($document->file_path)) {
            Storage::delete($document->file_path);
        }

        $document->delete();

        return response()->json([
            'success' => true,
        ]);
    }
}
```

- [ ] **Step 2: Add Cache facade import**

Add to the top of DocumentController:
```php
use Illuminate\Support\Facades\Cache;
```

- [ ] **Step 3: Commit**

```bash
git add app/Http/Controllers/DocumentController.php
git commit -m "feat: add DocumentController for document CRUD operations"
```

---

## Task 5: BatchController API

**Files:**
- Create: `backend/app/Http/Controllers/BatchController.php`

- [ ] **Step 1: Create BatchController**

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Batch;
use App\Models\Document;
use App\Models\DocumentBatch;
use App\Jobs\ProcessPdfExtraction;

class BatchController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    public function index(Request $request): JsonResponse
    {
        $batches = Batch::with('documentBatches.document')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $batches,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'document_ids' => 'required|array',
            'document_ids.*' => 'integer',
            'name' => 'nullable|string|max:255',
        ]);

        $documentIds = $request->document_ids;
        $name = $request->name ?? 'Batch ' . now()->format('Y-m-d H:i');

        $batch = Batch::create([
            'name' => $name,
            'status' => 'pending',
            'total_documents' => count($documentIds),
            'completed_documents' => 0,
            'failed_documents' => 0,
        ]);

        foreach ($documentIds as $docId) {
            DocumentBatch::create([
                'document_id' => $docId,
                'batch_id' => $batch->id,
                'status' => 'pending',
            ]);
        }

        // Dispatch processing jobs for each document
        foreach ($documentIds as $docId) {
            ProcessPdfExtraction::dispatch($docId, $batch->id);
        }

        return response()->json([
            'success' => true,
            'data' => $batch->load('documentBatches.document'),
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $batch = Batch::with('documentBatches.document')->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $batch,
        ]);
    }

    public function progress(int $id): JsonResponse
    {
        $batch = Batch::findOrFail($id);

        return response()->json([
            'success' => true,
            'status' => $batch->status,
            'total_documents' => $batch->total_documents,
            'completed_documents' => $batch->completed_documents,
            'failed_documents' => $batch->failed_documents,
            'progress_percent' => $batch->progressPercent(),
        ]);
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/BatchController.php
git commit -m "feat: add BatchController for batch processing operations"
```

---

## Task 6: ComparisonController API

**Files:**
- Create: `backend/app/Http/Controllers/ComparisonController.php`

- [ ] **Step 1: Create ComparisonController**

```php
<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Models\Document;

class ComparisonController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    public function compare(Request $request): JsonResponse
    {
        $request->validate([
            'document_ids' => 'required|array|min:2',
            'document_ids.*' => 'integer',
            'type' => 'required|in:balances,risk,transactions,delta',
        ]);

        $documentIds = $request->document_ids;
        $type = $request->type;

        $documents = Document::whereIn('id', $documentIds)
            ->where('status', 'complete')
            ->get();

        if ($documents->count() < 2) {
            return response()->json([
                'success' => false,
                'error' => 'At least 2 completed documents required',
            ], 400);
        }

        $result = match ($type) {
            'balances' => $this->compareBalances($documents),
            'risk' => $this->compareRisk($documents),
            'transactions' => $this->compareTransactions($documents),
            'delta' => $this->compareDelta($documents),
        };

        return response()->json([
            'success' => true,
            'type' => $type,
            'documents' => $documents,
            'comparison' => $result,
        ]);
    }

    private function compareBalances($documents): array
    {
        $timeline = [];
        $gaps = [];

        $sortedDocs = $documents->sortBy('created_at');

        foreach ($sortedDocs as $doc) {
            $balances = $doc->balances ?? [];
            $timeline[] = [
                'id' => $doc->id,
                'filename' => $doc->original_filename,
                'date' => $doc->created_at->format('Y-m-d'),
                'beginning_balance' => $balances['beginning_balance']['amount'] ?? null,
                'ending_balance' => $balances['ending_balance']['amount'] ?? null,
            ];
        }

        // Detect gaps between ending and beginning balances
        for ($i = 1; $i < count($timeline); $i++) {
            $prev = $timeline[$i - 1]['ending_balance'];
            $curr = $timeline[$i]['beginning_balance'];
            if ($prev !== null && $curr !== null && abs($prev - $curr) > 0.01) {
                $gaps[] = [
                    'from' => $timeline[$i - 1]['filename'],
                    'to' => $timeline[$i]['filename'],
                    'gap' => round($curr - $prev, 2),
                ];
            }
        }

        return [
            'timeline' => $timeline,
            'gaps' => $gaps,
        ];
    }

    private function compareRisk($documents): array
    {
        $riskGrid = [];
        $highRisk = [];

        foreach ($documents as $doc) {
            $ai = $doc->ai_analysis ?? [];
            $score = $ai['qualification_score'] ?? 5;
            $riskLevel = $score >= 7 ? 'low' : ($score >= 4 ? 'medium' : 'high');

            if ($riskLevel === 'high') {
                $highRisk[] = [
                    'id' => $doc->id,
                    'filename' => $doc->original_filename,
                    'score' => $score,
                    'risk_indicators' => $ai['risk_indicators'] ?? [],
                ];
            }

            $riskGrid[] = [
                'id' => $doc->id,
                'filename' => $doc->original_filename,
                'score' => $score,
                'level' => $riskLevel,
                'pii_found' => $ai['pii_found'] ?? [],
            ];
        }

        return [
            'risk_grid' => $riskGrid,
            'high_risk_documents' => $highRisk,
        ];
    }

    private function compareTransactions($documents): array
    {
        $summary = [];

        foreach ($documents as $doc) {
            $ai = $doc->ai_analysis ?? [];
            $txSummary = $ai['transaction_summary'] ?? [];

            $summary[] = [
                'id' => $doc->id,
                'filename' => $doc->original_filename,
                'date' => $doc->created_at->format('Y-m-d'),
                'credit_count' => $txSummary['credit_count'] ?? null,
                'debit_count' => $txSummary['debit_count'] ?? null,
                'total_credits' => $txSummary['total_amount_credits'] ?? null,
                'total_debits' => $txSummary['total_amount_debits'] ?? null,
            ];
        }

        return ['summary' => $summary];
    }

    private function compareDelta($documents): array
    {
        $deltas = [];

        $sortedDocs = $documents->sortBy('created_at');

        foreach ($sortedDocs as $doc) {
            $balances = $doc->balances ?? [];
            $beginning = $balances['beginning_balance']['amount'] ?? 0;
            $ending = $balances['ending_balance']['amount'] ?? 0;
            $delta = $ending - $beginning;

            $deltas[] = [
                'id' => $doc->id,
                'filename' => $doc->original_filename,
                'date' => $doc->created_at->format('Y-m-d'),
                'beginning' => $beginning,
                'ending' => $ending,
                'delta' => round($delta, 2),
                'delta_percent' => $beginning != 0 ? round(($delta / $beginning) * 100, 2) : 0,
            ];
        }

        return ['deltas' => $deltas];
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/Http/Controllers/ComparisonController.php
git commit -m "feat: add ComparisonController for document comparison"
```

---

## Task 7: API Routes

**Files:**
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Update routes**

```php
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PdfController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\ExtractionController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\BatchController;
use App\Http\Controllers\ComparisonController;

Route::prefix('v1')->group(function () {
    // Health
    Route::get('/health', [HealthController::class, 'index']);
    Route::get('/health/ready', [HealthController::class, 'ready']);
    Route::get('/health/docling', [HealthController::class, 'docling']);

    // Legacy PDF operations
    Route::post('/pdf/upload', [PdfController::class, 'upload']);
    Route::post('/pdf/analyze', [PdfController::class, 'analyze']);
    Route::post('/pdf/scrub', [PdfController::class, 'scrub']);
    Route::post('/pdf/full-extract', [ExtractionController::class, 'fullExtract']);
    Route::get('/pdf/progress/{jobId}', [ExtractionController::class, 'progress']);

    // Document management
    Route::get('/documents', [DocumentController::class, 'index']);
    Route::post('/documents', [DocumentController::class, 'store']);
    Route::get('/documents/{id}', [DocumentController::class, 'show']);
    Route::get('/documents/{id}/progress', [DocumentController::class, 'progress']);
    Route::delete('/documents/{id}', [DocumentController::class, 'destroy']);

    // Batch processing
    Route::get('/batches', [BatchController::class, 'index']);
    Route::post('/batches', [BatchController::class, 'store']);
    Route::get('/batches/{id}', [BatchController::class, 'show']);
    Route::get('/batches/{id}/progress', [BatchController::class, 'progress']);

    // Comparison
    Route::post('/compare', [ComparisonController::class, 'compare']);
});
```

- [ ] **Step 2: Commit**

```bash
git add routes/api.php
git commit -m "feat: add routes for documents, batches, comparison APIs"
```

---

## Task 8: Frontend API Service

**Files:**
- Create: `frontend/src/services/api.ts`

- [ ] **Step 1: Create API service**

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 120000,
});

export interface Document {
  id: number;
  filename: string;
  original_filename: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  document_type: string | null;
  type_confidence: number | null;
  balances: {
    beginning_balance: { amount: number | null; keyword: string | null };
    ending_balance: { amount: number | null; keyword: string | null };
  } | null;
  ai_analysis: {
    qualification_score: number;
    pii_found: { has_ssn: boolean; has_account_numbers: boolean; locations: string[] };
    risk_indicators: any;
    transaction_summary: any;
  } | null;
  scores: {
    completeness: number;
    quality: number;
    pii_detection: number;
    overall: number;
  } | null;
  key_details: any[] | null;
  recommendations: any[] | null;
  pii_breakdown: any | null;
  created_at: string;
  error_message: string | null;
}

export interface Batch {
  id: number;
  name: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  total_documents: number;
  completed_documents: number;
  failed_documents: number;
  document_batches: Array<{
    id: number;
    document_id: number;
    batch_id: number;
    status: string;
    document: Document;
  }>;
}

export interface ComparisonResponse {
  success: boolean;
  type: 'balances' | 'risk' | 'transactions' | 'delta';
  documents: Document[];
  comparison: {
    timeline?: any[];
    gaps?: any[];
    risk_grid?: any[];
    high_risk_documents?: any[];
    summary?: any[];
    deltas?: any[];
  };
}

export const documentApi = {
  list: async (params?: { status?: string; search?: string }): Promise<Document[]> => {
    const response = await api.get('/documents', { params });
    return response.data.data;
  },

  upload: async (files: File[]): Promise<Document[]> => {
    const formData = new FormData();
    files.forEach(file => formData.append('files[]', file));
    const response = await api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  },

  get: async (id: number): Promise<Document> => {
    const response = await api.get(`/documents/${id}`);
    return response.data.data;
  },

  getProgress: async (id: number) => {
    const response = await api.get(`/documents/${id}/progress`);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/documents/${id}`);
  },
};

export const batchApi = {
  list: async (): Promise<Batch[]> => {
    const response = await api.get('/batches');
    return response.data.data;
  },

  create: async (documentIds: number[], name?: string): Promise<Batch> => {
    const response = await api.post('/batches', { document_ids: documentIds, name });
    return response.data.data;
  },

  get: async (id: number): Promise<Batch> => {
    const response = await api.get(`/batches/${id}`);
    return response.data.data;
  },

  getProgress: async (id: number) => {
    const response = await api.get(`/batches/${id}/progress`);
    return response.data;
  },
};

export const comparisonApi = {
  compare: async (documentIds: number[], type: 'balances' | 'risk' | 'transactions' | 'delta'): Promise<ComparisonResponse> => {
    const response = await api.post('/compare', { document_ids: documentIds, type });
    return response.data;
  },
};

export default api;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "feat: add API service for documents, batches, comparison"
```

---

## Task 9: Update DocumentLibrary Component

**Files:**
- Modify: `frontend/src/components/DocumentLibrary.tsx`

- [ ] **Step 1: Update to use API instead of mock data**

Replace the current DocumentLibrary.tsx content with:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { documentApi, Document } from '../services/api';

interface DocumentLibraryProps {
  onSelectDocument?: (id: number) => void;
  selectedIds?: number[];
  onToggleSelect?: (id: number) => void;
  selectionMode?: boolean;
}

export function DocumentLibrary({
  onSelectDocument,
  selectedIds = [],
  onToggleSelect,
  selectionMode = false
}: DocumentLibraryProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.append('status', filter);
      if (search) params.append('search', search);

      const data = await documentApi.list(params.toString() ? { status: filter, search } : undefined);
      setDocuments(data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchDocuments();
    // Poll for updates every 3 seconds while processing
    const interval = setInterval(() => {
      const hasProcessing = documents.some(d => d.status === 'processing' || d.status === 'pending');
      if (hasProcessing) {
        fetchDocuments();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchDocuments, documents]);

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this document?')) return;
    try {
      await documentApi.delete(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
      if (pdfFiles.length === 0) return;

      await documentApi.upload(pdfFiles);
      fetchDocuments();
    } catch (error) {
      console.error('Failed to upload:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return (
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      case 'processing':
      case 'pending':
        return (
          <svg className="w-4 h-4 text-yellow-500 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      default:
        return <span className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'bg-green-50 border-green-200';
      case 'failed': return 'bg-red-50 border-red-200';
      case 'processing': return 'bg-yellow-50 border-yellow-200';
      case 'pending': return 'bg-gray-50 border-gray-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  const getRiskLevel = (score: number | undefined | null) => {
    if (score === undefined || score === null) return { level: 'Unknown', color: 'text-gray-400', bg: 'bg-gray-100' };
    if (score >= 7) return { level: 'Low', color: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 4) return { level: 'Medium', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { level: 'High', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const filteredDocuments = documents.filter(doc => {
    if (filter !== 'all' && doc.status !== filter) return false;
    if (search && !doc.original_filename.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-4 pr-10 py-2 border border-bw-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black w-64"
            />
            <svg className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-bw-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-4 py-2 border border-bw-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="complete">Complete</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-black text-white' : 'bg-bw-100 text-bw-600'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded ${viewMode === 'list' ? 'bg-black text-white' : 'bg-bw-100 text-bw-600'}`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Upload area */}
      <div className="border-2 border-dashed border-bw-200 rounded-xl p-8 text-center hover:border-bw-400 transition-colors">
        <input
          type="file"
          accept=".pdf"
          multiple
          onChange={handleUpload}
          className="hidden"
          id="library-upload"
        />
        <label htmlFor="library-upload" className="cursor-pointer">
          <svg className="w-8 h-8 mx-auto text-bw-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="text-sm text-bw-600">Click to upload more PDFs</span>
        </label>
      </div>

      {/* Loading state */}
      {loading && documents.length === 0 && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-2 border-bw-300 border-t-black rounded-full animate-spin mx-auto"></div>
          <p className="text-bw-500 mt-2">Loading documents...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && documents.length === 0 && (
        <div className="text-center py-12 border border-bw-100 rounded-xl">
          <svg className="w-12 h-12 mx-auto text-bw-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-bw-500">No documents found</p>
          <p className="text-sm text-bw-400 mt-1">Upload PDFs to get started</p>
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && !loading && documents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map(doc => {
            const risk = getRiskLevel(doc.ai_analysis?.qualification_score);
            const isSelected = selectedIds.includes(doc.id);

            return (
              <div
                key={doc.id}
                onClick={() => selectionMode ? onToggleSelect?.(doc.id) : onSelectDocument?.(doc.id)}
                className={`border rounded-xl p-4 cursor-pointer transition-all hover:shadow-md ${getStatusColor(doc.status)} ${isSelected ? 'ring-2 ring-black' : ''}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(doc.status)}
                    <span className="text-sm font-medium text-bw-700 truncate max-w-[150px]">{doc.original_filename}</span>
                  </div>
                  {!selectionMode && (
                    <button
                      onClick={(e) => handleDelete(doc.id, e)}
                      className="text-bw-400 hover:text-red-500"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-bw-500">Type:</span>
                    <span className="text-bw-700 font-medium">{doc.document_type || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-bw-500">Risk:</span>
                    <span className={`px-2 py-0.5 rounded ${risk.bg} ${risk.color} font-medium`}>{risk.level}</span>
                  </div>
                  {doc.balances?.ending_balance?.amount && (
                    <div className="flex justify-between">
                      <span className="text-bw-500">Ending:</span>
                      <span className="text-bw-700 font-mono">${doc.balances.ending_balance.amount.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && !loading && documents.length > 0 && (
        <div className="border border-bw-100 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-bw-50 border-b border-bw-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-bw-500 uppercase">Document</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-bw-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-bw-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-bw-500 uppercase">Risk</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-bw-500 uppercase">Ending Balance</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-bw-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bw-100">
              {filteredDocuments.map(doc => {
                const risk = getRiskLevel(doc.ai_analysis?.qualification_score);
                return (
                  <tr
                    key={doc.id}
                    onClick={() => selectionMode ? onToggleSelect?.(doc.id) : onSelectDocument?.(doc.id)}
                    className={`hover:bg-bw-50 cursor-pointer ${selectedIds.includes(doc.id) ? 'bg-bw-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(doc.status)}
                        <span className="text-sm font-medium text-bw-700">{doc.original_filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm capitalize ${doc.status === 'complete' ? 'text-green-600' : doc.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-bw-600">{doc.document_type || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${risk.color}`}>{risk.level}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-bw-700">
                      {doc.balances?.ending_balance?.amount ? `$${doc.balances.ending_balance.amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-bw-500">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

Run: `cd /Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend && npm run build`

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/DocumentLibrary.tsx frontend/src/services/api.ts
git commit -m "feat: update DocumentLibrary to use real API"
```

---

## Task 10: Update BatchProcessor Component

**Files:**
- Modify: `frontend/src/components/BatchProcessor.tsx`

- [ ] **Step 1: Update to use API instead of mock data**

Replace the BatchProcessor to use real batch API.

- [ ] **Step 2: Build to verify**

Run: `cd /Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend && npm run build`

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/BatchProcessor.tsx
git commit -m "feat: update BatchProcessor to use real API"
```

---

## Task 11: Update ComparativeView Component

**Files:**
- Modify: `frontend/src/components/ComparativeView.tsx`

- [ ] **Step 1: Update to use API instead of mock data**

Replace the ComparativeView to use real comparison API.

- [ ] **Step 2: Build to verify**

Run: `cd /Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend && npm run build`

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ComparativeView.tsx
git commit -m "feat: update ComparativeView to use real API"
```

---

## Task 12: Update UploadSection Component

**Files:**
- Modify: `frontend/src/components/UploadSection.tsx`

- [ ] **Step 1: Update to process multiple files and save to document library**

Key changes:
1. After processing `files[0]`, process remaining files
2. After all processing complete, show summary of all processed documents
3. Allow navigation to Document Library to see all uploaded documents

- [ ] **Step 2: Build to verify**

Run: `cd /Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/frontend && npm run build`

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/UploadSection.tsx
git commit -m "feat: update UploadSection for multi-file processing"
```

---

## Verification

After all tasks complete, run the following to verify:

1. **Backend migrations:**
   ```bash
   cd backend && php artisan migrate
   ```

2. **Backend tests:**
   ```bash
   cd backend && ./vendor/bin/phpunit
   ```

3. **Frontend build:**
   ```bash
   cd frontend && npm run build
   ```

4. **Start servers and test:**
   - Backend: `cd backend && php artisan serve`
   - Frontend: `cd frontend && npm run dev`
   - Upload 3+ PDFs
   - Check Document Library shows all documents
   - Select 2+ documents and compare
   - Process batch and see progress
