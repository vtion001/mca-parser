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
        $this->assertGreaterThanOrEqual(0.5, $result['confidence']);
    }

    public function test_detects_contract_type(): void
    {
        $text = "Agreement between Party A and Party B\nEffective Date: January 1, 2024\nTerms of this agreement shall apply for 12 months";
        $result = $this->detector->detect($text);

        $this->assertEquals('contract', $result['type']);
        $this->assertGreaterThanOrEqual(0.6, $result['confidence']);
    }

    public function test_detects_receipt_type(): void
    {
        $text = "RECEIPT\nMerchant: Store Name\nDate: 01/15/2024\nItems:\n- Item 1 $10.00\n- Item 2 $15.00\nTotal: $25.00";
        $result = $this->detector->detect($text);

        $this->assertEquals('receipt', $result['type']);
        $this->assertGreaterThanOrEqual(0.4, $result['confidence']);
    }

    public function test_returns_unknown_for_unrecognized(): void
    {
        $text = "Lorem ipsum dolor sit amet consectetur adipiscing elit";
        $result = $this->detector->detect($text);

        $this->assertEquals('unknown', $result['type']);
        $this->assertLessThan(0.5, $result['confidence']);
    }
}
