<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Supplier extends Model
{
    protected $fillable = [
        'name',
        'contact_person',
        'phone',
        'email',
        'address',
        'notes',
        'current_balance',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'current_balance' =>
            'decimal:2',

            'is_active' =>
            'boolean',
        ];
    }

    public function purchases(): HasMany
    {
        return $this->hasMany(
            Purchase::class,
            'supplier_id'
        );
    }

    public function payments(): HasMany
    {
        return $this->hasMany(
            SupplierPayment::class,
            'supplier_id'
        );
    }

    public function paymentBatches(): HasMany
    {
        return $this->hasMany(
            SupplierPaymentBatch::class,
            'supplier_id'
        );
    }
}
