<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

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
            'business_date' => 'date',
            'opened_at' => 'datetime',
            'closed_at' => 'datetime',
        ];
    }
}
