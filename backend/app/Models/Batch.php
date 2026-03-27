<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Batch extends Model
{
    protected $fillable = [
        'name',
        'status',
        'total_documents',
        'completed_documents',
    ];

    protected $casts = [
        'total_documents' => 'integer',
        'completed_documents' => 'integer',
    ];

    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETE = 'complete';
    public const STATUS_FAILED = 'failed';

    public function documents(): BelongsToMany
    {
        return $this->belongsToMany(Document::class, 'document_batches')
            ->withPivot('processing_order')
            ->withTimestamps();
    }

    public function incrementCompleted(): void
    {
        $this->increment('completed_documents');

        if ($this->completed_documents >= $this->total_documents) {
            $this->update(['status' => self::STATUS_COMPLETE]);
        }
    }

    public function markAsProcessing(): void
    {
        $this->update(['status' => self::STATUS_PROCESSING]);
    }

    public function markAsFailed(): void
    {
        $this->update(['status' => self::STATUS_FAILED]);
    }

    public function getProgressPercent(): int
    {
        if ($this->total_documents === 0) {
            return 0;
        }

        return (int) round(($this->completed_documents / $this->total_documents) * 100);
    }
}
