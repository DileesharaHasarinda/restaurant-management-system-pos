<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class RestaurantTable extends Model
{
    protected $table = 'tables';

    public const STATUS_AVAILABLE =
    'AVAILABLE';

    public const STATUS_OCCUPIED =
    'OCCUPIED';

    public const STATUS_RESERVED =
    'RESERVED';

    public const STATUS_CLEANING =
    'CLEANING';

    public const STATUS_OUT_OF_SERVICE =
    'OUT_OF_SERVICE';

    protected $fillable = [
        'table_number',
        'code',
        'name',
        'area',
        'capacity',
        'status',
        'qr_ordering_enabled',
        'sort_order',
        'is_active',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'table_number' => 'integer',
            'capacity' => 'integer',
            'qr_ordering_enabled' => 'boolean',
            'sort_order' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function qrTokens(): HasMany
    {
        return $this->hasMany(
            TableQrToken::class,
            'table_id'
        );
    }

    public function activeQrToken(): HasOne
    {
        return $this->hasOne(
            TableQrToken::class,
            'table_id'
        )
            ->where('is_active', true)
            ->latestOfMany();
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(
            TableSession::class,
            'table_id'
        );
    }

    public function openSession(): HasOne
    {
        return $this->hasOne(
            TableSession::class,
            'table_id'
        )
            ->where(
                'status',
                TableSession::STATUS_OPEN
            )
            ->latestOfMany();
    }
}
