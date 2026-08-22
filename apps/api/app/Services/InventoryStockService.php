<?php

namespace App\Services;

use App\Exceptions\InventoryOperationException;
use App\Models\BusinessDay;
use App\Models\Ingredient;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\StockMovement;
use App\Models\User;
use App\Support\DatabaseTransaction;

final class InventoryStockService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Opening Balance
    |--------------------------------------------------------------------------
    */

    public function openingBalance(
        User $actor,
        Ingredient $ingredient,
        float $quantity,
        float $unitCost,
        string $idempotencyKey,
        ?string $reference = null,
        ?string $notes = null
    ): StockMovement {
        $movementKey =
            'opening-balance:' .
            $idempotencyKey;

        $existing =
            $this->findExistingMovement(
                movementKey: $movementKey,

                ingredientId: $ingredient->id,

                movementType: StockMovement::TYPE_OPENING_BALANCE,

                expectedQuantityDelta: $quantity
            );

        if ($existing) {
            return $existing;
        }

        return DatabaseTransaction::run(
            function () use (
                $actor,
                $ingredient,
                $quantity,
                $unitCost,
                $movementKey,
                $reference,
                $notes
            ): StockMovement {
                $existing =
                    $this->findExistingMovement(
                        movementKey: $movementKey,

                        ingredientId: $ingredient->id,

                        movementType: StockMovement::TYPE_OPENING_BALANCE,

                        expectedQuantityDelta: $quantity
                    );

                if ($existing) {
                    return $existing;
                }

                /** @var Ingredient $locked */
                $locked =
                    Ingredient::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $ingredient->id
                    );

                $this->ensureStockTracked(
                    $locked
                );

                /*
                 * Opening balance is allowed only
                 * before any real stock history exists.
                 */
                if (
                    $locked
                    ->stockMovements()
                    ->exists()
                ) {
                    throw new InventoryOperationException(
                        message: 'Opening balance cannot be entered because this ingredient already has stock history.',

                        errorCode: 'OPENING_BALANCE_ALREADY_EXISTS'
                    );
                }

                if (
                    abs(
                        (float)
                        $locked->current_stock
                    ) > 0.000001
                ) {
                    throw new InventoryOperationException(
                        message: 'Opening balance cannot be entered because current stock is not zero.',

                        errorCode: 'OPENING_STOCK_NOT_ZERO'
                    );
                }

                if ($quantity <= 0) {
                    throw new InventoryOperationException(
                        message: 'Opening stock must be greater than zero.',

                        errorCode: 'INVALID_OPENING_QUANTITY',

                        status: 422
                    );
                }

                if ($unitCost < 0) {
                    throw new InventoryOperationException(
                        message: 'Opening unit cost cannot be negative.',

                        errorCode: 'INVALID_UNIT_COST',

                        status: 422
                    );
                }

                $newStock =
                    round(
                        $quantity,
                        4
                    );

                $averageCost =
                    round(
                        $unitCost,
                        4
                    );

                $locked->current_stock =
                    $newStock;

                $locked->average_cost =
                    $averageCost;

                $locked->save();

                $movement =
                    $this->createMovement(
                        movementKey: $movementKey,

                        ingredient: $locked,

                        actor: $actor,

                        movementType: StockMovement::TYPE_OPENING_BALANCE,

                        quantityDelta: $newStock,

                        balanceAfter: $newStock,

                        unitCost: $averageCost,

                        sourceType: Ingredient::class,

                        sourceId: $locked->id,

                        reference: $reference,

                        notes: $notes
                    );

                $this->auditMovement(
                    $actor,
                    $movement
                );

                return $movement;
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Manual Adjustment IN
    |--------------------------------------------------------------------------
    */

    public function adjustmentIn(
        User $actor,
        Ingredient $ingredient,
        float $quantity,
        ?float $unitCost,
        string $idempotencyKey,
        string $reason,
        ?string $reference = null
    ): StockMovement {
        $movementKey =
            'adjustment-in:' .
            $idempotencyKey;

        return $this->recordInbound(
            actor: $actor,

            ingredient: $ingredient,

            movementType: StockMovement::TYPE_ADJUSTMENT_IN,

            quantity: $quantity,

            unitCost: $unitCost,

            movementKey: $movementKey,

            sourceType: Ingredient::class,

            sourceId: $ingredient->id,

            reference: $reference,

            notes: $reason,

            updateAverageCost: true
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Manual Adjustment OUT
    |--------------------------------------------------------------------------
    */

    public function adjustmentOut(
        User $actor,
        Ingredient $ingredient,
        float $quantity,
        string $idempotencyKey,
        string $reason,
        ?string $reference = null
    ): StockMovement {
        $movementKey =
            'adjustment-out:' .
            $idempotencyKey;

        return $this->recordOutbound(
            actor: $actor,

            ingredient: $ingredient,

            movementType: StockMovement::TYPE_ADJUSTMENT_OUT,

            quantity: $quantity,

            movementKey: $movementKey,

            sourceType: Ingredient::class,

            sourceId: $ingredient->id,

            reference: $reference,

            notes: $reason
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Purchase Stock IN
    |--------------------------------------------------------------------------
    */

    public function receivePurchase(
        User $actor,
        Purchase $purchase,
        PurchaseItem $purchaseItem,
        Ingredient $ingredient,
        float $baseQuantity,
        float $baseUnitCost,
        ?int $businessDayId = null
    ): StockMovement {
        /*
         * Deterministic movement key.
         *
         * One purchase item can enter inventory only once.
         */
        $movementKey =
            sprintf(
                'purchase:%d:item:%d',
                $purchase->id,
                $purchaseItem->id
            );

        return $this->recordInbound(
            actor: $actor,

            ingredient: $ingredient,

            movementType: StockMovement::TYPE_PURCHASE,

            quantity: $baseQuantity,

            unitCost: $baseUnitCost,

            movementKey: $movementKey,

            sourceType: PurchaseItem::class,

            sourceId: $purchaseItem->id,

            reference: $purchase->purchase_number,

            notes: sprintf(
                'Stock received from purchase %s.',
                $purchase->purchase_number
            ),

            businessDayId: $businessDayId,

            updateAverageCost: true
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Sale Consumption
    |--------------------------------------------------------------------------
    |
    | Phase 13+ recipes will call this.
    |
    */

    public function consumeSaleBatch(
        User $actor,
        array $requirements,
        string $movementKeyPrefix,
        string $sourceType,
        int $sourceId,
        ?string $reference = null,
        ?string $notes = null,
        ?int $businessDayId = null
    ): array {
        if ($requirements === []) {
            throw new InventoryOperationException(
                message: 'At least one ingredient is required for sale consumption.',

                errorCode: 'EMPTY_SALE_CONSUMPTION',

                status: 422
            );
        }

        /*
         * Aggregate duplicates as a safety layer.
         */
        $normalized =
            [];

        foreach (
            $requirements as $requirement
        ) {
            $ingredientId =
                (int)
                $requirement['ingredient_id'];

            $quantity =
                round(
                    (float)
                    $requirement['quantity'],
                    4
                );

            if ($quantity <= 0) {
                throw new InventoryOperationException(
                    message: 'Sale consumption quantity must be greater than zero.',

                    errorCode: 'INVALID_STOCK_QUANTITY',

                    status: 422
                );
            }

            if (
                ! isset(
                    $normalized[$ingredientId]
                )
            ) {
                $normalized[$ingredientId] = 0.0;
            }

            $normalized[$ingredientId] +=
                $quantity;
        }

        ksort(
            $normalized
        );

        /*
         * One deterministic movement per ingredient
         * for this sale/order event.
         */
        $movementKeys =
            [];

        foreach (
            $normalized
            as $ingredientId => $quantity
        ) {
            $movementKeys[$ingredientId] =
                'sale:' .
                hash(
                    'sha256',
                    implode(
                        '|',
                        [
                            $movementKeyPrefix,
                            $sourceType,
                            (string)
                            $sourceId,
                            (string)
                            $ingredientId,
                        ]
                    )
                );
        }

        return DatabaseTransaction::run(
            function () use (
                $actor,
                $normalized,
                $movementKeys,
                $sourceType,
                $sourceId,
                $reference,
                $notes,
                $businessDayId
            ): array {
                $ingredientIds =
                    array_keys(
                        $normalized
                    );

                /*
                 * Always lock ingredients in ID order
                 * to reduce deadlock risk.
                 */
                $ingredients =
                    Ingredient::query()
                    ->whereIn(
                        'id',
                        $ingredientIds
                    )
                    ->orderBy('id')
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');

                if (
                    $ingredients->count()
                    !== count(
                        $ingredientIds
                    )
                ) {
                    throw new InventoryOperationException(
                        message: 'One or more recipe ingredients could not be found.',

                        errorCode: 'SALE_INGREDIENT_NOT_FOUND',

                        status: 422
                    );
                }

                /*
                 * Re-check idempotency AFTER acquiring
                 * ingredient locks.
                 */
                $existing =
                    StockMovement::query()
                    ->whereIn(
                        'movement_key',
                        array_values(
                            $movementKeys
                        )
                    )
                    ->get()
                    ->keyBy(
                        'movement_key'
                    );

                if (
                    $existing->count()
                    === count(
                        $normalized
                    )
                ) {
                    $movements =
                        [];

                    foreach (
                        $normalized
                        as $ingredientId => $quantity
                    ) {
                        $key =
                            $movementKeys[$ingredientId];

                        /** @var StockMovement $movement */
                        $movement =
                            $existing[$key];

                        $expectedDelta =
                            -round(
                                $quantity,
                                4
                            );

                        $valid =
                            $movement
                            ->ingredient_id
                            === $ingredientId
                            &&
                            $movement
                            ->movement_type
                            === StockMovement::TYPE_SALE_CONSUMPTION
                            &&
                            abs(
                                (float)
                                $movement
                                    ->quantity_delta
                                    -
                                    $expectedDelta
                            ) < 0.000001;

                        if (! $valid) {
                            throw new InventoryOperationException(
                                message: 'Sale-consumption idempotency key was reused for different stock data.',

                                errorCode: 'STOCK_IDEMPOTENCY_KEY_REUSED'
                            );
                        }

                        $movements[] =
                            $movement;
                    }

                    return $movements;
                }

                /*
                 * Because the operation is atomic,
                 * either every ingredient movement
                 * exists or none should exist.
                 */
                if (
                    $existing->isNotEmpty()
                ) {
                    throw new InventoryOperationException(
                        message: 'A partially recorded sale-consumption state was detected.',

                        errorCode: 'PARTIAL_SALE_CONSUMPTION_STATE',

                        status: 500
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Preflight ALL ingredients
                |--------------------------------------------------------------------------
                |
                | Nothing is deducted until every ingredient
                | has enough stock.
                |
                */

                foreach (
                    $normalized
                    as $ingredientId => $quantity
                ) {
                    /** @var Ingredient $ingredient */
                    $ingredient =
                        $ingredients[$ingredientId];

                    $this->ensureStockTracked(
                        $ingredient
                    );

                    $currentStock =
                        (float)
                        $ingredient
                            ->current_stock;

                    if (
                        $quantity
                        > $currentStock
                        + 0.000001
                    ) {
                        throw new InventoryOperationException(
                            message: sprintf(
                                'Insufficient stock for %s. Available: %.4f, required: %.4f.',
                                $ingredient->name,
                                $currentStock,
                                $quantity
                            ),

                            errorCode: 'INSUFFICIENT_STOCK',

                            status: 409
                        );
                    }
                }

                $resolvedBusinessDayId =
                    $businessDayId
                    ?? $this
                    ->currentBusinessDayId();

                $movements =
                    [];

                /*
                |--------------------------------------------------------------------------
                | Apply ALL deductions
                |--------------------------------------------------------------------------
                */

                foreach (
                    $normalized
                    as $ingredientId => $quantity
                ) {
                    /** @var Ingredient $ingredient */
                    $ingredient =
                        $ingredients[$ingredientId];

                    $currentStock =
                        (float)
                        $ingredient
                            ->current_stock;

                    $unitCost =
                        (float)
                        $ingredient
                            ->average_cost;

                    $newStock =
                        round(
                            max(
                                0,
                                $currentStock
                                    - $quantity
                            ),
                            4
                        );

                    $ingredient->current_stock =
                        $newStock;

                    $ingredient->save();

                    $movement =
                        $this->createMovement(
                            movementKey: $movementKeys[$ingredientId],

                            ingredient: $ingredient,

                            actor: $actor,

                            movementType: StockMovement::TYPE_SALE_CONSUMPTION,

                            quantityDelta: -$quantity,

                            balanceAfter: $newStock,

                            unitCost: $unitCost,

                            sourceType: $sourceType,

                            sourceId: $sourceId,

                            reference: $reference,

                            notes: $notes,

                            businessDayId: $resolvedBusinessDayId
                        );

                    $this->auditMovement(
                        $actor,
                        $movement
                    );

                    $movements[] =
                        $movement;
                }

                return $movements;
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Wastage
    |--------------------------------------------------------------------------
    */

    public function recordWastage(
        User $actor,
        Ingredient $ingredient,
        float $quantity,
        string $movementKey,
        string $sourceType,
        int $sourceId,
        ?string $reference = null,
        ?string $notes = null,
        ?int $businessDayId = null
    ): StockMovement {
        return $this->recordOutbound(
            actor: $actor,

            ingredient: $ingredient,

            movementType: StockMovement::TYPE_WASTAGE,

            quantity: $quantity,

            movementKey: $movementKey,

            sourceType: $sourceType,

            sourceId: $sourceId,

            reference: $reference,

            notes: $notes,

            businessDayId: $businessDayId
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Cancellation Reversal
    |--------------------------------------------------------------------------
    */

    public function cancellationReversal(
        User $actor,
        Ingredient $ingredient,
        float $quantity,
        float $unitCost,
        string $movementKey,
        string $sourceType,
        int $sourceId,
        ?string $reference = null,
        ?string $notes = null,
        ?int $businessDayId = null
    ): StockMovement {
        return $this->recordInbound(
            actor: $actor,

            ingredient: $ingredient,

            movementType: StockMovement::TYPE_CANCELLATION_REVERSAL,

            quantity: $quantity,

            unitCost: $unitCost,

            movementKey: $movementKey,

            sourceType: $sourceType,

            sourceId: $sourceId,

            reference: $reference,

            notes: $notes,

            businessDayId: $businessDayId,

            updateAverageCost: true
        );
    }

    /*
    |--------------------------------------------------------------------------
    | IN Movement Engine
    |--------------------------------------------------------------------------
    */

    private function recordInbound(
        User $actor,
        Ingredient $ingredient,
        string $movementType,
        float $quantity,
        ?float $unitCost,
        string $movementKey,
        string $sourceType,
        int $sourceId,
        ?string $reference = null,
        ?string $notes = null,
        ?int $businessDayId = null,
        bool $updateAverageCost = true
    ): StockMovement {
        $quantity =
            round(
                $quantity,
                4
            );

        if ($quantity <= 0) {
            throw new InventoryOperationException(
                message: 'Stock quantity must be greater than zero.',

                errorCode: 'INVALID_STOCK_QUANTITY',

                status: 422
            );
        }

        $existing =
            $this->findExistingMovement(
                movementKey: $movementKey,

                ingredientId: $ingredient->id,

                movementType: $movementType,

                expectedQuantityDelta: $quantity
            );

        if ($existing) {
            return $existing;
        }

        return DatabaseTransaction::run(
            function () use (
                $actor,
                $ingredient,
                $movementType,
                $quantity,
                $unitCost,
                $movementKey,
                $sourceType,
                $sourceId,
                $reference,
                $notes,
                $businessDayId,
                $updateAverageCost
            ): StockMovement {
                $existing =
                    $this->findExistingMovement(
                        movementKey: $movementKey,

                        ingredientId: $ingredient->id,

                        movementType: $movementType,

                        expectedQuantityDelta: $quantity
                    );

                if ($existing) {
                    return $existing;
                }

                /** @var Ingredient $locked */
                $locked =
                    Ingredient::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $ingredient->id
                    );

                $this->ensureStockTracked(
                    $locked
                );

                $oldStock =
                    (float)
                    $locked->current_stock;

                $oldAverageCost =
                    (float)
                    $locked->average_cost;

                /*
                 * If no incoming cost was provided,
                 * preserve existing average cost.
                 */
                $effectiveUnitCost =
                    $unitCost !== null
                    ? round(
                        $unitCost,
                        4
                    )
                    : $oldAverageCost;

                if ($effectiveUnitCost < 0) {
                    throw new InventoryOperationException(
                        message: 'Stock unit cost cannot be negative.',

                        errorCode: 'INVALID_UNIT_COST',

                        status: 422
                    );
                }

                $newStock =
                    round(
                        $oldStock
                            + $quantity,
                        4
                    );

                if ($updateAverageCost) {
                    $existingValue =
                        $oldStock
                        * $oldAverageCost;

                    $incomingValue =
                        $quantity
                        * $effectiveUnitCost;

                    $newAverageCost =
                        $newStock > 0
                        ? round(
                            (
                                $existingValue
                                + $incomingValue
                            )
                                / $newStock,
                            4
                        )
                        : 0;
                } else {
                    $newAverageCost =
                        $oldAverageCost;
                }

                $locked->current_stock =
                    $newStock;

                $locked->average_cost =
                    $newAverageCost;

                $locked->save();

                $movement =
                    $this->createMovement(
                        movementKey: $movementKey,

                        ingredient: $locked,

                        actor: $actor,

                        movementType: $movementType,

                        quantityDelta: $quantity,

                        balanceAfter: $newStock,

                        unitCost: $effectiveUnitCost,

                        sourceType: $sourceType,

                        sourceId: $sourceId,

                        reference: $reference,

                        notes: $notes,

                        businessDayId: $businessDayId
                    );

                $this->auditMovement(
                    $actor,
                    $movement
                );

                return $movement;
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | OUT Movement Engine
    |--------------------------------------------------------------------------
    */

    private function recordOutbound(
        User $actor,
        Ingredient $ingredient,
        string $movementType,
        float $quantity,
        string $movementKey,
        string $sourceType,
        int $sourceId,
        ?string $reference = null,
        ?string $notes = null,
        ?int $businessDayId = null
    ): StockMovement {
        $quantity =
            round(
                $quantity,
                4
            );

        if ($quantity <= 0) {
            throw new InventoryOperationException(
                message: 'Stock quantity must be greater than zero.',

                errorCode: 'INVALID_STOCK_QUANTITY',

                status: 422
            );
        }

        $quantityDelta =
            -$quantity;

        $existing =
            $this->findExistingMovement(
                movementKey: $movementKey,

                ingredientId: $ingredient->id,

                movementType: $movementType,

                expectedQuantityDelta: $quantityDelta
            );

        if ($existing) {
            return $existing;
        }

        return DatabaseTransaction::run(
            function () use (
                $actor,
                $ingredient,
                $movementType,
                $quantity,
                $quantityDelta,
                $movementKey,
                $sourceType,
                $sourceId,
                $reference,
                $notes,
                $businessDayId
            ): StockMovement {
                $existing =
                    $this->findExistingMovement(
                        movementKey: $movementKey,

                        ingredientId: $ingredient->id,

                        movementType: $movementType,

                        expectedQuantityDelta: $quantityDelta
                    );

                if ($existing) {
                    return $existing;
                }

                /** @var Ingredient $locked */
                $locked =
                    Ingredient::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $ingredient->id
                    );

                $this->ensureStockTracked(
                    $locked
                );

                $currentStock =
                    (float)
                    $locked->current_stock;

                if (
                    $quantity
                    > $currentStock + 0.000001
                ) {
                    throw new InventoryOperationException(
                        message: sprintf(
                            'Insufficient stock for %s. Available: %.4f, requested: %.4f.',
                            $locked->name,
                            $currentStock,
                            $quantity
                        ),

                        errorCode: 'INSUFFICIENT_STOCK',

                        status: 409
                    );
                }

                $unitCost =
                    (float)
                    $locked->average_cost;

                $newStock =
                    round(
                        max(
                            0,
                            $currentStock
                                - $quantity
                        ),
                        4
                    );

                /*
                 * Moving-average cost remains the same
                 * when stock leaves inventory.
                 */
                $locked->current_stock =
                    $newStock;

                $locked->save();

                $movement =
                    $this->createMovement(
                        movementKey: $movementKey,

                        ingredient: $locked,

                        actor: $actor,

                        movementType: $movementType,

                        quantityDelta: $quantityDelta,

                        balanceAfter: $newStock,

                        unitCost: $unitCost,

                        sourceType: $sourceType,

                        sourceId: $sourceId,

                        reference: $reference,

                        notes: $notes,

                        businessDayId: $businessDayId
                    );

                $this->auditMovement(
                    $actor,
                    $movement
                );

                return $movement;
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Stock Movement Creation
    |--------------------------------------------------------------------------
    */

    private function createMovement(
        string $movementKey,
        Ingredient $ingredient,
        User $actor,
        string $movementType,
        float $quantityDelta,
        float $balanceAfter,
        float $unitCost,
        string $sourceType,
        int $sourceId,
        ?string $reference,
        ?string $notes,
        ?int $businessDayId = null
    ): StockMovement {
        $businessDayId ??=
            $this->currentBusinessDayId();

        return StockMovement::query()
            ->create([
                'movement_key' =>
                $movementKey,

                'ingredient_id' =>
                $ingredient->id,

                'business_day_id' =>
                $businessDayId,

                'movement_type' =>
                $movementType,

                'quantity_delta' =>
                round(
                    $quantityDelta,
                    4
                ),

                'balance_after' =>
                round(
                    $balanceAfter,
                    4
                ),

                'unit_cost' =>
                round(
                    $unitCost,
                    4
                ),

                /*
                 * Signed valuation impact.
                 *
                 * IN  => positive
                 * OUT => negative
                 */
                'total_cost' =>
                round(
                    $quantityDelta
                        * $unitCost,
                    2
                ),

                'source_type' =>
                $sourceType,

                'source_id' =>
                $sourceId,

                'reference' =>
                $reference,

                'notes' =>
                $notes,

                'created_by' =>
                $actor->id,

                'occurred_at' =>
                now(),
            ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotency
    |--------------------------------------------------------------------------
    */

    private function findExistingMovement(
        string $movementKey,
        int $ingredientId,
        string $movementType,
        float $expectedQuantityDelta
    ): ?StockMovement {
        /** @var StockMovement|null $movement */
        $movement =
            StockMovement::query()
            ->where(
                'movement_key',
                $movementKey
            )
            ->first();

        if (! $movement) {
            return null;
        }

        $sameRequest =
            $movement->ingredient_id
            === $ingredientId
            &&
            $movement->movement_type
            === $movementType
            &&
            abs(
                (float)
                $movement->quantity_delta
                    -
                    $expectedQuantityDelta
            ) < 0.000001;

        if (! $sameRequest) {
            throw new InventoryOperationException(
                message: 'This stock movement idempotency key has already been used for another stock operation.',

                errorCode: 'STOCK_IDEMPOTENCY_KEY_REUSED'
            );
        }

        return $movement;
    }

    private function ensureStockTracked(
        Ingredient $ingredient
    ): void {
        if (! $ingredient->is_active) {
            throw new InventoryOperationException(
                message: 'Stock cannot be modified for an inactive ingredient.',

                errorCode: 'INGREDIENT_INACTIVE',

                status: 422
            );
        }

        if (! $ingredient->track_stock) {
            throw new InventoryOperationException(
                message: 'Stock tracking is disabled for this ingredient.',

                errorCode: 'STOCK_TRACKING_DISABLED',

                status: 422
            );
        }
    }

    private function currentBusinessDayId(): ?int
    {
        return BusinessDay::query()
            ->where(
                'status',
                BusinessDay::STATUS_OPEN
            )
            ->latest('opened_at')
            ->value('id');
    }

    private function auditMovement(
        User $actor,
        StockMovement $movement
    ): void {
        $this->auditLogger->record(
            action: 'STOCK_MOVEMENT_CREATED',

            entityType: 'stock_movement',

            entityId: $movement->id,

            newValues: [
                'ingredient_id' =>
                $movement->ingredient_id,

                'movement_type' =>
                $movement->movement_type,

                'quantity_delta' =>
                $movement->quantity_delta,

                'balance_after' =>
                $movement->balance_after,

                'unit_cost' =>
                $movement->unit_cost,

                'total_cost' =>
                $movement->total_cost,

                'reference' =>
                $movement->reference,
            ],

            userId: $actor->id
        );
    }
}
