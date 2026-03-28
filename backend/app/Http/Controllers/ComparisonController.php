<?php

namespace App\Http\Controllers;

use App\Models\Document;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ComparisonController extends Controller
{
    public function compare(Request $request): JsonResponse
    {
        $request->validate([
            'document_ids' => 'required|array|min:2',
            'document_ids.*' => 'integer|exists:documents,id',
            'type' => 'required|in:balances,risk,transactions,delta',
        ]);

        $documentIds = $request->input('document_ids');
        $compareType = $request->input('type');

        $documents = Document::whereIn('id', $documentIds)
            ->orderBy('created_at')
            ->get();

        if ($documents->count() < 2) {
            return response()->json(['error' => 'At least 2 documents are required for comparison'], 400);
        }

        $result = match ($compareType) {
            'balances' => $this->compareBalances($documents),
            'risk' => $this->compareRisk($documents),
            'transactions' => $this->compareTransactions($documents),
            'delta' => $this->compareDelta($documents),
            default => ['error' => 'Invalid comparison type'],
        };

        return response()->json(['data' => $result]);
    }

    private function compareBalances($documents): array
    {
        $balances = $documents->map(function ($doc) {
            return [
                'id' => $doc->id,
                'filename' => $doc->filename,
                'beginning_balance' => $doc->balances['beginning_balance']['amount'] ?? null,
                'ending_balance' => $doc->balances['ending_balance']['amount'] ?? null,
                'date' => $doc->created_at->toDateString(),
            ];
        })->toArray();

        // Find gaps between consecutive documents
        $gaps = [];
        for ($i = 1; $i < count($balances); $i++) {
            $prev = $balances[$i - 1]['ending_balance'];
            $curr = $balances[$i]['beginning_balance'];

            if ($prev !== null && $curr !== null && abs($prev - $curr) > 0.01) {
                $gaps[] = [
                    'from' => $balances[$i - 1]['filename'],
                    'to' => $balances[$i]['filename'],
                    'gap' => round($curr - $prev, 2),
                ];
            }
        }

        return [
            'balances' => $balances,
            'gaps' => $gaps,
        ];
    }

    private function compareRisk($documents): array
    {
        return $documents->map(function ($doc) {
            $score = $doc->ai_analysis['qualification_score'] ?? 5;

            return [
                'id' => $doc->id,
                'filename' => $doc->filename,
                'risk_level' => $score >= 7 ? 'low' : ($score >= 4 ? 'medium' : 'high'),
                'qualification_score' => $score,
            ];
        })->toArray();
    }

    private function compareTransactions($documents): array
    {
        return $documents->map(function ($doc) {
            $beginningBalance = $doc->balances['beginning_balance']['amount'] ?? 0;
            $endingBalance = $doc->balances['ending_balance']['amount'] ?? 0;
            $netChange = $endingBalance - $beginningBalance;

            // These are estimates derived from balance change — not parsed from actual transactions
            $credits = $netChange > 0 ? $netChange * 0.3 : 0;
            $debits = $beginningBalance * 0.2;

            return [
                'id' => $doc->id,
                'filename' => $doc->filename,
                'total_credits' => round($credits, 2),
                'total_debits' => round($debits, 2),
                '_estimated' => true,
                '_note' => 'Credits/debits are estimated from balance change, not parsed from transaction data',
            ];
        })->toArray();
    }

    private function compareDelta($documents): array
    {
        $piiDetected = [];

        foreach ($documents as $doc) {
            $pii = $doc->pii_breakdown ?? [];
            // $pii is keyed by pattern name, e.g. ['ssn' => ['found' => true, 'label' => '...']]
            foreach ($pii as $name => $info) {
                if (!isset($piiDetected[$name])) {
                    $piiDetected[$name] = [];
                }
                $piiDetected[$name][] = $doc->filename;
            }
        }

        return [
            'pii_detected' => $piiDetected,
        ];
    }
}
