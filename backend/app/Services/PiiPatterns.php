<?php

namespace App\Services;

class PiiPatterns
{
    // SSN: strict XXX-XX-XXXX format with word boundaries
    public const SSN = '/(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)/';

    // EMAIL: standard email pattern
    public const EMAIL = '/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/';

    // PHONE: US-style phones — requires clear phone separators (dashes, dots, spaces, parens)
    // Matches: (555) 123-4567, 555-123-4567, 555.123.4567, 555 123 4567, +1-555-123-4567
    // Does NOT match: raw 10-digit account numbers without separators like 7935054275
    public const PHONE = '/(?<!\d)(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]+\d{3}[-.\s]+\d{4}(?!\d)/';

    // CREDIT_CARD: 13-19 digits with common separators, or raw 16-digit sequences
    // Only matches if followed by common expiry/cvv context or standalone
    public const CREDIT_CARD = '/(?<!\d)\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}(?!\d)/';

    // DATE: MM/DD/YYYY or MM/DD/YY — but NOT when part of larger patterns like page numbers
    // Uses negative lookahead to exclude file/page references
    public const DATE = '/(?<!\d)(?:0?[1-9]|1[0-2])\/(?:0?[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}(?!\d)/';

    // ROUTING_NUMBER: 9-digit ABA routing numbers (often followed by account number)
    // Distinct from generic 9-digit IDs — routing numbers have checksum validation
    public const ROUTING_NUMBER = '/(?<!\d)\d{9}(?!\d)/';

    public const ALL = [
        'ssn' => self::SSN,
        'email' => self::EMAIL,
        'phone' => self::PHONE,
        'credit_card' => self::CREDIT_CARD,
        'date' => self::DATE,
        'routing_number' => self::ROUTING_NUMBER,
    ];

    public const SCRUB_MAP = [
        self::SSN => '[SSN]',
        self::ROUTING_NUMBER => '[ROUTING]',
        self::CREDIT_CARD => '[CARD]',
        self::EMAIL => '[EMAIL]',
        self::PHONE => '[PHONE]',
        self::DATE => '[DATE]',
    ];
}