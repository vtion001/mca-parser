<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Services\McaStandingCalculator;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class CustomerDashboardController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    public function __construct(
        private McaStandingCalculator $standingCalculator
    ) {}

    /**
     * Get dashboard overview
     *
     * GET /api/v1/customer/dashboard
     */
    public function index(Request $request): JsonResponse
    {
        $accountId = $request->attributes->get('account_id') ?? 1;

        // Get total document count
        $totalDocuments = Document::query()
            ->forAccount($accountId)
            ->count();

        // Get documents grouped by status
        $statusCounts = Document::query()
            ->forAccount($accountId)
            ->selectRaw('status, COUNT(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status')
            ->toArray();

        // Get last 5 document summaries
        $recentDocuments = Document::query()
            ->forAccount($accountId)
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get()
            ->map(function ($doc) {
                return [
                    'id' => $doc->id,
                    'filename' => $doc->original_filename ?? $doc->filename,
                    'status' => $doc->status,
                    'document_type' => $doc->document_type,
                    'created_at' => $doc->created_at->toIso8601String(),
                    'balance_summary' => $doc->balances ? [
                        'ending' => $doc->balances['ending_balance']['amount'] ?? null,
                    ] : null,
                    'mca_summary' => isset($doc->mca_findings['summary']) ? [
                        'transactions' => $doc->mca_findings['summary']['total_mca_transactions'] ?? 0,
                        'amount' => $doc->mca_findings['summary']['total_mca_amount'] ?? 0,
                    ] : null,
                ];
            });

        // Calculate MCA standing
        $standingDocuments = Document::query()
            ->forAccount($accountId)
            ->where('status', Document::STATUS_COMPLETE)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        $documentData = $standingDocuments->map(function ($doc) {
            return [
                'id' => $doc->id,
                'balances' => $doc->balances,
                'transaction_classification' => $doc->transaction_classification,
                'mca_findings' => $doc->mca_findings,
                'ai_analysis' => $doc->ai_analysis,
                'created_at' => $doc->created_at,
            ];
        })->toArray();

        $mcaStanding = $this->standingCalculator->calculate($documentData);

        // Generate funding recommendation text
        $recommendationText = $this->getRecommendationText($mcaStanding);

        return response()->json([
            'success' => true,
            'data' => [
                'total_documents' => $totalDocuments,
                'status_breakdown' => [
                    'pending' => $statusCounts['pending'] ?? 0,
                    'processing' => $statusCounts['processing'] ?? 0,
                    'complete' => $statusCounts['complete'] ?? 0,
                    'failed' => $statusCounts['failed'] ?? 0,
                ],
                'recent_documents' => $recentDocuments,
                'mca_standing' => [
                    'eligibility_score' => $mcaStanding['eligibility_score'],
                    'eligibility_level' => $mcaStanding['eligibility_level'],
                    'recommendation' => $recommendationText,
                ],
            ],
        ]);
    }

    /**
     * Generate human-readable recommendation text
     */
    private function getRecommendationText(array $standing): string
    {
        $score = $standing['eligibility_score'];
        $level = $standing['eligibility_level'];
        $factors = $standing['factors'] ?? [];
        $recommendation = $standing['recommendation'] ?? [];

        $concerns = array_filter($factors, fn($f) => $f['indicator'] === 'concern');
        $positives = array_filter($factors, fn($f) => $f['indicator'] === 'positive');

        if ($score >= 80) {
            return 'Excellent funding eligibility. You qualify for maximum funding with competitive rates.';
        }

        if ($score >= 65) {
            if (!empty($positives)) {
                return 'Good standing with strong ' . strtolower($positives[0]['message']) . '. Standard funding terms available.';
            }
            return 'Good funding eligibility. Standard terms and amounts available.';
        }

        if ($score >= 50) {
            $msg = 'Moderate eligibility. ';
            if (!empty($concerns)) {
                $msg .= 'Consider addressing ' . strtolower($concerns[0]['message']) . ' to improve your standing.';
            }
            return $msg;
        }

        if ($score >= 35) {
            return 'Limited eligibility currently. Focus on building cash reserves and reducing existing MCA obligations.';
        }

        return 'Restricted eligibility. Upload additional bank statements and reduce NSF fees to improve your standing.';
    }
}
