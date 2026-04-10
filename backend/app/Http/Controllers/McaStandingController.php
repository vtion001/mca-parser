<?php

namespace App\Http\Controllers;

use App\Models\Document;
use App\Services\McaStandingCalculator;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class McaStandingController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    public function __construct(
        private McaStandingCalculator $standingCalculator
    ) {}

    /**
     * Get MCA standing calculation
     *
     * GET /api/v1/customer/mca-standing
     */
    public function index(Request $request): JsonResponse
    {
        $accountId = $request->attributes->get('account_id') ?? 1;

        // Get completed documents for analysis
        $documents = Document::query()
            ->forAccount($accountId)
            ->where('status', Document::STATUS_COMPLETE)
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        if ($documents->isEmpty()) {
            return response()->json([
                'success' => true,
                'data' => $this->standingCalculator->calculate([]),
                'message' => 'No completed documents found for analysis',
            ]);
        }

        // Transform documents for calculator
        $documentData = $documents->map(function ($doc) {
            return [
                'id' => $doc->id,
                'balances' => $doc->balances,
                'transaction_classification' => $doc->transaction_classification,
                'mca_findings' => $doc->mca_findings,
                'ai_analysis' => $doc->ai_analysis,
                'created_at' => $doc->created_at,
            ];
        })->toArray();

        $standing = $this->standingCalculator->calculate($documentData);

        return response()->json([
            'success' => true,
            'data' => $standing,
        ]);
    }
}
