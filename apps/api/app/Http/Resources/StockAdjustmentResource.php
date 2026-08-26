<?php

namespace App\Http\Resources;

use App\Models\StockAdjustment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin StockAdjustment
 */
class StockAdjustmentResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        $difference =
            $this->signedDifference();

        $baseDifference =
            $this->signedBaseDifference();

        return [
            'id' =>
            $this->id,

            'client_request_id' =>
            $this->client_request_id,

            'adjustment_number' =>
            $this->adjustment_number,

            'status' =>
            $this->status,

            'direction' =>
            $this->direction,

            'business_day_id' =>
            $this->business_day_id,

            'ingredient' =>
            $this->ingredient
                ? [
                    'id' =>
                    $this
                        ->ingredient
                        ->id,

                    'sku' =>
                    $this
                        ->ingredient
                        ->sku,

                    'name' =>
                    $this
                        ->ingredient
                        ->name,

                    'current_stock' =>
                    (float)
                    $this
                        ->ingredient
                        ->current_stock,

                    'base_unit' =>
                    $this
                        ->ingredient
                        ->baseUnit
                        ? [
                            'id' =>
                            $this
                                ->ingredient
                                ->baseUnit
                                ->id,

                            'name' =>
                            $this
                                ->ingredient
                                ->baseUnit
                                ->name,

                            'symbol' =>
                            $this
                                ->ingredient
                                ->baseUnit
                                ->symbol,
                        ]
                        : null,
                ]
                : null,

            'count_unit' =>
            $this->unit
                ? [
                    'id' =>
                    $this
                        ->unit
                        ->id,

                    'name' =>
                    $this
                        ->unit
                        ->name,

                    'symbol' =>
                    $this
                        ->unit
                        ->symbol,
                ]
                : null,

            'system_quantity' =>
            (float)
            $this->system_quantity,

            'actual_quantity' =>
            (float)
            $this->actual_quantity,

            /*
             * Signed:
             *
             * -0.5 = OUT
             * +0.5 = IN
             *  0   = NONE
             */
            'difference_quantity' =>
            $difference,

            'system_base_quantity' =>
            (float)
            $this->system_base_quantity,

            'actual_base_quantity' =>
            (float)
            $this->actual_base_quantity,

            'difference_base_quantity' =>
            $baseDifference,

            'unit_cost_per_base_unit' =>
            (float)
            $this->unit_cost,

            'adjustment_value' =>
            round(
                abs(
                    $baseDifference
                )
                    *
                    (float)
                    $this->unit_cost,
                2
            ),

            'reason' =>
            $this->reason,

            /*
             * Mandatory user information.
             */
            'created_by' =>
            $this->createdBy
                ? [
                    'id' =>
                    $this
                        ->createdBy
                        ->id,

                    'name' =>
                    $this
                        ->createdBy
                        ->name,
                ]
                : null,

            /*
             * Mandatory server date/time.
             */
            'posted_at' =>
            $this
                ->posted_at
                ?->toISOString(),

            'stock_movement' =>
            $this->stockMovement
                ? [
                    'id' =>
                    $this
                        ->stockMovement
                        ->id,

                    'movement_type' =>
                    $this
                        ->stockMovement
                        ->movement_type,

                    'quantity_delta' =>
                    (float)
                    $this
                        ->stockMovement
                        ->quantity_delta,

                    'balance_after' =>
                    (float)
                    $this
                        ->stockMovement
                        ->balance_after,

                    'unit_cost' =>
                    (float)
                    $this
                        ->stockMovement
                        ->unit_cost,

                    'total_cost' =>
                    (float)
                    $this
                        ->stockMovement
                        ->total_cost,
                ]
                : null,

            'created_at' =>
            $this
                ->created_at
                ?->toISOString(),
        ];
    }
}
