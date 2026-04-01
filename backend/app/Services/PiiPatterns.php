<?php

namespace App\Services;

class PiiPatterns
{
    public const SSN = '/\d{3}-\d{2}-\d{4}/';
    public const EMAIL = '/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/';
    public const PHONE = '/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/';
    public const CREDIT_CARD = '/\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}/';
    public const DATE = '/\d{1,2}\/\d{1,2}\/\d{2,4}/';
    public const ID = '/\d{9}/';

    public const ALL = [
        'ssn' => self::SSN,
        'email' => self::EMAIL,
        'phone' => self::PHONE,
        'credit_card' => self::CREDIT_CARD,
        'date' => self::DATE,
        'id' => self::ID,
    ];

    public const SCRUB_MAP = [
        self::SSN => '[SSN]',
        self::ID => '[ID]',
        self::CREDIT_CARD => '[CARD]',
        self::EMAIL => '[EMAIL]',
        self::PHONE => '[PHONE]',
        self::DATE => '[DATE]',
    ];
}