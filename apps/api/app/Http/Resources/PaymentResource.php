<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PaymentResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'payment_number' =>
            $this->payment_number,

            'payment_batch_id' =>
            $this->payment_batch_id,

            'invoice_id' =>
            $this->invoice_id,

            'cashier_shift_id' =>
            $this->cashier_shift_id,

            'payment_method' =>
            $this->payment_method,

            'amount' =>
            (float)
            $this->amount,

            'tendered_amount' =>
            $this->tendered_amount !== null
                ? (float)
                $this->tendered_amount
                : null,

            'change_given' =>
            (float)
            $this->change_given,

            'reference_number' =>
            $this->reference_number,

            'status' =>
            $this->status,

            'received_by' =>
            $this->received_by,

            'paid_at' =>
            $this->paid_at
                ?->toISOString(),

            'notes' =>
            $this->notes,
        ];
    }
}
