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
                /*
                 * A purchase draft must belong to an
                 * currently open restaurant business day.
                 */
                $businessDay =
                    BusinessDay::query()
                    ->where(
                        'status',
                        BusinessDay::STATUS_OPEN
                    )
                    ->latest('opened_at')
                    ->first();

                if (! $businessDay) {
                    throw new RuntimeException(
                        'An open business day is required to create a purchase.'
                    );
                }

                /*
                 * Purchases may only be created for
                 * active suppliers.
                 */
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
                         * The database requires a unique
                         * purchase number before the ID
                         * exists.
                         *
                         * Create a temporary unique number
                         * first and replace it immediately
                         * after obtaining the primary key.
                         */
                        'purchase_number' =>
                        'TMP-' .
                            Str::upper(
                                (string)
                                Str::ulid()
                            ),

                        'supplier_id' =>
                        $supplier->id,

                        'business_day_id' =>
                        $businessDay->id,

                        'supplier_invoice_number' =>
                        $data['supplier_invoice_number']
                            ?? null,

                        'purchase_date' =>
                        $data['purchase_date'],

                        /*
                         * Financial totals are always
                         * calculated by Laravel.
                         */
                        'subtotal' =>
                        0,

                        'discount_total' =>
                        0,

                        'tax_total' =>
                        0,

                        'grand_total' =>
                        0,

                        /*
                         * Supplier payments cannot happen
                         * while this is only a draft.
                         */
                        'paid_amount' =>
                        0,

                        'balance_due' =>
                        0,

                        'payment_status' =>
                        Purchase::PAYMENT_STATUS_UNPAID,

                        'status' =>
                        Purchase::STATUS_DRAFT,

                        'notes' =>
                        $data['notes']
                            ?? null,

                        'created_by' =>
                        $actor->id,
                    ]);

                /*
                 * Stable human-readable purchase number.
                 *
                 * PUR-000001
                 * PUR-000002
                 * ...
                 */
                $purchase->purchase_number =
                    sprintf(
                        'PUR-%06d',
                        $purchase->id
                    );

                $purchase->save();

                /*
                 * Replace/create draft line items.
                 *
                 * Inventory is NOT changed here.
                 */
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

                        'business_day_id' =>
                        $purchase
                            ->business_day_id,

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

                /*
                 * Posted inventory must never be edited
                 * through the purchase master record.
                 */
                if (! $locked->isDraft()) {
                    throw new RuntimeException(
                        'Only draft purchases can be edited.'
                    );
                }

                /*
                 * The selected supplier must still be
                 * active at the time of editing.
                 */
                $supplier =
                    Supplier::query()
                    ->where(
                        'is_active',
                        true
                    )
                    ->findOrFail(
                        $data['supplier_id']
                    );

                $oldValues = [
                    'supplier_id' =>
                    $locked->supplier_id,

                    'purchase_date' =>
                    $locked
                        ->purchase_date
                        ?->format('Y-m-d'),

                    'supplier_invoice_number' =>
                    $locked
                        ->supplier_invoice_number,

                    'grand_total' =>
                    (float)
                    $locked
                        ->grand_total,

                    'notes' =>
                    $locked->notes,
                ];

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

                /*
                 * Replace the draft lines and allow
                 * Laravel to recalculate all totals.
                 */
                $total =
                    $this->replaceItems(
                        $locked,
                        $data['items']
                    );

                $locked->subtotal =
                    $total;

                $locked->grand_total =
                    $total;

                /*
                 * Draft purchases should normally have
                 * no payments. Keeping this calculation
                 * defensive protects existing data.
                 */
                $locked->balance_due =
                    round(
                        max(
                            0,
                            $total
                                -
                                (float)
                                $locked->paid_amount
                        ),
                        2
                    );

                $locked->save();

                $this->auditLogger->record(
                    action: 'PURCHASE_UPDATED',

                    entityType: 'purchase',

                    entityId: $locked->id,

                    oldValues: $oldValues,

                    newValues: [
                        'supplier_id' =>
                        $locked
                            ->supplier_id,

                        'purchase_date' =>
                        $locked
                            ->purchase_date
                            ?->format('Y-m-d'),

                        'supplier_invoice_number' =>
                        $locked
                            ->supplier_invoice_number,

                        'grand_total' =>
                        (float)
                        $locked
                            ->grand_total,

                        'notes' =>
                        $locked->notes,
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
    | Complete Purchase
    |--------------------------------------------------------------------------
    |
    | This is the ONLY point where a purchase changes inventory.
    |
    | Draft:
    |   no inventory
    |   no supplier liability
    |
    | Completion:
    |   convert quantities
    |   increase inventory
    |   calculate weighted average cost
    |   create immutable stock ledger movements
    |   increase supplier outstanding balance
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

                /*
                 * Completion is idempotent.
                 *
                 * Calling this endpoint more than once
                 * must NEVER duplicate stock.
                 */
                if (
                    $lockedPurchase
                    ->isCompleted()
                ) {
                    return $this->loadPurchase(
                        $lockedPurchase
                    );
                }

                if (
                    ! $lockedPurchase
                        ->isDraft()
                ) {
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

                /*
                 * Inventory becomes real only when the
                 * purchase is completed.
                 *
                 * Therefore completion requires a
                 * currently open business day.
                 */
                $businessDay =
                    BusinessDay::query()
                    ->where(
                        'status',
                        BusinessDay::STATUS_OPEN
                    )
                    ->latest('opened_at')
                    ->first();

                if (! $businessDay) {
                    throw new RuntimeException(
                        'An open business day is required to complete a purchase.'
                    );
                }

                /*
                 * A draft can potentially remain open
                 * overnight.
                 *
                 * The purchase is therefore reassigned
                 * to the business day on which inventory
                 * was actually posted.
                 */
                $lockedPurchase->business_day_id =
                    $businessDay->id;

                /*
                 * Receive every item exactly once.
                 *
                 * Any failure rolls back the complete
                 * purchase transaction.
                 */
                foreach (
                    $lockedPurchase->items
                    as $purchaseItem
                ) {
                    $this->receiveItem(
                        purchase: $lockedPurchase,

                        purchaseItem: $purchaseItem,

                        actor: $actor,

                        businessDayId: $businessDay->id
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
                 * Supplier liability becomes real only
                 * when the purchase has been completed.
                 *
                 * Completion itself does NOT mean that
                 * the supplier was paid.
                 */
                /** @var Supplier $supplier */
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
                        $supplier
                            ->current_balance
                            +
                            (float)
                            $lockedPurchase
                                ->balance_due,
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

                        'business_day_id' =>
                        $lockedPurchase
                            ->business_day_id,

                        'completed_by' =>
                        $lockedPurchase
                            ->completed_by,

                        'completed_at' =>
                        $lockedPurchase
                            ->completed_at
                            ?->toISOString(),

                        'grand_total' =>
                        (float)
                        $lockedPurchase
                            ->grand_total,

                        'balance_due' =>
                        (float)
                        $lockedPurchase
                            ->balance_due,
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

                /*
                 * Once inventory has been received,
                 * cancellation must not be used to
                 * reverse it.
                 *
                 * Completed purchases require a
                 * dedicated corrective workflow.
                 */
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
        int $businessDayId
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
         * Convert purchased quantity to the
         * ingredient stock/base unit.
         *
         * Example:
         *
         * 5 KG
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

        if (
            $baseQuantity
            <= 0
        ) {
            throw new RuntimeException(
                'Converted purchase quantity must be greater than zero.'
            );
        }

        $lineTotal =
            (float)
            $purchaseItem
                ->line_total;

        /*
         * Cost of one ingredient BASE unit.
         *
         * Example:
         *
         * Rs. 1,000 / KG
         * becomes
         * Rs. 1 / G
         */
        $baseUnitCost =
            round(
                $lineTotal
                    /
                    $baseQuantity,
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
                    +
                    $baseQuantity,
                4
            );

        /*
         * Weighted Average Cost
         *
         * existing stock value
         * +
         * received stock value
         * ---------------------
         * resulting stock
         */
        $existingValue =
            $oldStock
            *
            $oldAverageCost;

        $receivedValue =
            $baseQuantity
            *
            $baseUnitCost;

        $newAverageCost =
            $newStock > 0
            ? round(
                (
                    $existingValue
                    +
                    $receivedValue
                )
                    /
                    $newStock,
                4
            )
            : 0;

        /*
         * Store immutable conversion/cost snapshot
         * on the purchase item at completion.
         */
        $purchaseItem->base_quantity =
            round(
                $baseQuantity,
                4
            );

        $purchaseItem->base_unit_cost =
            $baseUnitCost;

        $purchaseItem->save();

        /*
         * Update cached ingredient stock state.
         */
        $ingredient->current_stock =
            $newStock;

        $ingredient->average_cost =
            $newAverageCost;

        $ingredient->save();

        /*
         * Create immutable stock movement.
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
                round(
                    $baseQuantity,
                    4
                ),

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
        /*
         * Safe because this method is used only while
         * purchases are still drafts.
         */
        $purchase
            ->items()
            ->delete();

        $total =
            0.0;

        foreach (
            $items
            as $item
        ) {
            /*
             * Inactive ingredients must not be used
             * for new purchase lines.
             */
            /** @var Ingredient $ingredient */
            $ingredient =
                Ingredient::query()
                ->where(
                    'is_active',
                    true
                )
                ->findOrFail(
                    $item['ingredient_id']
                );

            /*
             * Purchase unit must also be active.
             */
            /** @var Unit $unit */
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
             * Validate that the selected purchase unit
             * belongs to the same physical measurement
             * family as the ingredient base unit.
             *
             * Example:
             *
             * KG → G   valid
             * L  → ML  valid
             * KG → ML  invalid
             */
            $ingredient->loadMissing(
                'baseUnit'
            );

            if (
                ! $ingredient
                    ->baseUnit
            ) {
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
                        *
                        $unitCost,
                    2
                );

            /*
             * No base conversion snapshot exists until
             * the draft is completed and received into
             * inventory.
             */
            $purchase
                ->items()
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

    /*
    |--------------------------------------------------------------------------
    | Load Purchase
    |--------------------------------------------------------------------------
    */

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
