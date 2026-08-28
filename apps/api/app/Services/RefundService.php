<?php

namespace App\Services;

use App\Exceptions\RefundOperationException;
use App\Models\BusinessDay;
use App\Models\CashDrawerMovement;
use App\Models\CashierShift;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Refund;
use App\Models\User;
use App\Support\DatabaseTransaction;

final class RefundService
{
    public function __construct(
        private readonly ManagerAuthorizationService $managerAuthorization,
        private readonly AuditLogger $auditLogger
    ) {}

    public function create(
        Invoice $invoice,
        User $initiator,
        array $data
    ): array {
        $clientRequestId =
            trim(
                (string)
                $data['client_request_id']
            );

        $paymentId =
            isset(
                $data['payment_id']
            )
            ? (int)
            $data['payment_id']
            : null;

        $cashierShiftId =
            isset(
                $data['cashier_shift_id']
            )
            ? (int)
            $data['cashier_shift_id']
            : null;

        $amount =
            round(
                (float)
                $data['amount'],
                2
            );

        $method =
            (string)
            $data['refund_method'];

        $reason =
            trim(
                (string)
                $data['reason']
            );

        $requestHash =
            hash(
                'sha256',

                json_encode(
                    [
                        'invoice_id' =>
                        $invoice->id,

                        'initiated_by' =>
                        $initiator->id,

                        'payment_id' =>
                        $paymentId,

                        'cashier_shift_id' =>
                        $cashierShiftId,

                        'amount' =>
                        $amount,

                        'refund_method' =>
                        $method,

                        'reason' =>
                        $reason,
                    ],

                    JSON_THROW_ON_ERROR
                )
            );

        /*
        |--------------------------------------------------------------------------
        | Idempotent Retry
        |--------------------------------------------------------------------------
        */

        $existing =
            Refund::query()
            ->where(
                'client_request_id',
                $clientRequestId
            )
            ->first();

        if (
            $existing
        ) {
            $this->assertSameRequest(
                refund: $existing,

                requestHash: $requestHash,

                initiator: $initiator
            );

            return [
                'refund' =>
                $existing,

                'created' =>
                false,

                'cash_drawer' => [
                    'should_open' =>
                    false,

                    'cash_amount' =>
                    0.0,
                ],
            ];
        }

        return DatabaseTransaction::run(
            function () use (
                $invoice,
                $initiator,
                $data,
                $clientRequestId,
                $paymentId,
                $cashierShiftId,
                $amount,
                $method,
                $reason,
                $requestHash
            ): array {
                /** @var Invoice $lockedInvoice */
                $lockedInvoice =
                    Invoice::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $invoice->id
                    );

                $duplicate =
                    Refund::query()
                    ->where(
                        'client_request_id',
                        $clientRequestId
                    )
                    ->lockForUpdate()
                    ->first();

                if (
                    $duplicate
                ) {
                    $this->assertSameRequest(
                        refund: $duplicate,

                        requestHash: $requestHash,

                        initiator: $initiator
                    );

                    return [
                        'refund' =>
                        $duplicate,

                        'created' =>
                        false,

                        'cash_drawer' => [
                            'should_open' =>
                            false,

                            'cash_amount' =>
                            0.0,
                        ],
                    ];
                }

                /*
                |--------------------------------------------------------------------------
                | Business Day Protection
                |--------------------------------------------------------------------------
                */

                /** @var BusinessDay|null $businessDay */
                $businessDay =
                    BusinessDay::query()
                    ->lockForUpdate()
                    ->find(
                        $lockedInvoice->business_day_id
                    );

                if (
                    ! $businessDay
                    ||
                    $businessDay->status
                    !==
                    BusinessDay::STATUS_OPEN
                ) {
                    throw new RefundOperationException(
                        message: 'Refunds cannot be created for a closed business day.',

                        errorCode: 'REFUND_BUSINESS_DAY_CLOSED',

                        status: 409
                    );
                }

                if (
                    $lockedInvoice->status
                    ===
                    'VOID'
                ) {
                    throw new RefundOperationException(
                        message: 'A void invoice cannot be refunded.',

                        errorCode: 'VOID_INVOICE_CANNOT_BE_REFUNDED',

                        status: 409
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Manager Authorization
                |--------------------------------------------------------------------------
                */

                $authorizer =
                    $this
                    ->managerAuthorization
                    ->authorize(
                        initiator: $initiator,

                        permission: 'refunds.authorize',

                        login: $data['manager_login']
                            ?? null,

                        password: $data['manager_password']
                            ?? null,

                        action: 'FINANCIAL_REFUND',

                        entityType: 'invoice',

                        entityId: $lockedInvoice->id
                    );

                /*
                |--------------------------------------------------------------------------
                | Completed Payments
                |--------------------------------------------------------------------------
                */

                $completedPaid =
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

                $alreadyRefunded =
                    round(
                        (float)
                        Refund::query()
                            ->where(
                                'invoice_id',
                                $lockedInvoice->id
                            )
                            ->where(
                                'status',
                                Refund::STATUS_COMPLETED
                            )
                            ->sum(
                                'amount'
                            ),

                        2
                    );

                $remainingTotal =
                    round(
                        $completedPaid
                            -
                            $alreadyRefunded,

                        2
                    );

                if (
                    $amount
                    >
                    $remainingTotal
                    +
                    0.009
                ) {
                    throw new RefundOperationException(
                        message: 'Refund amount exceeds the remaining refundable amount.',

                        errorCode: 'REFUND_EXCEEDS_AVAILABLE_AMOUNT',

                        status: 422,

                        errors: [
                            'amount' => [
                                "Maximum refundable amount is {$remainingTotal}.",
                            ],
                        ]
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Method / Payment Limit
                |--------------------------------------------------------------------------
                */

                $specificPayment =
                    null;

                if (
                    $paymentId
                    !==
                    null
                ) {
                    $specificPayment =
                        Payment::query()
                        ->where(
                            'id',
                            $paymentId
                        )
                        ->where(
                            'invoice_id',
                            $lockedInvoice->id
                        )
                        ->where(
                            'status',
                            Payment::STATUS_COMPLETED
                        )
                        ->lockForUpdate()
                        ->first();

                    if (
                        ! $specificPayment
                    ) {
                        throw new RefundOperationException(
                            message: 'The selected completed payment does not belong to this invoice.',

                            errorCode: 'INVALID_REFUND_PAYMENT',

                            status: 422
                        );
                    }

                    if (
                        $specificPayment->payment_method
                        !==
                        $method
                    ) {
                        throw new RefundOperationException(
                            message: 'Refund method must match the selected payment method.',

                            errorCode: 'REFUND_METHOD_MISMATCH',

                            status: 422
                        );
                    }

                    $paymentRefunded =
                        round(
                            (float)
                            Refund::query()
                                ->where(
                                    'payment_id',
                                    $specificPayment->id
                                )
                                ->where(
                                    'status',
                                    Refund::STATUS_COMPLETED
                                )
                                ->sum(
                                    'amount'
                                ),

                            2
                        );

                    $paymentRemaining =
                        round(
                            (float)
                            $specificPayment->amount
                                -
                                $paymentRefunded,

                            2
                        );

                    if (
                        $amount
                        >
                        $paymentRemaining
                        +
                        0.009
                    ) {
                        throw new RefundOperationException(
                            message: 'Refund exceeds the remaining amount on the selected payment.',

                            errorCode: 'REFUND_EXCEEDS_PAYMENT_AMOUNT',

                            status: 422
                        );
                    }
                } else {
                    $methodPayments =
                        round(
                            (float)
                            Payment::query()
                                ->where(
                                    'invoice_id',
                                    $lockedInvoice->id
                                )
                                ->where(
                                    'payment_method',
                                    $method
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

                    $methodRefunds =
                        round(
                            (float)
                            Refund::query()
                                ->where(
                                    'invoice_id',
                                    $lockedInvoice->id
                                )
                                ->where(
                                    'refund_method',
                                    $method
                                )
                                ->where(
                                    'status',
                                    Refund::STATUS_COMPLETED
                                )
                                ->sum(
                                    'amount'
                                ),

                            2
                        );

                    if (
                        $amount
                        >
                        (
                            $methodPayments
                            -
                            $methodRefunds
                        )
                        +
                        0.009
                    ) {
                        throw new RefundOperationException(
                            message: 'Refund exceeds the remaining refundable amount for this payment method.',

                            errorCode: 'REFUND_EXCEEDS_METHOD_AMOUNT',

                            status: 422
                        );
                    }
                }

                /*
                |--------------------------------------------------------------------------
                | CASH Refund Shift
                |--------------------------------------------------------------------------
                */

                $shift =
                    null;

                if (
                    $method
                    ===
                    Payment::METHOD_CASH
                ) {
                    if (
                        ! $cashierShiftId
                    ) {
                        throw new RefundOperationException(
                            message: 'An open cashier shift is required for a cash refund.',

                            errorCode: 'CASH_REFUND_SHIFT_REQUIRED',

                            status: 422
                        );
                    }

                    /** @var CashierShift|null $shift */
                    $shift =
                        CashierShift::query()
                        ->lockForUpdate()
                        ->find(
                            $cashierShiftId
                        );

                    if (
                        ! $shift
                        ||
                        $shift->status
                        !==
                        CashierShift::STATUS_OPEN
                    ) {
                        throw new RefundOperationException(
                            message: 'Cash refund requires an open cashier shift.',

                            errorCode: 'CASH_REFUND_SHIFT_NOT_OPEN',

                            status: 409
                        );
                    }

                    if (
                        (int)
                        $shift->cashier_id
                        !==
                        (int)
                        $initiator->id
                    ) {
                        throw new RefundOperationException(
                            message: 'You cannot process a cash refund through another cashier\'s shift.',

                            errorCode: 'CASH_REFUND_SHIFT_OWNERSHIP',

                            status: 403
                        );
                    }

                    if (
                        (int)
                        $shift->business_day_id
                        !==
                        (int)
                        $lockedInvoice->business_day_id
                    ) {
                        throw new RefundOperationException(
                            message: 'Cashier shift and invoice belong to different business days.',

                            errorCode: 'CASH_REFUND_BUSINESS_DAY_MISMATCH',

                            status: 409
                        );
                    }

                    if (
                        $amount
                        >
                        (float)
                        $shift->expected_cash
                        +
                        0.009
                    ) {
                        throw new RefundOperationException(
                            message: 'The expected cash drawer balance is insufficient for this refund.',

                            errorCode: 'INSUFFICIENT_EXPECTED_CASH_FOR_REFUND',

                            status: 422
                        );
                    }
                }

                /*
                |--------------------------------------------------------------------------
                | Create Financial Refund
                |--------------------------------------------------------------------------
                |
                | IMPORTANT:
                |
                | We DO NOT change:
                | - invoice.paid_amount
                | - invoice.balance_due
                | - invoice.payment_status
                |
                | Refund is a separate financial event.
                |--------------------------------------------------------------------------
                */

                /** @var Refund $refund */
                $refund =
                    Refund::query()
                    ->create([
                        'client_request_id' =>
                        $clientRequestId,

                        'request_hash' =>
                        $requestHash,

                        'refund_number' =>
                        'TMP-' . $clientRequestId,

                        'invoice_id' =>
                        $lockedInvoice->id,

                        'payment_id' =>
                        $specificPayment?->id,

                        'business_day_id' =>
                        $lockedInvoice->business_day_id,

                        'cashier_shift_id' =>
                        $shift?->id,

                        'amount' =>
                        $amount,

                        'refund_method' =>
                        $method,

                        'status' =>
                        Refund::STATUS_COMPLETED,

                        'reason' =>
                        $reason,

                        'details' => [
                            'inventory_reversed' =>
                            false,

                            'financial_refund' =>
                            true,
                        ],

                        'initiated_by' =>
                        $initiator->id,

                        'authorized_by' =>
                        $authorizer->id,

                        'processed_by' =>
                        $initiator->id,

                        'refunded_at' =>
                        now(),
                    ]);

                $refund->refund_number =
                    sprintf(
                        'REF-%s-%06d',

                        now()->format(
                            'ymd'
                        ),

                        $refund->id
                    );

                $refund->save();

                /*
                |--------------------------------------------------------------------------
                | Cash Drawer
                |--------------------------------------------------------------------------
                */

                if (
                    $shift
                ) {
                    CashDrawerMovement::query()
                        ->create([
                            'client_request_id' =>
                            $clientRequestId,

                            'cashier_shift_id' =>
                            $shift->id,

                            'movement_type' =>
                            CashDrawerMovement::TYPE_CASH_REFUND,

                            'amount' =>
                            $amount,

                            'reference_type' =>
                            'refund',

                            'reference_id' =>
                            $refund->id,

                            'reason' =>
                            mb_substr(
                                $reason,
                                0,
                                255
                            ),

                            'created_by' =>
                            $initiator->id,

                            'occurred_at' =>
                            now(),
                        ]);

                    $shift->expected_cash =
                        round(
                            (float)
                            $shift->expected_cash
                                -
                                $amount,

                            2
                        );

                    $shift->save();
                }

                /*
                |--------------------------------------------------------------------------
                | Audit
                |--------------------------------------------------------------------------
                */

                $this->auditLogger->record(
                    action: 'REFUND_COMPLETED',

                    entityType: 'refund',

                    entityId: $refund->id,

                    newValues: [
                        'refund_number' =>
                        $refund->refund_number,

                        'invoice_id' =>
                        $lockedInvoice->id,

                        'payment_id' =>
                        $specificPayment?->id,

                        'amount' =>
                        $amount,

                        'refund_method' =>
                        $method,

                        'reason' =>
                        $reason,
                    ],

                    metadata: [
                        'client_request_id' =>
                        $clientRequestId,

                        'initiated_by' =>
                        $initiator->id,

                        'authorized_by' =>
                        $authorizer->id,

                        'cash_drawer_affected' =>
                        $shift !== null,

                        'inventory_reversed' =>
                        false,
                    ],

                    userId: $initiator->id
                );

                return [
                    'refund' =>
                    $refund
                        ->fresh([
                            'initiatedBy',
                            'authorizedBy',
                            'processedBy',
                        ]),

                    'created' =>
                    true,

                    'cash_drawer' => [
                        'should_open' =>
                        $method
                            ===
                            Payment::METHOD_CASH,

                        'cash_amount' =>
                        $method
                            ===
                            Payment::METHOD_CASH
                            ? $amount
                            : 0.0,
                    ],
                ];
            }
        );
    }

    private function assertSameRequest(
        Refund $refund,
        string $requestHash,
        User $initiator
    ): void {
        if (
            $refund->request_hash
            !==
            $requestHash
            ||
            (
                $refund->initiated_by
                !==
                null
                &&
                (int)
                $refund->initiated_by
                !==
                (int)
                $initiator->id
            )
        ) {
            throw new RefundOperationException(
                message: 'This refund request ID was already used with different data.',

                errorCode: 'REFUND_IDEMPOTENCY_KEY_REUSED',

                status: 409
            );
        }
    }
}
