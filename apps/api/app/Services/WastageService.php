<?php

namespace App\Services;

use App\Exceptions\WastageOperationException;
use App\Models\BusinessDay;
use App\Models\Ingredient;
use App\Models\Unit;
use App\Models\User;
use App\Models\Wastage;
use App\Support\DatabaseTransaction;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;

final class WastageService
{
    public function __construct(
        private readonly InventoryStockService $inventoryStockService,
        private readonly UnitConversionService $unitConversionService,
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Create Ingredient Wastage
    |--------------------------------------------------------------------------
    */

    public function createIngredientWastage(
        User $actor,
        string $clientRequestId,
        int $ingredientId,
        int $unitId,
        float $quantity,
        string $reasonCode,
        ?string $reason = null
    ): array {
        $clientRequestId =
            trim(
                $clientRequestId
            );

        $reasonCode =
            strtoupper(
                trim(
                    $reasonCode
                )
            );

        $reason =
            $reason !== null
            ? trim(
                $reason
            )
            : null;

        /*
        |--------------------------------------------------------------------------
        | Basic Validation
        |--------------------------------------------------------------------------
        */

        if (
            ! Str::isUuid(
                $clientRequestId
            )
        ) {
            throw new WastageOperationException(
                message: 'The wastage client request ID must be a valid UUID.',

                errorCode: 'INVALID_WASTAGE_REQUEST_ID',

                status: 422
            );
        }

        $quantity =
            round(
                $quantity,
                4
            );

        if (
            $quantity <= 0
        ) {
            throw new WastageOperationException(
                message: 'Wastage quantity must be greater than zero.',

                errorCode: 'INVALID_WASTAGE_QUANTITY',

                status: 422
            );
        }

        if (
            ! in_array(
                $reasonCode,
                Wastage::reasonCodes(),
                true
            )
        ) {
            throw new WastageOperationException(
                message: 'The selected wastage reason is invalid.',

                errorCode: 'INVALID_WASTAGE_REASON',

                status: 422
            );
        }

        if (
            $reasonCode
            === Wastage::REASON_OTHER
            &&
            (
                $reason === null
                ||
                $reason === ''
            )
        ) {
            throw new WastageOperationException(
                message: 'A description is required when the wastage reason is Other.',

                errorCode: 'WASTAGE_REASON_REQUIRED',

                status: 422
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Fast Idempotency Check
        |--------------------------------------------------------------------------
        */

        $existing =
            Wastage::query()
            ->where(
                'client_request_id',
                $clientRequestId
            )
            ->first();

        if ($existing) {
            $this->assertSameRequest(
                wastage: $existing,

                ingredientId: $ingredientId,

                unitId: $unitId,

                quantity: $quantity,

                reasonCode: $reasonCode,

                reason: $reason
            );

            return [
                'wastage' =>
                $this->loadForResponse(
                    $existing
                ),

                'created' =>
                false,
            ];
        }

        try {
            return DatabaseTransaction::run(
                function () use (
                    $actor,
                    $clientRequestId,
                    $ingredientId,
                    $unitId,
                    $quantity,
                    $reasonCode,
                    $reason
                ): array {
                    /*
                    |--------------------------------------------------------------------------
                    | Re-check Idempotency Inside Transaction
                    |--------------------------------------------------------------------------
                    */

                    $existing =
                        Wastage::query()
                        ->where(
                            'client_request_id',
                            $clientRequestId
                        )
                        ->first();

                    if ($existing) {
                        $this->assertSameRequest(
                            wastage: $existing,

                            ingredientId: $ingredientId,

                            unitId: $unitId,

                            quantity: $quantity,

                            reasonCode: $reasonCode,

                            reason: $reason
                        );

                        return [
                            'wastage' =>
                            $this->loadForResponse(
                                $existing
                            ),

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
                        throw new WastageOperationException(
                            message: 'An open business day is required before wastage can be recorded.',

                            errorCode: 'BUSINESS_DAY_NOT_OPEN',

                            status: 409
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Ingredient
                    |--------------------------------------------------------------------------
                    */

                    /** @var Ingredient|null $ingredient */
                    $ingredient =
                        Ingredient::query()
                        ->with(
                            'baseUnit'
                        )
                        ->find(
                            $ingredientId
                        );

                    if (! $ingredient) {
                        throw new WastageOperationException(
                            message: 'The selected ingredient could not be found.',

                            errorCode: 'WASTAGE_INGREDIENT_NOT_FOUND',

                            status: 422
                        );
                    }

                    if (
                        ! $ingredient->is_active
                    ) {
                        throw new WastageOperationException(
                            message: 'Wastage cannot be recorded for an inactive ingredient.',

                            errorCode: 'WASTAGE_INGREDIENT_INACTIVE',

                            status: 422
                        );
                    }

                    if (
                        ! $ingredient->track_stock
                    ) {
                        throw new WastageOperationException(
                            message: 'Stock tracking is disabled for the selected ingredient.',

                            errorCode: 'WASTAGE_STOCK_TRACKING_DISABLED',

                            status: 422
                        );
                    }

                    if (
                        ! $ingredient->baseUnit
                    ) {
                        throw new WastageOperationException(
                            message: 'The ingredient base unit is not configured.',

                            errorCode: 'WASTAGE_BASE_UNIT_NOT_FOUND',

                            status: 500
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Entered Unit
                    |--------------------------------------------------------------------------
                    */

                    /** @var Unit|null $unit */
                    $unit =
                        Unit::query()
                        ->find(
                            $unitId
                        );

                    if (! $unit) {
                        throw new WastageOperationException(
                            message: 'The selected unit could not be found.',

                            errorCode: 'WASTAGE_UNIT_NOT_FOUND',

                            status: 422
                        );
                    }

                    if (
                        ! $unit->is_active
                    ) {
                        throw new WastageOperationException(
                            message: 'The selected unit is inactive.',

                            errorCode: 'WASTAGE_UNIT_INACTIVE',

                            status: 422
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Convert To Ingredient Base Unit
                    |--------------------------------------------------------------------------
                    |
                    | Example:
                    |
                    | 2 KG
                    |  ↓
                    | 2000 G
                    |
                    */

                    $baseQuantity =
                        $this
                        ->unitConversionService
                        ->convert(
                            quantity: $quantity,

                            fromUnit: $unit,

                            toUnit: $ingredient
                                ->baseUnit
                        );

                    $baseQuantity =
                        round(
                            $baseQuantity,
                            4
                        );

                    if (
                        $baseQuantity <= 0
                    ) {
                        throw new WastageOperationException(
                            message: 'The converted wastage quantity must be greater than zero.',

                            errorCode: 'INVALID_WASTAGE_BASE_QUANTITY',

                            status: 422
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Create Wastage Record First
                    |--------------------------------------------------------------------------
                    |
                    | This is still inside the outer transaction.
                    |
                    | If inventory deduction fails, this row is rolled back.
                    |
                    */

                    $wastage =
                        Wastage::query()
                        ->create([
                            'client_request_id' =>
                            $clientRequestId,

                            'wastage_number' =>
                            $this->generateWastageNumber(),

                            'business_day_id' =>
                            $businessDay->id,

                            'wastage_type' =>
                            Wastage::TYPE_INGREDIENT,

                            'ingredient_id' =>
                            $ingredient->id,

                            'menu_item_id' =>
                            null,

                            'unit_id' =>
                            $unit->id,

                            'quantity' =>
                            $quantity,

                            'base_quantity' =>
                            $baseQuantity,

                            'reason_code' =>
                            $reasonCode,

                            'reason' =>
                            $reason,

                            /*
                             * Updated from the actual immutable
                             * stock movement below.
                             */
                            'estimated_cost' =>
                            0,

                            'status' =>
                            Wastage::STATUS_POSTED,

                            'created_by' =>
                            $actor->id,

                            'wasted_at' =>
                            now(),
                        ]);

                    /*
                    |--------------------------------------------------------------------------
                    | Immutable WASTAGE Stock Movement
                    |--------------------------------------------------------------------------
                    |
                    | Deterministic key tied to this wastage record.
                    |
                    */

                    $movementKey =
                        sprintf(
                            'wastage:%d:ingredient:%d',
                            $wastage->id,
                            $ingredient->id
                        );

                    $movement =
                        $this
                        ->inventoryStockService
                        ->recordWastage(
                            actor: $actor,

                            ingredient: $ingredient,

                            quantity: $baseQuantity,

                            movementKey: $movementKey,

                            sourceType: 'wastage',

                            sourceId: (int)
                            $wastage->id,

                            reference: $wastage
                                ->wastage_number,

                            notes: $this->movementNotes(
                                $reasonCode,
                                $reason
                            ),

                            businessDayId: $businessDay->id
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Wastage Value
                    |--------------------------------------------------------------------------
                    |
                    | The stock movement already captured the exact current
                    | average cost used for this stock deduction.
                    |
                    | total_cost is negative because stock left inventory.
                    |
                    | Wastage value must be stored as a positive amount.
                    |
                    */

                    $estimatedCost =
                        round(
                            abs(
                                (float)
                                $movement
                                    ->total_cost
                            ),
                            2
                        );

                    $wastage
                        ->update([
                            'estimated_cost' =>
                            $estimatedCost,
                        ]);

                    /*
                    |--------------------------------------------------------------------------
                    | Audit
                    |--------------------------------------------------------------------------
                    */

                    $this
                        ->auditLogger
                        ->record(
                            action: 'WASTAGE_RECORDED',

                            entityType: 'wastage',

                            entityId: $wastage->id,

                            newValues: [
                                'wastage_number' =>
                                $wastage
                                    ->wastage_number,

                                'ingredient_id' =>
                                $ingredient->id,

                                'quantity' =>
                                $quantity,

                                'unit_id' =>
                                $unit->id,

                                'base_quantity' =>
                                $baseQuantity,

                                'reason_code' =>
                                $reasonCode,

                                'estimated_cost' =>
                                $estimatedCost,

                                'stock_movement_id' =>
                                $movement->id,
                            ],

                            metadata: [
                                'client_request_id' =>
                                $clientRequestId,

                                'stock_movement_key' =>
                                $movement
                                    ->movement_key,
                            ],

                            userId: $actor->id
                        );

                    return [
                        'wastage' =>
                        $this->loadForResponse(
                            $wastage
                        ),

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
             *
             * If another request inserted the same
             * client_request_id first, return that row.
             */

            $existing =
                Wastage::query()
                ->where(
                    'client_request_id',
                    $clientRequestId
                )
                ->first();

            if (! $existing) {
                throw $exception;
            }

            $this->assertSameRequest(
                wastage: $existing,

                ingredientId: $ingredientId,

                unitId: $unitId,

                quantity: $quantity,

                reasonCode: $reasonCode,

                reason: $reason
            );

            return [
                'wastage' =>
                $this->loadForResponse(
                    $existing
                ),

                'created' =>
                false,
            ];
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotency Validation
    |--------------------------------------------------------------------------
    */

    private function assertSameRequest(
        Wastage $wastage,
        int $ingredientId,
        int $unitId,
        float $quantity,
        string $reasonCode,
        ?string $reason
    ): void {
        $same =
            (int)
            $wastage->ingredient_id
            === $ingredientId
            &&
            (int)
            $wastage->unit_id
            === $unitId
            &&
            abs(
                (float)
                $wastage->quantity
                    -
                    $quantity
            ) < 0.000001
            &&
            $wastage->reason_code
            === $reasonCode
            &&
            (
                $wastage->reason
                ?? null
            )
            ===
            (
                $reason
                ?: null
            );

        if (! $same) {
            throw new WastageOperationException(
                message: 'This wastage request ID has already been used for different wastage data.',

                errorCode: 'WASTAGE_IDEMPOTENCY_KEY_REUSED',

                status: 409
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Number Generation
    |--------------------------------------------------------------------------
    */

    private function generateWastageNumber(): string
    {
        return sprintf(
            'WST-%s-%s',

            now()->format(
                'Ymd'
            ),

            Str::upper(
                (string)
                Str::ulid()
            )
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Movement Notes
    |--------------------------------------------------------------------------
    */

    private function movementNotes(
        string $reasonCode,
        ?string $reason
    ): string {
        $label =
            Wastage::reasonLabels()[$reasonCode]
            ?? $reasonCode;

        if (
            $reason !== null
            &&
            $reason !== ''
        ) {
            return sprintf(
                'Wastage: %s. %s',
                $label,
                $reason
            );
        }

        return sprintf(
            'Wastage: %s.',
            $label
        );
    }

    private function loadForResponse(
        Wastage $wastage
    ): Wastage {
        return $wastage
            ->fresh([
                'businessDay',
                'ingredient.baseUnit',
                'unit',
                'createdBy',
            ]);
    }
}
