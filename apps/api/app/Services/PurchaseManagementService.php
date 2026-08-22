<?php

namespace App\Services;

use App\Exceptions\InventoryOperationException;
use App\Models\BusinessDay;
use App\Models\Ingredient;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\Unit;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Support\Str;
use RuntimeException;

final class PurchaseManagementService
{
    public function __construct(
        private readonly UnitConversionService $unitConversionService,
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Create Draft Purchase
    |--------------------------------------------------------------------------
    */

    public function create(
        User $actor,
        array $data
    ): Purchase {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $data
            ): Purchase {
                $supplier =
                    Supplier::query()
                    ->where(
                        'is_active',
                        true
                    )
                    ->findOrFail(
                        $data['supplier_id']
                    );

                $purchase =
                    Purchase::query()
                    ->create([
                        /*
                             * Temporary unique number.
                             * Replaced after ID exists.
                             */
                        'purchase_number' =>
                        'TMP-' .
                            Str::upper(
                                (string) Str::ulid()
                            ),

                        'supplier_id' =>
                        $supplier->id,

                        'supplier_invoice_number' =>
                        $data['supplier_invoice_number']
                            ?? null,

                        'purchase_date' =>
                        $data['purchase_date'],

                        'subtotal' =>
                        0,

                        'discount_total' =>
                        0,

                        'tax_total' =>
                        0,

                        'grand_total' =>
                        0,

                        'paid_amount' =>
                        0,

                        'balance_due' =>
                        0,

                        'payment_status' =>
                        'UNPAID',

                        'status' =>
                        Purchase::STATUS_DRAFT,

                        'notes' =>
                        $data['notes']
                            ?? null,

                        'created_by' =>
                        $actor->id,
                    ]);

                /*
                 * Stable purchase number.
                 */
                $purchase->purchase_number =
                    sprintf(
                        'PUR-%06d',
                        $purchase->id
                    );

                $purchase->save();

                $total =
                    $this->replaceItems(
                        $purchase,
                        $data['items']
                    );

                $purchase->subtotal =
                    $total;

                $purchase->grand_total =
                    $total;

                $purchase->balance_due =
                    $total;

                $purchase->save();

                $this->auditLogger->record(
                    action: 'PURCHASE_CREATED',

                    entityType: 'purchase',

                    entityId: $purchase->id,

                    newValues: [
                        'purchase_number' =>
                        $purchase
                            ->purchase_number,

                        'supplier_id' =>
                        $purchase
                            ->supplier_id,

                        'grand_total' =>
                        $purchase
                            ->grand_total,

                        'status' =>
                        $purchase
                            ->status,
                    ],

                    userId: $actor->id
                );

                return $this->loadPurchase(
                    $purchase
                );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Update Draft Purchase
    |--------------------------------------------------------------------------
    */

    public function update(
        User $actor,
        Purchase $purchase,
        array $data
    ): Purchase {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $purchase,
                $data
            ): Purchase {
                /** @var Purchase $locked */
                $locked =
                    Purchase::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $purchase->id
                    );

                if (! $locked->isDraft()) {
                    throw new RuntimeException(
                        'Only draft purchases can be edited.'
                    );
                }

                $supplier =
                    Supplier::query()
                    ->where(
                        'is_active',
                        true
                    )
                    ->findOrFail(
                        $data['supplier_id']
                    );

                $oldValues =
                    $locked->only([
                        'supplier_id',
                        'purchase_date',
                        'supplier_invoice_number',
                        'grand_total',
                        'notes',
                    ]);

                $locked->supplier_id =
                    $supplier->id;

                $locked->purchase_date =
                    $data['purchase_date'];

                $locked->supplier_invoice_number =
                    $data['supplier_invoice_number']
                    ?? null;

                $locked->notes =
                    $data['notes']
                    ?? null;

                $total =
                    $this->replaceItems(
                        $locked,
                        $data['items']
                    );

                $locked->subtotal =
                    $total;

                $locked->grand_total =
                    $total;

                $locked->balance_due =
                    max(
                        0,
                        $total -
                            (float) $locked->paid_amount
                    );

                $locked->save();

                $this->auditLogger->record(
                    action: 'PURCHASE_UPDATED',

                    entityType: 'purchase',

                    entityId: $locked->id,

                    oldValues: $oldValues,

                    newValues: $locked->only([
                        'supplier_id',
                        'purchase_date',
                        'supplier_invoice_number',
                        'grand_total',
                        'notes',
                    ]),

                    userId: $actor->id
                );

                return $this->loadPurchase(
                    $locked
                );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Complete Purchase
    |--------------------------------------------------------------------------
    |
    | This is the ONLY point in Phase 10 where inventory changes.
    |
    */

    public function complete(
        User $actor,
        Purchase $purchase
    ): Purchase {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $purchase
            ): Purchase {
                /** @var Purchase $lockedPurchase */
                $lockedPurchase =
                    Purchase::query()
                    ->with([
                        'items.ingredient.baseUnit',
                        'items.unit',
                    ])
                    ->lockForUpdate()
                    ->findOrFail(
                        $purchase->id
                    );

                if (
                    $lockedPurchase
                    ->isCompleted()
                ) {
                    /*
                     * Idempotency.
                     *
                     * Calling complete twice must never
                     * add inventory twice.
                     */
                    return $this->loadPurchase(
                        $lockedPurchase
                    );
                }

                if (! $lockedPurchase->isDraft()) {
                    throw new RuntimeException(
                        'Only draft purchases can be completed.'
                    );
                }

                if (
                    $lockedPurchase
                    ->items
                    ->isEmpty()
                ) {
                    throw new RuntimeException(
                        'A purchase must contain at least one item.'
                    );
                }

                $businessDay =
                    BusinessDay::query()
                    ->where(
                        'status',
                        BusinessDay::STATUS_OPEN
                    )
                    ->latest('opened_at')
                    ->first();

                foreach (
                    $lockedPurchase->items
                    as $purchaseItem
                ) {
                    $this->receiveItem(
                        purchase: $lockedPurchase,

                        purchaseItem: $purchaseItem,

                        actor: $actor,

                        businessDayId: $businessDay?->id
                    );
                }

                $lockedPurchase->status =
                    Purchase::STATUS_COMPLETED;

                $lockedPurchase->completed_by =
                    $actor->id;

                $lockedPurchase->completed_at =
                    now();

                $lockedPurchase->save();

                /*
                 * Supplier balance increases because
                 * Phase 10 completion does not imply
                 * the supplier has been paid.
                 */
                $supplier =
                    Supplier::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $lockedPurchase
                            ->supplier_id
                    );

                $supplier->current_balance =
                    round(
                        (float)
                        $supplier->current_balance
                            +
                            (float)
                            $lockedPurchase->balance_due,
                        2
                    );

                $supplier->save();

                $this->auditLogger->record(
                    action: 'PURCHASE_COMPLETED',

                    entityType: 'purchase',

                    entityId: $lockedPurchase->id,

                    newValues: [
                        'status' =>
                        Purchase::STATUS_COMPLETED,

                        'completed_at' =>
                        $lockedPurchase
                            ->completed_at
                            ?->toISOString(),

                        'grand_total' =>
                        $lockedPurchase
                            ->grand_total,
                    ],

                    userId: $actor->id
                );

                return $this->loadPurchase(
                    $lockedPurchase
                );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Cancel Draft Purchase
    |--------------------------------------------------------------------------
    */

    public function cancel(
        User $actor,
        Purchase $purchase
    ): Purchase {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $purchase
            ): Purchase {
                /** @var Purchase $locked */
                $locked =
                    Purchase::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $purchase->id
                    );

                if (! $locked->isDraft()) {
                    throw new RuntimeException(
                        'Only draft purchases can be cancelled.'
                    );
                }

                $locked->status =
                    Purchase::STATUS_CANCELLED;

                $locked->save();

                $this->auditLogger->record(
                    action: 'PURCHASE_CANCELLED',

                    entityType: 'purchase',

                    entityId: $locked->id,

                    newValues: [
                        'status' =>
                        Purchase::STATUS_CANCELLED,
                    ],

                    userId: $actor->id
                );

                return $this->loadPurchase(
                    $locked
                );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Receive Individual Purchase Item
    |--------------------------------------------------------------------------
    */

    private function receiveItem(
        Purchase $purchase,
        PurchaseItem $purchaseItem,
        User $actor,
        ?int $businessDayId
    ): void {
        /** @var Ingredient $ingredient */
        $ingredient =
            Ingredient::query()
            ->with(
                'baseUnit'
            )
            ->lockForUpdate()
            ->findOrFail(
                $purchaseItem
                    ->ingredient_id
            );

        /** @var Unit $purchaseUnit */
        $purchaseUnit =
            Unit::query()
            ->findOrFail(
                $purchaseItem
                    ->unit_id
            );

        $baseUnit =
            $ingredient->baseUnit;

        if (! $baseUnit) {
            throw new InventoryOperationException(
                message: "Ingredient {$ingredient->name} has no base unit.",

                errorCode: 'INGREDIENT_BASE_UNIT_MISSING',

                status: 422
            );
        }

        /*
         * Example:
         *
         * 5 KG Rice
         * ↓
         * 5000 G
         */
        $baseQuantity =
            $this
            ->unitConversionService
            ->convert(
                quantity: (float)
                $purchaseItem
                    ->quantity,

                fromUnit: $purchaseUnit,

                toUnit: $baseUnit
            );

        if ($baseQuantity <= 0) {
            throw new RuntimeException(
                'Converted purchase quantity must be greater than zero.'
            );
        }

        $lineTotal =
            (float)
            $purchaseItem
                ->line_total;

        /*
         * Cost per ONE ingredient base unit.
         */
        $baseUnitCost =
            round(
                $lineTotal
                    / $baseQuantity,
                4
            );

        $oldStock =
            (float)
            $ingredient
                ->current_stock;

        $oldAverageCost =
            (float)
            $ingredient
                ->average_cost;

        $newStock =
            round(
                $oldStock
                    + $baseQuantity,
                4
            );

        /*
         * Weighted Average Cost:
         *
         * existing stock value
         * +
         * received stock value
         * ---------------------
         * new quantity
         */
        $existingValue =
            $oldStock
            * $oldAverageCost;

        $receivedValue =
            $baseQuantity
            * $baseUnitCost;

        $newAverageCost =
            $newStock > 0
            ? round(
                (
                    $existingValue
                    + $receivedValue
                )
                    / $newStock,
                4
            )
            : 0;

        /*
         * Store conversion snapshot on
         * purchase item.
         */
        $purchaseItem->base_quantity =
            $baseQuantity;

        $purchaseItem->base_unit_cost =
            $baseUnitCost;

        $purchaseItem->save();

        /*
         * Update cached current inventory.
         */
        $ingredient->current_stock =
            $newStock;

        $ingredient->average_cost =
            $newAverageCost;

        $ingredient->save();

        /*
         * Immutable stock ledger.
         */
        StockMovement::query()
            ->create([
                'ingredient_id' =>
                $ingredient->id,

                'business_day_id' =>
                $businessDayId,

                'movement_type' =>
                'PURCHASE',

                'quantity_delta' =>
                $baseQuantity,

                'balance_after' =>
                $newStock,

                'unit_cost' =>
                $baseUnitCost,

                'total_cost' =>
                round(
                    $receivedValue,
                    2
                ),

                'source_type' =>
                Purchase::class,

                'source_id' =>
                $purchase->id,

                'reference' =>
                $purchase
                    ->purchase_number,

                'notes' =>
                sprintf(
                    'Purchase %s from supplier.',
                    $purchase
                        ->purchase_number
                ),

                'created_by' =>
                $actor->id,

                'occurred_at' =>
                now(),
            ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Replace Draft Items
    |--------------------------------------------------------------------------
    */

    private function replaceItems(
        Purchase $purchase,
        array $items
    ): float {
        $purchase
            ->items()
            ->delete();

        $total =
            0.0;

        foreach ($items as $item) {
            $ingredient =
                Ingredient::query()
                ->where(
                    'is_active',
                    true
                )
                ->findOrFail(
                    $item['ingredient_id']
                );

            $unit =
                Unit::query()
                ->where(
                    'is_active',
                    true
                )
                ->findOrFail(
                    $item['unit_id']
                );

            /*
             * Validate that this purchase
             * unit can eventually convert to
             * the ingredient's base unit.
             */
            $ingredient->loadMissing(
                'baseUnit'
            );

            if (! $ingredient->baseUnit) {
                throw new RuntimeException(
                    "Ingredient {$ingredient->name} has no base unit."
                );
            }

            $this
                ->unitConversionService
                ->convert(
                    quantity: 1,

                    fromUnit: $unit,

                    toUnit: $ingredient
                        ->baseUnit
                );

            $quantity =
                round(
                    (float)
                    $item['quantity'],
                    4
                );

            $unitCost =
                round(
                    (float)
                    $item['unit_cost'],
                    4
                );

            $lineTotal =
                round(
                    $quantity
                        * $unitCost,
                    2
                );

            $purchase->items()
                ->create([
                    'ingredient_id' =>
                    $ingredient->id,

                    'unit_id' =>
                    $unit->id,

                    'quantity' =>
                    $quantity,

                    'unit_cost' =>
                    $unitCost,

                    'line_total' =>
                    $lineTotal,

                    /*
                     * Filled only when the
                     * purchase is completed.
                     */
                    'base_quantity' =>
                    null,

                    'base_unit_cost' =>
                    null,
                ]);

            $total +=
                $lineTotal;
        }

        return round(
            $total,
            2
        );
    }

    private function loadPurchase(
        Purchase $purchase
    ): Purchase {
        return $purchase
            ->refresh()
            ->load([
                'supplier',

                'items.ingredient.baseUnit',

                'items.unit',

                'createdBy',

                'completedBy',
            ]);
    }
}
