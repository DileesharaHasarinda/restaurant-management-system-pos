<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'purchase_number' =>
            $this->purchase_number,

            'supplier' =>
            $this->supplier
                ? (
                    new SupplierResource(
                        $this->supplier
                    )
                )->resolve(
                    $request
                )
                : null,

            'purchase_date' =>
            $this->purchase_date
                ?->format(
                    'Y-m-d'
                ),

            'supplier_invoice_number' =>
            $this->supplier_invoice_number,

            /*
            |--------------------------------------------------------------------------
            | Financial Totals
            |--------------------------------------------------------------------------
            |
            | These are authoritative backend values.
            | The frontend must never recalculate them
            | as persisted financial state.
            |
            */

            'subtotal' =>
            (float)
            $this->subtotal,

            'discount_total' =>
            (float)
            $this->discount_total,

            'tax_total' =>
            (float)
            $this->tax_total,

            'grand_total' =>
            (float)
            $this->grand_total,

            /*
            |--------------------------------------------------------------------------
            | Supplier Payment Position
            |--------------------------------------------------------------------------
            */

            'paid_amount' =>
            (float)
            $this->paid_amount,

            'balance_due' =>
            (float)
            $this->balance_due,

            'payment_status' =>
            $this->payment_status,

            /*
            |--------------------------------------------------------------------------
            | Purchase Lifecycle
            |--------------------------------------------------------------------------
            */

            'status' =>
            $this->status,

            'notes' =>
            $this->notes,

            /*
            |--------------------------------------------------------------------------
            | Purchase Items
            |--------------------------------------------------------------------------
            |
            | Items are normally eager loaded by
            | PurchaseController / PurchaseManagementService.
            |
            | Guard with relationLoaded() so this resource
            | remains safe even if another caller does not
            | load the relationship.
            |
            */

            'items' =>
            $this->relationLoaded(
                'items'
            )
                ? PurchaseItemResource::collection(
                    $this->items
                )->resolve(
                    $request
                )
                : [],

            /*
            |--------------------------------------------------------------------------
            | Supplier Payment History
            |--------------------------------------------------------------------------
            |
            | A normal purchase list/create/show response
            | does not necessarily eager-load paymentBatches.
            |
            | Never call resolve() on a conditional
            | MissingValue collection.
            |
            | Module 9 can explicitly load paymentBatches
            | when payment history is required.
            |
            */

            'payment_history' =>
            $this->relationLoaded(
                'paymentBatches'
            )
                ? SupplierPaymentBatchResource::collection(
                    $this->paymentBatches
                )->resolve(
                    $request
                )
                : [],

            'completed_at' =>
            $this->completed_at
                ?->toISOString(),

            'created_at' =>
            $this->created_at
                ?->toISOString(),

            'updated_at' =>
            $this->updated_at
                ?->toISOString(),
        ];
    }
}
