<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class KitchenPrintJob extends Model
{
    /*
    |--------------------------------------------------------------------------
    | Job Types
    |--------------------------------------------------------------------------
    */

    public const TYPE_INITIAL_ORDER =
    'INITIAL_ORDER';

    public const TYPE_ADDITIONAL_ORDER =
    'ADDITIONAL_ORDER';

    public const TYPE_CANCELLATION =
    'CANCELLATION';

    public const TYPE_REPRINT =
    'REPRINT';

    public const TYPES = [
        self::TYPE_INITIAL_ORDER,
        self::TYPE_ADDITIONAL_ORDER,
        self::TYPE_CANCELLATION,
        self::TYPE_REPRINT,
    ];

    /*
    |--------------------------------------------------------------------------
    | Job Statuses
    |--------------------------------------------------------------------------
    */

    public const STATUS_PENDING =
    'PENDING';

    public const STATUS_PROCESSING =
    'PROCESSING';

    public const STATUS_PRINTED =
    'PRINTED';

    public const STATUS_FAILED =
    'FAILED';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_PROCESSING,
        self::STATUS_PRINTED,
        self::STATUS_FAILED,
    ];

    protected $fillable = [
        'job_number',
        'idempotency_key',

        'order_id',

        'job_type',

        'printer_name',
        'printer_address',

        'payload',

        'status',
        'attempts',
        'last_error',

        'requested_by',

        'queued_at',
        'printed_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' =>
            'array',

            'attempts' =>
            'integer',

            'queued_at' =>
            'datetime',

            'printed_at' =>
            'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(
            Order::class,
            'order_id'
        );
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'requested_by'
        );
    }

    public function isPending(): bool
    {
        return $this->status
            === self::STATUS_PENDING;
    }

    public function isProcessing(): bool
    {
        return $this->status
            === self::STATUS_PROCESSING;
    }

    public function isPrinted(): bool
    {
        return $this->status
            === self::STATUS_PRINTED;
    }

    public function isFailed(): bool
    {
        return $this->status
            === self::STATUS_FAILED;
    }
}
