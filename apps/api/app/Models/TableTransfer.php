<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TableTransfer extends Model
{
    protected $fillable = [
        'table_session_id',
        'from_table_id',
        'to_table_id',
        'transferred_by',
        'reason',
        'transferred_at',
    ];

    protected function casts(): array
    {
        return [
            'transferred_at' =>
            'datetime',
        ];
    }

    public function tableSession(): BelongsTo
    {
        return $this->belongsTo(
            TableSession::class,
            'table_session_id'
        );
    }

    public function fromTable(): BelongsTo
    {
        return $this->belongsTo(
            RestaurantTable::class,
            'from_table_id'
        );
    }

    public function toTable(): BelongsTo
    {
        return $this->belongsTo(
            RestaurantTable::class,
            'to_table_id'
        );
    }

    public function transferredBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'transferred_by'
        );
    }
}
