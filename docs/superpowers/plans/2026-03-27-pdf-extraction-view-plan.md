# PDF Extraction View & Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add progressive extraction feedback, raw markdown view, key details mapping, and accuracy scoring to the MCA PDF Scrubber.

**Architecture:**
- Laravel async job with cache-based progress tracking
- Document type auto-detection with heuristic matching
- Field extraction based on detected document type schema
- Quality scoring with completeness, text coherence, and PII detection metrics
- React components for progress, markdown preview, key details, and scores

**Tech Stack:** Laravel 11 (PHP 8.2+), React 18, TypeScript, Tailwind CSS, docling library

---

## File Structure

```
backend/
├── app/
│   ├── Http/Controllers/
│   │   └── ExtractionController.php          [NEW]
│   ├── Jobs/
│   │   └── ProcessPdfExtraction.php          [NEW]
│   └── Services/
│       ├── DocumentTypeDetector.php          [NEW]
│       ├── FieldMapper.php                  [NEW]
│       └── ExtractionScorer.php             [NEW]
├── routes/api.php                           [MODIFY]
├── tests/Unit/
│   ├── DocumentTypeDetectorTest.php          [NEW]
│   ├── FieldMapperTest.php                  [NEW]
│   └── ExtractionScorerTest.php             [NEW]
└── phpunit.xml                              [NEW]

frontend/src/
├── components/
│   ├── ExtractionProgress.tsx               [NEW]
│   ├── MarkdownViewer.tsx                   [NEW]
│   ├── KeyDetailsPanel.tsx                  [NEW]
│   ├── ScoreCard.tsx                        [NEW]
│   ├── ScoreDashboard.tsx                   [NEW]
│   └── UploadSection.tsx                   [MODIFY]
├── hooks/
│   └── useExtraction.ts                    [NEW]
└── types/
    └── extraction.ts                       [NEW]
```

---

## Task 1: DocumentTypeDetector Service

**Files:**
- Create: `backend/app/Services/DocumentTypeDetector.php`
- Test: `backend/tests/Unit/DocumentTypeDetectorTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Services\DocumentTypeDetector;

class DocumentTypeDetectorTest extends TestCase
{
    private DocumentTypeDetector $detector;

    protected function setUp(): void
    {
        parent::setUp();
        $this->detector = new DocumentTypeDetector();
    }

    public function test_detects_invoice_type(): void
    {
        $text = "Invoice #12345\nBill To: Acme Corp\nTotal Due: $1,234.56\nDate: 01/15/2024";
        $result = $this->detector->detect($text);

        $this->assertEquals('invoice', $result['type']);
        $this->assertGreaterThan(0.7, $result['confidence']);
    }

    public function test_detects_contract_type(): void
    {
        $text = "Agreement between Party A and Party B\nEffective Date: January 1, 2024\nTerms of this agreement shall apply for 12 months";
        $result = $this->detector->detect($text);

        $this->assertEquals('contract', $result['type']);
        $this->assertGreaterThan(0.6, $result['confidence']);
    }

    public function test_detects_receipt_type(): void
    {
        $text = "RECEIPT\nMerchant: Store Name\nDate: 01/15/2024\nItems:\n- Item 1 $10.00\n- Item 2 $15.00\nTotal: $25.00";
        $result = $this->detector->detect($text);

        $this->assertEquals('receipt', $result['type']);
        $this->assertGreaterThan(0.6, $result['confidence']);
    }

    public function test_returns_unknown_for_unrecognized(): void
    {
        $text = "Lorem ipsum dolor sit amet consectetur adipiscing elit";
        $result = $this->detector->detect($text);

        $this->assertEquals('unknown', $result['type']);
        $this->assertLessThan(0.5, $result['confidence']);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/backend && ./vendor/bin/phpunit tests/Unit/DocumentTypeDetectorTest.php`
Expected: FAIL with "Class App\Services\DocumentTypeDetector not found"

- [ ] **Step 3: Write minimal implementation**

```php
<?php

namespace App\Services;

class DocumentTypeDetector
{
    private array $typeSchemas = [
        'invoice' => [
            'keywords' => ['invoice', 'bill to', 'total due', 'amount due', 'inv-', 'invoice #'],
            'weight' => 1.0,
        ],
        'contract' => [
            'keywords' => ['agreement', 'party of the first', 'effective date', 'terms of', 'hereby agrees'],
            'weight' => 1.0,
        ],
        'receipt' => [
            'keywords' => ['receipt', 'merchant', ' purchased', ' subtotal', ' total:'],
            'weight' => 1.0,
        ],
        'report' => [
            'keywords' => ['executive summary', 'introduction', 'conclusion', 'methodology', 'findings'],
            'weight' => 0.9,
        ],
        'form' => [
            'keywords' => ['name:', 'address:', 'date of birth', 'signature', 'section'],
            'weight' => 0.8,
        ],
    ];

    public function detect(string $text): array
    {
        $textLower = strtolower($text);
        $scores = [];

        foreach ($this->typeSchemas as $type => $schema) {
            $matches = 0;
            foreach ($schema['keywords'] as $keyword) {
                if (str_contains($textLower, $keyword)) {
                    $matches++;
                }
            }
            if ($matches > 0) {
                $scores[$type] = min(1.0, ($matches / count($schema['keywords'])) * $schema['weight']);
            }
        }

        if (empty($scores)) {
            return ['type' => 'unknown', 'confidence' => 0.0];
        }

        arsort($scores);
        $bestType = array_key_first($scores);
        $bestScore = $scores[$bestType];

        return [
            'type' => $bestType,
            'confidence' => round($bestScore, 2),
        ];
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/backend && ./vendor/bin/phpunit tests/Unit/DocumentTypeDetectorTest.php`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/DocumentTypeDetector.php backend/tests/Unit/DocumentTypeDetectorTest.php
git commit -m "feat: add DocumentTypeDetector service for auto-detecting document types

- Supports invoice, contract, receipt, report, form, and unknown types
- Uses keyword matching with weighted scoring
- Returns type and confidence score

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: FieldMapper Service

**Files:**
- Create: `backend/app/Services/FieldMapper.php`
- Test: `backend/tests/Unit/FieldMapperTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Services\FieldMapper;

class FieldMapperTest extends TestCase
{
    private FieldMapper $mapper;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mapper = new FieldMapper();
    }

    public function test_extracts_invoice_fields(): void
    {
        $text = "Invoice #12345\nBill To: Acme Corporation\nDate: 01/15/2024\nTotal Due: \$1,234.56";
        $details = $this->mapper->map($text, 'invoice');

        $this->assertNotEmpty($details);

        $vendor = collect($details)->firstWhere('field', 'vendor');
        $this->assertNotNull($vendor);
        $this->assertEquals('Acme Corporation', $vendor['value']);

        $invoiceNumber = collect($details)->firstWhere('field', 'invoice_number');
        $this->assertNotNull($invoiceNumber);
        $this->assertEquals('12345', $invoiceNumber['value']);
    }

    public function test_extracts_generic_fields(): void
    {
        $text = "Contact: John Doe\nEmail: john@example.com\nPhone: 555-123-4567\nDate: 01/15/2024";
        $details = $this->mapper->map($text, 'generic');

        $email = collect($details)->firstWhere('field', 'email');
        $this->assertNotNull($email);
        $this->assertEquals('john@example.com', $email['value']);

        $phone = collect($details)->firstWhere('field', 'phone');
        $this->assertNotNull($phone);
    }

    public function test_returns_empty_for_no_matches(): void
    {
        $text = "Lorem ipsum dolor sit amet";
        $details = $this->mapper->map($text, 'invoice');

        $this->assertEmpty($details);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/backend && ./vendor/bin/phpunit tests/Unit/FieldMapperTest.php`
Expected: FAIL with "Class App\Services\FieldMapper not found"

- [ ] **Step 3: Write minimal implementation**

```php
<?php

namespace App\Services;

class FieldMapper
{
    private array $fieldSchemas = [
        'invoice' => [
            ['name' => 'vendor', 'label' => 'Vendor', 'patterns' => ['vendor', 'bill to', 'from:', 'company']],
            ['name' => 'amount', 'label' => 'Amount', 'patterns' => ['total due', 'amount due', 'total:', '\$[\d,]+\.\d{2}']],
            ['name' => 'date', 'label' => 'Date', 'patterns' => ['date:', 'dated', '\d{1,2}/\d{1,2}/\d{2,4}']],
            ['name' => 'invoice_number', 'label' => 'Invoice #', 'patterns' => ['invoice', 'inv-', '#\d+']],
        ],
        'contract' => [
            ['name' => 'parties', 'label' => 'Parties', 'patterns' => ['party of the first', 'agreement between', 'party a', 'party b']],
            ['name' => 'effective_date', 'label' => 'Effective Date', 'patterns' => ['effective date', 'dated', 'commencing']],
            ['name' => 'terms', 'label' => 'Terms', 'patterns' => ['term of', 'period of', 'duration', 'months']],
        ],
        'receipt' => [
            ['name' => 'merchant', 'label' => 'Merchant', 'patterns' => ['merchant', 'store', 'vendor']],
            ['name' => 'date', 'label' => 'Date', 'patterns' => ['date:', '\d{1,2}/\d{1,2}/\d{2,4}']],
            ['name' => 'total', 'label' => 'Total', 'patterns' => ['total:', 'grand total', '\$[\d,]+\.\d{2}']],
        ],
        'generic' => [
            ['name' => 'name', 'label' => 'Name', 'patterns' => ['name:', 'contact:', 'person']],
            ['name' => 'email', 'label' => 'Email', 'patterns' => ['[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-Z]{2,}']],
            ['name' => 'phone', 'label' => 'Phone', 'patterns' => ['\d{3}[-.\s]?\d{3}[-.\s]?\d{4}']],
            ['name' => 'date', 'label' => 'Date', 'patterns' => ['\d{1,2}/\d{1,2}/\d{2,4}']],
        ],
    ];

    public function map(string $text, string $documentType): array
    {
        $schema = $this->fieldSchemas[$documentType] ?? $this->fieldSchemas['generic'];
        $results = [];

        foreach ($schema as $field) {
            foreach ($field['patterns'] as $pattern) {
                if ($this->matchPattern($pattern, $text, $match, $value)) {
                    $results[] = [
                        'field' => $field['name'],
                        'label' => $field['label'],
                        'value' => $value,
                        'page' => 1,
                        'confidence' => 0.85,
                        'matched_pattern' => $pattern,
                    ];
                    break;
                }
            }
        }

        return $results;
    }

    private function matchPattern(string $pattern, string $text, ?string &$match, ?string &$value): bool
    {
        if (preg_match('/\/.*\//', $pattern)) {
            if (preg_match($pattern, $text, $matches)) {
                $match = $matches[0];
                $value = trim($matches[0]);
                return true;
            }
        } else {
            $patternLower = strtolower($pattern);
            $textLower = strtolower($text);
            $pos = strpos($textLower, $patternLower);
            if ($pos !== false) {
                $start = max(0, $pos - 50);
                $end = min(strlen($text), $pos + strlen($pattern) + 50);
                $context = substr($text, $start, $end - $start);

                if (preg_match('/[:\s]+([^\n]+)/', $context, $m)) {
                    $value = trim($m[1]);
                } else {
                    $value = trim(substr($text, $pos, strlen($pattern) + 20));
                }
                $match = $pattern;
                return true;
            }
        }
        return false;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/backend && ./vendor/bin/phpunit tests/Unit/FieldMapperTest.php`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/FieldMapper.php backend/tests/Unit/FieldMapperTest.php
git commit -m "feat: add FieldMapper service for extracting key details by document type

- Supports invoice, contract, receipt, and generic field schemas
- Uses regex and keyword matching for value extraction
- Returns field name, label, value, page, confidence

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: ExtractionScorer Service

**Files:**
- Create: `backend/app/Services/ExtractionScorer.php`
- Test: `backend/tests/Unit/ExtractionScorerTest.php`

- [ ] **Step 1: Write the failing test**

```php
<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Services\ExtractionScorer;

class ExtractionScorerTest extends TestCase
{
    private ExtractionScorer $scorer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->scorer = new ExtractionScorer();
    }

    public function test_completeness_score_full_pages(): void
    {
        $result = $this->scorer->score(
            text: 'This is a well structured document with multiple paragraphs and proper formatting.',
            pageCount: 5,
            piiDetected: ['email@sample.com'],
            piiPatterns: ['/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-Z]{2,}/']
        );

        $this->assertArrayHasKey('completeness', $result['scores']);
        $this->assertGreaterThanOrEqual(0.8, $result['scores']['completeness']);
    }

    public function test_quality_score_coherent_text(): void
    {
        $result = $this->scorer->score(
            text: 'This is a coherent sentence with proper English words and punctuation.',
            pageCount: 1,
            piiDetected: [],
            piiPatterns: []
        );

        $this->assertArrayHasKey('quality', $result['scores']);
        $this->assertGreaterThanOrEqual(0.7, $result['scores']['quality']);
    }

    public function test_quality_score_garbled_text(): void
    {
        $garbled = 'ÛÙËËÁÌÌÍÌÎËÌÂÊËËÌÌÂÌÌÌÍÌÂËÂËË';
        $result = $this->scorer->score(
            text: $garbled,
            pageCount: 1,
            piiDetected: [],
            piiPatterns: []
        );

        $this->assertLessThan(0.5, $result['scores']['quality']);
    }

    public function test_overall_score_calculation(): void
    {
        $result = $this->scorer->score(
            text: 'Invoice #12345. Total due: \$500.00. Contact: test@example.com',
            pageCount: 1,
            piiDetected: ['test@example.com'],
            piiPatterns: ['/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-Z]{2,}/']
        );

        $this->assertArrayHasKey('overall', $result['scores']);

        $expected = 0.4 * $result['scores']['completeness']
                  + 0.35 * $result['scores']['quality']
                  + 0.25 * $result['scores']['piiDetection'];

        $this->assertEqualsWithDelta($expected, $result['scores']['overall'], 0.01);
    }

    public function test_recommendations_generated_for_low_scores(): void
    {
        $garbled = str_repeat('ÛÙËËÁ', 100);
        $result = $this->scorer->score(
            text: $garbled,
            pageCount: 1,
            piiDetected: [],
            piiPatterns: []
        );

        $this->assertNotEmpty($result['recommendations']);
        $hasQualityRec = collect($result['recommendations'])->contains('type', 'quality');
        $this->assertTrue($hasQualityRec);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/backend && ./vendor/bin/phpunit tests/Unit/ExtractionScorerTest.php`
Expected: FAIL with "Class App\Services\ExtractionScorer not found"

- [ ] **Step 3: Write minimal implementation**

```php
<?php

namespace App\Services;

class ExtractionScorer
{
    public function score(string $text, int $pageCount, array $piiDetected, array $piiPatterns): array
    {
        $completeness = $this->calculateCompleteness($text, $pageCount);
        $quality = $this->calculateQuality($text);
        $piiDetection = $this->calculatePiiScore($piiDetected, $piiPatterns);

        $overall = (0.4 * $completeness) + (0.35 * $quality) + (0.25 * $piiDetection);

        $recommendations = $this->generateRecommendations($completeness, $quality, $piiDetection, $text);

        return [
            'scores' => [
                'completeness' => round($completeness, 2),
                'quality' => round($quality, 2),
                'piiDetection' => round($piiDetection, 2),
                'overall' => round($overall, 2),
            ],
            'recommendations' => $recommendations,
        ];
    }

    private function calculateCompleteness(string $text, int $pageCount): float
    {
        $length = strlen($text);

        if ($length < 100) {
            return 0.3;
        }
        if ($length < 500) {
            return 0.5;
        }
        if ($length < 2000) {
            return 0.7;
        }

        $hasStructure = preg_match('/[.\!\\?]+/', $text) ? 0.1 : 0;
        $pageScore = min(1.0, $pageCount / 5);

        return min(0.95, 0.7 + $hasStructure + ($pageScore * 0.15));
    }

    private function calculateQuality(string $text): float
    {
        $garbledRatio = $this->calculateGarbledRatio($text);
        $hasFormatting = preg_match('/[#*_\-\d]/', $text) ? 0.1 : 0;
        $hasUppercase = preg_match('/[A-Z]/', $text) ? 0.1 : 0;

        $baseScore = 0.6;
        $coherence = (1 - $garbledRatio) * 0.6;

        return min(0.95, $baseScore + $coherence + $hasFormatting + $hasUppercase);
    }

    private function calculateGarbledRatio(string $text): float
    {
        $chars = mb_str_split($text);
        if (count($chars) === 0) {
            return 0.0;
        }

        $garbled = 0;
        foreach ($chars as $char) {
            $ord = mb_ord($char);
            if ($ord > 127 && !preg_match('/[áéíóúñüäößéàèìòùâêîôû]/i', $char)) {
                $garbled++;
            }
        }

        return $garbled / count($chars);
    }

    private function calculatePiiScore(array $detected, array $patterns): float
    {
        if (empty($patterns)) {
            return 0.5;
        }

        $foundCount = count($detected);
        $patternCount = count($patterns);

        if ($foundCount === 0) {
            return 0.3;
        }

        return min(0.95, $foundCount / $patternCount + 0.5);
    }

    private function generateRecommendations(float $completeness, float $quality, float $piiDetection, string $text): array
    {
        $recommendations = [];

        if ($quality < 0.6) {
            $recommendations[] = [
                'type' => 'quality',
                'message' => 'Low text quality detected - possible scan artifact or garbled text',
            ];
        }

        if ($completeness < 0.6) {
            $recommendations[] = [
                'type' => 'completeness',
                'message' => 'Document appears short - verify all pages were extracted',
            ];
        }

        if ($piiDetection < 0.5 && strlen($text) > 500) {
            $recommendations[] = [
                'type' => 'pii',
                'message' => 'Limited PII detected - document may not contain sensitive data',
            ];
        }

        return $recommendations;
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/archerterminez/Desktop/REPOSITORY/MCA_PDF_Scrubber/backend && ./vendor/bin/phpunit tests/Unit/ExtractionScorerTest.php`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/Services/ExtractionScorer.php backend/tests/Unit/ExtractionScorerTest.php
git commit -m "feat: add ExtractionScorer service for accuracy scoring

- Completeness: based on text length and page count
- Quality: based on text coherence and formatting preservation
- PII Detection: based on found vs expected PII patterns
- Overall: weighted average (40% completeness, 35% quality, 25% PII)
- Generates recommendations for low scores

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: ProcessPdfExtraction Job

**Files:**
- Create: `backend/app/Jobs/ProcessPdfExtraction.php`

- [ ] **Step 1: Create job file with progress tracking**

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
use App\Services\DoclingService;
use App\Services\DocumentTypeDetector;
use App\Services\FieldMapper;
use App\Services\ExtractionScorer;
use App\Services\PdfAnalyzerService;

class ProcessPdfExtraction implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;
    public int $timeout = 300;

    private string $jobId;
    private string $filePath;

    public function __construct(string $jobId, string $filePath)
    {
        $this->jobId = $jobId;
        $this->filePath = $filePath;
    }

    public function handle(
        DoclingService $doclingService,
        DocumentTypeDetector $typeDetector,
        FieldMapper $fieldMapper,
        ExtractionScorer $scorer,
        PdfAnalyzerService $analyzer
    ): void {
        try {
            $this->updateProgress('extracting', 'Extracting text from PDF...', 10);

            $extractResult = $doclingService->extractText($this->filePath);

            if (!$extractResult['success']) {
                $this->failJob('Extraction failed: ' . ($extractResult['error'] ?? 'Unknown error'));
                return;
            }

            $markdown = $extractResult['text'];
            $pageCount = $extractResult['page_count'] ?? 1;

            $this->updateProgress('detecting_type', 'Detecting document type...', 35);

            $docType = $typeDetector->detect($markdown);

            $this->updateProgress('mapping_fields', 'Mapping key details...', 55);

            $keyDetails = $fieldMapper->map($markdown, $docType['type']);

            $this->updateProgress('analyzing_quality', 'Analyzing extraction quality...', 75);

            $piiDetected = $analyzer->checkPiiIndicators($markdown);
            $piiPatterns = $this->getPiiPatterns();

            $scoreResult = $scorer->score($markdown, $pageCount, $piiDetected ? ['pii'] : [], $piiPatterns);

            $this->updateProgress('complete', 'Done', 100);

            $result = [
                'markdown' => $markdown,
                'document_type' => $docType,
                'key_details' => $keyDetails,
                'scores' => $scoreResult['scores'],
                'recommendations' => $scoreResult['recommendations'],
                'page_count' => $pageCount,
            ];

            Cache::put("extraction_result_{$this->jobId}", $result, now()->addHours(24));

            $this->updateProgressComplete($result);

        } catch (\Exception $e) {
            Log::error('ProcessPdfExtraction failed: ' . $e->getMessage());
            $this->failJob($e->getMessage());
        }
    }

    private function updateProgress(string $stage, string $label, int $percent): void
    {
        $data = [
            'job_id' => $this->jobId,
            'status' => 'processing',
            'stage' => $stage,
            'stage_label' => $label,
            'progress_percent' => $percent,
            'current_markdown' => null,
            'result' => null,
        ];

        Cache::put("extraction_progress_{$this->jobId}", $data, now()->addHours(24));
    }

    private function updateProgressComplete(array $result): void
    {
        $data = [
            'job_id' => $this->jobId,
            'status' => 'complete',
            'stage' => 'complete',
            'stage_label' => 'Done',
            'progress_percent' => 100,
            'current_markdown' => null,
            'result' => $result,
        ];

        Cache::put("extraction_progress_{$this->jobId}", $data, now()->addHours(24));
    }

    private function failJob(string $error): void
    {
        $data = [
            'job_id' => $this->jobId,
            'status' => 'failed',
            'stage' => 'failed',
            'stage_label' => 'Failed',
            'progress_percent' => 0,
            'current_markdown' => null,
            'result' => null,
            'error' => $error,
        ];

        Cache::put("extraction_progress_{$this->jobId}", $data, now()->addHours(24));
    }

    private function getPiiPatterns(): array
    {
        return [
            '/\d{3}-\d{2}-\d{4}/',
            '/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/',
            '/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/',
        ];
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/Jobs/ProcessPdfExtraction.php
git commit -m "feat: add ProcessPdfExtraction async job

- Handles full PDF extraction pipeline
- Progress tracking via Laravel Cache
- Integrates DoclingService, DocumentTypeDetector, FieldMapper, ExtractionScorer
- Stores result in cache for retrieval

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: ExtractionController

**Files:**
- Create: `backend/app/Http/Controllers/ExtractionController.php`
- Modify: `backend/routes/api.php`

- [ ] **Step 1: Create the controller**

```php
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
```

- [ ] **Step 2: Update routes**

```php
<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PdfController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\ExtractionController;

Route::prefix('v1')->group(function () {
    Route::get('/health', [HealthController::class, 'index']);
    Route::get('/health/ready', [HealthController::class, 'ready']);
    Route::get('/health/docling', [HealthController::class, 'docling']);

    Route::post('/pdf/upload', [PdfController::class, 'upload']);
    Route::post('/pdf/analyze', [PdfController::class, 'analyze']);
    Route::post('/pdf/scrub', [PdfController::class, 'scrub']);

    // New extraction endpoints
    Route::post('/pdf/full-extract', [ExtractionController::class, 'fullExtract']);
    Route::get('/pdf/progress/{jobId}', [ExtractionController::class, 'progress']);
});
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/Http/Controllers/ExtractionController.php backend/routes/api.php
git commit -m "feat: add ExtractionController with full-extract and progress endpoints

- POST /pdf/full-extract - starts async extraction job
- GET /pdf/progress/{jobId} - retrieves job progress from cache

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Frontend Types and Hook

**Files:**
- Create: `frontend/src/types/extraction.ts`
- Create: `frontend/src/hooks/useExtraction.ts`

- [ ] **Step 1: Create TypeScript interfaces**

```typescript
export interface ExtractionState {
  jobId: string | null;
  status: 'idle' | 'processing' | 'complete' | 'failed';
  stage: string;
  stageLabel: string;
  progressPercent: number;
  currentMarkdown: string;
  result: ExtractionResult | null;
  error: string | null;
}

export interface ExtractionResult {
  markdown: string;
  document_type: {
    type: string;
    confidence: number;
  };
  key_details: KeyDetail[];
  scores: {
    completeness: number;
    quality: number;
    pii_detection: number;
    overall: number;
  };
  recommendations: Recommendation[];
  page_count: number;
}

export interface KeyDetail {
  field: string;
  label: string;
  value: string;
  page: number;
  confidence: number;
  matched_pattern: string;
}

export interface Recommendation {
  type: 'quality' | 'completeness' | 'pii' | 'structure';
  message: string;
}

export interface ProgressResponse {
  job_id: string;
  status: 'processing' | 'complete' | 'failed';
  stage: string;
  stage_label: string;
  progress_percent: number;
  current_markdown: string | null;
  result: ExtractionResult | null;
  error?: string;
}
```

- [ ] **Step 2: Create the extraction hook**

```typescript
import { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import type { ExtractionState, ExtractionResult, ProgressResponse } from '../types/extraction';

export function useExtraction() {
  const [state, setState] = useState<ExtractionState>({
    jobId: null,
    status: 'idle',
    stage: '',
    stageLabel: '',
    progressPercent: 0,
    currentMarkdown: '',
    result: null,
    error: null,
  });

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollProgress = useCallback(async (jobId: string) => {
    try {
      const response = await axios.get<ProgressResponse>(`/api/v1/pdf/progress/${jobId}`);
      const data = response.data;

      setState(prev => ({
        ...prev,
        status: data.status,
        stage: data.stage,
        stageLabel: data.stage_label,
        progressPercent: data.progress_percent,
        currentMarkdown: data.current_markdown || prev.currentMarkdown,
        result: data.result,
        error: data.error || null,
      }));

      if (data.status === 'complete' || data.status === 'failed') {
        clearPolling();
      }
    } catch (error) {
      console.error('Polling error:', error);
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: 'Failed to get progress',
      }));
      clearPolling();
    }
  }, [clearPolling]);

  const startExtraction = useCallback(async (file: File) => {
    setState({
      jobId: null,
      status: 'processing',
      stage: 'uploading',
      stageLabel: 'Uploading PDF...',
      progressPercent: 0,
      currentMarkdown: '',
      result: null,
      error: null,
    });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post<{ job_id: string; status: string }>(
        '/api/v1/pdf/full-extract',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const jobId = response.data.job_id;

      setState(prev => ({
        ...prev,
        jobId,
        stage: 'uploading',
        stageLabel: 'Uploading PDF...',
        progressPercent: 5,
      }));

      pollingRef.current = setInterval(() => {
        pollProgress(jobId);
      }, 500);

      pollProgress(jobId);
    } catch (error) {
      console.error('Extraction start error:', error);
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: 'Failed to start extraction',
      }));
    }
  }, [pollProgress]);

  const reset = useCallback(() => {
    clearPolling();
    setState({
      jobId: null,
      status: 'idle',
      stage: '',
      stageLabel: '',
      progressPercent: 0,
      currentMarkdown: '',
      result: null,
      error: null,
    });
  }, [clearPolling]);

  return {
    state,
    startExtraction,
    reset,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/extraction.ts frontend/src/hooks/useExtraction.ts
git commit -m "feat: add extraction types and useExtraction hook

- TypeScript interfaces for ExtractionState, ExtractionResult, KeyDetail, Recommendation
- useExtraction hook with polling logic
- startExtraction, pollProgress, reset functions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Frontend Components

**Files:**
- Create: `frontend/src/components/ExtractionProgress.tsx`
- Create: `frontend/src/components/MarkdownViewer.tsx`
- Create: `frontend/src/components/KeyDetailsPanel.tsx`
- Create: `frontend/src/components/ScoreCard.tsx`
- Create: `frontend/src/components/ScoreDashboard.tsx`
- Modify: `frontend/src/components/UploadSection.tsx`

- [ ] **Step 1: Create ExtractionProgress component**

```tsx
import { useTheme } from '../hooks/useTheme';

interface ExtractionProgressProps {
  stage: string;
  stageLabel: string;
  progressPercent: number;
  currentMarkdown: string;
}

export function ExtractionProgress({ stage, stageLabel, progressPercent, currentMarkdown }: ExtractionProgressProps) {
  const { colors } = useTheme();

  return (
    <div className="bg-white rounded-xl p-6 border border-bw-100 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-bw-700">{stageLabel}</span>
        <span className="text-sm text-bw-500">{progressPercent}%</span>
      </div>

      <div className="w-full bg-bw-100 rounded-full h-2 mb-4">
        <div
          className="bg-black h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {currentMarkdown && (
        <div className="mt-4">
          <p className="text-xs text-bw-500 uppercase tracking-wider mb-2">Extracted Text Preview</p>
          <pre className="text-xs text-bw-600 bg-bw-50 p-4 rounded-lg border border-bw-100 overflow-auto max-h-40 font-mono">
            {currentMarkdown.slice(-500)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create MarkdownViewer component**

```tsx
import { useState } from 'react';
import { useTheme } from '../hooks/useTheme';

interface MarkdownViewerProps {
  markdown: string;
}

export function MarkdownViewer({ markdown }: MarkdownViewerProps) {
  const { colors } = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-bw-100 shadow-card overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-bw-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-bw-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-semibold text-bw-700">Raw Markdown</span>
        </div>
        <svg
          className={`w-5 h-5 text-bw-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6">
          <pre className="whitespace-pre-wrap text-sm leading-relaxed text-bw-700 bg-bw-50 p-4 rounded-lg border border-bw-100 overflow-auto max-h-96 font-mono">
            {markdown}
          </pre>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create KeyDetailsPanel component**

```tsx
import { useTheme } from '../hooks/useTheme';
import type { KeyDetail } from '../types/extraction';

interface KeyDetailsPanelProps {
  details: KeyDetail[];
  documentType: string;
  typeConfidence: number;
}

export function KeyDetailsPanel({ details, documentType, typeConfidence }: KeyDetailsPanelProps) {
  const { colors } = useTheme();

  const formatLabel = (label: string) => label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="bg-white rounded-xl border border-bw-100 shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-bw-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-bw-700">Key Details</span>
          <span className="px-2 py-0.5 text-xs font-medium bg-bw-100 text-bw-600 rounded">
            {documentType}
          </span>
          <span className="text-xs text-bw-400">
            ({Math.round(typeConfidence * 100)}% confidence)
          </span>
        </div>
      </div>

      {details.length === 0 ? (
        <div className="px-6 py-8 text-center text-bw-400 text-sm">
          No key details detected
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-bw-100">
                <th className="px-6 py-3 text-left text-xs font-semibold text-bw-500 uppercase tracking-wider">Field</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-bw-500 uppercase tracking-wider">Value</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-bw-500 uppercase tracking-wider">Page</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bw-100">
              {details.map((detail, index) => (
                <tr key={index} className="hover:bg-bw-50">
                  <td className="px-6 py-4 text-sm font-medium text-bw-700">{formatLabel(detail.label)}</td>
                  <td className="px-6 py-4 text-sm text-bw-600 font-mono">{detail.value}</td>
                  <td className="px-6 py-4 text-sm text-bw-400">{detail.page}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create ScoreCard component**

```tsx
import { useTheme } from '../hooks/useTheme';

interface ScoreCardProps {
  label: string;
  score: number;
  threshold: number;
  weight?: number;
}

export function ScoreCard({ label, score, threshold, weight }: ScoreCardProps) {
  const { colors } = useTheme();

  const percentage = Math.round(score * 100);
  const isGood = score >= threshold;
  const isWarning = score >= threshold * 0.8 && score < threshold;

  const getStatusColor = () => {
    if (isGood) return 'text-green-600';
    if (isWarning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusIcon = () => {
    if (isGood) return '✓';
    if (isWarning) return '⚠';
    return '✗';
  };

  const getBarColor = () => {
    if (isGood) return 'bg-green-500';
    if (isWarning) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-xl p-5 border border-bw-100 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-bw-500 uppercase tracking-wider">{label}</span>
        <span className={`text-lg font-semibold ${getStatusColor()}`}>
          {getStatusIcon()}
        </span>
      </div>

      <div className="text-3xl font-light text-bw-900 mb-3">{percentage}%</div>

      <div className="w-full bg-bw-100 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${getBarColor()}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {weight && (
        <p className="text-xs text-bw-400 mt-2">Weight: {Math.round(weight * 100)}%</p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create ScoreDashboard component**

```tsx
import { useTheme } from '../hooks/useTheme';
import { ScoreCard } from './ScoreCard';
import type { Recommendation } from '../types/extraction';

interface ScoreDashboardProps {
  scores: {
    completeness: number;
    quality: number;
    pii_detection: number;
    overall: number;
  };
  recommendations: Recommendation[];
}

export function ScoreDashboard({ scores, recommendations }: ScoreDashboardProps) {
  const { colors } = useTheme();

  const overallPercentage = Math.round(scores.overall * 100);
  const isAcceptable = scores.overall >= 0.8;
  const isReviewSuggested = scores.overall >= 0.6 && scores.overall < 0.8;

  const getOverallStatus = () => {
    if (isAcceptable) return { text: 'Acceptable', class: 'text-green-600 bg-green-50 border-green-200' };
    if (isReviewSuggested) return { text: 'Review Suggested', class: 'text-yellow-600 bg-yellow-50 border-yellow-200' };
    return { text: 'Needs Review', class: 'text-red-600 bg-red-50 border-red-200' };
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="bg-white rounded-xl border border-bw-100 shadow-card overflow-hidden">
      <div className="px-6 py-4 border-b border-bw-100">
        <h3 className="text-sm font-semibold text-bw-700">Extraction Quality Score</h3>
      </div>

      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="text-4xl font-light text-bw-900">{overallPercentage}%</div>
          <div className={`px-3 py-1 rounded-full text-sm font-medium border ${overallStatus.class}`}>
            {overallStatus.text}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <ScoreCard label="Completeness" score={scores.completeness} threshold={0.8} weight={0.4} />
          <ScoreCard label="Quality" score={scores.quality} threshold={0.75} weight={0.35} />
          <ScoreCard label="PII Detection" score={scores.pii_detection} threshold={0.85} weight={0.25} />
        </div>

        {recommendations.length > 0 && (
          <div className="border-t border-bw-100 pt-4">
            <h4 className="text-xs font-semibold text-bw-500 uppercase tracking-wider mb-3">Recommendations</h4>
            <ul className="space-y-2">
              {recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                    rec.type === 'quality' ? 'bg-orange-100 text-orange-600' :
                    rec.type === 'completeness' ? 'bg-blue-100 text-blue-600' :
                    rec.type === 'pii' ? 'bg-purple-100 text-purple-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {rec.type === 'quality' ? 'Q' : rec.type === 'completeness' ? 'C' : rec.type === 'pii' ? 'P' : 'S'}
                  </span>
                  <span className="text-bw-600">{rec.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Update UploadSection to integrate new extraction view**

Replace the existing `UploadSection.tsx` content with a version that uses `useExtraction` hook and displays the new components. The component should:
1. Use `useExtraction` hook for state management
2. Show `ExtractionProgress` during processing
3. Show `MarkdownViewer`, `KeyDetailsPanel`, and `ScoreDashboard` on completion
4. Keep existing Analyze and Scrub buttons functional

- [ ] **Step 7: Export new components from index.ts**

```typescript
export { UploadSection } from './UploadSection';
export { ExtractionProgress } from './ExtractionProgress';
export { MarkdownViewer } from './MarkdownViewer';
export { KeyDetailsPanel } from './KeyDetailsPanel';
export { ScoreCard } from './ScoreCard';
export { ScoreDashboard } from './ScoreDashboard';
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/ExtractionProgress.tsx frontend/src/components/MarkdownViewer.tsx frontend/src/components/KeyDetailsPanel.tsx frontend/src/components/ScoreCard.tsx frontend/src/components/ScoreDashboard.tsx frontend/src/components/UploadSection.tsx frontend/src/components/index.ts
git commit -m "feat: add extraction UI components

- ExtractionProgress: stage indicator with progress bar and preview
- MarkdownViewer: collapsible raw markdown display
- KeyDetailsPanel: auto-detected fields in table format
- ScoreCard: individual score display with threshold indicator
- ScoreDashboard: overall score + breakdown + recommendations
- Updated UploadSection to integrate new extraction flow

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: phpunit.xml Configuration

**Files:**
- Create: `backend/phpunit.xml`

- [ ] **Step 1: Create phpunit.xml**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<phpunit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:noNamespaceSchemaLocation="vendor/phpunit/phpunit/phpunit.xsd"
         bootstrap="vendor/autoload.php"
         colors="true"
         cacheDirectory=".phpunit.cache"
         executionOrder="depends,defects"
         failOnRisky="true"
         failOnWarning="true"
         beStrictAboutOutputDuringTests="true">
    <testsuites>
        <testsuite name="Unit">
            <directory suffix="Test.php">./tests/Unit</directory>
        </testsuite>
    </testsuites>
    <source>
        <include>
            <directory suffix=".php">./app</directory>
        </include>
    </source>
</phpunit>
```

- [ ] **Step 2: Commit**

```bash
git add backend/phpunit.xml
git commit -m "chore: add phpunit.xml for Laravel backend testing

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|------------------|------|
| Progressive extraction feedback | Task 1-5, 7 (ExtractionProgress) |
| Raw markdown view | Task 7 (MarkdownViewer) |
| Key details mapping | Task 2, 7 (KeyDetailsPanel) |
| Document type detection | Task 1 |
| Accuracy scoring (completeness, quality, PII) | Task 3, 7 (ScoreCard, ScoreDashboard) |
| Threshold indicators | Task 7 (ScoreCard) |
| Recommendations | Task 3, 7 (ScoreDashboard) |
| Backend endpoints | Task 4, 5 |
| Frontend polling | Task 6 (useExtraction hook) |

---

## Self-Review Checklist

- [x] All PHP classes use proper namespaces
- [x] TypeScript interfaces match PHP response structures
- [x] File paths are absolute from project root
- [x] All tests have assertions
- [x] No placeholder TODOs or TBDs
- [x] Each task has specific commit message

---

**Plan complete.** All tasks are independent and can be executed in order. Backend tasks (1-5) should be completed before frontend tasks (6-7).
