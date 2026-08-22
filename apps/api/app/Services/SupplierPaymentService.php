<?php

namespace App\Services;

use App\Exceptions\SupplierPaymentException;
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
         * Fast-path idempotency check.
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
                     * Lock purchase first.
                     */
                    /** @var Purchase $lockedPurchase */
                    $lockedPurchase =
                        Purchase::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $purchase->id
                        );

                    /*
                     * Re-check idempotency within
                     * transaction.
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

                            errorCode: 'PURCHASE_ALREADY_PAID'
                        );
                    }

                    $payments =
                        $data['payments'];

                    $totalAmount =
                        round(
                            collect($payments)
                                ->sum(
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
                     * Never accept an overpayment
                     * against a purchase.
                     */
                    if (
                        $totalAmount
                        > $currentBalanceDue
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
                     * This should normally never fail.
                     * If it does, supplier totals and
                     * purchase balances have diverged.
                     */
                    if (
                        $supplierBalance
                        + 0.01
                        < $totalAmount
                    ) {
                        throw new SupplierPaymentException(
                            message: 'Supplier outstanding balance is inconsistent with the purchase balance. Payment was not recorded.',

                            errorCode: 'SUPPLIER_BALANCE_INCONSISTENT'
                        );
                    }

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
                            $data['idempotency_key'],

                            'request_hash' =>
                            $requestHash,

                            'supplier_id' =>
                            $supplier->id,

                            'purchase_id' =>
                            $lockedPurchase->id,

                            'payment_date' =>
                            $data['payment_date'],

                            'total_amount' =>
                            $totalAmount,

                            'notes' =>
                            $data['notes']
                                ?? null,

                            'created_by' =>
                            $actor->id,
                        ]);

                    foreach (
                        $payments as $index => $payment
                    ) {
                        $lineNumber =
                            sprintf(
                                '%s-%02d',
                                $batchNumber,
                                $index + 1
                            );

                        SupplierPayment::query()
                            ->create([
                                'payment_batch_id' =>
                                $batch->id,

                                'supplier_id' =>
                                $supplier->id,

                                'purchase_id' =>
                                $lockedPurchase
                                    ->id,

                                'payment_number' =>
                                $lineNumber,

                                'payment_date' =>
                                $data['payment_date'],

                                'amount' =>
                                round(
                                    (float)
                                    $payment['amount'],
                                    2
                                ),

                                'payment_method' =>
                                $payment['payment_method'],

                                'reference' =>
                                $payment['reference']
                                    ?? null,

                                'notes' =>
                                $payment['notes']
                                    ?? null,

                                'created_by' =>
                                $actor->id,
                            ]);
                    }

                    /*
                     * Update purchase payment totals.
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
                        $this->paymentStatus(
                            paidAmount: $newPaidAmount,

                            grandTotal: (float)
                            $lockedPurchase
                                ->grand_total
                        );

                    $lockedPurchase->save();

                    /*
                     * Supplier total outstanding
                     * balance decreases by exactly
                     * the payment total.
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

                    $this->auditLogger
                        ->record(
                            action: 'SUPPLIER_PAYMENT_RECORDED',

                            entityType: 'supplier_payment_batch',

                            entityId: $batch->id,

                            newValues: [
                                'batch_number' =>
                                $batchNumber,

                                'supplier_id' =>
                                $supplier->id,

                                'purchase_id' =>
                                $lockedPurchase
                                    ->id,

                                'amount' =>
                                $totalAmount,

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

                            userId: $actor->id
                        );

                    return $this->loadBatch(
                        $batch
                    );
                }
            );
        } catch (
            QueryException $exception
        ) {
            /*
             * Handles two identical requests
             * arriving concurrently and racing
             * against the unique idempotency key.
             */
            $existing =
                SupplierPaymentBatch::query()
                ->where(
                    'idempotency_key',
                    $data['idempotency_key']
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
            >= $grandTotal
        ) {
            return Purchase::PAYMENT_STATUS_PAID;
        }

        return Purchase::PAYMENT_STATUS_PARTIALLY_PAID;
    }

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
                    $payment['payment_method'],

                    'amount' =>
                    number_format(
                        (float)
                        $payment['amount'],
                        2,
                        '.',
                        ''
                    ),

                    'reference' =>
                    $payment['reference']
                        ?? null,

                    'notes' =>
                    $payment['notes']
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
                    $data['payment_date'],

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

        return $this->loadBatch(
            $batch
        );
    }

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
