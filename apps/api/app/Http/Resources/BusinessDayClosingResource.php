<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BusinessDayClosingResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'business_day_id' =>
            $this->business_day_id,

            'business_day' =>
            $this->businessDay
                ? (
                    new BusinessDayResource(
                        $this->businessDay
                    )
                )->resolve(
                    $request
                )
                : null,

            /*
            |--------------------------------------------------------------------------
            | Headline Financial Snapshot
            |--------------------------------------------------------------------------
            */

            'total_sales' =>
            (float)
            $this->total_sales,

            'total_discounts' =>
            (float)
            $this->total_discounts,

            'total_refunds' =>
            (float)
            $this->total_refunds,

            'payments' => [
                'cash' =>
                (float)
                $this->cash_sales,

                'card' =>
                (float)
                $this->card_sales,

                'qr' =>
                (float)
                $this->qr_sales,

                'bank_transfer' =>
                (float)
                $this->bank_sales,

                'other' =>
                (float)
                $this->other_sales,
            ],

            'total_cogs' =>
            (float)
            $this->total_cogs,

            'gross_profit' =>
            (float)
            $this->gross_profit,

            'total_expenses' =>
            (float)
            $this->total_expenses,

            'total_wastage_cost' =>
            (float)
            $this->total_wastage_cost,

            'estimated_net_profit' =>
            (float)
            $this->estimated_net_profit,

            'total_purchases' =>
            (float)
            $this->total_purchases,

            'supplier_payments' =>
            (float)
            $this->supplier_payments,

            /*
            |--------------------------------------------------------------------------
            | Cash Reconciliation
            |--------------------------------------------------------------------------
            */

            'expected_cash' =>
            (float)
            $this->expected_cash,

            'actual_cash' =>
            (float)
            $this->actual_cash,

            'cash_difference' =>
            (float)
            $this->cash_difference,

            /*
            |--------------------------------------------------------------------------
            | Full Immutable Snapshot
            |--------------------------------------------------------------------------
            */

            'snapshot' =>
            $this->snapshot,

            /*
            |--------------------------------------------------------------------------
            | Closing
            |--------------------------------------------------------------------------
            */

            'closed_by' =>
            $this->closedBy
                ? [
                    'id' =>
                    $this
                        ->closedBy
                        ->id,

                    'name' =>
                    $this
                        ->closedBy
                        ->name,
                ]
                : null,

            'closed_at' =>
            $this
                ->closed_at
                ?->toISOString(),

            'closing_notes' =>
            $this->closing_notes,

            'created_at' =>
            $this
                ->created_at
                ?->toISOString(),
        ];
    }
}
