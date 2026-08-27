<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CashDrawerMovementResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'cashier_shift_id' =>
            $this->cashier_shift_id,

            'movement_type' =>
            $this->movement_type,

            'amount' =>
            (float)
            $this->amount,

            'reference_type' =>
            $this->reference_type,

            'reference_id' =>
            $this->reference_id,

            'reason' =>
            $this->reason,

            'created_by' =>
            $this->created_by,

            'occurred_at' =>
            $this->occurred_at
                ?->toISOString(),
        ];
    }
}
