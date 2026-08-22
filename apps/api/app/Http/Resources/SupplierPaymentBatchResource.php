<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupplierPaymentBatchResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'batch_number' =>
            $this->batch_number,

            'payment_date' =>
            $this->payment_date
                ?->format('Y-m-d'),

            'supplier' =>
            $this->supplier
                ? [
                    'id' =>
                    $this->supplier->id,

                    'name' =>
                    $this->supplier->name,

                    'current_balance' =>
                    (float)
                    $this->supplier
                        ->current_balance,
                ]
                : null,

            'purchase' =>
            $this->purchase
                ? [
                    'id' =>
                    $this->purchase->id,

                    'purchase_number' =>
                    $this->purchase
                        ->purchase_number,

                    'grand_total' =>
                    (float)
                    $this->purchase
                        ->grand_total,

                    'paid_amount' =>
                    (float)
                    $this->purchase
                        ->paid_amount,

                    'balance_due' =>
                    (float)
                    $this->purchase
                        ->balance_due,

                    'payment_status' =>
                    $this->purchase
                        ->payment_status,
                ]
                : null,

            'total_amount' =>
            (float)
            $this->total_amount,

            'notes' =>
            $this->notes,

            'payments' =>
            SupplierPaymentResource::collection(
                $this->whenLoaded(
                    'payments'
                )
            )->resolve(
                $request
            ),

            'created_by' =>
            $this->createdBy
                ? [
                    'id' =>
                    $this->createdBy->id,

                    'name' =>
                    $this->createdBy->name,
                ]
                : null,

            'created_at' =>
            $this->created_at
                ?->toISOString(),
        ];
    }
}
