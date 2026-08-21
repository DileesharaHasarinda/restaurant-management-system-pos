<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TableSession extends Model
{
    public const STATUS_OPEN =
    'OPEN';

    public const STATUS_CLOSED =
    'CLOSED';

    public const STATUS_MERGED =
    'MERGED';

    public const SOURCE_STAFF =
    'STAFF';

    public const SOURCE_QR_CUSTOMER =
    'QR_CUSTOMER';

    protected $fillable = [
        'session_number',
        'public_token',
        'business_day_id',
        'table_id',
        'merged_into_session_id',
        'guest_count',
        'opened_source',
        'status',
        'opened_by',
        'opened_at',
        'closed_at',
        'closed_by',
        'close_reason',
        'last_activity_at',
    ];

    protected function casts(): array
    {
        return [
            'guest_count' => 'integer',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
            'last_activity_at' => 'datetime',
        ];
    }

    public function table(): BelongsTo
    {
        return $this->belongsTo(
            RestaurantTable::class,
            'table_id'
        );
    }

    public function businessDay(): BelongsTo
    {
        return $this->belongsTo(
            BusinessDay::class,
            'business_day_id'
        );
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

    public function mergedInto(): BelongsTo
    {
        return $this->belongsTo(
            self::class,
            'merged_into_session_id'
        );
    }
}
