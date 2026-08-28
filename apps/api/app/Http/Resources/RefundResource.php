<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class RefundResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        $this->resource
            ->loadMissing([
                'initiatedBy',
                'authorizedBy',
                'processedBy',
            ]);

        return [
            'id' =>
            $this->id,

            'refund_number' =>
            $this->refund_number,

            'invoice_id' =>
            $this->invoice_id,

            'payment_id' =>
            $this->payment_id,

            'business_day_id' =>
            $this->business_day_id,

            'cashier_shift_id' =>
            $this->cashier_shift_id,

            'amount' =>
            (float)
            $this->amount,

            'refund_method' =>
            $this->refund_method,

            'status' =>
            $this->status,

            'reason' =>
            $this->reason,

            'initiated_by' =>
            $this->initiatedBy
                ? [
                    'id' =>
                    $this->initiatedBy->id,

                    'name' =>
                    $this->initiatedBy->name,
                ]
                : null,

            'authorized_by' =>
            $this->authorizedBy
                ? [
                    'id' =>
                    $this->authorizedBy->id,

                    'name' =>
                    $this->authorizedBy->name,
                ]
                : null,

            'processed_by' =>
            $this->processedBy
                ? [
                    'id' =>
                    $this->processedBy->id,

                    'name' =>
                    $this->processedBy->name,
                ]
                : null,

            'refunded_at' =>
            $this->refunded_at
                ?->toISOString(),

            'created_at' =>
            $this->created_at
                ?->toISOString(),
        ];
    }
}
