<?php

namespace App\Services;

/**
 * MCA Standing Calculator Service
 *
 * Calculates funding eligibility based on bank statement analysis.
 * Aggregates data from multiple documents to determine:
 * - Average bank balances
 * - Monthly revenue trends
 * - Transaction patterns (MCA repayments, NSF fees)
 * - Overall eligibility score (0-100)
 */
class McaStandingCalculator
{
    private McaDetectionService $mcaDetectionService;
    private TransactionClassificationService $transactionClassificationService;
    private BalanceExtractorService $balanceExtractorService;

    public function __construct(
        McaDetectionService $mcaDetectionService,
        TransactionClassificationService $transactionClassificationService,
        BalanceExtractorService $balanceExtractorService
    ) {
        $this->mcaDetectionService = $mcaDetectionService;
        $this->transactionClassificationService = $transactionClassificationService;
        $this->balanceExtractorService = $balanceExtractorService;
    }

    /**
     * Calculate MCA standing from an array of documents
     *
     * @param array $documents Array of document data with extraction results
     * @return array MCA standing calculation results
     */
    public function calculate(array $documents): array
    {
        if (empty($documents)) {
            return $this->emptyStanding();
        }

        // Aggregate data from all documents
        $aggregatedBalances = $this->aggregateBalances($documents);
        $aggregatedTransactions = $this->aggregateTransactions($documents);
        $mcaAnalysis = $this->analyzeMcaImpact($aggregatedTransactions);
        $revenueAnalysis = $this->analyzeRevenue($aggregatedTransactions);
        $nsfAnalysis = $this->analyzeNsfFees($aggregatedTransactions);

        // Calculate component scores
        $balanceScore = $this->scoreBalances($aggregatedBalances);
        $revenueScore = $this->scoreRevenue($revenueAnalysis);
        $mcaScore = $this->scoreMcaActivity($mcaAnalysis);
        $nsfScore = $this->scoreNsfActivity($nsfAnalysis);

        // Calculate overall eligibility score (weighted average)
        $overallScore = $this->calculateOverallScore(
            $balanceScore,
            $revenueScore,
            $mcaScore,
            $nsfScore
        );

        // Determine eligibility factors
        $factors = $this->determineFactors(
            $aggregatedBalances,
            $revenueAnalysis,
            $mcaAnalysis,
            $nsfAnalysis,
            $balanceScore,
            $revenueScore,
            $mcaScore,
            $nsfScore
        );

        // Generate recommendation
        $recommendation = $this->generateRecommendation($overallScore, $factors);

        return [
            'eligibility_score' => round($overallScore, 1),
            'eligibility_level' => $this->getEligibilityLevel($overallScore),
            'average_balance' => round($aggregatedBalances['average_ending'], 2),
            'average_monthly_revenue' => round($revenueAnalysis['average_monthly_revenue'], 2),
            'total_mca_payments' => round($mcaAnalysis['total_mca_payments'], 2),
            'mca_payment_count' => $mcaAnalysis['mca_payment_count'],
            'nsf_fee_count' => $nsfAnalysis['nsf_count'],
            'total_nsf_fees' => round($nsfAnalysis['total_nsf_amount'], 2),
            'factors' => $factors,
            'recommendation' => $recommendation,
            'document_count' => count($documents),
            'analysis_details' => [
                'balance_score' => round($balanceScore, 1),
                'revenue_score' => round($revenueScore, 1),
                'mca_score' => round($mcaScore, 1),
                'nsf_score' => round($nsfScore, 1),
                'balance_trend' => $aggregatedBalances['trend'],
                'revenue_trend' => $revenueAnalysis['trend'],
            ],
        ];
    }

    /**
     * Aggregate balances from multiple documents
     */
    private function aggregateBalances(array $documents): array
    {
        $endingBalances = [];
        $beginningBalances = [];

        foreach ($documents as $doc) {
            $balances = $doc['balances'] ?? null;
            if (!$balances) continue;

            if (isset($balances['ending_balance']['amount']) && $balances['ending_balance']['amount'] !== null) {
                $endingBalances[] = $balances['ending_balance']['amount'];
            }
            if (isset($balances['beginning_balance']['amount']) && $balances['beginning_balance']['amount'] !== null) {
                $beginningBalances[] = $balances['beginning_balance']['amount'];
            }
        }

        $averageEnding = !empty($endingBalances) ? array_sum($endingBalances) / count($endingBalances) : 0;
        $averageBeginning = !empty($beginningBalances) ? array_sum($beginningBalances) / count($beginningBalances) : 0;

        // Determine trend by comparing recent vs older balances
        $trend = 'stable';
        if (count($endingBalances) >= 2) {
            $recentAvg = array_sum(array_slice($endingBalances, 0, (int)(count($endingBalances) / 2))) /
                         (int)(count($endingBalances) / 2);
            $olderAvg = array_sum(array_slice($endingBalances, (int)(count($endingBalances) / 2))) /
                        (count($endingBalances) - (int)(count($endingBalances) / 2));

            if ($recentAvg > $olderAvg * 1.1) {
                $trend = 'increasing';
            } elseif ($recentAvg < $olderAvg * 0.9) {
                $trend = 'decreasing';
            }
        }

        return [
            'ending_balances' => $endingBalances,
            'beginning_balances' => $beginningBalances,
            'average_ending' => $averageEnding,
            'average_beginning' => $averageBeginning,
            'trend' => $trend,
        ];
    }

    /**
     * Aggregate transactions from multiple documents
     */
    private function aggregateTransactions(array $documents): array
    {
        $allTransactions = [];

        foreach ($documents as $doc) {
            $txnClassification = $doc['transaction_classification'] ?? null;
            if (!$txnClassification || !isset($txnClassification['transactions'])) continue;

            foreach ($txnClassification['transactions'] as $txn) {
                $allTransactions[] = $txn;
            }
        }

        return $allTransactions;
    }

    /**
     * Analyze MCA impact from transactions
     */
    private function analyzeMcaImpact(array $transactions): array
    {
        $mcaPayments = [];
        $totalMcaPayments = 0;

        foreach ($transactions as $txn) {
            $classification = $txn['classification'] ?? [];
            $tags = $classification['tags'] ?? [];

            // Check for MCA-related tags or descriptions
            if (in_array('line_of_credit', $tags) || in_array('lender', $tags)) {
                $amount = $txn['amount'] ?? 0;
                if ($amount < 0) { // Payments are negative
                    $mcaPayments[] = [
                        'amount' => abs($amount),
                        'date' => $txn['date'] ?? null,
                        'description' => $txn['description'] ?? '',
                    ];
                    $totalMcaPayments += abs($amount);
                }
            }
        }

        // Also check using MCA detection service on transaction descriptions
        $mcaDetectionPayments = [];
        foreach ($transactions as $txn) {
            $description = $txn['description'] ?? '';
            $amount = $txn['amount'] ?? 0;

            if ($amount < 0 && strlen($description) > 3) {
                $mcaResult = $this->mcaDetectionService->detect($description);
                if (!empty($mcaResult['transactions'])) {
                    $mcaDetectionPayments[] = [
                        'amount' => abs($amount),
                        'date' => $txn['date'] ?? null,
                        'description' => $description,
                    ];
                    $totalMcaPayments += abs($amount);
                }
            }
        }

        // Merge and deduplicate
        $allMcaPayments = array_merge($mcaPayments, $mcaDetectionPayments);
        $uniquePayments = [];
        $seenAmounts = [];
        foreach ($allMcaPayments as $payment) {
            $key = round($payment['amount']) . '-' . substr($payment['description'], 0, 20);
            if (!isset($seenAmounts[$key])) {
                $seenAmounts[$key] = true;
                $uniquePayments[] = $payment;
            }
        }

        return [
            'mca_payments' => $uniquePayments,
            'mca_payment_count' => count($uniquePayments),
            'total_mca_payments' => $totalMcaPayments,
        ];
    }

    /**
     * Analyze revenue from transactions
     */
    private function analyzeRevenue(array $transactions): array
    {
        $monthlyCredits = [];
        $monthlyDebits = [];

        foreach ($transactions as $txn) {
            $amount = $txn['amount'] ?? null;
            if ($amount === null) continue;

            $date = $txn['date'] ?? null;
            $monthKey = $date ? date('Y-m', strtotime($date)) : 'unknown';

            if ($amount > 0) {
                if (!isset($monthlyCredits[$monthKey])) {
                    $monthlyCredits[$monthKey] = 0;
                }
                $monthlyCredits[$monthKey] += $amount;
            } else {
                if (!isset($monthlyDebits[$monthKey])) {
                    $monthlyDebits[$monthKey] = 0;
                }
                $monthlyDebits[$monthKey] += abs($amount);
            }
        }

        $allMonthlyRevenue = array_values($monthlyCredits);
        $averageMonthlyRevenue = !empty($allMonthlyRevenue)
            ? array_sum($allMonthlyRevenue) / count($allMonthlyRevenue)
            : 0;

        // Determine revenue trend
        $trend = 'stable';
        if (count($allMonthlyRevenue) >= 2) {
            $halfPoint = (int)(count($allMonthlyRevenue) / 2);
            $recentAvg = array_sum(array_slice($allMonthlyRevenue, 0, $halfPoint)) / max(1, $halfPoint);
            $olderAvg = array_sum(array_slice($allMonthlyRevenue, $halfPoint)) /
                        max(1, count($allMonthlyRevenue) - $halfPoint);

            if ($olderAvg > 0) {
                if ($recentAvg > $olderAvg * 1.15) {
                    $trend = 'increasing';
                } elseif ($recentAvg < $olderAvg * 0.85) {
                    $trend = 'decreasing';
                }
            }
        }

        return [
            'monthly_credits' => $monthlyCredits,
            'monthly_debits' => $monthlyDebits,
            'average_monthly_revenue' => $averageMonthlyRevenue,
            'total_revenue' => array_sum($allMonthlyRevenue),
            'trend' => $trend,
        ];
    }

    /**
     * Analyze NSF fees from transactions
     */
    private function analyzeNsfFees(array $transactions): array
    {
        $nsfKeywords = ['nsf', 'non-sufficient', 'insufficient', 'overdraft fee', 'returned item'];
        $nsfCount = 0;
        $totalNsfAmount = 0;
        $nsfTransactions = [];

        foreach ($transactions as $txn) {
            $description = strtolower($txn['description'] ?? '');
            $amount = abs($txn['amount'] ?? 0);

            foreach ($nsfKeywords as $keyword) {
                if (strpos($description, $keyword) !== false) {
                    $nsfCount++;
                    $totalNsfAmount += $amount;
                    $nsfTransactions[] = [
                        'amount' => $amount,
                        'date' => $txn['date'] ?? null,
                        'description' => $txn['description'] ?? '',
                    ];
                    break;
                }
            }
        }

        return [
            'nsf_count' => $nsfCount,
            'total_nsf_amount' => $totalNsfAmount,
            'nsf_transactions' => $nsfTransactions,
        ];
    }

    /**
     * Score balance adequacy (0-100)
     */
    private function scoreBalances(array $balances): float
    {
        $avgBalance = $balances['average_ending'];

        // Score based on average balance thresholds
        if ($avgBalance >= 50000) return 100;
        if ($avgBalance >= 25000) return 90;
        if ($avgBalance >= 10000) return 75;
        if ($avgBalance >= 5000) return 60;
        if ($avgBalance >= 2500) return 45;
        if ($avgBalance >= 1000) return 30;
        if ($avgBalance >= 500) return 15;
        return 5;
    }

    /**
     * Score revenue stability (0-100)
     */
    private function scoreRevenue(array $revenue): float
    {
        $avgRevenue = $revenue['average_monthly_revenue'];
        $trend = $revenue['trend'];

        // Base score on average revenue
        $baseScore = 0;
        if ($avgRevenue >= 100000) $baseScore = 100;
        elseif ($avgRevenue >= 50000) $baseScore = 85;
        elseif ($avgRevenue >= 25000) $baseScore = 70;
        elseif ($avgRevenue >= 10000) $baseScore = 55;
        elseif ($avgRevenue >= 5000) $baseScore = 40;
        elseif ($avgRevenue >= 2500) $baseScore = 25;
        elseif ($avgRevenue >= 1000) $baseScore = 15;
        else $baseScore = 5;

        // Adjust for trend
        $trendMultiplier = 1.0;
        if ($trend === 'increasing') $trendMultiplier = 1.15;
        elseif ($trend === 'decreasing') $trendMultiplier = 0.75;

        return min(100, $baseScore * $trendMultiplier);
    }

    /**
     * Score MCA activity (0-100, lower is better)
     */
    private function scoreMcaActivity(array $mca): float
    {
        $paymentCount = $mca['mca_payment_count'];
        $totalPayments = $mca['total_mca_payments'];

        // Heavy MCA usage is a negative factor
        if ($paymentCount === 0) return 100; // No MCA = best score
        if ($paymentCount <= 2) return 85;
        if ($paymentCount <= 5) return 70;
        if ($paymentCount <= 10) return 55;
        if ($paymentCount <= 20) return 40;
        return 25;
    }

    /**
     * Score NSF activity (0-100, lower is better)
     */
    private function scoreNsfActivity(array $nsf): float
    {
        $nsfCount = $nsf['nsf_count'];

        if ($nsfCount === 0) return 100;
        if ($nsfCount <= 1) return 85;
        if ($nsfCount <= 3) return 65;
        if ($nsfCount <= 5) return 45;
        if ($nsfCount <= 10) return 25;
        return 10;
    }

    /**
     * Calculate overall eligibility score
     */
    private function calculateOverallScore(
        float $balanceScore,
        float $revenueScore,
        float $mcaScore,
        float $nsfScore
    ): float {
        // Weighted average: balance 25%, revenue 35%, MCA usage 25%, NSF 15%
        return ($balanceScore * 0.25) +
               ($revenueScore * 0.35) +
               ($mcaScore * 0.25) +
               ($nsfScore * 0.15);
    }

    /**
     * Determine eligibility factors
     */
    private function determineFactors(
        array $balances,
        array $revenue,
        array $mca,
        array $nsf,
        float $balanceScore,
        float $revenueScore,
        float $mcaScore,
        float $nsfScore
    ): array {
        $factors = [];

        // Balance factors
        if ($balanceScore >= 75) {
            $factors[] = [
                'category' => 'balance',
                'indicator' => 'positive',
                'message' => 'Strong average bank balance',
                'value' => round($balances['average_ending'], 2),
            ];
        } elseif ($balanceScore < 40) {
            $factors[] = [
                'category' => 'balance',
                'indicator' => 'concern',
                'message' => 'Low average bank balance may limit eligibility',
                'value' => round($balances['average_ending'], 2),
            ];
        }

        if ($balances['trend'] === 'increasing') {
            $factors[] = [
                'category' => 'balance',
                'indicator' => 'positive',
                'message' => 'Balance trend is increasing',
                'value' => $balances['trend'],
            ];
        } elseif ($balances['trend'] === 'decreasing') {
            $factors[] = [
                'category' => 'balance',
                'indicator' => 'concern',
                'message' => 'Balance trend is declining',
                'value' => $balances['trend'],
            ];
        }

        // Revenue factors
        if ($revenueScore >= 70) {
            $factors[] = [
                'category' => 'revenue',
                'indicator' => 'positive',
                'message' => 'Strong monthly revenue',
                'value' => round($revenue['average_monthly_revenue'], 2),
            ];
        } elseif ($revenueScore < 40) {
            $factors[] = [
                'category' => 'revenue',
                'indicator' => 'concern',
                'message' => 'Revenue may be insufficient for maximum funding',
                'value' => round($revenue['average_monthly_revenue'], 2),
            ];
        }

        if ($revenue['trend'] === 'increasing') {
            $factors[] = [
                'category' => 'revenue',
                'indicator' => 'positive',
                'message' => 'Revenue trend is growing',
                'value' => $revenue['trend'],
            ];
        } elseif ($revenue['trend'] === 'decreasing') {
            $factors[] = [
                'category' => 'revenue',
                'indicator' => 'concern',
                'message' => 'Revenue trend is declining',
                'value' => $revenue['trend'],
            ];
        }

        // MCA factors
        if ($mca['mca_payment_count'] > 0) {
            $factors[] = [
                'category' => 'mca_usage',
                'indicator' => 'neutral',
                'message' => "Has {$mca['mca_payment_count']} MCA payments detected",
                'value' => round($mca['total_mca_payments'], 2),
            ];
        }

        // NSF factors
        if ($nsf['nsf_count'] > 5) {
            $factors[] = [
                'category' => 'nsf',
                'indicator' => 'concern',
                'message' => 'High number of NSF fees may indicate financial stress',
                'value' => $nsf['nsf_count'],
            ];
        } elseif ($nsf['nsf_count'] > 0) {
            $factors[] = [
                'category' => 'nsf',
                'indicator' => 'neutral',
                'message' => "{$nsf['nsf_count']} NSF fees detected",
                'value' => $nsf['nsf_count'],
            ];
        }

        return $factors;
    }

    /**
     * Generate funding recommendation
     */
    private function generateRecommendation(float $score, array $factors): array
    {
        $concerns = array_filter($factors, fn($f) => $f['indicator'] === 'concern');
        $positives = array_filter($factors, fn($f) => $f['indicator'] === 'positive');

        $eligible = $score >= 50;
        $recommended = $score >= 70;
        $maxFunding = $score >= 80;

        $message = match (true) {
            $maxFunding => 'Excellent standing. You qualify for maximum funding amounts with competitive rates.',
            $recommended => 'Good standing. You qualify for funding with standard terms.',
            $eligible => 'Moderate standing. Funding available with some restrictions. Consider reducing MCA usage and NSF fees.',
            default => 'Limited eligibility currently. Focus on improving cash flow and reducing outstanding MCA obligations.',
        };

        return [
            'eligible' => $eligible,
            'recommended' => $recommended,
            'max_funding' => $maxFunding,
            'message' => $message,
            'concern_count' => count($concerns),
            'positive_count' => count($positives),
        ];
    }

    /**
     * Get eligibility level label
     */
    private function getEligibilityLevel(float $score): string
    {
        return match (true) {
            $score >= 80 => 'excellent',
            $score >= 65 => 'good',
            $score >= 50 => 'moderate',
            $score >= 35 => 'limited',
            default => 'restricted',
        };
    }

    /**
     * Return empty standing structure
     */
    private function emptyStanding(): array
    {
        return [
            'eligibility_score' => 0,
            'eligibility_level' => 'restricted',
            'average_balance' => 0,
            'average_monthly_revenue' => 0,
            'total_mca_payments' => 0,
            'mca_payment_count' => 0,
            'nsf_fee_count' => 0,
            'total_nsf_fees' => 0,
            'factors' => [],
            'recommendation' => [
                'eligible' => false,
                'recommended' => false,
                'max_funding' => false,
                'message' => 'Upload bank statements to calculate your MCA standing.',
                'concern_count' => 0,
                'positive_count' => 0,
            ],
            'document_count' => 0,
            'analysis_details' => [
                'balance_score' => 0,
                'revenue_score' => 0,
                'mca_score' => 0,
                'nsf_score' => 0,
                'balance_trend' => 'unknown',
                'revenue_trend' => 'unknown',
            ],
        ];
    }
}
