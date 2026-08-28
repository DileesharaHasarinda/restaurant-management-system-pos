<?php

namespace App\Services;

use App\Exceptions\SupplierPaymentException;
use App\Models\BusinessDay;
use App\Models\CashDrawerMovement;
use App\Models\CashierShift;
use App\Models\Purchase;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\SupplierPaymentBatch;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;

final class SupplierPaymentService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function payPurchase(
        User $actor,
        Purchase $purchase,
        array $data
    ): SupplierPaymentBatch {
        $requestHash =
            $this->requestHash(
                purchase: $purchase,
                data: $data
            );

        /*
        |--------------------------------------------------------------------------
        | Fast Idempotency Check
        |--------------------------------------------------------------------------
        */

        $existing =
            SupplierPaymentBatch::query()
            ->where(
                'idempotency_key',
                $data['idempotency_key']
            )
            ->first();

        if ($existing) {
            return $this->validateExistingBatch(
                $existing,
                $requestHash
            );
        }

        try {
            return DatabaseTransaction::run(
                function () use (
                    $actor,
                    $purchase,
                    $data,
                    $requestHash
                ): SupplierPaymentBatch {
                    /*
                    |--------------------------------------------------------------------------
                    | Purchase Lock
                    |--------------------------------------------------------------------------
                    */

                    /** @var Purchase $lockedPurchase */
                    $lockedPurchase =
                        Purchase::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $purchase->id
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Transaction Idempotency Check
                    |--------------------------------------------------------------------------
                    */

                    $existingBatch =
                        SupplierPaymentBatch::query()
                        ->where(
                            'idempotency_key',
                            $data['idempotency_key']
                        )
                        ->first();

                    if ($existingBatch) {
                        return $this
                            ->validateExistingBatch(
                                $existingBatch,
                                $requestHash
                            );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Purchase Validation
                    |--------------------------------------------------------------------------
                    */

                    if (
                        ! $lockedPurchase
                            ->isCompleted()
                    ) {
                        throw new SupplierPaymentException(
                            message: 'Supplier payments can only be recorded against a completed purchase.',

                            errorCode: 'PURCHASE_NOT_COMPLETED',

                            status: 422
                        );
                    }

                    $currentBalanceDue =
                        round(
                            (float)
                            $lockedPurchase
                                ->balance_due,
                            2
                        );

                    if (
                        $currentBalanceDue
                        <= 0
                    ) {
                        throw new SupplierPaymentException(
                            message: 'This purchase is already fully paid.',

                            errorCode: 'PURCHASE_ALREADY_PAID',

                            status: 409
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Payment Totals
                    |--------------------------------------------------------------------------
                    */

                    $payments =
                        $data['payments'];

                    $totalAmount =
                        round(
                            collect(
                                $payments
                            )->sum(
                                fn(
                                    array $payment
                                ): float =>
                                (float)
                                $payment['amount']
                            ),
                            2
                        );

                    if ($totalAmount <= 0) {
                        throw new SupplierPaymentException(
                            message: 'Payment total must be greater than zero.',

                            errorCode: 'INVALID_PAYMENT_TOTAL',

                            status: 422
                        );
                    }

                    /*
                     * Overpayments against a purchase
                     * are never allowed.
                     */
                    if (
                        $totalAmount
                        >
                        $currentBalanceDue
                    ) {
                        throw new SupplierPaymentException(
                            message: sprintf(
                                'Payment total %.2f exceeds the outstanding purchase balance %.2f.',
                                $totalAmount,
                                $currentBalanceDue
                            ),

                            errorCode: 'PAYMENT_EXCEEDS_BALANCE',

                            status: 422
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Open Business Day
                    |--------------------------------------------------------------------------
                    |
                    | A supplier payment is a financial transaction
                    | occurring now. It therefore belongs to the
                    | currently open business day, not necessarily
                    | the business day on which the purchase itself
                    | was completed.
                    |
                    */

                    /** @var BusinessDay|null $businessDay */
                    $businessDay =
                        BusinessDay::query()
                        ->where(
                            'status',
                            BusinessDay::STATUS_OPEN
                        )
                        ->orderByDesc(
                            'opened_at'
                        )
                        ->lockForUpdate()
                        ->first();

                    if (! $businessDay) {
                        throw new SupplierPaymentException(
                            message: 'An open business day is required before a supplier payment can be recorded.',

                            errorCode: 'BUSINESS_DAY_NOT_OPEN',

                            status: 409
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Cash Requirement
                    |--------------------------------------------------------------------------
                    */

                    $hasCash =
                        collect(
                            $payments
                        )->contains(
                            fn(
                                array $payment
                            ): bool =>
                            $payment['payment_method']
                            ===
                            SupplierPayment::METHOD_CASH
                        );

                    $cashAmount =
                        round(
                            collect(
                                $payments
                            )
                                ->filter(
                                    fn(
                                        array $payment
                                    ): bool =>
                                    $payment['payment_method']
                                    ===
                                    SupplierPayment::METHOD_CASH
                                )
                                ->sum(
                                    fn(
                                        array $payment
                                    ): float =>
                                    (float)
                                    $payment['amount']
                                ),
                            2
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Cashier Shift
                    |--------------------------------------------------------------------------
                    |
                    | Only CASH needs a physical cashier drawer.
                    |
                    */

                    $shift =
                        $this
                            ->resolveAndLockShift(
                                actor: $actor,

                                businessDay:
                                $businessDay,

                                cashRequired:
                                $hasCash
                            );

                    /*
                     * Prevent the supplier payment from
                     * making expected physical cash negative.
                     */
                    if (
                        $cashAmount > 0
                        &&
                        $shift
                        &&
                        $cashAmount
                        >
                        round(
                            (float)
                            $shift->expected_cash,
                            2
                        )
                        + 0.001
                    ) {
                        throw new SupplierPaymentException(
                            message: 'The cash supplier payment exceeds the expected cash currently available in this drawer.',

                            errorCode: 'CASH_OUT_EXCEEDS_EXPECTED_CASH',

                            status: 409
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Supplier Lock
                    |--------------------------------------------------------------------------
                    */

                    /** @var Supplier $supplier */
                    $supplier =
                        Supplier::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $lockedPurchase
                                ->supplier_id
                        );

                    $supplierBalance =
                        round(
                            (float)
                            $supplier
                                ->current_balance,
                            2
                        );

                    /*
                     * Normally this should never fail.
                     *
                     * If it does, the supplier balance
                     * and purchase balances have diverged.
                     */
                    if (
                        $supplierBalance
                        + 0.01
                        <
                        $totalAmount
                    ) {
                        throw new SupplierPaymentException(
                            message: 'Supplier outstanding balance is inconsistent with the purchase balance. Payment was not recorded.',

                            errorCode: 'SUPPLIER_BALANCE_INCONSISTENT',

                            status: 409
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Payment Batch
                    |--------------------------------------------------------------------------
                    */

                    $batchNumber =
                        'SPAY-' .
                        Str::upper(
                            (string)
                            Str::ulid()
                        );

                    $batch =
                        SupplierPaymentBatch::query()
                        ->create([
                            'batch_number' =>
                            $batchNumber,

                            'idempotency_key' =>
                            $data[
                                'idempotency_key'
                            ],

                            'request_hash' =>
                            $requestHash,

                            'supplier_id' =>
                            $supplier->id,

                            'purchase_id' =>
                            $lockedPurchase
                                ->id,

                            'payment_date' =>
                            $data[
                                'payment_date'
                            ],

                            'total_amount' =>
                            $totalAmount,

                            'notes' =>
                            $data['notes']
                                ?? null,

                            'created_by' =>
                            $actor->id,
                        ]);

                    /*
                    |--------------------------------------------------------------------------
                    | Individual Payment Lines
                    |--------------------------------------------------------------------------
                    */

                    foreach (
                        $payments as $index => $payment
                    ) {
                        $lineNumber =
                            sprintf(
                                '%s-%02d',
                                $batchNumber,
                                $index + 1
                            );

                        $isCash =
                            $payment[
                                'payment_method'
                            ]
                            ===
                            SupplierPayment::METHOD_CASH;

                        SupplierPayment::query()
                            ->create([
                                'payment_batch_id' =>
                                $batch->id,

                                'supplier_id' =>
                                $supplier->id,

                                'purchase_id' =>
                                $lockedPurchase
                                    ->id,

                                /*
                                 * Required by the
                                 * existing production
                                 * database schema.
                                 */
                                'business_day_id' =>
                                $businessDay->id,

                                /*
                                 * CASH is tied to the
                                 * actor's physical drawer.
                                 *
                                 * Non-cash lines must not
                                 * affect a cashier shift.
                                 */
                                'cashier_shift_id' =>
                                $isCash
                                    ? $shift?->id
                                    : null,

                                'payment_number' =>
                                $lineNumber,

                                'payment_date' =>
                                $data[
                                    'payment_date'
                                ],

                                'amount' =>
                                round(
                                    (float)
                                    $payment[
                                        'amount'
                                    ],
                                    2
                                ),

                                'payment_method' =>
                                $payment[
                                    'payment_method'
                                ],

                                /*
                                 * Public API:
                                 * reference
                                 *
                                 * Database:
                                 * reference_number
                                 */
                                'reference_number' =>
                                $payment[
                                    'reference'
                                ]
                                    ?? null,

                                'notes' =>
                                $payment[
                                    'notes'
                                ]
                                    ?? null,

                                'created_by' =>
                                $actor->id,
                            ]);
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Update Purchase
                    |--------------------------------------------------------------------------
                    */

                    $newPaidAmount =
                        round(
                            (float)
                            $lockedPurchase
                                ->paid_amount
                            +
                            $totalAmount,
                            2
                        );

                    $newBalanceDue =
                        round(
                            max(
                                0,

                                (float)
                                $lockedPurchase
                                    ->grand_total
                                -
                                $newPaidAmount
                            ),
                            2
                        );

                    $lockedPurchase
                        ->paid_amount =
                        $newPaidAmount;

                    $lockedPurchase
                        ->balance_due =
                        $newBalanceDue;

                    $lockedPurchase
                        ->payment_status =
                        $this
                            ->paymentStatus(
                                paidAmount:
                                $newPaidAmount,

                                grandTotal:
                                (float)
                                $lockedPurchase
                                    ->grand_total
                            );

                    $lockedPurchase->save();

                    /*
                    |--------------------------------------------------------------------------
                    | Update Supplier Balance
                    |--------------------------------------------------------------------------
                    */

                    $supplier
                        ->current_balance =
                        round(
                            $supplierBalance
                            -
                            $totalAmount,
                            2
                        );

                    $supplier->save();

                    /*
                    |--------------------------------------------------------------------------
                    | Cash Drawer
                    |--------------------------------------------------------------------------
                    |
                    | A split payment may contain both CASH
                    | and non-cash methods.
                    |
                    | Only the CASH total leaves the physical
                    | cashier drawer.
                    |
                    */

                    if (
                        $cashAmount > 0
                        &&
                        $shift
                    ) {
                        $this
                            ->recordCashOut(
                                shift: $shift,

                                batch: $batch,

                                amount:
                                $cashAmount,

                                actor: $actor
                            );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Audit
                    |--------------------------------------------------------------------------
                    */

                    $this
                        ->auditLogger
                        ->record(
                            action: 'SUPPLIER_PAYMENT_RECORDED',

                            entityType:
                            'supplier_payment_batch',

                            entityId:
                            $batch->id,

                            newValues: [
                                'batch_number' =>
                                $batchNumber,

                                'supplier_id' =>
                                $supplier->id,

                                'purchase_id' =>
                                $lockedPurchase
                                    ->id,

                                'business_day_id' =>
                                $businessDay->id,

                                'cashier_shift_id' =>
                                $shift?->id,

                                'amount' =>
                                $totalAmount,

                                'cash_amount' =>
                                $cashAmount,

                                'purchase_paid_amount' =>
                                $newPaidAmount,

                                'purchase_balance_due' =>
                                $newBalanceDue,

                                'payment_status' =>
                                $lockedPurchase
                                    ->payment_status,
                            ],

                            metadata: [
                                'payment_methods' =>
                                collect(
                                    $payments
                                )
                                    ->pluck(
                                        'payment_method'
                                    )
                                    ->values()
                                    ->all(),
                            ],

                            userId:
                            $actor->id
                        );

                    return $this
                        ->loadBatch(
                            $batch
                        );
                }
            );
        } catch (
            QueryException $exception
        ) {
            /*
             * Handles two identical requests arriving
             * concurrently and racing against the
             * unique idempotency key.
             */

            $existing =
                SupplierPaymentBatch::query()
                ->where(
                    'idempotency_key',
                    $data[
                        'idempotency_key'
                    ]
                )
                ->first();

            if ($existing) {
                return $this
                    ->validateExistingBatch(
                        $existing,
                        $requestHash
                    );
            }

            throw $exception;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Payment Status
    |--------------------------------------------------------------------------
    */

    private function paymentStatus(
        float $paidAmount,
        float $grandTotal
    ): string {
        if ($paidAmount <= 0) {
            return Purchase::PAYMENT_STATUS_UNPAID;
        }

        if (
            $paidAmount
            + 0.001
            >=
            $grandTotal
        ) {
            return Purchase::PAYMENT_STATUS_PAID;
        }

        return Purchase::PAYMENT_STATUS_PARTIALLY_PAID;
    }

    /*
    |--------------------------------------------------------------------------
    | Cashier Shift
    |--------------------------------------------------------------------------
    */

    private function resolveAndLockShift(
        User $actor,
        BusinessDay $businessDay,
        bool $cashRequired
    ): ?CashierShift {
        if (! $cashRequired) {
            return null;
        }

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
            throw new SupplierPaymentException(
                message: 'An open cashier shift is required before recording a cash supplier payment.',

                errorCode: 'CASHIER_SHIFT_REQUIRED',

                status: 409
            );
        }

        /** @var CashierShift|null $shift */
        $shift =
            CashierShift::query()
            ->lockForUpdate()
            ->find(
                $shiftId
            );

        if (! $shift) {
            throw new SupplierPaymentException(
                message: 'The cashier shift could not be found.',

                errorCode: 'CASHIER_SHIFT_NOT_FOUND',

                status: 422
            );
        }

        if (
            $shift->status
            !==
            CashierShift::STATUS_OPEN
        ) {
            throw new SupplierPaymentException(
                message: 'The cashier shift is not open.',

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
            throw new SupplierPaymentException(
                message: 'The cashier shift belongs to a different business day.',

                errorCode: 'CASHIER_SHIFT_BUSINESS_DAY_MISMATCH',

                status: 422
            );
        }

        /*
         * Never allow one user to change another
         * cashier's expected physical drawer cash.
         */
        if (
            (int)
            $shift->cashier_id
            !==
            (int)
            $actor->id
        ) {
            throw new SupplierPaymentException(
                message: 'You cannot record a cash supplier payment against another cashier\'s shift.',

                errorCode: 'CASHIER_SHIFT_NOT_OWNED',

                status: 403
            );
        }

        return $shift;
    }

    /*
    |--------------------------------------------------------------------------
    | Cash Drawer Out
    |--------------------------------------------------------------------------
    */

    private function recordCashOut(
        CashierShift $shift,
        SupplierPaymentBatch $batch,
        float $amount,
        User $actor
    ): CashDrawerMovement {
        $amount =
            round(
                $amount,
                2
            );

        if ($amount <= 0) {
            throw new SupplierPaymentException(
                message: 'Cash drawer amount must be greater than zero.',

                errorCode: 'INVALID_CASH_DRAWER_AMOUNT',

                status: 422
            );
        }

        $currentExpected =
            round(
                (float)
                $shift->expected_cash,
                2
            );

        if (
            $amount
            >
            $currentExpected
            + 0.001
        ) {
            throw new SupplierPaymentException(
                message: 'The cash supplier payment exceeds the expected cash currently available in this drawer.',

                errorCode: 'CASH_OUT_EXCEEDS_EXPECTED_CASH',

                status: 409
            );
        }

        $movement =
            CashDrawerMovement::query()
            ->create([
                'cashier_shift_id' =>
                $shift->id,

                'movement_type' =>
                CashDrawerMovement::TYPE_CASH_OUT,

                'amount' =>
                $amount,

                'reference_type' =>
                'supplier_payment_batch',

                'reference_id' =>
                $batch->id,

                'reason' =>
                mb_substr(
                    sprintf(
                        'Cash supplier payment %s.',
                        $batch->batch_number
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
                $currentExpected
                -
                $amount,
                2
            );

        $shift->save();

        return $movement;
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotency Hash
    |--------------------------------------------------------------------------
    */

    private function requestHash(
        Purchase $purchase,
        array $data
    ): string {
        $payments =
            collect(
                $data['payments']
            )
            ->map(
                fn(
                    array $payment
                ): array => [
                    'payment_method' =>
                    $payment[
                        'payment_method'
                    ],

                    'amount' =>
                    number_format(
                        (float)
                        $payment[
                            'amount'
                        ],
                        2,
                        '.',
                        ''
                    ),

                    'reference' =>
                    $payment[
                        'reference'
                    ]
                        ?? null,

                    'notes' =>
                    $payment[
                        'notes'
                    ]
                        ?? null,
                ]
            )
            ->values()
            ->all();

        return hash(
            'sha256',

            json_encode(
                [
                    'purchase_id' =>
                    $purchase->id,

                    'payment_date' =>
                    $data[
                        'payment_date'
                    ],

                    'notes' =>
                    $data['notes']
                        ?? null,

                    'payments' =>
                    $payments,
                ],

                JSON_THROW_ON_ERROR
            )
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Existing Idempotent Request
    |--------------------------------------------------------------------------
    */

    private function validateExistingBatch(
        SupplierPaymentBatch $batch,
        string $requestHash
    ): SupplierPaymentBatch {
        if (
            ! hash_equals(
                $batch->request_hash,
                $requestHash
            )
        ) {
            throw new SupplierPaymentException(
                message: 'This idempotency key has already been used for a different payment request.',

                errorCode: 'IDEMPOTENCY_KEY_REUSED',

                status: 409
            );
        }

        return $this
            ->loadBatch(
                $batch
            );
    }

    /*
    |--------------------------------------------------------------------------
    | Load Resource Relationships
    |--------------------------------------------------------------------------
    */

    private function loadBatch(
        SupplierPaymentBatch $batch
    ): SupplierPaymentBatch {
        return $batch
            ->refresh()
            ->load([
                'supplier',

                'purchase',

                'payments' =>
                fn($query) =>
                $query->orderBy(
                    'id'
                ),

                'payments.createdBy',

                'createdBy',
            ]);
    }
}
