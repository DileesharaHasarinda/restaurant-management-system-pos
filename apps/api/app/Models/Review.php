<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Review extends Model
{
    public const STATUS_PENDING =
    'PENDING';

    public const STATUS_APPROVED =
    'APPROVED';

    public const STATUS_REJECTED =
    'REJECTED';

    protected $fillable = [
        'customer_name',
        'customer_email',
        'rating',
        'review',
        'status',
        'reviewed_by',
        'reviewed_at',
        'is_featured',
        'is_visible',
    ];

    protected function casts(): array
    {
        return [
            'rating' =>
            'integer',

            'reviewed_at' =>
            'datetime',

            'is_featured' =>
            'boolean',

            'is_visible' =>
            'boolean',
        ];
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'reviewed_by'
        );
    }
}
