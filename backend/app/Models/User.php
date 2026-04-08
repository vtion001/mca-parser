<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Hash;

class User extends Model
{
    protected $fillable = [
        'account_id',
        'name',
        'email',
        'password',
        'api_token',
        'token_expires_at',
    ];

    protected $hidden = [
        'password',
        'api_token',
    ];

    protected $casts = [
        'account_id' => 'integer',
        'token_expires_at' => 'datetime',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function setPasswordAttribute(string $value): void
    {
        $this->attributes['password'] = Hash::needsRehash($value) ? Hash::make($value) : $value;
    }

    public function regenerateToken(int $daysValid = 30): string
    {
        $this->api_token = bin2hex(random_bytes(32));
        $this->token_expires_at = now()->addDays($daysValid);
        $this->save();
        return $this->api_token;
    }

    public function clearToken(): void
    {
        $this->api_token = null;
        $this->save();
    }
}
