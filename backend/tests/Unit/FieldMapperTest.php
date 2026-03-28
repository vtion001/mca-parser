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

    public function test_extracts_bank_statement_fields(): void
    {
        $text = <<<MD
Account Number: 7935054275

Account Type: 5/3 BUSINESS CKG

Banking Center: Roseville/Eastpointe

Banking Center Phone: 586-443-5333

| Account Summary - 7935054275 | Account Summary | Account Summary | Account Summary | Account Summary |
|-----------------------------|----------------|-----------------|-----------------|----------------|
| 12/01                       | Beginning Balance | \$(1,785.93)    | Number of Days in Period | 31 |
| 12/31                       | Ending Balance    | \$11,069.11    |                   |    |
MD;

        $details = $this->mapper->map($text, 'bank_statement');

        $this->assertNotEmpty($details);

        $fields = array_column($details, 'field');

        // Standalone fields
        $this->assertContains('account_number', $fields);
        $this->assertContains('account_type', $fields);
        $this->assertContains('banking_center', $fields);
        $this->assertContains('banking_center_phone', $fields);

        // Table-parsed fields
        $this->assertContains('beginning_balance', $fields);
        $this->assertContains('ending_balance', $fields);
        $this->assertContains('number_of_days', $fields);
    }

    public function test_returns_empty_for_no_matches(): void
    {
        $text = "Lorem ipsum dolor sit amet";
        $details = $this->mapper->map($text, 'invoice');

        $this->assertEmpty($details);
    }
}
