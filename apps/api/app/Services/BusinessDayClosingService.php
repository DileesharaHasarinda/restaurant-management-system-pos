<?php

namespace App\Services;

use App\Exceptions\BusinessDayClosingException;
use App\Models\BusinessDay;
use App\Models\BusinessDayClosing;
use App\Models\CashierShift;
use App\Models\Expense;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Purchase;
use App\Models\Refund;
use App\Models\StockMovement;
use App\Models\SupplierPayment;
use App\Models\TableSession;
use App\Models\User;
use App\Models\Wastage;
use App\Support\DatabaseTransaction;

final class BusinessDayClosingService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Current Day
    |--------------------------------------------------------------------------
    */

    public function current(): ?array
    {
        $businessDay =
            BusinessDay::query()
            ->where(
                'status',
                BusinessDay::STATUS_OPEN
            )
            ->orderByDesc(
                'business_date'
            )
            ->orderByDesc(
                'id'
            )
            ->first();

        if (! $businessDay) {
            return null;
        }

        return $this->preview(
            $businessDay
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Preview
    |--------------------------------------------------------------------------
    */

    public function preview(
        BusinessDay $businessDay
    ): array {
        $businessDay->load([
            'openedBy',
            'closedBy',
        ]);

        $closing =
            BusinessDayClosing::query()
            ->with([
                'businessDay.openedBy',
                'businessDay.closedBy',
                'closedBy',
            ])
            ->where(
                'business_day_id',
                $businessDay->id
            )
            ->first();

        /*
         * Historical closed day:
         * return immutable snapshot.
         */
        if (
            $businessDay->status
            ===
            BusinessDay::STATUS_CLOSED
            &&
            $closing
        ) {
            return [
                'business_day' =>
                $businessDay,

                'blockers' =>
                [
                    'open_tables' => 0,
                    'active_orders' => 0,
                    'unpaid_invoices' => 0,
                    'open_cashier_shifts' => 0,
                    'can_close' => false,
                ],

                'summary' =>
                $this->summaryFromClosing(
                    $closing
                ),

                'closing' =>
                $closing,
            ];
        }

        return [
            'business_day' =>
            $businessDay,

            'blockers' =>
            $this->blockers(
                $businessDay
            ),

            'summary' =>
            $this->financialSummary(
                $businessDay
            ),

            'closing' =>
            $closing,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Close
    |--------------------------------------------------------------------------
    */

    public function close(
        User $actor,
        BusinessDay $businessDay,
        array $data
    ): array {
        $clientRequestId =
            trim(
                (string)
                $data['client_request_id']
            );

        $closingNotes =
            $this->nullableString(
                $data['closing_notes']
                    ?? null
            );

        $requestHash =
            $this->closeRequestHash(
                businessDayId: $businessDay->id,

                closingNotes: $closingNotes
            );

        /*
        |--------------------------------------------------------------------------
        | Idempotent Retry
        |--------------------------------------------------------------------------
        */

        $existingByRequest =
            BusinessDayClosing::query()
            ->where(
                'client_request_id',
                $clientRequestId
            )
            ->first();

        if (
            $existingByRequest
        ) {
            $this->assertSameRequest(
                closing: $existingByRequest,

                businessDayId: $businessDay->id,

                requestHash: $requestHash
            );

            return [
                'closing' =>
                $this->loadClosing(
                    $existingByRequest
                ),

                'closed' =>
                false,
            ];
        }

        return DatabaseTransaction::run(
            function () use (
                $actor,
                $businessDay,
                $clientRequestId,
                $closingNotes,
                $requestHash
            ): array {
                /*
                |--------------------------------------------------------------------------
                | Lock Day
                |--------------------------------------------------------------------------
                */

                $locked =
                    BusinessDay::query()
                    ->lockForUpdate()
                    ->find(
                        $businessDay->id
                    );

                if (! $locked) {
                    throw new BusinessDayClosingException(
                        message: 'The restaurant business day could not be found.',

                        errorCode: 'BUSINESS_DAY_NOT_FOUND',

                        status: 404
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Already Closed
                |--------------------------------------------------------------------------
                */

                $existingClosing =
                    BusinessDayClosing::query()
                    ->where(
                        'business_day_id',
                        $locked->id
                    )
                    ->first();

                if (
                    $existingClosing
                ) {
                    return [
                        'closing' =>
                        $this->loadClosing(
                            $existingClosing
                        ),

                        'closed' =>
                        false,
                    ];
                }

                if (
                    $locked->status
                    !==
                    BusinessDay::STATUS_OPEN
                ) {
                    throw new BusinessDayClosingException(
                        message: 'This restaurant business day is already closed.',

                        errorCode: 'BUSINESS_DAY_ALREADY_CLOSED',

                        status: 409
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Re-check Operational Blockers
                |--------------------------------------------------------------------------
                */

                $blockers =
                    $this->blockers(
                        $locked
                    );

                if (
                    ! $blockers['can_close']
                ) {
                    throw new BusinessDayClosingException(
                        message: 'The restaurant day cannot be closed while unresolved operational items remain.',

                        errorCode: 'BUSINESS_DAY_CLOSE_BLOCKED',

                        status: 409,

                        errors: $blockers
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Financial Snapshot
                |--------------------------------------------------------------------------
                */

                $summary =
                    $this->financialSummary(
                        $locked
                    );

                $closedAt =
                    now();

                $snapshot = [
                    'version' =>
                    1,

                    'business_day' => [
                        'id' =>
                        $locked->id,

                        'business_date' =>
                        $locked
                            ->business_date
                            ?->toDateString(),
                    ],

                    'blockers' =>
                    $blockers,

                    'orders' =>
                    $summary['orders'],

                    'invoices' =>
                    $summary['invoices'],

                    'sales' =>
                    $summary['sales'],

                    'payments' =>
                    $summary['payments'],

                    'refunds' =>
                    $summary['refunds'],

                    'purchases' => [
                        'total' =>
                        $summary['purchases'],
                    ],

                    'supplier_payments' => [
                        'total' =>
                        $summary['supplier_payments'],
                    ],

                    'profit' => [
                        'cogs' =>
                        $summary['cogs'],

                        'gross_profit' =>
                        $summary['gross_profit'],

                        'expenses' =>
                        $summary['expenses'],

                        'wastage' =>
                        $summary['wastage'],

                        'estimated_net_profit' =>
                        $summary['estimated_net_profit'],
                    ],

                    'cash_reconciliation' => [
                        'expected_cash' =>
                        $summary['expected_cash'],

                        'actual_cash' =>
                        $summary['actual_cash'],

                        'difference' =>
                        $summary['cash_difference'],
                    ],
                ];

                /*
                |--------------------------------------------------------------------------
                | Immutable Closing Record
                |--------------------------------------------------------------------------
                */

                $closing =
                    BusinessDayClosing::query()
                    ->create([
                        'business_day_id' =>
                        $locked->id,

                        'client_request_id' =>
                        $clientRequestId,

                        'request_hash' =>
                        $requestHash,

                        'total_sales' =>
                        $summary['sales']['net_sales'],

                        'total_discounts' =>
                        $summary['sales']['discounts'],

                        'total_refunds' =>
                        $summary['refunds']['total'],

                        'cash_sales' =>
                        $summary['payments']['net']['cash'],

                        'card_sales' =>
                        $summary['payments']['net']['card'],

                        'qr_sales' =>
                        $summary['payments']['net']['qr'],

                        'bank_sales' =>
                        $summary['payments']['net']['bank_transfer'],

                        'other_sales' =>
                        $summary['payments']['net']['other'],

                        'total_cogs' =>
                        $summary['cogs'],

                        'gross_profit' =>
                        $summary['gross_profit'],

                        'total_expenses' =>
                        $summary['expenses'],

                        'total_wastage_cost' =>
                        $summary['wastage'],

                        'estimated_net_profit' =>
                        $summary['estimated_net_profit'],

                        'total_purchases' =>
                        $summary['purchases'],

                        'supplier_payments' =>
                        $summary['supplier_payments'],

                        'expected_cash' =>
                        $summary['expected_cash'],

                        'actual_cash' =>
                        $summary['actual_cash'],

                        'cash_difference' =>
                        $summary['cash_difference'],

                        'snapshot' =>
                        $snapshot,

                        'closing_notes' =>
                        $closingNotes,

                        'closed_by' =>
                        $actor->id,

                        'closed_at' =>
                        $closedAt,
                    ]);

                /*
                |--------------------------------------------------------------------------
                | Close Business Day
                |--------------------------------------------------------------------------
                */

                $locked->status =
                    BusinessDay::STATUS_CLOSED;

                $locked->closed_by =
                    $actor->id;

                $locked->closed_at =
                    $closedAt;

                $locked->save();

                /*
                |--------------------------------------------------------------------------
                | Audit
                |--------------------------------------------------------------------------
                */

                $this
                    ->auditLogger
                    ->record(
                        action: 'BUSINESS_DAY_CLOSED',

                        entityType: 'business_day',

                        entityId: $locked->id,

                        oldValues: [
                            'status' =>
                            BusinessDay::STATUS_OPEN,
                        ],

                        newValues: [
                            'status' =>
                            BusinessDay::STATUS_CLOSED,

                            'closed_by' =>
                            $actor->id,

                            'closed_at' =>
                            $closedAt
                                ->toISOString(),
                        ],

                        metadata: [
                            'client_request_id' =>
                            $clientRequestId,

                            'summary' =>
                            $snapshot,
                        ],

                        userId: $actor->id
                    );

                return [
                    'closing' =>
                    $this->loadClosing(
                        $closing
                    ),

                    'closed' =>
                    true,
                ];
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Blockers
    |--------------------------------------------------------------------------
    */

    private function blockers(
        BusinessDay $businessDay
    ): array {
        $openTables =
            TableSession::query()
            ->where(
                'business_day_id',
                $businessDay->id
            )
            ->where(
                'status',
                TableSession::STATUS_OPEN
            )
            ->count();

        $activeOrders =
            Order::query()
            ->where(
                'business_day_id',
                $businessDay->id
            )
            ->whereIn(
                'status',
                [
                    Order::STATUS_PENDING,
                    Order::STATUS_CONFIRMED,
                    Order::STATUS_SENT_TO_KITCHEN,
                    Order::STATUS_SERVED,
                ]
            )
            ->count();

        $unpaidInvoices =
            Invoice::query()
            ->where(
                'business_day_id',
                $businessDay->id
            )
            ->where(
                'status',
                Invoice::STATUS_ISSUED
            )
            ->where(
                'payment_status',
                '!=',
                Invoice::PAYMENT_STATUS_PAID
            )
            ->count();

        $openCashierShifts =
            CashierShift::query()
            ->where(
                'business_day_id',
                $businessDay->id
            )
            ->where(
                'status',
                CashierShift::STATUS_OPEN
            )
            ->count();

        return [
            'open_tables' =>
            $openTables,

            'active_orders' =>
            $activeOrders,

            'unpaid_invoices' =>
            $unpaidInvoices,

            'open_cashier_shifts' =>
            $openCashierShifts,

            'can_close' =>
            $openTables === 0
                &&
                $activeOrders === 0
                &&
                $unpaidInvoices === 0
                &&
                $openCashierShifts === 0,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Financial Summary
    |--------------------------------------------------------------------------
    */

    private function financialSummary(
        BusinessDay $businessDay
    ): array {
        /*
        |--------------------------------------------------------------------------
        | Orders
        |--------------------------------------------------------------------------
        */

        $completedOrders =
            Order::query()
            ->where(
                'business_day_id',
                $businessDay->id
            )
            ->where(
                'status',
                Order::STATUS_COMPLETED
            )
            ->count();

        $cancelledOrders =
            Order::query()
            ->where(
                'business_day_id',
                $businessDay->id
            )
            ->where(
                'status',
                Order::STATUS_CANCELLED
            )
            ->count();

        $rejectedOrders =
            Order::query()
            ->where(
                'business_day_id',
                $businessDay->id
            )
            ->where(
                'status',
                Order::STATUS_REJECTED
            )
            ->count();

        /*
        |--------------------------------------------------------------------------
        | Sales Invoices
        |--------------------------------------------------------------------------
        */

        $invoiceQuery =
            Invoice::query()
            ->where(
                'business_day_id',
                $businessDay->id
            )
            ->where(
                'invoice_type',
                Invoice::TYPE_SALE
            )
            ->where(
                'status',
                Invoice::STATUS_ISSUED
            );

        $invoiceCount =
            (clone $invoiceQuery)
            ->count();

        $subtotal =
            $this->money(
                (clone $invoiceQuery)
                    ->sum(
                        'subtotal'
                    )
            );

        $discounts =
            $this->money(
                (clone $invoiceQuery)
                    ->sum(
                        'discount_total'
                    )
            );

        $tax =
            $this->money(
                (clone $invoiceQuery)
                    ->sum(
                        'tax_total'
                    )
            );

        $serviceCharge =
            $this->money(
                (clone $invoiceQuery)
                    ->sum(
                        'service_charge_total'
                    )
            );

        $grossInvoiceSales =
            $this->money(
                (clone $invoiceQuery)
                    ->sum(
                        'grand_total'
                    )
            );

        /*
        |--------------------------------------------------------------------------
        | Completed Refunds
        |--------------------------------------------------------------------------
        */

        $refundRows =
            Refund::query()
            ->where(
                'business_day_id',
                $businessDay->id
            )
            ->where(
                'status',
                Refund::STATUS_COMPLETED
            )
            ->selectRaw(
                '
                    refund_method,
                    SUM(amount) AS total_amount
                    '
            )
            ->groupBy(
                'refund_method'
            )
            ->get();

        $refundByMethod = [
            Payment::METHOD_CASH =>
            0.0,

            Payment::METHOD_CARD =>
            0.0,

            Payment::METHOD_QR =>
            0.0,

            Payment::METHOD_BANK_TRANSFER =>
            0.0,

            Payment::METHOD_OTHER =>
            0.0,
        ];

        foreach (
            $refundRows
            as $row
        ) {
            $method =
                (string)
                $row->refund_method;

            if (
                array_key_exists(
                    $method,
                    $refundByMethod
                )
            ) {
                $refundByMethod[$method] =
                    $this->money(
                        $row->total_amount
                    );
            }
        }

        $totalRefunds =
            $this->money(
                array_sum(
                    $refundByMethod
                )
            );

        /*
        |--------------------------------------------------------------------------
        | Net Sales
        |--------------------------------------------------------------------------
        */

        $netSales =
            $this->money(
                $grossInvoiceSales
                    -
                    $totalRefunds
            );

        /*
        |--------------------------------------------------------------------------
        | Customer Payments
        |--------------------------------------------------------------------------
        */

        $paymentRows =
            Payment::query()
            ->join(
                'invoices',
                'invoices.id',
                '=',
                'payments.invoice_id'
            )
            ->where(
                'invoices.business_day_id',
                $businessDay->id
            )
            ->where(
                'invoices.status',
                Invoice::STATUS_ISSUED
            )
            ->where(
                'payments.status',
                Payment::STATUS_COMPLETED
            )
            ->selectRaw(
                '
                    payments.payment_method,
                    SUM(payments.amount) AS total_amount
                    '
            )
            ->groupBy(
                'payments.payment_method'
            )
            ->get();

        $grossPayments = [
            Payment::METHOD_CASH =>
            0.0,

            Payment::METHOD_CARD =>
            0.0,

            Payment::METHOD_QR =>
            0.0,

            Payment::METHOD_BANK_TRANSFER =>
            0.0,

            Payment::METHOD_OTHER =>
            0.0,
        ];

        foreach (
            $paymentRows
            as $row
        ) {
            $method =
                (string)
                $row->payment_method;

            if (
                array_key_exists(
                    $method,
                    $grossPayments
                )
            ) {
                $grossPayments[$method] =
                    $this->money(
                        $row->total_amount
                    );
            }
        }

        $netPayments = [];

        foreach (
            $grossPayments
            as $method => $amount
        ) {
            $netPayments[$method] =
                $this->money(
                    $amount
                        -
                        (
                            $refundByMethod[$method]
                            ??
                            0
                        )
                );
        }

        /*
        |--------------------------------------------------------------------------
        | Purchases
        |--------------------------------------------------------------------------
        */

        $purchases =
            $this->money(
                Purchase::query()
                    ->where(
                        'business_day_id',
                        $businessDay->id
                    )
                    ->where(
                        'status',
                        Purchase::STATUS_COMPLETED
                    )
                    ->sum(
                        'grand_total'
                    )
            );

        /*
        |--------------------------------------------------------------------------
        | Supplier Payments
        |--------------------------------------------------------------------------
        */

        $supplierPayments =
            $this->money(
                SupplierPayment::query()
                    ->where(
                        'business_day_id',
                        $businessDay->id
                    )
                    ->sum(
                        'amount'
                    )
            );

        /*
        |--------------------------------------------------------------------------
        | COGS
        |--------------------------------------------------------------------------
        |
        | Net immutable stock ledger:
        |
        | SALE_CONSUMPTION      negative
        | CANCELLATION_REVERSAL positive
        |
        */

        $netInventoryCost =
            (float)
            StockMovement::query()
                ->where(
                    'business_day_id',
                    $businessDay->id
                )
                ->whereIn(
                    'movement_type',
                    [
                        StockMovement::TYPE_SALE_CONSUMPTION,
                        StockMovement::TYPE_CANCELLATION_REVERSAL,
                    ]
                )
                ->sum(
                    'total_cost'
                );

        $cogs =
            $this->money(
                -$netInventoryCost
            );

        /*
        |--------------------------------------------------------------------------
        | Expenses
        |--------------------------------------------------------------------------
        */

        $expenses =
            $this->money(
                Expense::query()
                    ->where(
                        'business_day_id',
                        $businessDay->id
                    )
                    ->where(
                        'status',
                        Expense::STATUS_POSTED
                    )
                    ->sum(
                        'amount'
                    )
            );

        /*
        |--------------------------------------------------------------------------
        | Wastage
        |--------------------------------------------------------------------------
        */

        $wastage =
            $this->money(
                Wastage::query()
                    ->where(
                        'business_day_id',
                        $businessDay->id
                    )
                    ->where(
                        'status',
                        Wastage::STATUS_POSTED
                    )
                    ->sum(
                        'estimated_cost'
                    )
            );

        /*
        |--------------------------------------------------------------------------
        | Profit
        |--------------------------------------------------------------------------
        */

        $grossProfit =
            $this->money(
                $netSales
                    -
                    $cogs
            );

        $estimatedNetProfit =
            $this->money(
                $grossProfit
                    -
                    $expenses
                    -
                    $wastage
            );

        /*
        |--------------------------------------------------------------------------
        | Shift Reconciliation
        |--------------------------------------------------------------------------
        */

        $closedShiftQuery =
            CashierShift::query()
            ->where(
                'business_day_id',
                $businessDay->id
            )
            ->where(
                'status',
                CashierShift::STATUS_CLOSED
            );

        $expectedCash =
            $this->money(
                (clone $closedShiftQuery)
                    ->sum(
                        'expected_cash'
                    )
            );

        $actualCash =
            $this->money(
                (clone $closedShiftQuery)
                    ->sum(
                        'actual_cash'
                    )
            );

        $cashDifference =
            $this->money(
                (clone $closedShiftQuery)
                    ->sum(
                        'cash_difference'
                    )
            );

        return [
            'orders' => [
                'completed' =>
                $completedOrders,

                'cancelled' =>
                $cancelledOrders,

                'rejected' =>
                $rejectedOrders,
            ],

            'invoices' => [
                'issued' =>
                $invoiceCount,
            ],

            'sales' => [
                'subtotal' =>
                $subtotal,

                'discounts' =>
                $discounts,

                'tax' =>
                $tax,

                'service_charge' =>
                $serviceCharge,

                'gross_invoice_sales' =>
                $grossInvoiceSales,

                'refunds' =>
                $totalRefunds,

                'net_sales' =>
                $netSales,
            ],

            'refunds' => [
                'total' =>
                $totalRefunds,

                'by_method' => [
                    'cash' =>
                    $refundByMethod[Payment::METHOD_CASH],

                    'card' =>
                    $refundByMethod[Payment::METHOD_CARD],

                    'qr' =>
                    $refundByMethod[Payment::METHOD_QR],

                    'bank_transfer' =>
                    $refundByMethod[Payment::METHOD_BANK_TRANSFER],

                    'other' =>
                    $refundByMethod[Payment::METHOD_OTHER],
                ],
            ],

            'payments' => [
                'gross' => [
                    'cash' =>
                    $grossPayments[Payment::METHOD_CASH],

                    'card' =>
                    $grossPayments[Payment::METHOD_CARD],

                    'qr' =>
                    $grossPayments[Payment::METHOD_QR],

                    'bank_transfer' =>
                    $grossPayments[Payment::METHOD_BANK_TRANSFER],

                    'other' =>
                    $grossPayments[Payment::METHOD_OTHER],
                ],

                'net' => [
                    'cash' =>
                    $netPayments[Payment::METHOD_CASH],

                    'card' =>
                    $netPayments[Payment::METHOD_CARD],

                    'qr' =>
                    $netPayments[Payment::METHOD_QR],

                    'bank_transfer' =>
                    $netPayments[Payment::METHOD_BANK_TRANSFER],

                    'other' =>
                    $netPayments[Payment::METHOD_OTHER],
                ],
            ],

            'purchases' =>
            $purchases,

            'supplier_payments' =>
            $supplierPayments,

            'cogs' =>
            $cogs,

            'gross_profit' =>
            $grossProfit,

            'expenses' =>
            $expenses,

            'wastage' =>
            $wastage,

            'estimated_net_profit' =>
            $estimatedNetProfit,

            'expected_cash' =>
            $expectedCash,

            'actual_cash' =>
            $actualCash,

            'cash_difference' =>
            $cashDifference,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Historical Summary
    |--------------------------------------------------------------------------
    */

    private function summaryFromClosing(
        BusinessDayClosing $closing
    ): array {
        if (
            is_array(
                $closing->snapshot
            )
        ) {
            return [
                ...$closing->snapshot,

                /*
                 * Preserve direct headline fields too.
                 */
                'headline' => [
                    'total_sales' =>
                    (float)
                    $closing->total_sales,

                    'total_discounts' =>
                    (float)
                    $closing->total_discounts,

                    'total_refunds' =>
                    (float)
                    $closing->total_refunds,

                    'total_cogs' =>
                    (float)
                    $closing->total_cogs,

                    'gross_profit' =>
                    (float)
                    $closing->gross_profit,

                    'total_expenses' =>
                    (float)
                    $closing->total_expenses,

                    'total_wastage_cost' =>
                    (float)
                    $closing->total_wastage_cost,

                    'estimated_net_profit' =>
                    (float)
                    $closing->estimated_net_profit,

                    'cash_difference' =>
                    (float)
                    $closing->cash_difference,
                ],
            ];
        }

        /*
         * Compatibility for old closing rows that may
         * predate the detailed JSON snapshot.
         */
        return [
            'orders' =>
            null,

            'invoices' =>
            null,

            'sales' => [
                'discounts' =>
                (float)
                $closing->total_discounts,

                'refunds' =>
                (float)
                $closing->total_refunds,

                'net_sales' =>
                (float)
                $closing->total_sales,
            ],

            'payments' => [
                'net' => [
                    'cash' =>
                    (float)
                    $closing->cash_sales,

                    'card' =>
                    (float)
                    $closing->card_sales,

                    'qr' =>
                    (float)
                    $closing->qr_sales,

                    'bank_transfer' =>
                    (float)
                    $closing->bank_sales,

                    'other' =>
                    (float)
                    $closing->other_sales,
                ],
            ],

            'purchases' =>
            (float)
            $closing->total_purchases,

            'supplier_payments' =>
            (float)
            $closing->supplier_payments,

            'cogs' =>
            (float)
            $closing->total_cogs,

            'gross_profit' =>
            (float)
            $closing->gross_profit,

            'expenses' =>
            (float)
            $closing->total_expenses,

            'wastage' =>
            (float)
            $closing->total_wastage_cost,

            'estimated_net_profit' =>
            (float)
            $closing->estimated_net_profit,

            'expected_cash' =>
            (float)
            $closing->expected_cash,

            'actual_cash' =>
            (float)
            $closing->actual_cash,

            'cash_difference' =>
            (float)
            $closing->cash_difference,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotency
    |--------------------------------------------------------------------------
    */

    private function closeRequestHash(
        int $businessDayId,
        ?string $closingNotes
    ): string {
        return hash(
            'sha256',
            json_encode(
                [
                    'business_day_id' =>
                    $businessDayId,

                    'closing_notes' =>
                    $closingNotes,
                ],

                JSON_THROW_ON_ERROR
            )
        );
    }

    private function assertSameRequest(
        BusinessDayClosing $closing,
        int $businessDayId,
        string $requestHash
    ): void {
        if (
            (int)
            $closing->business_day_id
            !==
            $businessDayId
            ||
            ! is_string(
                $closing->request_hash
            )
            ||
            ! hash_equals(
                $closing->request_hash,
                $requestHash
            )
        ) {
            throw new BusinessDayClosingException(
                message: 'This business day closing request ID has already been used for different data.',

                errorCode: 'BUSINESS_DAY_CLOSE_IDEMPOTENCY_KEY_REUSED',

                status: 409
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function loadClosing(
        BusinessDayClosing $closing
    ): BusinessDayClosing {
        return $closing
            ->fresh([
                'businessDay.openedBy',
                'businessDay.closedBy',
                'closedBy',
            ]);
    }

    private function money(
        mixed $value
    ): float {
        return round(
            (float)
            $value,
            2
        );
    }

    private function nullableString(
        mixed $value
    ): ?string {
        if (
            $value === null
        ) {
            return null;
        }

        $value =
            trim(
                (string)
                $value
            );

        return $value !== ''
            ? $value
            : null;
    }
}
