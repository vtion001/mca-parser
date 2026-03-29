<?php

namespace App\Services\FieldMappers;

class FieldValueCleaner
{
    public function cleanFieldValue(string $fieldName, string $value): string
    {
        // Strip leading "Label | " from cells that contain "Label | Value" format.
        // The label can contain word chars, spaces, hyphens, dots, slashes, commas.
        // e.g. "Beginning Balance | $(1,785.93)" → "$(1,785.93)"
        // e.g. "Ending Balance    | $11,069.11" → "$11,069.11"
        // We strip the label (everything before and including the last " | ") and keep the rest.
        if (str_contains($value, '|')) {
            $lastPipePos = strrpos($value, '|');
            $possibleLabel = substr($value, 0, $lastPipePos);
            $possibleValue = substr($value, $lastPipePos + 1);
            // If the "label" part before the pipe contains at least one letter (is textual),
            // and the "value" part is non-empty, treat it as a "Label | Value" cell
            if (preg_match('/[A-Za-z]/', $possibleLabel) && trim($possibleValue) !== '') {
                $value = $possibleValue;
            }
        }

        // For monetary fields, clean up dollar and parentheses formatting
        if (in_array($fieldName, ['beginning_balance', 'ending_balance', 'total_deposits', 'total_withdrawals', 'total_credits', 'total_debits', 'service_charge'])) {
            $value = preg_replace('/^\$\s*/', '', $value); // strip leading $
            // If accounting format: (123.45) → -123.45
            if (preg_match('/^\(([^)]+)\)$/', $value, $m)) {
                $value = '-' . $m[1];
            }
        }

        // Remove any remaining pipe characters
        $value = str_replace('|', '', $value);

        return trim($value);
    }
}
