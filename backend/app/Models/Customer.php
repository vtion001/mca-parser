<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Customer extends Model
{
    protected $fillable = [
        'user_id',
        'business_name',
        'business_type',
        'annual_revenue',
        'time_in_business',
        'email',
        'email_verified_at',
        'verification_token',
        'reset_token',
        'reset_token_expires_at',
        'is_active',
    ];

    protected $hidden = [
        'verification_token',
        'reset_token',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'annual_revenue' => 'decimal:2',
        'time_in_business' => 'integer',
        'email_verified_at' => 'datetime',
        'reset_token_expires_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isVerified(): bool
    {
        return $this->email_verified_at !== null;
    }

    public function generateVerificationToken(): string
    {
        $this->verification_token = bin2hex(random_bytes(32));
        $this->save();
        return $this->verification_token;
    }

    public function generateResetToken(int $hoursValid = 1): string
    {
        $this->reset_token = bin2hex(random_bytes(32));
        $this->reset_token_expires_at = now()->addHours($hoursValid);
        $this->save();
        return $this->reset_token;
    }

    public function clearResetToken(): void
    {
        $this->reset_token = null;
        $this->reset_token_expires_at = null;
        $this->save();
    }

    public function verify(): void
    {
        $this->email_verified_at = now();
        $this->verification_token = null;
        $this->save();
    }
}
