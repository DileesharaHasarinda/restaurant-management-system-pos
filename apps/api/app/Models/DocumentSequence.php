<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentSequence extends Model
{
    public const TYPE_INVOICE =
    'INVOICE';

    public const TYPE_ORDER =
    'ORDER';

    public const TYPE_TOKEN =
    'TOKEN';

    public const RESET_NEVER =
    'NEVER';

    public const RESET_DAILY =
    'DAILY';

    public const RESET_MONTHLY =
    'MONTHLY';

    public const RESET_YEARLY =
    'YEARLY';

    protected $fillable = [
        'sequence_type',
        'prefix',
        'current_number',
        'padding',
        'reset_period',
        'last_reset_key',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'current_number' =>
            'integer',

            'padding' =>
            'integer',

            'is_active' =>
            'boolean',
        ];
    }
}
