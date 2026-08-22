<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SupplierPaymentResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'payment_number' =>
            $this->payment_number,

            'payment_date' =>
            $this->payment_date
                ?->format('Y-m-d'),

            'payment_method' =>
            $this->payment_method,

            'amount' =>
            (float) $this->amount,

            'reference' =>
            $this->reference,

            'notes' =>
            $this->notes,

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
