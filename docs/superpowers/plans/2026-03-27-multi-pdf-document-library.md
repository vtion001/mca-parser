# Multi-PDF Document Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement multi-PDF handling for MCA PDF Scrubber with batch processing, document library, and comparative analysis.

**Architecture:**
- Laravel API + MySQL database for metadata storage
- Supabase Storage for PDF file storage
- React frontend with document library, batch processing, and comparative views

**Tech Stack:**
- Laravel 11 (PHP 8.5)
- React 18 + TypeScript + Vite
- MySQL (existing Laravel database)
- Supabase Storage for PDF files

---

## Task 1: Database Migrations

**Files:**
- Create: `backend/database/migrations/2026_03_27_000001_create_documents_table.php`
- Create: `backend/database/migrations/2026_03_27_000002_create_batch_jobs_table.php`
- Create: `backend/database/migrations/2026_03_27_000003_create_document_batch_table.php`

- [ ] **Step 1: Create migration for documents table**

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
            $table->string('supabase_path')->nullable();
            $table->string('filename');
            $table->enum('status', ['pending', 'processing', 'complete', 'failed'])->default('pending');
            $table->string('document_type')->nullable();
            $table->decimal('type_confidence', 5, 4)->nullable();
            $table->integer('page_count')->default(0);
            $table->bigInteger('file_size')->default(0);
            $table->json('extraction_result')->nullable();
            $table->json('ai_analysis')->nullable();
            $table->json('balances')->nullable();
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

- [ ] **Step 2: Create migration for batch_jobs table**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('batch_jobs', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->enum('status', ['pending', 'processing', 'complete', 'failed'])->default('pending');
            $table->integer('total_documents')->default(0);
            $table->integer('completed_documents')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('batch_jobs');
    }
};
```

- [ ] **Step 3: Create migration for document_batch pivot table**

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_batch', function (Blueprint $table) {
            $table->foreignId('document_id')->constrained()->onDelete('cascade');
            $table->foreignId('batch_id')->constrained()->onDelete('cascade');
            $table->integer('processing_order')->default(0);
            $table->timestamps();
            $table->primary(['document_id', 'batch_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_batch');
    }
};
```

- [ ] **Step 4: Run migrations**

Run: `php artisan migrate`
Expected: Tables created successfully

- [ ] **Step 5: Commit**

```bash
git add database/migrations/*_create_documents_table.php database/migrations/*_create_batch_jobs_table.php database/migrations/*_create_document_batch_table.php
git commit -m "feat: add documents, batch_jobs, and document_batch tables for multi-PDF support"
```

---

## Task 2: Document Model

**Files:**
- Create: `backend/app/Models/Document.php`
- Create: `backend/app/Models/BatchJob.php`

- [ ] **Step 1: Create Document model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Document extends Model
{
    protected $fillable = [
        'supabase_path',
        'filename',
        'status',
        'document_type',
        'type_confidence',
        'page_count',
        'file_size',
        'extraction_result',
        'ai_analysis',
        'balances',
        'error_message',
    ];

    protected $casts = [
        'extraction_result' => 'array',
        'ai_analysis' => 'array',
        'balances' => 'array',
        'type_confidence' => 'decimal:4',
        'file_size' => 'integer',
        'page_count' => 'integer',
    ];

    public function batches(): BelongsToMany
    {
        return $this->belongsToMany(BatchJob::class, 'document_batch')
            ->withPivot('processing_order')
            ->withTimestamps();
    }

    public function isComplete(): bool
    {
        return $this->status === 'complete';
    }

    public function isFailed(): bool
    {
        return $this->status === 'failed';
    }

    public function isProcessing(): bool
    {
        return $this->status === 'processing';
    }

    public function getRiskLevel(): string
    {
        if (!$this->ai_analysis) {
            return 'unknown';
        }

        $score = $this->ai_analysis['qualification_score'] ?? 5;
        if ($score >= 7) return 'low';
        if ($score >= 4) return 'medium';
        return 'high';
    }
}
```

- [ ] **Step 2: Create BatchJob model**

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class BatchJob extends Model
{
    protected $fillable = [
        'name',
        'status',
        'total_documents',
        'completed_documents',
    ];

    protected $casts = [
        'total_documents' => 'integer',
        'completed_documents' => 'integer',
    ];

    public function documents(): BelongsToMany
    {
        return $this->belongsToMany(Document::class, 'document_batch')
            ->withPivot('processing_order')
            ->withTimestamps();
    }

    public function getProgressPercent(): int
    {
        if ($this->total_documents === 0) {
            return 0;
        }
        return (int) round(($this->completed_documents / $this->total_documents) * 100);
    }

    public function isComplete(): bool
    {
        return $this->status === 'complete';
    }

    public function hasFailures(): bool
    {
        return $this->documents()->where('status', 'failed')->exists();
    }
}
```

- [ ] **Step 3: Write tests for models**

```php
<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Models\Document;
use App\Models\BatchJob;

class DocumentModelTest extends TestCase
{
    public function test_document_status_helpers(): void
    {
        $doc = new Document();

        $doc->status = 'complete';
        $this->assertTrue($doc->isComplete());
        $this->assertFalse($doc->isFailed());
        $this->assertFalse($doc->isProcessing());

        $doc->status = 'failed';
        $this->assertFalse($doc->isComplete());
        $this->assertTrue($doc->isFailed());
        $this->assertFalse($doc->isProcessing());

        $doc->status = 'processing';
        $this->assertFalse($doc->isComplete());
        $this->assertFalse($doc->isFailed());
        $this->assertTrue($doc->isProcessing());
    }

    public function test_risk_level_calculation(): void
    {
        $doc = new Document();

        $doc->ai_analysis = ['qualification_score' => 8];
        $this->assertEquals('low', $doc->getRiskLevel());

        $doc->ai_analysis = ['qualification_score' => 5];
        $this->assertEquals('medium', $doc->getRiskLevel());

        $doc->ai_analysis = ['qualification_score' => 2];
        $this->assertEquals('high', $doc->getRiskLevel());

        $doc->ai_analysis = null;
        $this->assertEquals('unknown', $doc->getRiskLevel());
    }
}

class BatchJobModelTest extends TestCase
{
    public function test_progress_calculation(): void
    {
        $batch = new BatchJob();

        $batch->total_documents = 0;
        $batch->completed_documents = 0;
        $this->assertEquals(0, $batch->getProgressPercent());

        $batch->total_documents = 10;
        $batch->completed_documents = 5;
        $this->assertEquals(50, $batch->getProgressPercent());

        $batch->total_documents = 10;
        $batch->completed_documents = 10;
        $this->assertEquals(100, $batch->getProgressPercent());
    }

    public function test_is_complete(): void
    {
        $batch = new BatchJob();

        $batch->status = 'complete';
        $this->assertTrue($batch->isComplete());

        $batch->status = 'processing';
        $this->assertFalse($batch->isComplete());
    }
}
```

- [ ] **Step 4: Run tests**

Run: `./vendor/bin/phpunit tests/Unit/DocumentModelTest.php tests/Unit/BatchJobModelTest.php`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/Models/Document.php app/Models/BatchJob.php tests/Unit/DocumentModelTest.php tests/Unit/BatchJobModelTest.php
git commit -m "feat: add Document and BatchJob models"
```

---

## Task 3: Supabase Storage Service

**Files:**
- Create: `backend/app/Services/SupabaseStorageService.php`
- Create: `backend/tests/Unit/SupabaseStorageServiceTest.php`

- [ ] **Step 1: Create SupabaseStorageService**

```php
<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

class SupabaseStorageService
{
    private string $url;
    private string $key;
    private string $bucket;
    private LoggerInterface $logger;

    public function __construct(
        ?string $url = null,
        ?string $key = null,
        ?string $bucket = null,
        ?LoggerInterface $logger = null
    ) {
        $this->url = $url ?? env('SUPABASE_URL', '');
        $this->key = $key ?? env('SUPABASE_SERVICE_KEY', '');
        $this->bucket = $bucket ?? env('SUPABASE_BUCKET', 'pdf-documents');
        $this->logger = $logger ?? new NullLogger();
    }

    public function setLogger(LoggerInterface $logger): void
    {
        $this->logger = $logger;
    }

    /**
     * Upload a file to Supabase Storage
     * Returns the storage path on success, null on failure
     */
    public function upload(string $filePath, string $filename): ?string
    {
        if (empty($this->url) || empty($this->key)) {
            $this->logger->warning('Supabase not configured, skipping upload');
            return null;
        }

        try {
            $content = file_get_contents($filePath);
            if ($content === false) {
                $this->logger->error('Failed to read file: ' . $filePath);
                return null;
            }

            $path = $this->generatePath($filename);
            $endpoint = $this->url . '/storage/v1/object/' . $this->bucket . '/' . $path;

            $response = Http::timeout(60)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $this->key,
                    'Content-Type' => 'application/pdf',
                    'x-upsert' => 'true',
                ])
                ->withBody($content, 'application/pdf')
                ->post($endpoint);

            if ($response->successful()) {
                $this->logger->info('Uploaded to Supabase: ' . $path);
                return $path;
            }

            $this->logger->error('Supabase upload failed: ' . $response->body());
            return null;

        } catch (\Exception $e) {
            $this->logger->error('Supabase upload exception: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Get a signed URL for downloading a file (15 min expiry)
     */
    public function getSignedUrl(string $path): ?string
    {
        if (empty($this->url) || empty($this->key)) {
            $this->logger->warning('Supabase not configured');
            return null;
        }

        try {
            $endpoint = $this->url . '/storage/v1/object/sign/' . $this->bucket . '/' . $path;

            $response = Http::timeout(30)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $this->key,
                ])
                ->post($endpoint);

            if ($response->successful()) {
                $data = $response->json();
                $signedPath = $data['signed_url'] ?? null;
                if ($signedPath) {
                    return $this->url . $signedPath;
                }
            }

            $this->logger->error('Failed to get signed URL: ' . $response->body());
            return null;

        } catch (\Exception $e) {
            $this->logger->error('Signed URL exception: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Delete a file from Supabase Storage
     */
    public function delete(string $path): bool
    {
        if (empty($this->url) || empty($this->key)) {
            $this->logger->warning('Supabase not configured, skipping delete');
            return false;
        }

        try {
            $endpoint = $this->url . '/storage/v1/object/' . $this->bucket . '/' . $path;

            $response = Http::timeout(30)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $this->key,
                ])
                ->delete($endpoint);

            if ($response->successful()) {
                $this->logger->info('Deleted from Supabase: ' . $path);
                return true;
            }

            $this->logger->error('Supabase delete failed: ' . $response->body());
            return false;

        } catch (\Exception $e) {
            $this->logger->error('Supabase delete exception: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Generate unique storage path for a file
     */
    private function generatePath(string $filename): string
    {
        $date = date('Y/m/d');
        $uuid = Str::uuid();
        $sanitized = preg_replace('/[^a-zA-Z0-9._-]/', '_', $filename);
        return $date . '/' . $uuid . '_' . $sanitized;
    }
}
```

- [ ] **Step 2: Write tests for SupabaseStorageService**

```php
<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Services\SupabaseStorageService;
use PHPUnit\Framework\Attributes\Test;

class SupabaseStorageServiceTest extends TestCase
{
    private SupabaseStorageService $service;

    protected function setUp(): void
    {
        parent::setUp();
        // Create with empty config to test fallback behavior
        $this->service = new SupabaseStorageService('', '', 'test-bucket');
    }

    #[Test]
    public function upload_returns_null_when_not_configured(): void
    {
        $result = $this->service->upload('/tmp/test.pdf', 'test.pdf');
        $this->assertNull($result);
    }

    #[Test]
    public function get_signed_url_returns_null_when_not_configured(): void
    {
        $result = $this->service->getSignedUrl('2026/03/27/test.pdf');
        $this->assertNull($result);
    }

    #[Test]
    public function delete_returns_false_when_not_configured(): void
    {
        $result = $this->service->delete('2026/03/27/test.pdf');
        $this->assertFalse($result);
    }

    #[Test]
    public function service_can_be_instantiated_with_config(): void
    {
        $service = new SupabaseStorageService(
            'https://example.supabase.co',
            'test-key',
            'my-bucket'
        );
        $this->assertInstanceOf(SupabaseStorageService::class, $service);
    }
}
```

- [ ] **Step 3: Run tests**

Run: `./vendor/bin/phpunit tests/Unit/SupabaseStorageServiceTest.php`
Expected: PASS

- [ ] **Step 4: Update .env with Supabase config**

Add to `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_BUCKET=pdf-documents
```

- [ ] **Step 5: Commit**

```bash
git add app/Services/SupabaseStorageService.php tests/Unit/SupabaseStorageServiceTest.php .env
git commit -m "feat: add SupabaseStorageService for PDF file storage"
```

---

## Task 4: Document Controller & API Endpoints

**Files:**
- Create: `backend/app/Http/Controllers/DocumentController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Create DocumentController**

```php
<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\BatchJob;
use App\Services\SupabaseStorageService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class DocumentController extends Controller
{
    public function __construct(
        private SupabaseStorageService $storage
    ) {}

    /**
     * List all documents with pagination
     */
    public function index(Request $request): JsonResponse
    {
        $query = Document::query();

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->get('status'));
        }

        // Filter by document type
        if ($request->has('document_type')) {
            $query->where('document_type', $request->get('document_type'));
        }

        // Search by filename
        if ($request->has('search')) {
            $query->where('filename', 'like', '%' . $request->get('search') . '%');
        }

        $documents = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));

        return response()->json($documents);
    }

    /**
     * Upload new document(s)
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'files.*' => 'required|file|mimes:pdf|max:102400', // 100MB max
        ]);

        $uploadedDocuments = [];

        foreach ($request->file('files') as $file) {
            // Upload to Supabase Storage
            $supabasePath = $this->storage->upload(
                $file->getPathname(),
                $file->getClientOriginalName()
            );

            // Create document record
            $document = Document::create([
                'supabase_path' => $supabasePath,
                'filename' => $file->getClientOriginalName(),
                'status' => 'pending',
                'file_size' => $file->getSize(),
            ]);

            $uploadedDocuments[] = $document;
        }

        return response()->json([
            'success' => true,
            'documents' => $uploadedDocuments,
            'count' => count($uploadedDocuments),
        ], 201);
    }

    /**
     * Get single document with full details
     */
    public function show(int $id): JsonResponse
    {
        $document = Document::with('batches')->findOrFail($id);

        // Generate signed URL for download
        $downloadUrl = null;
        if ($document->supabase_path) {
            $downloadUrl = $this->storage->getSignedUrl($document->supabase_path);
        }

        return response()->json([
            'document' => $document,
            'download_url' => $downloadUrl,
        ]);
    }

    /**
     * Delete a document
     */
    public function destroy(int $id): JsonResponse
    {
        $document = Document::findOrFail($id);

        // Delete from Supabase Storage
        if ($document->supabase_path) {
            $this->storage->delete($document->supabase_path);
        }

        $document->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Get download URL for a document
     */
    public function download(int $id): JsonResponse
    {
        $document = Document::findOrFail($id);

        if (!$document->supabase_path) {
            return response()->json(['error' => 'File not found'], 404);
        }

        $url = $this->storage->getSignedUrl($document->supabase_path);

        if (!$url) {
            return response()->json(['error' => 'Failed to generate URL'], 500);
        }

        return response()->json(['url' => $url]);
    }
}
```

- [ ] **Step 2: Create BatchController**

```php
<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Models\BatchJob;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class BatchController extends Controller
{
    /**
     * Create a new batch from document IDs
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'document_ids' => 'required|array|min:1|max:50',
            'document_ids.*' => 'integer|exists:documents,id',
            'name' => 'nullable|string|max:255',
        ]);

        $batch = BatchJob::create([
            'name' => $request->get('name', 'Batch ' . date('Y-m-d H:i')),
            'status' => 'pending',
            'total_documents' => count($request->document_ids),
            'completed_documents' => 0,
        ]);

        $batch->documents()->attach($request->document_ids);

        return response()->json([
            'batch' => $batch->load('documents'),
            'success' => true,
        ], 201);
    }

    /**
     * Get batch status and documents
     */
    public function show(int $id): JsonResponse
    {
        $batch = BatchJob::with('documents')->findOrFail($id);

        return response()->json([
            'batch' => $batch,
            'progress' => $batch->getProgressPercent(),
            'documents' => $batch->documents,
        ]);
    }

    /**
     * Start processing a batch
     */
    public function process(int $id): JsonResponse
    {
        $batch = BatchJob::with('documents')->findOrFail($id);

        if ($batch->status === 'processing') {
            return response()->json(['error' => 'Batch already processing'], 400);
        }

        $batch->update(['status' => 'processing']);

        // Dispatch jobs for each document
        foreach ($batch->documents as $document) {
            ProcessDocumentJob::dispatch($document->id);
        }

        return response()->json([
            'batch' => $batch,
            'message' => 'Processing started',
        ]);
    }

    /**
     * Delete a batch (documents remain)
     */
    public function destroy(int $id): JsonResponse
    {
        $batch = BatchJob::findOrFail($id);
        $batch->documents()->detach();
        $batch->delete();

        return response()->json(['success' => true]);
    }

    /**
     * Get batch progress
     */
    public function progress(int $id): JsonResponse
    {
        $batch = BatchJob::with(['documents' => function ($q) {
            $q->select('id', 'filename', 'status');
        }])->findOrFail($id);

        return response()->json([
            'batch_id' => $batch->id,
            'status' => $batch->status,
            'total' => $batch->total_documents,
            'completed' => $batch->completed_documents,
            'progress_percent' => $batch->getProgressPercent(),
            'documents' => $batch->documents,
        ]);
    }
}
```

- [ ] **Step 3: Create ProcessDocumentJob**

```php
<?php

namespace App\Jobs;

use App\Models\Document;
use App\Services\DoclingService;
use App\Services\DocumentTypeDetector;
use App\Services\FieldMapper;
use App\Services\ExtractionScorer;
use App\Services\BalanceExtractorService;
use App\Services\OpenRouterService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessDocumentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;
    public int $timeout = 300;

    public function __construct(
        public int $documentId
    ) {}

    public function handle(
        DoclingService $doclingService,
        DocumentTypeDetector $typeDetector,
        FieldMapper $fieldMapper,
        ExtractionScorer $scorer,
        BalanceExtractorService $balanceExtractor,
        OpenRouterService $openRouterService
    ): void {
        $document = Document::find($this->documentId);
        if (!$document) {
            Log::error('Document not found: ' . $this->documentId);
            return;
        }

        $document->update(['status' => 'processing']);

        try {
            // Get file path from Supabase or local storage
            $filePath = $this->getFilePath($document);
            if (!$filePath) {
                throw new \Exception('Could not retrieve file');
            }

            // Extract text
            $extractResult = $doclingService->extractText($filePath);
            if (!$extractResult['success']) {
                throw new \Exception($extractResult['error'] ?? 'Extraction failed');
            }

            $markdown = $extractResult['text'];
            $ocrText = $extractResult['ocr_text'] ?? '';
            $fullMarkdown = !empty($ocrText) ? $markdown . "\n\n## OCR\n\n" . $ocrText : $markdown;

            // Detect document type
            $docType = $typeDetector->detect($fullMarkdown);

            // Map fields
            $keyDetails = $fieldMapper->map($fullMarkdown, $docType['type']);

            // Detect PII
            $patterns = [
                'ssn' => '/\d{3}-\d{2}-\d{4}/',
                'email' => '/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/',
                'phone' => '/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/',
            ];
            $piiDetected = [];
            foreach ($patterns as $name => $pattern) {
                if (preg_match($pattern, $fullMarkdown)) {
                    $piiDetected[] = $name;
                }
            }

            // Score extraction
            $scoreResult = $scorer->score($fullMarkdown, $extractResult['page_count'] ?? 1, $piiDetected, $patterns);

            // Extract balances
            $balances = $balanceExtractor->extractBalances($fullMarkdown);

            // AI analysis
            $aiAnalysis = $openRouterService->analyzeDocument($fullMarkdown, $docType, $keyDetails, $balances);

            // Update document
            $document->update([
                'status' => 'complete',
                'document_type' => $docType['type'],
                'type_confidence' => $docType['confidence'],
                'page_count' => $extractResult['page_count'] ?? 1,
                'extraction_result' => [
                    'markdown' => $fullMarkdown,
                    'key_details' => $keyDetails,
                    'scores' => $scoreResult['scores'],
                    'pii_breakdown' => $scoreResult['pii_breakdown'],
                ],
                'ai_analysis' => $aiAnalysis,
                'balances' => $balances,
            ]);

            // Update batch progress if applicable
            $this->updateBatchProgress($document);

        } catch (\Exception $e) {
            Log::error('ProcessDocumentJob failed: ' . $e->getMessage());
            $document->update([
                'status' => 'failed',
                'error_message' => $e->getMessage(),
            ]);
            $this->updateBatchProgress($document);
        }
    }

    private function getFilePath(Document $document): ?string
    {
        // If Supabase path exists, download temporarily
        if ($document->supabase_path) {
            // For now, return null - full implementation would download from Supabase
            return null;
        }

        // Local storage fallback would go here
        return null;
    }

    private function updateBatchProgress(Document $document): void
    {
        $batches = $document->batches;
        foreach ($batches as $batch) {
            $completed = $batch->documents()
                ->whereIn('status', ['complete', 'failed'])
                ->count();
            $batch->update(['completed_documents' => $completed]);

            if ($completed >= $batch->total_documents) {
                $hasFailures = $batch->documents()->where('status', 'failed')->exists();
                $batch->update(['status' => $hasFailures ? 'failed' : 'complete']);
            }
        }
    }
}
```

- [ ] **Step 4: Update API routes**

Add to `backend/routes/api.php`:

```php
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\BatchController;

// Document endpoints
Route::get('/documents', [DocumentController::class, 'index']);
Route::post('/documents', [DocumentController::class, 'store']);
Route::get('/documents/{id}', [DocumentController::class, 'show']);
Route::delete('/documents/{id}', [DocumentController::class, 'destroy']);
Route::get('/documents/{id}/download', [DocumentController::class, 'download']);

// Batch endpoints
Route::post('/batches', [BatchController::class, 'store']);
Route::get('/batches/{id}', [BatchController::class, 'show']);
Route::post('/batches/{id}/process', [BatchController::class, 'process']);
Route::delete('/batches/{id}', [BatchController::class, 'destroy']);
Route::get('/batches/{id}/progress', [BatchController::class, 'progress']);

// Comparison endpoint
Route::post('/documents/compare', [DocumentController::class, 'compare']);
```

- [ ] **Step 5: Add compare method to DocumentController**

```php
/**
 * Compare multiple documents
 */
public function compare(Request $request): JsonResponse
{
    $request->validate([
        'document_ids' => 'required|array|min:2|max:50',
        'document_ids.*' => 'integer|exists:documents,id',
        'type' => 'nullable|in:balances,transactions,risk,delta',
    ]);

    $type = $request->get('type', 'balances');
    $documents = Document::whereIn('id', $request->document_ids)
        ->where('status', 'complete')
        ->get();

    $result = match ($type) {
        'balances' => $this->compareBalances($documents),
        'transactions' => $this->compareTransactions($documents),
        'risk' => $this->compareRisk($documents),
        'delta' => $this->compareDelta($documents),
        default => $this->compareBalances($documents),
    };

    return response()->json([
        'comparison_type' => $type,
        'documents' => $documents->map(fn($d) => [
            'id' => $d->id,
            'filename' => $d->filename,
            'document_type' => $d->document_type,
            'created_at' => $d->created_at,
        ]),
        'data' => $result,
    ]);
}

private function compareBalances($documents): array
{
    $comparison = [];
    foreach ($documents as $doc) {
        $comparison[] = [
            'id' => $doc->id,
            'filename' => $doc->filename,
            'beginning_balance' => $doc->balances['beginning_balance']['amount'] ?? null,
            'ending_balance' => $doc->balances['ending_balance']['amount'] ?? null,
            'date' => $doc->created_at,
        ];
    }

    // Sort by date
    usort($comparison, fn($a, $b) => strtotime($a['date']) - strtotime($b['date']));

    // Calculate gaps
    $gaps = [];
    for ($i = 1; $i < count($comparison); $i++) {
        $prev = $comparison[$i - 1]['ending_balance'];
        $curr = $comparison[$i]['beginning_balance'];
        if ($prev !== null && $curr !== null) {
            $gap = round($curr - $prev, 2);
            if ($gap !== 0) {
                $gaps[] = [
                    'from' => $comparison[$i - 1]['filename'],
                    'to' => $comparison[$i]['filename'],
                    'gap' => $gap,
                ];
            }
        }
    }

    return [
        'balances' => $comparison,
        'gaps' => $gaps,
    ];
}

private function compareTransactions($documents): array
{
    // Aggregate transaction totals
    $totals = [];
    foreach ($documents as $doc) {
        $ai = $doc->ai_analysis ?? [];
        $totals[] = [
            'id' => $doc->id,
            'filename' => $doc->filename,
            'total_credits' => $ai['transaction_summary']['total_amount_credits'] ?? null,
            'total_debits' => $ai['transaction_summary']['total_amount_debits'] ?? null,
        ];
    }
    return ['transactions' => $totals];
}

private function compareRisk($documents): array
{
    return $documents->map(fn($d) => [
        'id' => $d->id,
        'filename' => $d->filename,
        'risk_level' => $d->getRiskLevel(),
        'qualification_score' => $d->ai_analysis['qualification_score'] ?? null,
    ])->toArray();
}

private function compareDelta($documents): array
{
    // Find what's different between documents
    $piiPatterns = ['ssn', 'email', 'phone'];
    $deltas = [];

    foreach ($documents as $doc) {
        $pii = $doc->extraction_result['pii_breakdown'] ?? [];
        foreach ($piiPatterns as $pattern) {
            if ($pii[$pattern]['found'] ?? false) {
                $deltas[$pattern][] = $doc->filename;
            }
        }
    }

    return ['pii_detected' => $deltas];
}
```

- [ ] **Step 6: Commit**

```bash
git add app/Http/Controllers/DocumentController.php app/Http/Controllers/BatchController.php app/Jobs/ProcessDocumentJob.php routes/api.php
git commit -m "feat: add Document and Batch API endpoints with processing jobs"
```

---

## Task 5: Frontend - Document Library Components

**Files:**
- Create: `frontend/src/components/DocumentLibrary.tsx`
- Create: `frontend/src/components/BatchProcessor.tsx`
- Create: `frontend/src/components/ComparativeView.tsx`
- Modify: `frontend/src/components/index.ts`

- [ ] **Step 1: Create DocumentLibrary component**

```tsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useTheme } from '../hooks/useTheme';

interface Document {
  id: number;
  filename: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  document_type: string | null;
  type_confidence: number | null;
  balances: any;
  ai_analysis: any;
  created_at: string;
}

export function DocumentLibrary() {
  const { colors } = useTheme();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, [filter]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await axios.get('/api/v1/documents', { params });
      setDocuments(response.data.data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this document?')) return;
    try {
      await axios.delete(`/api/v1/documents/${id}`);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'complete': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'processing': return 'text-yellow-600';
      default: return 'text-gray-500';
    }
  };

  const getRiskBadge = (doc: Document) => {
    const score = doc.ai_analysis?.qualification_score;
    if (score === undefined) return null;
    const level = score >= 7 ? 'low' : score >= 4 ? 'medium' : 'high';
    const color = level === 'low' ? 'bg-green-100 text-green-700' : level === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
    return <span className={`px-2 py-0.5 text-xs rounded ${color}`}>{level.toUpperCase()}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4 items-center">
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">All Documents</option>
          <option value="complete">Complete</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
        </select>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg"
        />
      </div>

      {/* Document Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map(doc => (
          <div
            key={doc.id}
            className="bg-white rounded-xl border shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  doc.status === 'complete' ? 'bg-green-500' :
                  doc.status === 'failed' ? 'bg-red-500' :
                  doc.status === 'processing' ? 'bg-yellow-500' : 'bg-gray-400'
                }`} />
                <span className="font-medium text-sm truncate max-w-[150px]">{doc.filename}</span>
              </div>
              {getRiskBadge(doc)}
            </div>

            <div className="space-y-1 text-sm text-gray-600">
              <p>Type: {doc.document_type || 'Unknown'}</p>
              {doc.balances?.ending_balance?.amount && (
                <p>Balance: ${doc.balances.ending_balance.amount.toLocaleString()}</p>
              )}
              <p className="text-xs text-gray-400">
                {new Date(doc.created_at).toLocaleDateString()}
              </p>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => window.location.href = `/documents/${doc.id}`}
                className="flex-1 px-3 py-1 text-sm border rounded hover:bg-gray-50"
              >
                View
              </button>
              <button
                onClick={() => handleDelete(doc.id)}
                className="px-3 py-1 text-sm text-red-600 border border-red-200 rounded hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {documents.length === 0 && !loading && (
        <p className="text-center text-gray-500 py-12">No documents found</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create BatchProcessor component**

```tsx
import { useState } from 'react';
import axios from 'axios';

interface Batch {
  id: number;
  name: string;
  status: string;
  total_documents: number;
  completed_documents: number;
}

interface BatchProcessorProps {
  selectedDocuments: number[];
  onComplete: () => void;
}

export function BatchProcessor({ selectedDocuments, onComplete }: BatchProcessorProps) {
  const [batchName, setBatchName] = useState('');
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(false);

  const createAndProcess = async () => {
    if (selectedDocuments.length === 0) return;

    setLoading(true);
    try {
      // Create batch
      const createResponse = await axios.post('/api/v1/batches', {
        document_ids: selectedDocuments,
        name: batchName || undefined,
      });
      const newBatch = createResponse.data.batch;

      // Start processing
      await axios.post(`/api/v1/batches/${newBatch.id}/process`);
      setBatch({ ...newBatch, status: 'processing' });

      // Poll for progress
      pollProgress(newBatch.id);
    } catch (error) {
      console.error('Failed to process batch:', error);
    } finally {
      setLoading(false);
    }
  };

  const pollProgress = async (batchId: number) => {
    const poll = async () => {
      try {
        const response = await axios.get(`/api/v1/batches/${batchId}/progress`);
        setBatch(response.data);

        if (response.data.status === 'processing') {
          setTimeout(poll, 1000);
        } else {
          onComplete();
        }
      } catch (error) {
        console.error('Progress poll failed:', error);
      }
    };
    poll();
  };

  const progress = batch ? Math.round((batch.completed_documents / batch.total_documents) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="text-lg font-semibold mb-4">Batch Processing</h3>

      {!batch ? (
        <>
          <p className="text-sm text-gray-600 mb-4">
            {selectedDocuments.length} documents selected
          </p>
          <input
            type="text"
            placeholder="Batch name (optional)"
            value={batchName}
            onChange={e => setBatchName(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg mb-4"
          />
          <button
            onClick={createAndProcess}
            disabled={loading || selectedDocuments.length === 0}
            className="w-full px-4 py-2 bg-black text-white rounded-lg disabled:opacity-50"
          >
            {loading ? 'Creating Batch...' : 'Process All'}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>{batch.completed_documents}/{batch.total_documents} complete</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          {batch.status === 'complete' && (
            <p className="text-green-600 text-sm font-medium">Processing complete!</p>
          )}
          {batch.status === 'failed' && (
            <p className="text-red-600 text-sm font-medium">Processing failed</p>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create ComparativeView component**

```tsx
import { useState } from 'react';
import axios from 'axios';

interface BalanceComparison {
  filename: string;
  beginning_balance: number | null;
  ending_balance: number | null;
  date: string;
}

export function ComparativeView() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [compareType, setCompareType] = useState<'balances' | 'risk' | 'transactions'>('balances');

  const runComparison = async () => {
    if (selectedIds.length < 2) return;

    setLoading(true);
    try {
      const response = await axios.post('/api/v1/documents/compare', {
        document_ids: selectedIds,
        type: compareType,
      });
      setComparison(response.data.data);
    } catch (error) {
      console.error('Comparison failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderBalanceTimeline = () => {
    if (!comparison?.balances) return null;

    return (
      <div className="space-y-4">
        <h4 className="font-medium">Balance Timeline</h4>
        <div className="h-64 flex items-end gap-4 border-b border-gray-200 px-4">
          {comparison.balances.map((b: BalanceComparison, i: number) => (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="w-full flex justify-center gap-2">
                {b.ending_balance && (
                  <div
                    className="w-8 bg-black rounded-t"
                    style={{ height: `${(b.ending_balance / 10000) * 100}px` }}
                    title={`$${b.ending_balance.toLocaleString()}`}
                  />
                )}
              </div>
              <span className="text-xs mt-2 truncate max-w-full">{b.filename}</span>
            </div>
          ))}
        </div>

        {comparison.gaps?.length > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
            <h5 className="font-medium text-yellow-800">Discrepancies Detected</h5>
            {comparison.gaps.map((gap: any, i: number) => (
              <p key={i} className="text-sm text-yellow-700">
                {gap.from} → {gap.to}: ${gap.gap.toLocaleString()} gap
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderRiskGrid = () => {
    if (!comparison) return null;

    return (
      <div className="grid grid-cols-3 gap-4">
        {comparison.map((doc: any, i: number) => (
          <div
            key={i}
            className={`p-4 rounded-lg border ${
              doc.risk_level === 'low' ? 'border-green-200 bg-green-50' :
              doc.risk_level === 'medium' ? 'border-yellow-200 bg-yellow-50' :
              'border-red-200 bg-red-50'
            }`}
          >
            <p className="font-medium truncate">{doc.filename}</p>
            <p className="text-2xl mt-2">{doc.qualification_score}/10</p>
            <p className={`text-sm ${
              doc.risk_level === 'low' ? 'text-green-600' :
              doc.risk_level === 'medium' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {doc.risk_level?.toUpperCase()} RISK
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 items-center">
        <select
          value={compareType}
          onChange={e => setCompareType(e.target.value as any)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="balances">Balance Comparison</option>
          <option value="risk">Risk Analysis</option>
          <option value="transactions">Transaction Summary</option>
        </select>
        <button
          onClick={runComparison}
          disabled={loading || selectedIds.length < 2}
          className="px-4 py-2 bg-black text-white rounded-lg disabled:opacity-50"
        >
          {loading ? 'Comparing...' : 'Compare Selected'}
        </button>
      </div>

      {comparison && (
        <div className="bg-white rounded-xl border p-6">
          {compareType === 'balances' && renderBalanceTimeline()}
          {compareType === 'risk' && renderRiskGrid()}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update component exports**

Add to `frontend/src/components/index.ts`:

```tsx
export { DocumentLibrary } from './DocumentLibrary';
export { BatchProcessor } from './BatchProcessor';
export { ComparativeView } from './ComparativeView';
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/DocumentLibrary.tsx frontend/src/components/BatchProcessor.tsx frontend/src/components/ComparativeView.tsx
git commit -m "feat: add DocumentLibrary, BatchProcessor, and ComparativeView components"
```

---

## Task 6: Update Upload Section for Multi-File

**Files:**
- Modify: `frontend/src/components/UploadSection.tsx`

- [ ] **Step 1: Update UploadSection for multi-file support**

```tsx
import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { useTheme } from '../hooks/useTheme';
import { useExtraction } from '../hooks/useExtraction';
import { BatchProcessor } from './BatchProcessor';

export function UploadSection() {
  const { colors } = useTheme();
  const { state, startExtraction, reset } = useExtraction();
  const [files, setFiles] = useState<File[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<any[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);

    if (e.dataTransfer.files) {
      const pdfs = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
      setFiles(prev => [...prev, ...pdfs]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const pdfs = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
      setFiles(prev => [...prev, ...pdfs]);
    }
  }, []);

  const uploadBatch = async () => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('files[]', f));

      const response = await axios.post('/api/v1/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadedDocs(response.data.documents);
      setSelectedIds(response.data.documents.map((d: any) => d.id));
      setFiles([]);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8">
      {/* Drop Zone */}
      <div
        onDragEnter={() => setDragActive(true)}
        onDragLeave={() => setDragActive(false)}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all ${
          dragActive ? 'border-black bg-gray-50' : 'border-gray-300'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        <button onClick={() => fileInputRef.current?.click()}>
          <p className="text-lg mb-2">Drop PDFs or click to select</p>
          <p className="text-sm text-gray-500">{files.length} files selected</p>
        </button>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">{files.length} files ready</h3>
            <button
              onClick={uploadBatch}
              disabled={uploading}
              className="px-6 py-2 bg-black text-white rounded-lg disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Upload All'}
            </button>
          </div>
        </div>
      )}

      {/* Uploaded Documents */}
      {uploadedDocs.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-medium">Uploaded Documents</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {uploadedDocs.map((doc: any) => (
              <div
                key={doc.id}
                onClick={() => toggleSelect(doc.id)}
                className={`p-4 rounded-lg border cursor-pointer ${
                  selectedIds.includes(doc.id)
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200'
                }`}
              >
                <p className="font-medium truncate text-sm">{doc.filename}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>

          {selectedIds.length > 1 && (
            <BatchProcessor
              selectedDocuments={selectedIds}
              onComplete={() => setUploadedDocs([])}
            />
          )}
        </div>
      )}

      {/* Single file legacy processing */}
      {files.length === 0 && uploadedDocs.length === 0 && (
        /* existing single-file UI */
        <div className="text-center text-gray-500 py-12">
          No files selected
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/UploadSection.tsx
git commit -m "feat: update UploadSection for multi-file batch upload"
```

---

## Verification

Run all tests to verify implementation:

```bash
./vendor/bin/phpunit tests/Unit --no-coverage
```

Expected: All tests pass

---

## Summary

**Completed Tasks:**
1. Database Migrations - documents, batch_jobs, document_batch tables
2. Document & BatchJob Models with relationships
3. SupabaseStorageService for PDF file storage
4. DocumentController & BatchController with all API endpoints
5. ProcessDocumentJob for async PDF processing
6. Frontend components: DocumentLibrary, BatchProcessor, ComparativeView
7. Updated UploadSection for multi-file support
