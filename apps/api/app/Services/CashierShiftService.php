<?php

namespace App\Services;

use App\Exceptions\CashierShiftOperationException;
use App\Models\BusinessDay;
use App\Models\CashDrawerMovement;
use App\Models\CashierShift;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;

final class CashierShiftService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Current Shift
    |--------------------------------------------------------------------------
    */

    public function current(
        User $actor
    ): ?array {
        /** @var CashierShift|null $shift */
        $shift =
            CashierShift::query()
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
            ->first();

        if (! $shift) {
            return null;
        }

        return $this->result(
            shift: $shift
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Show Shift
    |--------------------------------------------------------------------------
    */

    public function show(
        CashierShift $shift
    ): array {
        return $this->result(
            shift: $shift
                ->fresh()
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Open Shift
    |--------------------------------------------------------------------------
    */

    public function open(
        User $actor,
        array $data
    ): array {
        $clientRequestId =
            (string)
            $data['client_request_id'];

        $openingCash =
            round(
                (float)
                $data['opening_cash'],
                2
            );

        $openingNotes =
            $this->nullableString(
                $data['opening_notes']
                    ??
                    null
            );

        $requestHash =
            $this->openRequestHash(
                actor: $actor,

                openingCash: $openingCash,

                openingNotes: $openingNotes
            );

        /*
        |--------------------------------------------------------------------------
        | Fast Retry Check
        |--------------------------------------------------------------------------
        */

        $existing =
            CashierShift::query()
            ->where(
                'open_request_id',
                $clientRequestId
            )
            ->first();

        if ($existing) {
            $this->assertSameOpenRequest(
                shift: $existing,

                actor: $actor,

                requestHash: $requestHash
            );

            return [
                ...$this->result(
                    shift: $existing
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
                    $openingCash,
                    $openingNotes,
                    $requestHash
                ): array {
                    /*
                    |--------------------------------------------------------------------------
                    | Current Business Day
                    |--------------------------------------------------------------------------
                    */

                    /** @var BusinessDay|null $businessDay */
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
                        ->lockForUpdate()
                        ->first();

                    if (! $businessDay) {
                        throw new CashierShiftOperationException(
                            message: 'An open business day is required before opening a cashier shift.',

                            errorCode: 'OPEN_BUSINESS_DAY_REQUIRED',

                            status: 409
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Retry Check Inside Transaction
                    |--------------------------------------------------------------------------
                    */

                    $duplicateRequest =
                        CashierShift::query()
                        ->where(
                            'open_request_id',
                            $clientRequestId
                        )
                        ->lockForUpdate()
                        ->first();

                    if ($duplicateRequest) {
                        $this->assertSameOpenRequest(
                            shift: $duplicateRequest,

                            actor: $actor,

                            requestHash: $requestHash
                        );

                        return [
                            ...$this->result(
                                shift: $duplicateRequest
                            ),

                            'created' =>
                            false,
                        ];
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | One OPEN Shift Per Cashier
                    |--------------------------------------------------------------------------
                    */

                    $existingOpenShift =
                        CashierShift::query()
                        ->where(
                            'cashier_id',
                            $actor->id
                        )
                        ->where(
                            'status',
                            CashierShift::STATUS_OPEN
                        )
                        ->lockForUpdate()
                        ->first();

                    if ($existingOpenShift) {
                        throw new CashierShiftOperationException(
                            message: 'You already have an open cashier shift.',

                            errorCode: 'CASHIER_SHIFT_ALREADY_OPEN',

                            status: 409
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Create Shift
                    |--------------------------------------------------------------------------
                    */

                    /** @var CashierShift $shift */
                    $shift =
                        CashierShift::query()
                        ->create([
                            'open_request_id' =>
                            $clientRequestId,

                            'open_request_hash' =>
                            $requestHash,

                            'close_request_id' =>
                            null,

                            'close_request_hash' =>
                            null,

                            'shift_number' =>
                            $this->generateShiftNumber(),

                            'business_day_id' =>
                            $businessDay->id,

                            'cashier_id' =>
                            $actor->id,

                            'open_shift_key' =>
                            'CASHIER:' .
                                $actor->id,

                            'opening_float' =>
                            $openingCash,

                            /*
                                 * IMPORTANT:
                                 *
                                 * Expected cash begins at the
                                 * opening float.
                                 *
                                 * OPENING_FLOAT movement below
                                 * is ledger history only.
                                 *
                                 * Do NOT add opening float twice.
                                 */
                            'expected_cash' =>
                            $openingCash,

                            'actual_cash' =>
                            null,

                            'cash_difference' =>
                            null,

                            'status' =>
                            CashierShift::STATUS_OPEN,

                            'opened_at' =>
                            now(),

                            'closed_at' =>
                            null,

                            'closed_by' =>
                            null,

                            'opening_notes' =>
                            $openingNotes,

                            'closing_notes' =>
                            null,
                        ]);

                    /*
                    |--------------------------------------------------------------------------
                    | Opening Float Ledger Entry
                    |--------------------------------------------------------------------------
                    */

                    CashDrawerMovement::query()
                        ->create([
                            'client_request_id' =>
                            $clientRequestId,

                            'cashier_shift_id' =>
                            $shift->id,

                            'movement_type' =>
                            CashDrawerMovement::TYPE_OPENING_FLOAT,

                            'amount' =>
                            $openingCash,

                            'reference_type' =>
                            'cashier_shift',

                            'reference_id' =>
                            $shift->id,

                            'reason' =>
                            'Opening cash float.',

                            'created_by' =>
                            $actor->id,

                            'occurred_at' =>
                            now(),
                        ]);

                    /*
                    |--------------------------------------------------------------------------
                    | Audit
                    |--------------------------------------------------------------------------
                    */

                    $this->auditLogger->record(
                        action: 'CASHIER_SHIFT_OPENED',

                        entityType: 'cashier_shift',

                        entityId: $shift->id,

                        newValues: [
                            'shift_number' =>
                            $shift->shift_number,

                            'business_day_id' =>
                            $businessDay->id,

                            'cashier_id' =>
                            $actor->id,

                            'opening_cash' =>
                            $openingCash,

                            'expected_cash' =>
                            $openingCash,

                            'status' =>
                            CashierShift::STATUS_OPEN,
                        ],

                        metadata: [
                            'client_request_id' =>
                            $clientRequestId,
                        ],

                        userId: $actor->id
                    );

                    return [
                        ...$this->result(
                            shift: $shift
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
             * Concurrent retry.
             */
            $retry =
                CashierShift::query()
                ->where(
                    'open_request_id',
                    $clientRequestId
                )
                ->first();

            if ($retry) {
                $this->assertSameOpenRequest(
                    shift: $retry,

                    actor: $actor,

                    requestHash: $requestHash
                );

                return [
                    ...$this->result(
                        shift: $retry
                    ),

                    'created' =>
                    false,
                ];
            }

            /*
             * Unique open_shift_key protection.
             */
            $openShift =
                CashierShift::query()
                ->where(
                    'cashier_id',
                    $actor->id
                )
                ->where(
                    'status',
                    CashierShift::STATUS_OPEN
                )
                ->first();

            if ($openShift) {
                throw new CashierShiftOperationException(
                    message: 'You already have an open cashier shift.',

                    errorCode: 'CASHIER_SHIFT_ALREADY_OPEN',

                    status: 409
                );
            }

            throw $exception;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Manual Cash In
    |--------------------------------------------------------------------------
    */

    public function cashIn(
        User $actor,
        CashierShift $shift,
        array $data
    ): array {
        return $this->manualMovement(
            actor: $actor,

            shift: $shift,

            type: CashDrawerMovement::TYPE_CASH_IN,

            data: $data
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Manual Cash Out
    |--------------------------------------------------------------------------
    */

    public function cashOut(
        User $actor,
        CashierShift $shift,
        array $data
    ): array {
        return $this->manualMovement(
            actor: $actor,

            shift: $shift,

            type: CashDrawerMovement::TYPE_CASH_OUT,

            data: $data
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Close Shift
    |--------------------------------------------------------------------------
    */

    public function close(
        User $actor,
        CashierShift $shift,
        array $data
    ): array {
        $clientRequestId =
            (string)
            $data['client_request_id'];

        $actualCash =
            round(
                (float)
                $data['actual_cash'],
                2
            );

        $closingNotes =
            $this->nullableString(
                $data['closing_notes']
                    ??
                    null
            );

        $requestHash =
            $this->closeRequestHash(
                shiftId: $shift->id,

                actor: $actor,

                actualCash: $actualCash,

                closingNotes: $closingNotes
            );

        /*
        |--------------------------------------------------------------------------
        | Fast Retry
        |--------------------------------------------------------------------------
        */

        $existing =
            CashierShift::query()
            ->where(
                'close_request_id',
                $clientRequestId
            )
            ->first();

        if ($existing) {
            $this->assertSameCloseRequest(
                shift: $existing,

                requestedShiftId: $shift->id,

                actor: $actor,

                requestHash: $requestHash
            );

            return [
                ...$this->result(
                    shift: $existing
                ),

                'closed' =>
                false,
            ];
        }

        return DatabaseTransaction::run(
            function () use (
                $actor,
                $shift,
                $clientRequestId,
                $actualCash,
                $closingNotes,
                $requestHash
            ): array {
                /** @var CashierShift|null $locked */
                $locked =
                    CashierShift::query()
                    ->lockForUpdate()
                    ->find(
                        $shift->id
                    );

                if (! $locked) {
                    throw new CashierShiftOperationException(
                        message: 'The cashier shift could not be found.',

                        errorCode: 'CASHIER_SHIFT_NOT_FOUND',

                        status: 404
                    );
                }

                $this->assertOwnedBy(
                    actor: $actor,

                    shift: $locked
                );

                if (
                    $locked->status
                    ===
                    CashierShift::STATUS_CLOSED
                ) {
                    throw new CashierShiftOperationException(
                        message: 'This cashier shift is already closed.',

                        errorCode: 'CASHIER_SHIFT_ALREADY_CLOSED',

                        status: 409
                    );
                }

                $businessDay =
                    BusinessDay::query()
                    ->lockForUpdate()
                    ->find(
                        $locked
                            ->business_day_id
                    );

                if (
                    ! $businessDay
                    ||
                    $businessDay->status
                    !==
                    BusinessDay::STATUS_OPEN
                ) {
                    throw new CashierShiftOperationException(
                        message: 'The business day must remain open while closing a cashier shift.',

                        errorCode: 'SHIFT_BUSINESS_DAY_NOT_OPEN',

                        status: 409
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Ledger Integrity Check
                |--------------------------------------------------------------------------
                */

                $summary =
                    $this->cashSummary(
                        $locked
                    );

                $expectedCash =
                    round(
                        (float)
                        $locked->expected_cash,
                        2
                    );

                $calculatedExpected =
                    round(
                        (float)
                        $summary['calculated_expected_cash'],
                        2
                    );

                if (
                    abs(
                        $expectedCash
                            -
                            $calculatedExpected
                    )
                    >
                    0.01
                ) {
                    throw new CashierShiftOperationException(
                        message: 'Cash drawer ledger does not match the stored expected balance. Reconciliation is required before closing.',

                        errorCode: 'SHIFT_CASH_LEDGER_MISMATCH',

                        status: 409
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Actual vs Expected
                |--------------------------------------------------------------------------
                */

                $difference =
                    round(
                        $actualCash
                            -
                            $expectedCash,
                        2
                    );

                $locked->actual_cash =
                    $actualCash;

                $locked->cash_difference =
                    $difference;

                $locked->status =
                    CashierShift::STATUS_CLOSED;

                $locked->closed_at =
                    now();

                $locked->closed_by =
                    $actor->id;

                $locked->closing_notes =
                    $closingNotes;

                $locked->close_request_id =
                    $clientRequestId;

                $locked->close_request_hash =
                    $requestHash;

                /*
                 * Release database uniqueness guard.
                 */
                $locked->open_shift_key =
                    null;

                $locked->save();

                $this->auditLogger->record(
                    action: 'CASHIER_SHIFT_CLOSED',

                    entityType: 'cashier_shift',

                    entityId: $locked->id,

                    oldValues: [
                        'status' =>
                        CashierShift::STATUS_OPEN,

                        'expected_cash' =>
                        $expectedCash,
                    ],

                    newValues: [
                        'status' =>
                        CashierShift::STATUS_CLOSED,

                        'expected_cash' =>
                        $expectedCash,

                        'actual_cash' =>
                        $actualCash,

                        'cash_difference' =>
                        $difference,
                    ],

                    metadata: [
                        'client_request_id' =>
                        $clientRequestId,

                        'cash_summary' =>
                        $summary,
                    ],

                    userId: $actor->id
                );

                return [
                    ...$this->result(
                        shift: $locked
                    ),

                    'closed' =>
                    true,
                ];
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Movements
    |--------------------------------------------------------------------------
    */

    public function movements(
        CashierShift $shift
    ) {
        return CashDrawerMovement::query()
            ->where(
                'cashier_shift_id',
                $shift->id
            )
            ->orderBy(
                'occurred_at'
            )
            ->orderBy(
                'id'
            )
            ->get();
    }

    /*
    |--------------------------------------------------------------------------
    | Manual Drawer Movement
    |--------------------------------------------------------------------------
    */

    private function manualMovement(
        User $actor,
        CashierShift $shift,
        string $type,
        array $data
    ): array {
        $clientRequestId =
            (string)
            $data['client_request_id'];

        $amount =
            round(
                (float)
                $data['amount'],
                2
            );

        $reason =
            trim(
                (string)
                $data['reason']
            );

        /*
        |--------------------------------------------------------------------------
        | Fast Retry Check
        |--------------------------------------------------------------------------
        */

        $existing =
            CashDrawerMovement::query()
            ->where(
                'client_request_id',
                $clientRequestId
            )
            ->first();

        if ($existing) {
            $this->assertSameManualMovement(
                movement: $existing,

                actor: $actor,

                shiftId: $shift->id,

                type: $type,

                amount: $amount,

                reason: $reason
            );

            return [
                'movement' =>
                $existing,

                ...$this->result(
                    shift: CashierShift::query()
                        ->findOrFail(
                            $existing
                                ->cashier_shift_id
                        )
                ),

                'created' =>
                false,
            ];
        }

        try {
            return DatabaseTransaction::run(
                function () use (
                    $actor,
                    $shift,
                    $type,
                    $clientRequestId,
                    $amount,
                    $reason
                ): array {
                    /** @var CashierShift|null $locked */
                    $locked =
                        CashierShift::query()
                        ->lockForUpdate()
                        ->find(
                            $shift->id
                        );

                    if (! $locked) {
                        throw new CashierShiftOperationException(
                            message: 'The cashier shift could not be found.',

                            errorCode: 'CASHIER_SHIFT_NOT_FOUND',

                            status: 404
                        );
                    }

                    $this->assertShiftUsable(
                        actor: $actor,

                        shift: $locked
                    );

                    if ($amount <= 0) {
                        throw new CashierShiftOperationException(
                            message: 'Cash movement amount must be greater than zero.',

                            errorCode: 'INVALID_CASH_MOVEMENT_AMOUNT',

                            status: 422
                        );
                    }

                    /*
                     * Prevent expected drawer balance
                     * becoming negative.
                     */
                    if (
                        $type
                        ===
                        CashDrawerMovement::TYPE_CASH_OUT
                        &&
                        $amount
                        >
                        (float)
                        $locked->expected_cash
                        +
                        0.009
                    ) {
                        throw new CashierShiftOperationException(
                            message: 'Cash out amount cannot exceed the expected drawer balance.',

                            errorCode: 'CASH_OUT_EXCEEDS_EXPECTED_CASH',

                            status: 422
                        );
                    }

                    /** @var CashDrawerMovement $movement */
                    $movement =
                        CashDrawerMovement::query()
                        ->create([
                            'client_request_id' =>
                            $clientRequestId,

                            'cashier_shift_id' =>
                            $locked->id,

                            'movement_type' =>
                            $type,

                            'amount' =>
                            $amount,

                            'reference_type' =>
                            'manual',

                            'reference_id' =>
                            null,

                            'reason' =>
                            mb_substr(
                                $reason,
                                0,
                                255
                            ),

                            'created_by' =>
                            $actor->id,

                            'occurred_at' =>
                            now(),
                        ]);

                    $currentExpected =
                        (float)
                        $locked
                            ->expected_cash;

                    if (
                        $type
                        ===
                        CashDrawerMovement::TYPE_CASH_IN
                    ) {
                        $locked->expected_cash =
                            round(
                                $currentExpected
                                    +
                                    $amount,
                                2
                            );
                    } else {
                        $locked->expected_cash =
                            round(
                                $currentExpected
                                    -
                                    $amount,
                                2
                            );
                    }

                    $locked->save();

                    $this->auditLogger->record(
                        action: $type
                            ===
                            CashDrawerMovement::TYPE_CASH_IN
                            ? 'CASH_DRAWER_CASH_IN'
                            : 'CASH_DRAWER_CASH_OUT',

                        entityType: 'cash_drawer_movement',

                        entityId: $movement->id,

                        newValues: [
                            'cashier_shift_id' =>
                            $locked->id,

                            'movement_type' =>
                            $type,

                            'amount' =>
                            $amount,

                            'expected_cash_after' =>
                            (float)
                            $locked
                                ->expected_cash,

                            'reason' =>
                            $reason,
                        ],

                        metadata: [
                            'client_request_id' =>
                            $clientRequestId,
                        ],

                        userId: $actor->id
                    );

                    return [
                        'movement' =>
                        $movement,

                        ...$this->result(
                            shift: $locked
                        ),

                        'created' =>
                        true,
                    ];
                }
            );
        } catch (
            QueryException $exception
        ) {
            $existing =
                CashDrawerMovement::query()
                ->where(
                    'client_request_id',
                    $clientRequestId
                )
                ->first();

            if (! $existing) {
                throw $exception;
            }

            $this->assertSameManualMovement(
                movement: $existing,

                actor: $actor,

                shiftId: $shift->id,

                type: $type,

                amount: $amount,

                reason: $reason
            );

            return [
                'movement' =>
                $existing,

                ...$this->result(
                    shift: CashierShift::query()
                        ->findOrFail(
                            $existing
                                ->cashier_shift_id
                        )
                ),

                'created' =>
                false,
            ];
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Shift Validation
    |--------------------------------------------------------------------------
    */

    private function assertShiftUsable(
        User $actor,
        CashierShift $shift
    ): void {
        $this->assertOwnedBy(
            actor: $actor,

            shift: $shift
        );

        if (
            $shift->status
            !==
            CashierShift::STATUS_OPEN
        ) {
            throw new CashierShiftOperationException(
                message: 'The cashier shift is not open.',

                errorCode: 'CASHIER_SHIFT_NOT_OPEN',

                status: 409
            );
        }

        $businessDay =
            BusinessDay::query()
            ->find(
                $shift
                    ->business_day_id
            );

        if (
            ! $businessDay
            ||
            $businessDay->status
            !==
            BusinessDay::STATUS_OPEN
        ) {
            throw new CashierShiftOperationException(
                message: 'The cashier shift belongs to a business day that is not open.',

                errorCode: 'SHIFT_BUSINESS_DAY_NOT_OPEN',

                status: 409
            );
        }
    }

    private function assertOwnedBy(
        User $actor,
        CashierShift $shift
    ): void {
        if (
            (int)
            $shift->cashier_id
            !==
            (int)
            $actor->id
        ) {
            throw new CashierShiftOperationException(
                message: 'You cannot modify another cashier\'s shift.',

                errorCode: 'CASHIER_SHIFT_NOT_OWNED',

                status: 403
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Cash Summary
    |--------------------------------------------------------------------------
    */

    private function cashSummary(
        CashierShift $shift
    ): array {
        $totals =
            CashDrawerMovement::query()
            ->where(
                'cashier_shift_id',
                $shift->id
            )
            ->selectRaw(
                'movement_type, SUM(amount) AS total_amount'
            )
            ->groupBy(
                'movement_type'
            )
            ->pluck(
                'total_amount',
                'movement_type'
            );

        $openingCash =
            round(
                (float)
                $shift->opening_float,
                2
            );

        $cashSales =
            round(
                (float)
                (
                    $totals[CashDrawerMovement::TYPE_CASH_SALE]
                    ??
                    0
                ),
                2
            );

        $cashRefunds =
            round(
                (float)
                (
                    $totals[CashDrawerMovement::TYPE_CASH_REFUND]
                    ??
                    0
                ),
                2
            );

        $cashIn =
            round(
                (float)
                (
                    $totals[CashDrawerMovement::TYPE_CASH_IN]
                    ??
                    0
                ),
                2
            );

        $cashOut =
            round(
                (float)
                (
                    $totals[CashDrawerMovement::TYPE_CASH_OUT]
                    ??
                    0
                ),
                2
            );

        $calculatedExpected =
            round(
                $openingCash
                    +
                    $cashSales
                    -
                    $cashRefunds
                    +
                    $cashIn
                    -
                    $cashOut,
                2
            );

        return [
            'opening_cash' =>
            $openingCash,

            'cash_sales' =>
            $cashSales,

            'cash_refunds' =>
            $cashRefunds,

            'cash_in' =>
            $cashIn,

            'cash_out' =>
            $cashOut,

            'calculated_expected_cash' =>
            $calculatedExpected,

            'expected_cash' =>
            (float)
            $shift->expected_cash,

            'actual_cash' =>
            $shift->actual_cash !== null
                ? (float)
                $shift->actual_cash
                : null,

            'cash_difference' =>
            $shift->cash_difference !== null
                ? (float)
                $shift->cash_difference
                : null,
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Result
    |--------------------------------------------------------------------------
    */

    private function result(
        CashierShift $shift
    ): array {
        $shift =
            $shift->fresh();

        return [
            'shift' =>
            $shift,

            'summary' =>
            $this->cashSummary(
                $shift
            ),
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | Request Hashes
    |--------------------------------------------------------------------------
    */

    private function openRequestHash(
        User $actor,
        float $openingCash,
        ?string $openingNotes
    ): string {
        return hash(
            'sha256',
            json_encode(
                [
                    'cashier_id' =>
                    $actor->id,

                    'opening_cash' =>
                    number_format(
                        $openingCash,
                        2,
                        '.',
                        ''
                    ),

                    'opening_notes' =>
                    $openingNotes,
                ],
                JSON_THROW_ON_ERROR
            )
        );
    }

    private function closeRequestHash(
        int $shiftId,
        User $actor,
        float $actualCash,
        ?string $closingNotes
    ): string {
        return hash(
            'sha256',
            json_encode(
                [
                    'shift_id' =>
                    $shiftId,

                    'cashier_id' =>
                    $actor->id,

                    'actual_cash' =>
                    number_format(
                        $actualCash,
                        2,
                        '.',
                        ''
                    ),

                    'closing_notes' =>
                    $closingNotes,
                ],
                JSON_THROW_ON_ERROR
            )
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotency Assertions
    |--------------------------------------------------------------------------
    */

    private function assertSameOpenRequest(
        CashierShift $shift,
        User $actor,
        string $requestHash
    ): void {
        if (
            (int)
            $shift->cashier_id
            !==
            (int)
            $actor->id
            ||
            ! hash_equals(
                (string)
                $shift
                    ->open_request_hash,

                $requestHash
            )
        ) {
            throw new CashierShiftOperationException(
                message: 'This shift opening request ID has already been used with different data.',

                errorCode: 'SHIFT_OPEN_IDEMPOTENCY_KEY_REUSED',

                status: 409
            );
        }
    }

    private function assertSameCloseRequest(
        CashierShift $shift,
        int $requestedShiftId,
        User $actor,
        string $requestHash
    ): void {
        if (
            (int)
            $shift->id
            !==
            $requestedShiftId
            ||
            (int)
            $shift->cashier_id
            !==
            (int)
            $actor->id
            ||
            ! hash_equals(
                (string)
                $shift
                    ->close_request_hash,

                $requestHash
            )
        ) {
            throw new CashierShiftOperationException(
                message: 'This shift closing request ID has already been used with different data.',

                errorCode: 'SHIFT_CLOSE_IDEMPOTENCY_KEY_REUSED',

                status: 409
            );
        }
    }

    private function assertSameManualMovement(
        CashDrawerMovement $movement,
        User $actor,
        int $shiftId,
        string $type,
        float $amount,
        string $reason
    ): void {
        if (
            (int)
            $movement
                ->cashier_shift_id
            !==
            $shiftId
            ||
            (int)
            $movement
                ->created_by
            !==
            (int)
            $actor->id
            ||
            $movement
            ->movement_type
            !==
            $type
            ||
            abs(
                (float)
                $movement->amount
                    -
                    $amount
            )
            >
            0.009
            ||
            (string)
            $movement->reason
            !==
            mb_substr(
                $reason,
                0,
                255
            )
        ) {
            throw new CashierShiftOperationException(
                message: 'This cash movement request ID has already been used with different data.',

                errorCode: 'CASH_MOVEMENT_IDEMPOTENCY_KEY_REUSED',

                status: 409
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Shift Number
    |--------------------------------------------------------------------------
    */

    private function generateShiftNumber(): string
    {
        return sprintf(
            'CS-%s-%s',
            now()
                ->format(
                    'Ymd'
                ),
            Str::upper(
                (string)
                Str::ulid()
            )
        );
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
