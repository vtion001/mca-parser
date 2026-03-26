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
        $this->assertGreaterThanOrEqual(2, count($details));

        $fields = array_column($details, 'field');
        $this->assertContains('vendor', $fields);
    }

    public function test_extracts_generic_fields(): void
    {
        $text = "Contact: John Doe\nEmail: john@example.com\nPhone: 555-123-4567\nDate: 01/15/2024";
        $details = $this->mapper->map($text, 'generic');

        $this->assertNotEmpty($details);

        $email = collect($details)->firstWhere('field', 'email');
        $this->assertNotNull($email);
        $this->assertEquals('john@example.com', $email['value']);
    }

    public function test_returns_empty_for_no_matches(): void
    {
        $text = "Lorem ipsum dolor sit amet";
        $details = $this->mapper->map($text, 'invoice');

        $this->assertEmpty($details);
    }
}
