<?php

namespace App\Services;

use App\Exceptions\InvoiceOperationException;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\TableSession;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Database\Eloquent\Collection;

final class InvoiceGenerationService
{
    public function __construct(
        private readonly DocumentNumberService $documentNumberService,
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Generate From Order Context
    |--------------------------------------------------------------------------
    |
    | TAKEAWAY:
    |
    |     Order
    |       ↓
    |     Invoice
    |
    | DINE-IN:
    |
    |     Order
    |       ↓
    |     Table Session
    |       ↓
    |     All session orders
    |       ↓
    |     ONE final invoice
    |
    */

    public function generateForOrder(
        User $actor,
        Order $order
    ): array {
        if (
            $order->order_type
            === Order::TYPE_TAKEAWAY
        ) {
            return $this->generateTakeaway(
                actor: $actor,
                order: $order
            );
        }

        if (
            $order->order_type
            === Order::TYPE_DINE_IN
        ) {
            if (! $order->table_session_id) {
                throw new InvoiceOperationException(
                    message: 'This dine-in order does not have a table session.',

                    errorCode: 'DINE_IN_ORDER_HAS_NO_TABLE_SESSION',

                    status: 409
                );
            }

            $session =
                TableSession::query()
                ->find(
                    $order->table_session_id
                );

            if (! $session) {
                throw new InvoiceOperationException(
                    message: 'The table session for this order could not be found.',

                    errorCode: 'TABLE_SESSION_NOT_FOUND',

                    status: 404
                );
            }

            return $this->generateForTableSession(
                actor: $actor,
                tableSession: $session
            );
        }

        throw new InvoiceOperationException(
            message: 'This order type cannot be invoiced.',

            errorCode: 'ORDER_TYPE_NOT_BILLABLE',

            status: 422
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Generate Takeaway Invoice
    |--------------------------------------------------------------------------
    */

    public function generateTakeaway(
        User $actor,
        Order $order
    ): array {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $order
            ): array {
                /** @var Order|null $lockedOrder */
                $lockedOrder =
                    Order::query()
                    ->where(
                        'id',
                        $order->id
                    )
                    ->lockForUpdate()
                    ->first();

                if (! $lockedOrder) {
                    throw new InvoiceOperationException(
                        message: 'The order could not be found.',

                        errorCode: 'ORDER_NOT_FOUND',

                        status: 404
                    );
                }

                if (
                    $lockedOrder->order_type
                    !== Order::TYPE_TAKEAWAY
                ) {
                    throw new InvoiceOperationException(
                        message: 'This invoice operation is only valid for takeaway orders.',

                        errorCode: 'ORDER_IS_NOT_TAKEAWAY',

                        status: 422
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Idempotency
                |--------------------------------------------------------------------------
                |
                | Locking the source order means simultaneous requests serialize
                | here.
                |
                | Pressing Generate Invoice twice returns the same active invoice.
                |
                */

                $existingInvoice =
                    Invoice::query()
                    ->where(
                        'order_id',
                        $lockedOrder->id
                    )
                    ->where(
                        'status',
                        '!=',
                        Invoice::STATUS_VOID
                    )
                    ->lockForUpdate()
                    ->first();

                if ($existingInvoice) {
                    return [
                        'invoice' =>
                        $this->loadInvoice(
                            $existingInvoice
                        ),

                        'created' =>
                        false,
                    ];
                }

                $this->ensureOrderReadyForBilling(
                    $lockedOrder
                );

                return $this->createInvoice(
                    actor: $actor,

                    orders: new Collection([
                        $lockedOrder,
                    ]),

                    sourceOrder: $lockedOrder,

                    tableSession: null
                );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Generate Dine-In Final Invoice
    |--------------------------------------------------------------------------
    */

    public function generateForTableSession(
        User $actor,
        TableSession $tableSession
    ): array {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $tableSession
            ): array {
                $lockedSession =
                    $this->resolveFinalBillingSession(
                        $tableSession
                    );

                /*
                |--------------------------------------------------------------------------
                | Idempotency
                |--------------------------------------------------------------------------
                */

                $existingInvoice =
                    Invoice::query()
                    ->where(
                        'table_session_id',
                        $lockedSession->id
                    )
                    ->where(
                        'status',
                        '!=',
                        Invoice::STATUS_VOID
                    )
                    ->lockForUpdate()
                    ->first();

                if ($existingInvoice) {
                    return [
                        'invoice' =>
                        $this->loadInvoice(
                            $existingInvoice
                        ),

                        'created' =>
                        false,
                    ];
                }

                /*
                |--------------------------------------------------------------------------
                | Lock All Orders in Surviving Session
                |--------------------------------------------------------------------------
                |
                | TableMergeService moves all orders into the primary surviving
                | table_session_id.
                |
                | Therefore this naturally includes:
                |
                | - original orders
                | - additional orders
                | - transferred orders
                | - merged-table orders
                |
                */

                /** @var Collection<int, Order> $orders */
                $orders =
                    Order::query()
                    ->where(
                        'table_session_id',
                        $lockedSession->id
                    )
                    ->orderBy(
                        'session_sequence'
                    )
                    ->orderBy(
                        'id'
                    )
                    ->lockForUpdate()
                    ->get();

                $billableOrders =
                    $orders
                    ->filter(
                        fn(
                            Order $order
                        ): bool =>
                        ! in_array(
                            $order->status,
                            [
                                Order::STATUS_CANCELLED,
                                Order::STATUS_REJECTED,
                            ],
                            true
                        )
                    )
                    ->values();

                if (
                    $billableOrders
                    ->isEmpty()
                ) {
                    throw new InvoiceOperationException(
                        message: 'There are no billable orders in this table session.',

                        errorCode: 'TABLE_SESSION_HAS_NO_BILLABLE_ORDERS',

                        status: 409
                    );
                }

                foreach (
                    $billableOrders
                    as $billableOrder
                ) {
                    $this->ensureOrderReadyForBilling(
                        $billableOrder
                    );

                    if (
                        (int)
                        $billableOrder->business_day_id
                        !==
                        (int)
                        $lockedSession->business_day_id
                    ) {
                        throw new InvoiceOperationException(
                            message: 'An order in this table session belongs to a different business day.',

                            errorCode: 'INVOICE_BUSINESS_DAY_MISMATCH',

                            status: 409
                        );
                    }
                }

                return $this->createInvoice(
                    actor: $actor,

                    orders: $billableOrders,

                    sourceOrder: null,

                    tableSession: $lockedSession
                );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Create Permanent Invoice Snapshot
    |--------------------------------------------------------------------------
    */

    private function createInvoice(
        User $actor,
        Collection $orders,
        ?Order $sourceOrder,
        ?TableSession $tableSession
    ): array {
        if (
            $orders->isEmpty()
        ) {
            throw new InvoiceOperationException(
                message: 'An invoice cannot be generated without orders.',

                errorCode: 'INVOICE_HAS_NO_ORDERS',

                status: 409
            );
        }

        $orderIds =
            $orders
            ->pluck(
                'id'
            )
            ->map(
                fn(
                    $value
                ): int =>
                (int) $value
            )
            ->values()
            ->all();

        /*
        |--------------------------------------------------------------------------
        | Lock Active Order Items
        |--------------------------------------------------------------------------
        |
        | Cancelled items are deliberately excluded from the final invoice.
        |
        */

        $orderItems =
            OrderItem::query()
            ->with(
                'addons'
            )
            ->whereIn(
                'order_id',
                $orderIds
            )
            ->where(
                'status',
                OrderItem::STATUS_ACTIVE
            )
            ->orderBy(
                'order_id'
            )
            ->orderBy(
                'id'
            )
            ->lockForUpdate()
            ->get();

        if (
            $orderItems->isEmpty()
        ) {
            throw new InvoiceOperationException(
                message: 'The selected order has no active billable items.',

                errorCode: 'INVOICE_HAS_NO_ACTIVE_ITEMS',

                status: 409
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Historical Order Totals
        |--------------------------------------------------------------------------
        |
        | These are already sale-time values.
        |
        | NEVER read:
        |
        | menu_items.price
        | menu_item_variants.price
        | addons.price
        |
        */

        $subtotal =
            $this->sumOrderMoney(
                $orders,
                'subtotal'
            );

        $discountTotal =
            $this->sumOrderMoney(
                $orders,
                'discount_total'
            );

        $taxTotal =
            $this->sumOrderMoney(
                $orders,
                'tax_total'
            );

        $serviceChargeTotal =
            $this->sumOrderMoney(
                $orders,
                'service_charge_total'
            );

        $grandTotal =
            $this->sumOrderMoney(
                $orders,
                'grand_total'
            );

        /*
        |--------------------------------------------------------------------------
        | Snapshot Consistency Protection
        |--------------------------------------------------------------------------
        |
        | Active item line totals should equal the stored order subtotal.
        |
        | If historical order data is inconsistent, do not silently issue a
        | financial document.
        |
        */

        $itemSubtotal =
            round(
                $orderItems->sum(
                    fn(
                        OrderItem $item
                    ): float =>
                    (float)
                    $item->line_total
                ),
                2
            );

        if (
            abs(
                $itemSubtotal
                    -
                    $subtotal
            )
            > 0.01
        ) {
            throw new InvoiceOperationException(
                message: 'Stored order totals do not match the active order items. Invoice generation was stopped to protect financial accuracy.',

                errorCode: 'INVOICE_ORDER_TOTAL_MISMATCH',

                status: 409
            );
        }

        $estimatedCostTotal =
            round(
                $orderItems->sum(
                    fn(
                        OrderItem $item
                    ): float =>
                    (float)
                    $item
                        ->estimated_cost_total
                ),
                2
            );

        $customerName =
            $orders
            ->first(
                fn(
                    Order $order
                ): bool =>
                filled(
                    $order->customer_name
                )
            )
            ?->customer_name;

        $customerPhone =
            $orders
            ->first(
                fn(
                    Order $order
                ): bool =>
                filled(
                    $order->customer_phone
                )
            )
            ?->customer_phone;

        $tableNameSnapshot =
            $tableSession
            ? $orders
            ->last()
            ?->table_name_snapshot
            : null;

        $invoice =
            Invoice::query()
            ->create([
                'invoice_number' =>
                $this
                    ->documentNumberService
                    ->nextInvoiceNumber(),

                'business_day_id' =>
                (int)
                $orders
                    ->first()
                    ->business_day_id,

                /*
                 * Phase 27 does not yet require an open cashier shift.
                 *
                 * Phase 28 payment handling will validate the cashier shift.
                 */
                'cashier_shift_id' =>
                null,

                'table_session_id' =>
                $tableSession?->id,

                /*
                 * order_id is authoritative for a standalone Takeaway.
                 *
                 * Dine-in final invoices use table_session_id because one
                 * invoice may contain multiple orders.
                 */
                'order_id' =>
                $sourceOrder?->id,

                'invoice_type' =>
                Invoice::TYPE_SALE,

                'table_name_snapshot' =>
                $tableNameSnapshot,

                'customer_name' =>
                $customerName,

                'customer_phone' =>
                $customerPhone,

                'subtotal' =>
                $subtotal,

                'discount_total' =>
                $discountTotal,

                'tax_total' =>
                $taxTotal,

                'service_charge_total' =>
                $serviceChargeTotal,

                'grand_total' =>
                $grandTotal,

                'estimated_cost_total' =>
                $estimatedCostTotal,

                'paid_amount' =>
                0,

                'change_amount' =>
                0,

                /*
                 * Immediately after invoice issuance:
                 *
                 * paid = 0
                 * balance = complete grand total
                 */
                'balance_due' =>
                $grandTotal,

                'payment_status' =>
                Invoice::PAYMENT_STATUS_UNPAID,

                'status' =>
                Invoice::STATUS_ISSUED,

                'issued_by' =>
                $actor->id,

                'issued_at' =>
                now(),
            ]);

        /*
        |--------------------------------------------------------------------------
        | Permanent Item Snapshots
        |--------------------------------------------------------------------------
        */

        foreach (
            $orderItems
            as $orderItem
        ) {
            /*
            |--------------------------------------------------------------------------
            | Add-on Historical Snapshot
            |--------------------------------------------------------------------------
            */

            $addonsSnapshot =
                $orderItem
                ->addons
                ->map(
                    function (
                        $addon
                    ) use (
                        $orderItem
                    ): array {
                        $quantityPerItem =
                            (float)
                            $addon->quantity;

                        $orderedItemQuantity =
                            (float)
                            $orderItem->quantity;

                        return [
                            /*
                             * addon_id is traceability only.
                             *
                             * Invoice rendering MUST use the snapshot values
                             * below instead of reading the live Addon model.
                             */
                            'addon_id' =>
                            $addon->addon_id
                                ? (int)
                                $addon->addon_id
                                : null,

                            'name' =>
                            $addon
                                ->addon_name_snapshot,

                            /*
                             * OrderItemAddon quantity is defined as quantity
                             * PER ordered menu item.
                             */
                            'quantity_per_item' =>
                            round(
                                $quantityPerItem,
                                3
                            ),

                            'ordered_item_quantity' =>
                            round(
                                $orderedItemQuantity,
                                3
                            ),

                            'total_quantity' =>
                            round(
                                $quantityPerItem
                                    *
                                    $orderedItemQuantity,
                                3
                            ),

                            'unit_price' =>
                            round(
                                (float)
                                $addon
                                    ->unit_price,
                                2
                            ),

                            'line_total' =>
                            round(
                                (float)
                                $addon
                                    ->line_total,
                                2
                            ),

                            'estimated_cost_total' =>
                            round(
                                (float)
                                $addon
                                    ->estimated_cost_total,
                                2
                            ),
                        ];
                    }
                )
                ->values()
                ->all();

            InvoiceItem::query()
                ->create([
                    'invoice_id' =>
                    $invoice->id,

                    /*
                     * Traceability only.
                     *
                     * Invoice history must remain valid even if the referenced
                     * order item later disappears because the FK is nullOnDelete.
                     */
                    'order_item_id' =>
                    $orderItem->id,

                    /*
                     * AUTHORITATIVE HISTORICAL VALUES
                     */
                    'item_name_snapshot' =>
                    $orderItem
                        ->item_name_snapshot,

                    'variant_name_snapshot' =>
                    $orderItem
                        ->variant_name_snapshot,

                    'quantity' =>
                    $orderItem
                        ->quantity,

                    /*
                     * Base sale-time menu/variant price.
                     */
                    'unit_price' =>
                    $orderItem
                        ->unit_price,

                    /*
                     * Base item quantity × base unit price.
                     */
                    'gross_total' =>
                    $orderItem
                        ->gross_total,

                    'discount_total' =>
                    $orderItem
                        ->discount_total,

                    'tax_total' =>
                    $orderItem
                        ->tax_total,

                    /*
                     * Existing order line total includes selected add-ons.
                     */
                    'line_total' =>
                    $orderItem
                        ->line_total,

                    'unit_cost_snapshot' =>
                    $orderItem
                        ->estimated_unit_cost,

                    'cost_total_snapshot' =>
                    $orderItem
                        ->estimated_cost_total,

                    'addons_snapshot' =>
                    $addonsSnapshot,
                ]);
        }

        $this->auditLogger->record(
            action: 'INVOICE_ISSUED',

            entityType: 'invoice',

            entityId: $invoice->id,

            newValues: [
                'invoice_number' =>
                $invoice
                    ->invoice_number,

                'business_day_id' =>
                $invoice
                    ->business_day_id,

                'order_id' =>
                $invoice
                    ->order_id,

                'table_session_id' =>
                $invoice
                    ->table_session_id,

                'subtotal' =>
                $invoice
                    ->subtotal,

                'discount_total' =>
                $invoice
                    ->discount_total,

                'service_charge_total' =>
                $invoice
                    ->service_charge_total,

                'tax_total' =>
                $invoice
                    ->tax_total,

                'grand_total' =>
                $invoice
                    ->grand_total,

                'balance_due' =>
                $invoice
                    ->balance_due,

                'payment_status' =>
                $invoice
                    ->payment_status,

                'status' =>
                $invoice
                    ->status,
            ],

            metadata: [
                'source_order_ids' =>
                $orderIds,

                'invoice_item_count' =>
                $orderItems->count(),

                'billing_context' =>
                $tableSession
                    ? 'TABLE_SESSION'
                    : 'TAKEAWAY_ORDER',
            ],

            userId: $actor->id
        );

        return [
            'invoice' =>
            $this->loadInvoice(
                $invoice
            ),

            'created' =>
            true,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Order Billing Validation
    |--------------------------------------------------------------------------
    */

    private function ensureOrderReadyForBilling(
        Order $order
    ): void {
        if (
            in_array(
                $order->status,
                [
                    Order::STATUS_CANCELLED,
                    Order::STATUS_REJECTED,
                ],
                true
            )
        ) {
            throw new InvoiceOperationException(
                message: 'Cancelled or rejected orders cannot be invoiced.',

                errorCode: 'ORDER_NOT_BILLABLE',

                status: 409
            );
        }

        /*
         * Final invoice workflow:
         *
         * SERVED
         *   ↓
         * INVOICE
         *   ↓
         * PAYMENT (Phase 28)
         *   ↓
         * COMPLETED
         *
         * COMPLETED is also accepted for historical compatibility because
         * Phase 17 previously allowed completion before billing existed.
         */

        if (
            ! in_array(
                $order->status,
                [
                    Order::STATUS_SERVED,
                    Order::STATUS_COMPLETED,
                ],
                true
            )
        ) {
            throw new InvoiceOperationException(
                message: 'All billable orders must be served before the final invoice can be generated.',

                errorCode: 'ORDER_NOT_READY_FOR_INVOICE',

                status: 409
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Resolve Surviving Table Session
    |--------------------------------------------------------------------------
    |
    | Handles chained merges safely:
    |
    | Session B → Session A
    | Session A → Session C
    |
    | Final billing session = C
    |
    */

    private function resolveFinalBillingSession(
        TableSession $tableSession
    ): TableSession {
        $sessionId =
            (int)
            $tableSession->id;

        $visited =
            [];

        for (
            $depth = 0;
            $depth < 20;
            $depth++
        ) {
            if (
                in_array(
                    $sessionId,
                    $visited,
                    true
                )
            ) {
                throw new InvoiceOperationException(
                    message: 'A circular table-session merge relationship was detected.',

                    errorCode: 'TABLE_SESSION_MERGE_CYCLE',

                    status: 409
                );
            }

            $visited[] =
                $sessionId;

            /** @var TableSession|null $session */
            $session =
                TableSession::query()
                ->where(
                    'id',
                    $sessionId
                )
                ->lockForUpdate()
                ->first();

            if (! $session) {
                throw new InvoiceOperationException(
                    message: 'The table session could not be found.',

                    errorCode: 'TABLE_SESSION_NOT_FOUND',

                    status: 404
                );
            }

            if (
                $session->status
                !== TableSession::STATUS_MERGED
                ||
                ! $session
                    ->merged_into_session_id
            ) {
                return $session;
            }

            $sessionId =
                (int)
                $session
                    ->merged_into_session_id;
        }

        throw new InvoiceOperationException(
            message: 'The table-session merge chain is too deep to resolve safely.',

            errorCode: 'TABLE_SESSION_MERGE_CHAIN_TOO_DEEP',

            status: 409
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Money Summation
    |--------------------------------------------------------------------------
    */

    private function sumOrderMoney(
        Collection $orders,
        string $column
    ): float {
        return round(
            $orders->sum(
                fn(
                    Order $order
                ): float =>
                (float)
                $order->{$column}
            ),
            2
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Load Invoice
    |--------------------------------------------------------------------------
    */

    public function loadInvoice(
        Invoice $invoice
    ): Invoice {
        return $invoice
            ->fresh()
            ->load([
                'items' =>
                fn(
                    $query
                ) =>
                $query
                    ->orderBy(
                        'id'
                    ),

                'issuedBy',

                'tableSession',

                'order',
            ]);
    }
}
