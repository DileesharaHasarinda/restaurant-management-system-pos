<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TableMerge extends Model
{
    protected $fillable = [
        'source_session_id',
        'target_session_id',
        'source_table_id',
        'target_table_id',
        'merged_by',
        'reason',
        'merged_at',
    ];

    protected function casts(): array
    {
        return [
            'merged_at' =>
            'datetime',
        ];
    }

    public function sourceSession(): BelongsTo
    {
        return $this->belongsTo(
            TableSession::class,
            'source_session_id'
        );
    }

    public function targetSession(): BelongsTo
    {
        return $this->belongsTo(
            TableSession::class,
            'target_session_id'
        );
    }

    public function sourceTable(): BelongsTo
    {
        return $this->belongsTo(
            RestaurantTable::class,
            'source_table_id'
        );
    }

    public function targetTable(): BelongsTo
    {
        return $this->belongsTo(
            RestaurantTable::class,
            'target_table_id'
        );
    }

    public function mergedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'merged_by'
        );
    }
}
