<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CashierShiftResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'shift_number' =>
            $this->shift_number,

            'business_day_id' =>
            $this->business_day_id,

            'cashier_id' =>
            $this->cashier_id,

            'opening_cash' =>
            (float)
            $this->opening_float,

            'expected_cash' =>
            (float)
            $this->expected_cash,

            'actual_cash' =>
            $this->actual_cash !== null
                ? (float)
                $this->actual_cash
                : null,

            'cash_difference' =>
            $this->cash_difference !== null
                ? (float)
                $this->cash_difference
                : null,

            'status' =>
            $this->status,

            'opened_at' =>
            $this->opened_at
                ?->toISOString(),

            'closed_at' =>
            $this->closed_at
                ?->toISOString(),

            'closed_by' =>
            $this->closed_by,

            'opening_notes' =>
            $this->opening_notes,

            'closing_notes' =>
            $this->closing_notes,
        ];
    }
}
