<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class BusinessDay extends Model
{
    public const STATUS_OPEN =
    'OPEN';

    public const STATUS_CLOSED =
    'CLOSED';

    protected $fillable = [
        'business_date',
        'status',

        'opened_by',
        'closed_by',

        'opened_at',
        'closed_at',

        'notes',
    ];

    protected function casts(): array
    {
        return [
            'business_date' =>
            'date',

            'opened_at' =>
            'datetime',

            'closed_at' =>
            'datetime',
        ];
    }

    public function openedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'opened_by'
        );
    }

    public function closedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'closed_by'
        );
    }

    public function closing(): HasOne
    {
        return $this->hasOne(
            BusinessDayClosing::class
        );
    }
}
