<?php

namespace App\Services\Interfaces;

/**
 * Interface for AI document analysis service.
 */
interface AiServiceInterface
{
    /**
     * Analyze a document for transaction data, MCA findings, and summary.
     *
     * @param string $markdown The extracted document text
     * @param array $documentType The detected document type
     * @param array $keyDetails Extracted key details from the document
     * @param array $balances Extracted balance information
     * @return array{
     *     success: bool,
     *     analysis?: array{
     *         transaction_summary?: array{
     *             credit_count?: int|null,
     *             debit_count?: int|null,
     *             total_credits?: float|null,
     *             total_debits?: float|null
     *         }
     *     },
     *     error?: string
     * }
     */
    public function analyzeDocument(string $markdown, array $documentType, array $keyDetails, array $balances): array;
}
