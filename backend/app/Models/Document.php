<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Document extends Model
{
    protected $fillable = [
        'filename',
        'original_filename',
        'file_path',
        'status',
        'document_type',
        'markdown',
        'key_details',
        'scores',
        'pii_breakdown',
        'recommendations',
        'balances',
        'ai_analysis',
        'page_count',
        'error',
    ];

    protected $casts = [
        'key_details' => 'array',
        'scores' => 'array',
        'pii_breakdown' => 'array',
        'recommendations' => 'array',
        'balances' => 'array',
        'ai_analysis' => 'array',
        'page_count' => 'integer',
    ];

    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETE = 'complete';
    public const STATUS_FAILED = 'failed';

    public function batches(): BelongsToMany
    {
        return $this->belongsToMany(Batch::class, 'document_batches')
            ->withPivot('processing_order')
            ->withTimestamps();
    }

    public function isProcessable(): bool
    {
        return $this->status === self::STATUS_PENDING || $this->status === self::STATUS_FAILED;
    }

    public function markAsProcessing(): void
    {
        $this->update(['status' => self::STATUS_PROCESSING]);
    }

    public function markAsComplete(array $extractionData): void
    {
        $this->update(array_merge($extractionData, ['status' => self::STATUS_COMPLETE]));
    }

    public function markAsFailed(string $error): void
    {
        $this->update(['status' => self::STATUS_FAILED, 'error' => $error]);
    }
}
