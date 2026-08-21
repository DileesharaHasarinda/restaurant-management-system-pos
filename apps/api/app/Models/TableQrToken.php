<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TableQrToken extends Model
{
    protected $fillable = [
        'table_id',
        'token',
        'is_active',
        'expires_at',
        'last_scanned_at',
        'generated_by',
        'disabled_at',
        'disabled_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'expires_at' => 'datetime',
            'last_scanned_at' => 'datetime',
            'disabled_at' => 'datetime',
        ];
    }

    public function restaurantTable(): BelongsTo
    {
        return $this->belongsTo(
            RestaurantTable::class,
            'table_id'
        );
    }

    public function generatedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'generated_by'
        );
    }

    public function disabledBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'disabled_by'
        );
    }

    public function isUsable(): bool
    {
        if (! $this->is_active) {
            return false;
        }

        if (
            $this->expires_at !== null
            && $this->expires_at->isPast()
        ) {
            return false;
        }

        return true;
    }
}
