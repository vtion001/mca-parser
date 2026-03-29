<?php

namespace App\Services\FieldMappers;

class GarbageDetector
{
    /**
     * Returns true if the extracted value looks like reconciliation boilerplate
     * rather than a real field value. These values contain generic instruction
     * text that the generic regex patterns sometimes match.
     */
    public function isGarbageValue(string $value): bool
    {
        $valueLower = strtolower(trim($value));
        $garbagePhrases = [
            'this is provided to help you balance',
            'your checkbook',
            'bank balance',
            'checks outstanding',
            'other bank charges',
            'deposits not shown',
            'activity charge',
            'should agree with your',
            'beginning balance',
            'ending balance',
        ];
        foreach ($garbagePhrases as $phrase) {
            if (str_contains($valueLower, $phrase)) {
                return true;
            }
        }
        // Also flag very long values (>150 chars) that aren't money amounts
        if (strlen($value) > 150 && !preg_match('/^\$?[\d,]+\.\d{2}$/', trim($value))) {
            return true;
        }
        return false;
    }
}
