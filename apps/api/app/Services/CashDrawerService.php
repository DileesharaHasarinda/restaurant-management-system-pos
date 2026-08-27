<?php

namespace App\Services;

use App\Exceptions\CashierShiftOperationException;
use App\Models\BusinessDay;
use App\Models\CashDrawerMovement;
use App\Models\CashierShift;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Database\QueryException;

final class CashDrawerService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function manualOpen(
        User $actor,
        CashierShift $shift,
        array $data
    ): array {
        $clientRequestId =
            (string)
            $data['client_request_id'];

        $reason =
            trim(
                (string)
                $data['reason']
            );

        /*
        |--------------------------------------------------------------------------
        | Fast Idempotency Check
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
            $this->assertSameRequest(
                movement: $existing,

                actor: $actor,

                shift: $shift,

                reason: $reason
            );

            return [
                'movement' =>
                $existing,

                'shift' =>
                $shift->fresh(),

                /*
                 * IMPORTANT:
                 *
                 * Retry must NOT physically
                 * open the drawer again.
                 */
                'created' =>
                false,
            ];
        }

        try {
            return DatabaseTransaction::run(
                function () use (
                    $actor,
                    $shift,
                    $clientRequestId,
                    $reason
                ): array {
                    $duplicate =
                        CashDrawerMovement::query()
                        ->where(
                            'client_request_id',
                            $clientRequestId
                        )
                        ->lockForUpdate()
                        ->first();

                    if ($duplicate) {
                        $this->assertSameRequest(
                            movement: $duplicate,

                            actor: $actor,

                            shift: $shift,

                            reason: $reason
                        );

                        return [
                            'movement' =>
                            $duplicate,

                            'shift' =>
                            $shift->fresh(),

                            'created' =>
                            false,
                        ];
                    }

                    /** @var CashierShift|null $lockedShift */
                    $lockedShift =
                        CashierShift::query()
                        ->lockForUpdate()
                        ->find(
                            $shift->id
                        );

                    if (! $lockedShift) {
                        throw new CashierShiftOperationException(
                            message: 'The cashier shift could not be found.',

                            errorCode: 'CASHIER_SHIFT_NOT_FOUND',

                            status: 404
                        );
                    }

                    if (
                        (int)
                        $lockedShift->cashier_id
                        !==
                        (int)
                        $actor->id
                    ) {
                        throw new CashierShiftOperationException(
                            message: 'You cannot manually open another cashier\'s drawer.',

                            errorCode: 'CASHIER_SHIFT_NOT_OWNED',

                            status: 403
                        );
                    }

                    if (
                        $lockedShift->status
                        !==
                        CashierShift::STATUS_OPEN
                    ) {
                        throw new CashierShiftOperationException(
                            message: 'A cash drawer can only be manually opened during an open cashier shift.',

                            errorCode: 'CASHIER_SHIFT_NOT_OPEN',

                            status: 409
                        );
                    }

                    $businessDay =
                        BusinessDay::query()
                        ->lockForUpdate()
                        ->find(
                            $lockedShift
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
                            message: 'The cashier shift business day is not open.',

                            errorCode: 'SHIFT_BUSINESS_DAY_NOT_OPEN',

                            status: 409
                        );
                    }

                    /** @var CashDrawerMovement $movement */
                    $movement =
                        CashDrawerMovement::query()
                        ->create([
                            'client_request_id' =>
                            $clientRequestId,

                            'cashier_shift_id' =>
                            $lockedShift->id,

                            'movement_type' =>
                            CashDrawerMovement::TYPE_MANUAL_OPEN,

                            /*
                                 * Manual opening changes
                                 * no financial balance.
                                 */
                            'amount' =>
                            0,

                            'reference_type' =>
                            'cashier_shift',

                            'reference_id' =>
                            $lockedShift->id,

                            'reason' =>
                            $reason,

                            'created_by' =>
                            $actor->id,

                            'occurred_at' =>
                            now(),
                        ]);

                    $this->auditLogger->record(
                        action: 'CASH_DRAWER_MANUAL_OPEN',

                        entityType: 'cash_drawer_movement',

                        entityId: $movement->id,

                        newValues: [
                            'cashier_shift_id' =>
                            $lockedShift->id,

                            'movement_type' =>
                            CashDrawerMovement::TYPE_MANUAL_OPEN,

                            'reason' =>
                            $reason,

                            'expected_cash' =>
                            (float)
                            $lockedShift->expected_cash,
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

                        'shift' =>
                        $lockedShift->fresh(),

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

            $this->assertSameRequest(
                movement: $existing,

                actor: $actor,

                shift: $shift,

                reason: $reason
            );

            return [
                'movement' =>
                $existing,

                'shift' =>
                $shift->fresh(),

                'created' =>
                false,
            ];
        }
    }

    private function assertSameRequest(
        CashDrawerMovement $movement,
        User $actor,
        CashierShift $shift,
        string $reason
    ): void {
        if (
            (int)
            $movement->cashier_shift_id
            !==
            (int)
            $shift->id
            ||
            (int)
            $movement->created_by
            !==
            (int)
            $actor->id
            ||
            $movement->movement_type
            !==
            CashDrawerMovement::TYPE_MANUAL_OPEN
            ||
            abs(
                (float)
                $movement->amount
            )
            >
            0.009
            ||
            (string)
            $movement->reason
            !==
            $reason
        ) {
            throw new CashierShiftOperationException(
                message: 'This manual drawer opening request ID has already been used with different data.',

                errorCode: 'CASH_DRAWER_IDEMPOTENCY_KEY_REUSED',

                status: 409
            );
        }
    }
}
