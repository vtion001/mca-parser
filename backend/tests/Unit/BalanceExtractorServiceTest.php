<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use App\Services\BalanceExtractorService;

class BalanceExtractorServiceTest extends TestCase
{
    private BalanceExtractorService $extractor;

    protected function setUp(): void
    {
        parent::setUp();
        $this->extractor = new BalanceExtractorService();
    }

    public function test_returns_valid_structure(): void
    {
        $result = $this->extractor->extractBalances('');

        $this->assertArrayHasKey('beginning_balance', $result);
        $this->assertArrayHasKey('ending_balance', $result);
        
        $this->assertArrayHasKey('amount', $result['beginning_balance']);
        $this->assertArrayHasKey('keyword', $result['beginning_balance']);
        $this->assertArrayHasKey('raw_text', $result['beginning_balance']);
        
        $this->assertArrayHasKey('amount', $result['ending_balance']);
        $this->assertArrayHasKey('keyword', $result['ending_balance']);
        $this->assertArrayHasKey('raw_text', $result['ending_balance']);
    }

    public function test_extracts_ending_balance_with_keyword(): void
    {
        $text = "Some transaction details\nEnding Balance: $1,234.56\nMore details";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(1234.56, $result['ending_balance']['amount']);
        $this->assertEquals('ending balance', $result['ending_balance']['keyword']);
        $this->assertStringContainsString('Ending Balance', $result['ending_balance']['raw_text']);
    }

    public function test_extracts_beginning_balance_with_previous_keyword(): void
    {
        $text = "Previous Balance: $500.00\nSome transaction details\nEnding Balance: $1,234.56";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(500.00, $result['beginning_balance']['amount']);
        $this->assertEquals('previous balance', $result['beginning_balance']['keyword']);
    }

    public function test_extracts_beginning_balance_with_starting_keyword(): void
    {
        $text = "Starting Balance $2,500.00\nTransaction 1...";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(2500.00, $result['beginning_balance']['amount']);
        $this->assertEquals('starting balance', $result['beginning_balance']['keyword']);
    }

    public function test_extracts_beginning_balance_with_beginning_keyword(): void
    {
        $text = "Beginning Balance $1,000.00\nTransaction details...";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(1000.00, $result['beginning_balance']['amount']);
        $this->assertEquals('beginning balance', $result['beginning_balance']['keyword']);
    }

    public function test_extracts_negative_amount_correctly(): void
    {
        $text = "Previous Balance: -$500.00\nCurrent Balance: $100.00";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(-500.00, $result['beginning_balance']['amount']);
    }

    public function test_extracts_trailing_minus_amount(): void
    {
        $text = "Previous Balance: $500.00-\nEnding Balance: $100.00";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(-500.00, $result['beginning_balance']['amount']);
    }

    public function test_extracts_amount_without_dollar_sign(): void
    {
        $text = "Previous Balance: 1,234.56\nEnding Balance: 2,500.00";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(1234.56, $result['beginning_balance']['amount']);
        $this->assertEquals(2500.00, $result['ending_balance']['amount']);
    }

    public function test_handles_multiple_amounts_picks_largest(): void
    {
        $text = "Previous Balance: $100.00\nSome details with $50.00\nEnding Balance: $5,000.00";

        $result = $this->extractor->extractBalances($text);

        // Should pick the largest amount for balance, not the $50 transaction
        $this->assertEquals(5000.00, $result['ending_balance']['amount']);
    }

    public function test_extracts_current_balance_keyword(): void
    {
        $text = "Current Balance: $3,456.78";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(3456.78, $result['ending_balance']['amount']);
        $this->assertEquals('current balance', $result['ending_balance']['keyword']);
    }

    public function test_returns_null_when_no_balance_found(): void
    {
        $text = "This is just some random text without any balance information";

        $result = $this->extractor->extractBalances($text);

        $this->assertNull($result['beginning_balance']['amount']);
        $this->assertNull($result['ending_balance']['amount']);
    }

    public function test_is_case_insensitive(): void
    {
        $text = "ENDING BALANCE: $999.00\nPREVIOUS BALANCE: $111.00";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(999.00, $result['ending_balance']['amount']);
        $this->assertEquals(111.00, $result['beginning_balance']['amount']);
    }

    public function test_handles_amounts_with_commas(): void
    {
        $text = "Beginning Balance: $1,234,567.89\nEnding Balance: $2,345,678.90";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(1234567.89, $result['beginning_balance']['amount']);
        $this->assertEquals(2345678.90, $result['ending_balance']['amount']);
    }

    public function test_handles_decimal_precision(): void
    {
        $text = "Previous Balance: $100.5\nEnding Balance: $200.99";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(100.5, $result['beginning_balance']['amount']);
        $this->assertEquals(200.99, $result['ending_balance']['amount']);
    }

    public function test_extracts_from_multiline_text(): void
    {
        $text = "Account Statement\n\nPrevious Balance\n$500.00\n\nTransactions\n...details...\n\nEnding Balance\n$750.00";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(500.00, $result['beginning_balance']['amount']);
        $this->assertEquals(750.00, $result['ending_balance']['amount']);
    }

    public function test_balance_with_balance_last_statement_keyword(): void
    {
        $text = "Balance Last Statement: $1,500.00";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(1500.00, $result['beginning_balance']['amount']);
        $this->assertEquals('balance last statement', $result['beginning_balance']['keyword']);
    }

    public function test_balance_with_balance_this_statement_keyword(): void
    {
        $text = "Balance This Statement: $2,200.00";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(2200.00, $result['ending_balance']['amount']);
        $this->assertEquals('balance this statement', $result['ending_balance']['keyword']);
    }

    public function test_ending_with_ending_statement_keyword(): void
    {
        $text = "Ending Statement: $3,000.00";

        $result = $this->extractor->extractBalances($text);

        $this->assertEquals(3000.00, $result['ending_balance']['amount']);
        $this->assertEquals('ending statement', $result['ending_balance']['keyword']);
    }

    public function test_raw_text_contains_original_text(): void
    {
        $text = "Beginning Balance: $500.00 was carried forward";

        $result = $this->extractor->extractBalances($text);

        $this->assertStringContainsString('$500.00', $result['beginning_balance']['raw_text']);
    }
}
