<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderAdditionSubmission extends Model
{
    protected $fillable = [
        'order_id',
        'client_submission_id',
        'submission_hash',
    ];

    protected $hidden = [
        'submission_hash',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(
            Order::class,
            'order_id'
        );
    }
}
