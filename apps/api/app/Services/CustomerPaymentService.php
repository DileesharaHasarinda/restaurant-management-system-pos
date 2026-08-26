<?php

namespace App\Services;

use App\Exceptions\PaymentOperationException;
use App\Models\BusinessDay;
use App\Models\CashDrawerMovement;
use App\Models\CashierShift;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentBatch;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\QueryException;

final class CustomerPaymentService
{
    public function __construct(
        private readonly DocumentNumberService $documentNumberService,
        private readonly AuditLogger $auditLogger
    ) {}

    public function record(
        User $actor,
        Invoice $invoice,
        array $data
    ): array {
        $clientRequestId =
            (string)
            $data['client_request_id'];

        $requestedShiftId =
            isset(
                $data['cashier_shift_id']
            )
            ? (int)
            $data['cashier_shift_id']
            : null;

        $payments =
            $this->normalizePayments(
                $data['payments']
            );

        $requestHash =
            $this->requestHash(
                invoiceId: $invoice->id,

                cashierShiftId: $requestedShiftId,

                payments: $payments
            );

        /*
        |--------------------------------------------------------------------------
        | Fast Idempotency Check
        |--------------------------------------------------------------------------
        */

        $existing =
            PaymentBatch::query()
            ->where(
                'client_request_id',
                $clientRequestId
            )
            ->first();

        if ($existing) {
            $this->assertSameRequest(
                batch: $existing,

                invoiceId: $invoice->id,

                requestHash: $requestHash
            );

            return $this->existingResult(
                $existing
            );
        }

        try {
            return DatabaseTransaction::run(
                function () use (
                    $actor,
                    $invoice,
                    $clientRequestId,
                    $requestedShiftId,
                    $payments,
                    $requestHash
                ): array {
                    /*
                    |--------------------------------------------------------------------------
                    | Lock Invoice
                    |--------------------------------------------------------------------------
                    */

                    /** @var Invoice|null $lockedInvoice */
                    $lockedInvoice =
                        Invoice::query()
                        ->lockForUpdate()
                        ->find(
                            $invoice->id
                        );

                    if (! $lockedInvoice) {
                        throw new PaymentOperationException(
                            message: 'The invoice could not be found.',

                            errorCode: 'INVOICE_NOT_FOUND',

                            status: 404
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Idempotency Check Inside Transaction
                    |--------------------------------------------------------------------------
                    */

                    $existingBatch =
                        PaymentBatch::query()
                        ->where(
                            'client_request_id',
                            $clientRequestId
                        )
                        ->lockForUpdate()
                        ->first();

                    if ($existingBatch) {
                        $this->assertSameRequest(
                            batch: $existingBatch,

                            invoiceId: $lockedInvoice->id,

                            requestHash: $requestHash
                        );

                        return $this->existingResult(
                            $existingBatch
                        );
                    }

                    $this->assertInvoicePayable(
                        $lockedInvoice
                    );

                    /*
                    |--------------------------------------------------------------------------
                    | Business Day
                    |--------------------------------------------------------------------------
                    */

                    /** @var BusinessDay|null $businessDay */
                    $businessDay =
                        BusinessDay::query()
                        ->lockForUpdate()
                        ->find(
                            $lockedInvoice
                                ->business_day_id
                        );

                    if (! $businessDay) {
                        throw new PaymentOperationException(
                            message: 'The invoice business day could not be found.',

                            errorCode: 'PAYMENT_BUSINESS_DAY_NOT_FOUND',

                            status: 409
                        );
                    }

                    if (
                        $businessDay->status
                        !==
                        BusinessDay::STATUS_OPEN
                    ) {
                        throw new PaymentOperationException(
                            message: 'Payments cannot be recorded against a closed business day.',

                            errorCode: 'PAYMENT_BUSINESS_DAY_CLOSED',

                            status: 409
                        );
                    }

                    $hasCash =
                        collect(
                            $payments
                        )->contains(
                            fn(
                                array $payment
                            ): bool =>
                            $payment['payment_method']
                                ===
                                Payment::METHOD_CASH
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Cashier Shift
                    |--------------------------------------------------------------------------
                    |
                    | CASH requires an open shift.
                    |
                    | For non-cash-only payment requests the shift remains
                    | optional, but if supplied it must still be valid.
                    |
                    */

                    $shift =
                        $this->resolveAndLockShift(
                            actor: $actor,

                            businessDay: $businessDay,

                            requestedShiftId: $requestedShiftId,

                            cashRequired: $hasCash
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Validate Payment Total
                    |--------------------------------------------------------------------------
                    */

                    $requestedTotal =
                        round(
                            collect(
                                $payments
                            )->sum(
                                fn(
                                    array $payment
                                ): float =>
                                $payment['amount']
                            ),
                            2
                        );

                    $currentBalance =
                        round(
                            (float)
                            $lockedInvoice
                                ->balance_due,
                            2
                        );

                    if (
                        $requestedTotal
                        >
                        $currentBalance
                        +
                        0.009
                    ) {
                        throw new PaymentOperationException(
                            message: 'The payment total exceeds the remaining invoice balance.',

                            errorCode: 'PAYMENT_EXCEEDS_BALANCE',

                            status: 422
                        );
                    }

                    $cashAmount =
                        round(
                            collect(
                                $payments
                            )->where(
                                'payment_method',
                                Payment::METHOD_CASH
                            )
                                ->sum(
                                    'amount'
                                ),
                            2
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Create Atomic Batch
                    |--------------------------------------------------------------------------
                    */

                    $batch =
                        PaymentBatch::query()
                        ->create([
                            'client_request_id' =>
                            $clientRequestId,

                            'request_hash' =>
                            $requestHash,

                            'invoice_id' =>
                            $lockedInvoice->id,

                            'cashier_shift_id' =>
                            $shift?->id,

                            'total_amount' =>
                            $requestedTotal,

                            'cash_amount' =>
                            $cashAmount,

                            'payment_count' =>
                            count(
                                $payments
                            ),

                            'status' =>
                            PaymentBatch::STATUS_COMPLETED,

                            'created_by' =>
                            $actor->id,

                            'processed_at' =>
                            now(),
                        ]);

                    $createdPayments =
                        new Collection();

                    /*
                    |--------------------------------------------------------------------------
                    | Individual Payment Rows
                    |--------------------------------------------------------------------------
                    */

                    foreach (
                        $payments
                        as $paymentData
                    ) {
                        $method =
                            $paymentData['payment_method'];

                        $amount =
                            $paymentData['amount'];

                        $tendered =
                            null;

                        $change =
                            0.0;

                        if (
                            $method
                            ===
                            Payment::METHOD_CASH
                        ) {
                            $tendered =
                                $paymentData['tendered_amount']
                                ??
                                $amount;

                            if (
                                $tendered
                                +
                                0.009
                                <
                                $amount
                            ) {
                                throw new PaymentOperationException(
                                    message: 'Cash tendered amount cannot be less than the cash payment amount.',

                                    errorCode: 'CASH_TENDERED_AMOUNT_TOO_LOW',

                                    status: 422
                                );
                            }

                            $change =
                                round(
                                    $tendered
                                        -
                                        $amount,
                                    2
                                );
                        } elseif (
                            $paymentData['tendered_amount']
                            !== null
                        ) {
                            throw new PaymentOperationException(
                                message: 'Tendered amount is only valid for cash payments.',

                                errorCode: 'TENDERED_AMOUNT_ONLY_FOR_CASH',

                                status: 422
                            );
                        }

                        /** @var Payment $payment */
                        $payment =
                            Payment::query()
                            ->create([
                                'payment_batch_id' =>
                                $batch->id,

                                'payment_number' =>
                                $this
                                    ->documentNumberService
                                    ->nextPaymentNumber(),

                                'invoice_id' =>
                                $lockedInvoice->id,

                                /*
                                     * A validated shift may be associated
                                     * with all payments in this transaction
                                     * for operational reporting.
                                     *
                                     * Only CASH affects expected_cash.
                                     */
                                'cashier_shift_id' =>
                                $shift?->id,

                                'payment_method' =>
                                $method,

                                'amount' =>
                                $amount,

                                'tendered_amount' =>
                                $tendered,

                                'change_given' =>
                                $change,

                                'reference_number' =>
                                $paymentData['reference_number'],

                                'status' =>
                                Payment::STATUS_COMPLETED,

                                'received_by' =>
                                $actor->id,

                                'paid_at' =>
                                now(),

                                'notes' =>
                                $paymentData['notes'],
                            ]);

                        $createdPayments->push(
                            $payment
                        );

                        /*
                        |--------------------------------------------------------------------------
                        | Physical Cash Drawer
                        |--------------------------------------------------------------------------
                        |
                        | Drawer receives the NET cash kept:
                        |
                        | amount = tendered - change
                        |
                        | Therefore increment expected cash by Payment::amount.
                        |
                        */

                        if (
                            $method
                            ===
                            Payment::METHOD_CASH
                        ) {
                            if (! $shift) {
                                throw new PaymentOperationException(
                                    message: 'An open cashier shift is required for cash payments.',

                                    errorCode: 'CASHIER_SHIFT_REQUIRED',

                                    status: 409
                                );
                            }

                            $this->recordCashSale(
                                shift: $shift,

                                payment: $payment,

                                actor: $actor
                            );
                        }
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Recalculate Invoice Payment State
                    |--------------------------------------------------------------------------
                    |
                    | The client never controls invoice paid/balance totals.
                    |
                    */

                    $paidAmount =
                        round(
                            (float)
                            Payment::query()
                                ->where(
                                    'invoice_id',
                                    $lockedInvoice->id
                                )
                                ->where(
                                    'status',
                                    Payment::STATUS_COMPLETED
                                )
                                ->sum(
                                    'amount'
                                ),
                            2
                        );

                    $changeAmount =
                        round(
                            (float)
                            Payment::query()
                                ->where(
                                    'invoice_id',
                                    $lockedInvoice->id
                                )
                                ->where(
                                    'status',
                                    Payment::STATUS_COMPLETED
                                )
                                ->sum(
                                    'change_given'
                                ),
                            2
                        );

                    $grandTotal =
                        round(
                            (float)
                            $lockedInvoice
                                ->grand_total,
                            2
                        );

                    if (
                        $paidAmount
                        >
                        $grandTotal
                        +
                        0.009
                    ) {
                        throw new PaymentOperationException(
                            message: 'Recorded payments exceed the invoice grand total.',

                            errorCode: 'INVOICE_PAYMENT_TOTAL_INVALID',

                            status: 409
                        );
                    }

                    $balanceDue =
                        round(
                            max(
                                0,
                                $grandTotal
                                    -
                                    $paidAmount
                            ),
                            2
                        );

                    if (
                        $balanceDue
                        <=
                        0.009
                    ) {
                        $balanceDue =
                            0.0;

                        $paymentStatus =
                            Invoice::PAYMENT_STATUS_PAID;
                    } elseif (
                        $paidAmount > 0
                    ) {
                        $paymentStatus =
                            Invoice::PAYMENT_STATUS_PARTIAL;
                    } else {
                        $paymentStatus =
                            Invoice::PAYMENT_STATUS_UNPAID;
                    }

                    $lockedInvoice->paid_amount =
                        $paidAmount;

                    $lockedInvoice->change_amount =
                        $changeAmount;

                    $lockedInvoice->balance_due =
                        $balanceDue;

                    $lockedInvoice->payment_status =
                        $paymentStatus;

                    $lockedInvoice->save();

                    /*
                    |--------------------------------------------------------------------------
                    | Audit
                    |--------------------------------------------------------------------------
                    */

                    $this->auditLogger->record(
                        action: 'CUSTOMER_PAYMENT_BATCH_RECORDED',

                        entityType: 'invoice',

                        entityId: $lockedInvoice->id,

                        newValues: [
                            'paid_amount' =>
                            $paidAmount,

                            'balance_due' =>
                            $balanceDue,

                            'payment_status' =>
                            $paymentStatus,
                        ],

                        metadata: [
                            'payment_batch_id' =>
                            $batch->id,

                            'client_request_id' =>
                            $clientRequestId,

                            'payment_ids' =>
                            $createdPayments
                                ->pluck('id')
                                ->values()
                                ->all(),

                            'payment_methods' =>
                            $createdPayments
                                ->pluck(
                                    'payment_method'
                                )
                                ->values()
                                ->all(),

                            'total_amount' =>
                            $requestedTotal,

                            'cash_amount' =>
                            $cashAmount,

                            'cash_drawer_affected' =>
                            $cashAmount > 0,
                        ],

                        userId: $actor->id
                    );

                    return [
                        'batch' =>
                        $batch->fresh(),

                        'payments' =>
                        $createdPayments,

                        'invoice' =>
                        $this->loadInvoice(
                            $lockedInvoice
                        ),

                        /*
                         * Electron should open the drawer ONLY when
                         * created=true and should_open=true.
                         */
                        'cash_drawer_should_open' =>
                        $cashAmount > 0,

                        'cash_amount' =>
                        $cashAmount,

                        'created' =>
                        true,
                    ];
                }
            );
        } catch (
            QueryException $exception
        ) {
            /*
             * Concurrent duplicate client_request_id.
             */

            $existing =
                PaymentBatch::query()
                ->where(
                    'client_request_id',
                    $clientRequestId
                )
                ->first();

            if (! $existing) {
                throw $exception;
            }

            $this->assertSameRequest(
                batch: $existing,

                invoiceId: $invoice->id,

                requestHash: $requestHash
            );

            return $this->existingResult(
                $existing
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Payment Normalization
    |--------------------------------------------------------------------------
    */

    private function normalizePayments(
        array $payments
    ): array {
        return collect(
            $payments
        )
            ->map(
                function (
                    array $payment
                ): array {
                    $method =
                        strtoupper(
                            trim(
                                (string)
                                $payment['payment_method']
                            )
                        );

                    if (
                        ! in_array(
                            $method,
                            Payment::METHODS,
                            true
                        )
                    ) {
                        throw new PaymentOperationException(
                            message: 'Unsupported payment method.',

                            errorCode: 'INVALID_PAYMENT_METHOD',

                            status: 422
                        );
                    }

                    $amount =
                        round(
                            (float)
                            $payment['amount'],
                            2
                        );

                    if ($amount <= 0) {
                        throw new PaymentOperationException(
                            message: 'Payment amount must be greater than zero.',

                            errorCode: 'INVALID_PAYMENT_AMOUNT',

                            status: 422
                        );
                    }

                    $tendered =
                        isset(
                            $payment['tendered_amount']
                        )
                        ? round(
                            (float)
                            $payment['tendered_amount'],
                            2
                        )
                        : null;

                    return [
                        'payment_method' =>
                        $method,

                        'amount' =>
                        $amount,

                        'tendered_amount' =>
                        $tendered,

                        'reference_number' =>
                        $this->nullableString(
                            $payment['reference_number']
                                ??
                                null
                        ),

                        'notes' =>
                        $this->nullableString(
                            $payment['notes']
                                ??
                                null
                        ),
                    ];
                }
            )
            ->values()
            ->all();
    }

    /*
    |--------------------------------------------------------------------------
    | Invoice Validation
    |--------------------------------------------------------------------------
    */

    private function assertInvoicePayable(
        Invoice $invoice
    ): void {
        if (
            $invoice->status
            ===
            Invoice::STATUS_VOID
        ) {
            throw new PaymentOperationException(
                message: 'A void invoice cannot receive payments.',

                errorCode: 'VOID_INVOICE_CANNOT_BE_PAID',

                status: 409
            );
        }

        if (
            $invoice->status
            !==
            Invoice::STATUS_ISSUED
        ) {
            throw new PaymentOperationException(
                message: 'This invoice is not available for payment.',

                errorCode: 'INVOICE_NOT_PAYABLE',

                status: 409
            );
        }

        if (
            $invoice->payment_status
            ===
            Invoice::PAYMENT_STATUS_PAID
            ||
            (float)
            $invoice->balance_due
            <= 0
        ) {
            throw new PaymentOperationException(
                message: 'This invoice has already been fully paid.',

                errorCode: 'INVOICE_ALREADY_PAID',

                status: 409
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Cashier Shift
    |--------------------------------------------------------------------------
    */

    private function resolveAndLockShift(
        User $actor,
        BusinessDay $businessDay,
        ?int $requestedShiftId,
        bool $cashRequired
    ): ?CashierShift {
        $shiftId =
            $requestedShiftId;

        if (
            $shiftId === null
            &&
            $cashRequired
        ) {
            $shiftId =
                CashierShift::query()
                ->where(
                    'business_day_id',
                    $businessDay->id
                )
                ->where(
                    'cashier_id',
                    $actor->id
                )
                ->where(
                    'status',
                    CashierShift::STATUS_OPEN
                )
                ->orderByDesc(
                    'opened_at'
                )
                ->value(
                    'id'
                );

            if (! $shiftId) {
                throw new PaymentOperationException(
                    message: 'An open cashier shift is required before accepting cash.',

                    errorCode: 'CASHIER_SHIFT_REQUIRED',

                    status: 409
                );
            }
        }

        if ($shiftId === null) {
            return null;
        }

        /** @var CashierShift|null $shift */
        $shift =
            CashierShift::query()
            ->lockForUpdate()
            ->find(
                $shiftId
            );

        if (! $shift) {
            throw new PaymentOperationException(
                message: 'The selected cashier shift could not be found.',

                errorCode: 'CASHIER_SHIFT_NOT_FOUND',

                status: 422
            );
        }

        if (
            $shift->status
            !==
            CashierShift::STATUS_OPEN
        ) {
            throw new PaymentOperationException(
                message: 'The selected cashier shift is not open.',

                errorCode: 'CASHIER_SHIFT_NOT_OPEN',

                status: 409
            );
        }

        if (
            (int)
            $shift->business_day_id
            !==
            (int)
            $businessDay->id
        ) {
            throw new PaymentOperationException(
                message: 'The cashier shift belongs to a different business day.',

                errorCode: 'CASHIER_SHIFT_BUSINESS_DAY_MISMATCH',

                status: 422
            );
        }

        if (
            (int)
            $shift->cashier_id
            !==
            (int)
            $actor->id
        ) {
            throw new PaymentOperationException(
                message: 'You cannot record payments against another cashier\'s shift.',

                errorCode: 'CASHIER_SHIFT_NOT_OWNED',

                status: 403
            );
        }

        return $shift;
    }

    /*
    |--------------------------------------------------------------------------
    | Cash Drawer Sale
    |--------------------------------------------------------------------------
    */

    private function recordCashSale(
        CashierShift $shift,
        Payment $payment,
        User $actor
    ): CashDrawerMovement {
        $amount =
            round(
                (float)
                $payment->amount,
                2
            );

        $movement =
            CashDrawerMovement::query()
            ->create([
                'cashier_shift_id' =>
                $shift->id,

                'movement_type' =>
                CashDrawerMovement::TYPE_CASH_SALE,

                'amount' =>
                $amount,

                'reference_type' =>
                'payment',

                'reference_id' =>
                $payment->id,

                'reason' =>
                mb_substr(
                    sprintf(
                        'Cash received for payment %s.',
                        $payment
                            ->payment_number
                    ),
                    0,
                    255
                ),

                'created_by' =>
                $actor->id,

                'occurred_at' =>
                now(),
            ]);

        $shift->expected_cash =
            round(
                (float)
                $shift->expected_cash
                    +
                    $amount,
                2
            );

        $shift->save();

        return $movement;
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotency
    |--------------------------------------------------------------------------
    */

    private function requestHash(
        int $invoiceId,
        ?int $cashierShiftId,
        array $payments
    ): string {
        return hash(
            'sha256',
            json_encode(
                [
                    'invoice_id' =>
                    $invoiceId,

                    'cashier_shift_id' =>
                    $cashierShiftId,

                    'payments' =>
                    $payments,
                ],
                JSON_THROW_ON_ERROR
            )
        );
    }

    private function assertSameRequest(
        PaymentBatch $batch,
        int $invoiceId,
        string $requestHash
    ): void {
        if (
            (int)
            $batch->invoice_id
            !==
            $invoiceId
            ||
            ! hash_equals(
                $batch->request_hash,
                $requestHash
            )
        ) {
            throw new PaymentOperationException(
                message: 'This client request ID has already been used with different payment data.',

                errorCode: 'PAYMENT_IDEMPOTENCY_KEY_REUSED',

                status: 409
            );
        }
    }

    private function existingResult(
        PaymentBatch $batch
    ): array {
        $batch->load([
            'payments' =>
            fn(
                $query
            ) =>
            $query
                ->orderBy('id'),
        ]);

        /** @var Invoice $invoice */
        $invoice =
            Invoice::query()
            ->with([
                'items' =>
                fn(
                    $query
                ) =>
                $query
                    ->orderBy('id'),
            ])
            ->findOrFail(
                $batch->invoice_id
            );

        return [
            'batch' =>
            $batch,

            'payments' =>
            $batch->payments,

            'invoice' =>
            $invoice,

            /*
             * Critical:
             *
             * Never open the physical drawer again for an
             * idempotent network retry.
             */
            'cash_drawer_should_open' =>
            false,

            'cash_amount' =>
            (float)
            $batch->cash_amount,

            'created' =>
            false,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Load Invoice
    |--------------------------------------------------------------------------
    */

    private function loadInvoice(
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
                    ->orderBy('id'),
            ]);
    }

    private function nullableString(
        mixed $value
    ): ?string {
        if ($value === null) {
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
