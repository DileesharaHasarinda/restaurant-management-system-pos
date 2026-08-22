<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Unit extends Model
{
    public const TYPE_MASS = 'MASS';
    public const TYPE_VOLUME = 'VOLUME';
    public const TYPE_COUNT = 'COUNT';

    protected $fillable = [
        'name',
        'symbol',
        'measurement_type',
        'base_unit_id',
        'conversion_factor',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'conversion_factor' => 'decimal:6',
            'is_active' => 'boolean',
        ];
    }

    public function baseUnit(): BelongsTo
    {
        return $this->belongsTo(
            self::class,
            'base_unit_id'
        );
    }

    public function derivedUnits(): HasMany
    {
        return $this->hasMany(
            self::class,
            'base_unit_id'
        );
    }

    public function ingredients(): HasMany
    {
        return $this->hasMany(
            Ingredient::class,
            'base_unit_id'
        );
    }

    public function isRootUnit(): bool
    {
        return $this->base_unit_id === null;
    }
}
