<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    /*
    |--------------------------------------------------------------------------
    | Order Types
    |--------------------------------------------------------------------------
    */

    public const TYPE_DINE_IN =
    'DINE_IN';

    public const TYPE_TAKEAWAY =
    'TAKEAWAY';

    public const TYPES = [
        self::TYPE_DINE_IN,
        self::TYPE_TAKEAWAY,
    ];

    /*
    |--------------------------------------------------------------------------
    | Order Sources
    |--------------------------------------------------------------------------
    */

    public const SOURCE_QR_CUSTOMER =
    'QR_CUSTOMER';

    public const SOURCE_WAITER =
    'WAITER';

    public const SOURCE_CASHIER =
    'CASHIER';

    public const SOURCES = [
        self::SOURCE_QR_CUSTOMER,
        self::SOURCE_WAITER,
        self::SOURCE_CASHIER,
    ];

    /*
    |--------------------------------------------------------------------------
    | Statuses
    |--------------------------------------------------------------------------
    */

    public const STATUS_PENDING =
    'PENDING';

    public const STATUS_CONFIRMED =
    'CONFIRMED';

    public const STATUS_SENT_TO_KITCHEN =
    'SENT_TO_KITCHEN';

    public const STATUS_SERVED =
    'SERVED';

    public const STATUS_COMPLETED =
    'COMPLETED';

    public const STATUS_CANCELLED =
    'CANCELLED';

    public const STATUS_REJECTED =
    'REJECTED';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_CONFIRMED,
        self::STATUS_SENT_TO_KITCHEN,
        self::STATUS_SERVED,
        self::STATUS_COMPLETED,
        self::STATUS_CANCELLED,
        self::STATUS_REJECTED,
    ];

    public const TERMINAL_STATUSES = [
        self::STATUS_COMPLETED,
        self::STATUS_CANCELLED,
        self::STATUS_REJECTED,
    ];

    protected $fillable = [
        'order_number',
        'client_order_id',
        'submission_hash',
        'public_status_token',

        'business_day_id',
        'table_session_id',
        'table_id',

        'order_type',
        'order_source',
        'session_sequence',

        'table_name_snapshot',
        'takeaway_token',

        'customer_name',
        'customer_phone',

        'status',

        'subtotal',
        'discount_total',
        'tax_total',
        'service_charge_total',
        'grand_total',
        'estimated_cost_total',

        'customer_notes',
        'internal_notes',

        'created_by',
        'confirmed_by',
        'cancelled_by',
        'rejected_by',

        'confirmed_at',
        'sent_to_kitchen_at',
        'served_at',
        'completed_at',
        'cancelled_at',
        'rejected_at',

        'cancellation_reason',
        'rejection_reason',
    ];

    protected $hidden = [
        'submission_hash',
    ];

    protected function casts(): array
    {
        return [
            'session_sequence' =>
            'integer',

            'subtotal' =>
            'decimal:2',

            'discount_total' =>
            'decimal:2',

            'tax_total' =>
            'decimal:2',

            'service_charge_total' =>
            'decimal:2',

            'grand_total' =>
            'decimal:2',

            'estimated_cost_total' =>
            'decimal:2',

            'confirmed_at' =>
            'datetime',

            'sent_to_kitchen_at' =>
            'datetime',

            'served_at' =>
            'datetime',

            'completed_at' =>
            'datetime',

            'cancelled_at' =>
            'datetime',

            'rejected_at' =>
            'datetime',
        ];
    }

    public function businessDay(): BelongsTo
    {
        return $this->belongsTo(
            BusinessDay::class,
            'business_day_id'
        );
    }

    public function tableSession(): BelongsTo
    {
        return $this->belongsTo(
            TableSession::class,
            'table_session_id'
        );
    }

    public function restaurantTable(): BelongsTo
    {
        return $this->belongsTo(
            RestaurantTable::class,
            'table_id'
        );
    }

    public function items(): HasMany
    {
        return $this->hasMany(
            OrderItem::class,
            'order_id'
        );
    }

    public function statusHistories(): HasMany
    {
        return $this->hasMany(
            OrderStatusHistory::class,
            'order_id'
        );
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'created_by'
        );
    }

    public function confirmedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'confirmed_by'
        );
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'cancelled_by'
        );
    }

    public function rejectedBy(): BelongsTo
    {
        return $this->belongsTo(
            User::class,
            'rejected_by'
        );
    }

    public function additionSubmissions(): HasMany
    {
        return $this->hasMany(
            OrderAdditionSubmission::class,
            'order_id'
        );
    }

    public function isPending(): bool
    {
        return $this->status
            === self::STATUS_PENDING;
    }

    public function isTerminal(): bool
    {
        return in_array(
            $this->status,
            self::TERMINAL_STATUSES,
            true
        );
    }

    public function isTakeaway(): bool
    {
        return $this->order_type
            === self::TYPE_TAKEAWAY;
    }
}
