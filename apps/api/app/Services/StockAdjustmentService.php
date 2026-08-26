<?php

namespace App\Services;

use App\Exceptions\StockAdjustmentOperationException;
use App\Models\BusinessDay;
use App\Models\Ingredient;
use App\Models\StockAdjustment;
use App\Models\StockMovement;
use App\Models\Unit;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;

final class StockAdjustmentService
{
    public function __construct(
        private readonly InventoryStockService $inventoryStockService,
        private readonly UnitConversionService $unitConversionService,
        private readonly AuditLogger $auditLogger
    ) {}

    public function recordPhysicalCount(
        User $actor,
        Ingredient $ingredient,
        string $clientRequestId,
        int $unitId,
        float $actualQuantity,
        string $reason
    ): array {
        $clientRequestId =
            trim(
                $clientRequestId
            );

        $reason =
            trim(
                $reason
            );

        if (
            ! Str::isUuid(
                $clientRequestId
            )
        ) {
            throw new StockAdjustmentOperationException(
                message: 'The stock count request ID must be a valid UUID.',

                errorCode: 'INVALID_STOCK_COUNT_REQUEST_ID',

                status: 422
            );
        }

        $actualQuantity =
            round(
                $actualQuantity,
                4
            );

        if (
            $actualQuantity < 0
        ) {
            throw new StockAdjustmentOperationException(
                message: 'Actual stock quantity cannot be negative.',

                errorCode: 'INVALID_ACTUAL_STOCK_QUANTITY',

                status: 422
            );
        }

        if (
            $reason === ''
        ) {
            throw new StockAdjustmentOperationException(
                message: 'A reason is required for the physical stock count.',

                errorCode: 'STOCK_ADJUSTMENT_REASON_REQUIRED',

                status: 422
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Fast Idempotency Check
        |--------------------------------------------------------------------------
        */

        $existing =
            StockAdjustment::query()
            ->where(
                'client_request_id',
                $clientRequestId
            )
            ->first();

        if ($existing) {
            $this->assertSameRequest(
                adjustment: $existing,

                ingredientId: $ingredient->id,

                unitId: $unitId,

                actualQuantity: $actualQuantity,

                reason: $reason
            );

            return [
                'adjustment' =>
                $this->loadForResponse(
                    $existing
                ),

                'movement' =>
                $existing
                    ->stockMovement,

                'created' =>
                false,
            ];
        }

        try {
            return DatabaseTransaction::run(
                function () use (
                    $actor,
                    $ingredient,
                    $clientRequestId,
                    $unitId,
                    $actualQuantity,
                    $reason
                ): array {
                    /*
                    |--------------------------------------------------------------------------
                    | Re-check request inside transaction
                    |--------------------------------------------------------------------------
                    */

                    $existing =
                        StockAdjustment::query()
                        ->where(
                            'client_request_id',
                            $clientRequestId
                        )
                        ->first();

                    if ($existing) {
                        $this->assertSameRequest(
                            adjustment: $existing,

                            ingredientId: $ingredient->id,

                            unitId: $unitId,

                            actualQuantity: $actualQuantity,

                            reason: $reason
                        );

                        return [
                            'adjustment' =>
                            $this->loadForResponse(
                                $existing
                            ),

                            'movement' =>
                            $existing
                                ->stockMovement,

                            'created' =>
                            false,
                        ];
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Open Business Day
                    |--------------------------------------------------------------------------
                    */

                    /** @var BusinessDay|null $businessDay */
                    $businessDay =
                        BusinessDay::query()
                        ->where(
                            'status',
                            BusinessDay::STATUS_OPEN
                        )
                        ->latest(
                            'opened_at'
                        )
                        ->first();

                    if (! $businessDay) {
                        throw new StockAdjustmentOperationException(
                            message: 'An open business day is required before a physical stock count can be recorded.',

                            errorCode: 'BUSINESS_DAY_NOT_OPEN',

                            status: 409
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Lock Ingredient
                    |--------------------------------------------------------------------------
                    |
                    | The physical comparison MUST happen while
                    | inventory is locked.
                    |
                    | Otherwise another sale/purchase could change
                    | stock between:
                    |
                    | reading system stock
                    | and
                    | applying the adjustment.
                    |
                    */

                    /** @var Ingredient $lockedIngredient */
                    $lockedIngredient =
                        Ingredient::query()
                        ->with(
                            'baseUnit'
                        )
                        ->lockForUpdate()
                        ->findOrFail(
                            $ingredient->id
                        );

                    if (
                        ! $lockedIngredient
                            ->is_active
                    ) {
                        throw new StockAdjustmentOperationException(
                            message: 'A physical count cannot be posted for an inactive ingredient.',

                            errorCode: 'STOCK_COUNT_INGREDIENT_INACTIVE',

                            status: 422
                        );
                    }

                    if (
                        ! $lockedIngredient
                            ->track_stock
                    ) {
                        throw new StockAdjustmentOperationException(
                            message: 'Stock tracking is disabled for this ingredient.',

                            errorCode: 'STOCK_TRACKING_DISABLED',

                            status: 422
                        );
                    }

                    if (
                        ! $lockedIngredient
                            ->baseUnit
                    ) {
                        throw new StockAdjustmentOperationException(
                            message: 'The ingredient base unit is not configured.',

                            errorCode: 'INGREDIENT_BASE_UNIT_NOT_FOUND',

                            status: 500
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Count Unit
                    |--------------------------------------------------------------------------
                    */

                    /** @var Unit|null $unit */
                    $unit =
                        Unit::query()
                        ->find(
                            $unitId
                        );

                    if (! $unit) {
                        throw new StockAdjustmentOperationException(
                            message: 'The selected stock-count unit could not be found.',

                            errorCode: 'STOCK_COUNT_UNIT_NOT_FOUND',

                            status: 422
                        );
                    }

                    if (
                        ! $unit->is_active
                    ) {
                        throw new StockAdjustmentOperationException(
                            message: 'The selected stock-count unit is inactive.',

                            errorCode: 'STOCK_COUNT_UNIT_INACTIVE',

                            status: 422
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | System Stock Snapshot
                    |--------------------------------------------------------------------------
                    */

                    $systemBaseQuantity =
                        round(
                            (float)
                            $lockedIngredient
                                ->current_stock,
                            4
                        );

                    /*
                     * Convert system base quantity to
                     * the unit used for physical counting.
                     *
                     * Example:
                     *
                     * 10000 G -> 10 KG
                     */
                    $systemQuantity =
                        $this
                        ->unitConversionService
                        ->convert(
                            quantity: $systemBaseQuantity,

                            fromUnit: $lockedIngredient
                                ->baseUnit,

                            toUnit: $unit
                        );

                    $systemQuantity =
                        round(
                            $systemQuantity,
                            4
                        );

                    /*
                     * Convert actual physical count back
                     * to the ingredient base unit.
                     *
                     * Example:
                     *
                     * 9.5 KG -> 9500 G
                     */
                    $actualBaseQuantity =
                        $this
                        ->unitConversionService
                        ->convert(
                            quantity: $actualQuantity,

                            fromUnit: $unit,

                            toUnit: $lockedIngredient
                                ->baseUnit
                        );

                    $actualBaseQuantity =
                        round(
                            $actualBaseQuantity,
                            4
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Calculate Difference
                    |--------------------------------------------------------------------------
                    */

                    $differenceBase =
                        round(
                            $actualBaseQuantity
                                -
                                $systemBaseQuantity,
                            4
                        );

                    if (
                        $differenceBase > 0
                    ) {
                        $direction =
                            StockAdjustment::DIRECTION_IN;
                    } elseif (
                        $differenceBase < 0
                    ) {
                        $direction =
                            StockAdjustment::DIRECTION_OUT;
                    } else {
                        $direction =
                            StockAdjustment::DIRECTION_NONE;
                    }

                    $absoluteBaseDifference =
                        round(
                            abs(
                                $differenceBase
                            ),
                            4
                        );

                    /*
                     * Store difference in the user's
                     * selected physical-count unit too.
                     */
                    $differenceQuantity =
                        $absoluteBaseDifference > 0
                        ? $this
                        ->unitConversionService
                        ->convert(
                            quantity: $absoluteBaseDifference,

                            fromUnit: $lockedIngredient
                                ->baseUnit,

                            toUnit: $unit
                        )
                        : 0;

                    $differenceQuantity =
                        round(
                            $differenceQuantity,
                            4
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Adjustment Record
                    |--------------------------------------------------------------------------
                    */

                    $adjustment =
                        StockAdjustment::query()
                        ->create([
                            'client_request_id' =>
                            $clientRequestId,

                            'adjustment_number' =>
                            $this
                                ->generateAdjustmentNumber(),

                            'business_day_id' =>
                            $businessDay->id,

                            'ingredient_id' =>
                            $lockedIngredient->id,

                            'unit_id' =>
                            $unit->id,

                            'system_quantity' =>
                            $systemQuantity,

                            'actual_quantity' =>
                            $actualQuantity,

                            'system_base_quantity' =>
                            $systemBaseQuantity,

                            'actual_base_quantity' =>
                            $actualBaseQuantity,

                            'direction' =>
                            $direction,

                            /*
                             * Absolute adjustment amount.
                             */
                            'quantity' =>
                            $differenceQuantity,

                            'base_quantity' =>
                            $absoluteBaseDifference,

                            /*
                             * Snapshot of cost PER BASE UNIT.
                             */
                            'unit_cost' =>
                            (float)
                            $lockedIngredient
                                ->average_cost,

                            'reason' =>
                            $reason,

                            'status' =>
                            StockAdjustment::STATUS_POSTED,

                            'created_by' =>
                            $actor->id,

                            /*
                             * Physical count does not require
                             * approval in Phase 25.
                             */
                            'approved_by' =>
                            null,

                            'posted_at' =>
                            now(),

                            'stock_movement_id' =>
                            null,
                        ]);

                    /*
                    |--------------------------------------------------------------------------
                    | Stock Movement
                    |--------------------------------------------------------------------------
                    */

                    $movement =
                        null;

                    $idempotencyKey =
                        'physical-count:' .
                        $clientRequestId;

                    if (
                        $direction
                        ===
                        StockAdjustment::DIRECTION_IN
                    ) {
                        /*
                         * Extra physical stock discovered.
                         *
                         * No new purchase cost exists, so passing
                         * null preserves the existing moving
                         * average cost.
                         */
                        $movement =
                            $this
                            ->inventoryStockService
                            ->adjustmentIn(
                                actor: $actor,

                                ingredient: $lockedIngredient,

                                quantity: $absoluteBaseDifference,

                                unitCost: null,

                                idempotencyKey: $idempotencyKey,

                                reason: $reason,

                                reference: $adjustment
                                    ->adjustment_number,

                                sourceType: StockAdjustment::class,

                                sourceId: $adjustment->id,

                                businessDayId: $businessDay->id
                            );
                    }

                    if (
                        $direction
                        ===
                        StockAdjustment::DIRECTION_OUT
                    ) {
                        $movement =
                            $this
                            ->inventoryStockService
                            ->adjustmentOut(
                                actor: $actor,

                                ingredient: $lockedIngredient,

                                quantity: $absoluteBaseDifference,

                                idempotencyKey: $idempotencyKey,

                                reason: $reason,

                                reference: $adjustment
                                    ->adjustment_number,

                                sourceType: StockAdjustment::class,

                                sourceId: $adjustment->id,

                                businessDayId: $businessDay->id
                            );
                    }

                    /*
                     * Matching physical/system stock:
                     *
                     * record count
                     * but create NO movement.
                     */
                    if ($movement) {
                        $adjustment
                            ->update([
                                'stock_movement_id' =>
                                $movement->id,
                            ]);
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Audit
                    |--------------------------------------------------------------------------
                    */

                    $this
                        ->auditLogger
                        ->record(
                            action: 'PHYSICAL_STOCK_COUNT_RECORDED',

                            entityType: 'stock_adjustment',

                            entityId: $adjustment->id,

                            newValues: [
                                'adjustment_number' =>
                                $adjustment
                                    ->adjustment_number,

                                'ingredient_id' =>
                                $lockedIngredient->id,

                                'unit_id' =>
                                $unit->id,

                                'system_quantity' =>
                                $systemQuantity,

                                'actual_quantity' =>
                                $actualQuantity,

                                'system_base_quantity' =>
                                $systemBaseQuantity,

                                'actual_base_quantity' =>
                                $actualBaseQuantity,

                                'difference_quantity' =>
                                match ($direction) {
                                    StockAdjustment::DIRECTION_IN =>
                                    $differenceQuantity,

                                    StockAdjustment::DIRECTION_OUT =>
                                    -$differenceQuantity,

                                    default =>
                                    0,
                                },

                                'difference_base_quantity' =>
                                $differenceBase,

                                'direction' =>
                                $direction,

                                'reason' =>
                                $reason,

                                'stock_movement_id' =>
                                $movement?->id,
                            ],

                            metadata: [
                                'client_request_id' =>
                                $clientRequestId,

                                'stock_movement_type' =>
                                $movement
                                    ?->movement_type,

                                'posted_at' =>
                                $adjustment
                                    ->posted_at
                                    ?->toISOString(),
                            ],

                            userId: $actor->id
                        );

                    return [
                        'adjustment' =>
                        $this
                            ->loadForResponse(
                                $adjustment
                            ),

                        'movement' =>
                        $movement,

                        'created' =>
                        true,
                    ];
                }
            );
        } catch (
            QueryException $exception
        ) {
            /*
             * Concurrent duplicate protection.
             */
            $existing =
                StockAdjustment::query()
                ->where(
                    'client_request_id',
                    $clientRequestId
                )
                ->first();

            if (! $existing) {
                throw $exception;
            }

            $this->assertSameRequest(
                adjustment: $existing,

                ingredientId: $ingredient->id,

                unitId: $unitId,

                actualQuantity: $actualQuantity,

                reason: $reason
            );

            return [
                'adjustment' =>
                $this
                    ->loadForResponse(
                        $existing
                    ),

                'movement' =>
                $existing
                    ->stockMovement,

                'created' =>
                false,
            ];
        }
    }

    private function assertSameRequest(
        StockAdjustment $adjustment,
        int $ingredientId,
        int $unitId,
        float $actualQuantity,
        string $reason
    ): void {
        $same =
            (int)
            $adjustment
                ->ingredient_id
            ===
            $ingredientId
            &&
            (int)
            $adjustment
                ->unit_id
            ===
            $unitId
            &&
            abs(
                (float)
                $adjustment
                    ->actual_quantity
                    -
                    $actualQuantity
            )
            <
            0.000001
            &&
            $adjustment
            ->reason
            ===
            $reason;

        if (! $same) {
            throw new StockAdjustmentOperationException(
                message: 'This stock-count request ID has already been used for different data.',

                errorCode: 'STOCK_COUNT_IDEMPOTENCY_KEY_REUSED',

                status: 409
            );
        }
    }

    private function generateAdjustmentNumber(): string
    {
        return sprintf(
            'ADJ-%s-%s',
            now()->format(
                'Ymd'
            ),
            Str::upper(
                (string)
                Str::ulid()
            )
        );
    }

    private function loadForResponse(
        StockAdjustment $adjustment
    ): StockAdjustment {
        return $adjustment
            ->fresh([
                'businessDay',
                'ingredient.baseUnit',
                'unit',
                'createdBy',
                'approvedBy',
                'stockMovement',
            ]);
    }
}
