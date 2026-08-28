<?php

namespace App\Services;

use App\Exceptions\StockReversalOperationException;
use App\Models\BusinessDay;
use App\Models\StockMovement;
use App\Models\User;
use App\Support\DatabaseTransaction;

final class StockCancellationReversalService
{
    public function __construct(
        private readonly InventoryStockService $inventoryStockService,
        private readonly ManagerAuthorizationService $managerAuthorization,
        private readonly AuditLogger $auditLogger
    ) {}

    public function reverse(
        StockMovement $movement,
        User $initiator,
        array $data
    ): array {
        return DatabaseTransaction::run(
            function () use (
                $movement,
                $initiator,
                $data
            ): array {
                /** @var StockMovement $original */
                $original =
                    StockMovement::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $movement->id
                    );

                if (
                    $original->movement_type
                    !==
                    StockMovement::TYPE_SALE_CONSUMPTION
                ) {
                    throw new StockReversalOperationException(
                        message: 'Only a sale-consumption stock movement can be reversed through this correction.',

                        errorCode: 'INVALID_CANCELLATION_REVERSAL_SOURCE',

                        status: 422
                    );
                }

                /** @var BusinessDay|null $businessDay */
                $businessDay =
                    BusinessDay::query()
                    ->lockForUpdate()
                    ->find(
                        $original->business_day_id
                    );

                if (
                    ! $businessDay
                    ||
                    $businessDay->status
                    !==
                    BusinessDay::STATUS_OPEN
                ) {
                    throw new StockReversalOperationException(
                        message: 'Stock from a closed business day cannot be corrected.',

                        errorCode: 'STOCK_REVERSAL_BUSINESS_DAY_CLOSED',

                        status: 409
                    );
                }

                $clientRequestId =
                    trim(
                        (string)
                        $data['client_request_id']
                    );

                $quantity =
                    round(
                        (float)
                        $data['quantity'],
                        6
                    );

                $reason =
                    trim(
                        (string)
                        $data['reason']
                    );

                $movementKey =
                    "phase33-cancellation-reversal:{$clientRequestId}";

                /*
                |--------------------------------------------------------------------------
                | Idempotency
                |--------------------------------------------------------------------------
                */

                $existing =
                    StockMovement::query()
                    ->where(
                        'movement_key',
                        $movementKey
                    )
                    ->first();

                if (
                    $existing
                ) {
                    if (
                        $existing->movement_type
                        !==
                        StockMovement::TYPE_CANCELLATION_REVERSAL
                        ||
                        (int)
                        $existing->source_id
                        !==
                        (int)
                        $original->id
                        ||
                        abs(
                            (float)
                            $existing->quantity_delta
                                -
                                $quantity
                        )
                        >
                        0.000001
                    ) {
                        throw new StockReversalOperationException(
                            message: 'This stock correction request ID was reused with different data.',

                            errorCode: 'STOCK_REVERSAL_IDEMPOTENCY_KEY_REUSED',

                            status: 409
                        );
                    }

                    return [
                        'movement' =>
                        $existing,

                        'created' =>
                        false,
                    ];
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

                        permission: 'inventory.cancellation_reversal',

                        login: $data['manager_login']
                            ?? null,

                        password: $data['manager_password']
                            ?? null,

                        action: 'CANCELLATION_STOCK_REVERSAL',

                        entityType: 'stock_movement',

                        entityId: $original->id
                    );

                /*
                |--------------------------------------------------------------------------
                | Maximum Reversible Quantity
                |--------------------------------------------------------------------------
                */

                $consumed =
                    abs(
                        (float)
                        $original->quantity_delta
                    );

                $alreadyReversed =
                    round(
                        (float)
                        StockMovement::query()
                            ->where(
                                'movement_type',
                                StockMovement::TYPE_CANCELLATION_REVERSAL
                            )
                            ->where(
                                'source_type',
                                'stock_movement'
                            )
                            ->where(
                                'source_id',
                                $original->id
                            )
                            ->sum(
                                'quantity_delta'
                            ),

                        6
                    );

                $remaining =
                    round(
                        $consumed
                            -
                            $alreadyReversed,

                        6
                    );

                if (
                    $quantity <= 0
                    ||
                    $quantity
                    >
                    $remaining
                    +
                    0.000001
                ) {
                    throw new StockReversalOperationException(
                        message: 'Stock reversal exceeds the remaining reversible quantity.',

                        errorCode: 'STOCK_REVERSAL_EXCEEDS_CONSUMPTION',

                        status: 422,

                        errors: [
                            'quantity' => [
                                "Maximum reversible quantity is {$remaining}.",
                            ],
                        ]
                    );
                }

                $ingredient =
                    $original
                    ->ingredient()
                    ->lockForUpdate()
                    ->firstOrFail();

                $reversal =
                    $this
                    ->inventoryStockService
                    ->cancellationReversal(
                        actor: $authorizer,

                        ingredient: $ingredient,

                        quantity: $quantity,

                        unitCost: (float)
                        $original->unit_cost,

                        movementKey: $movementKey,

                        sourceType: 'stock_movement',

                        sourceId: $original->id,

                        reference: $original->reference,

                        notes: $reason,

                        businessDayId: $original->business_day_id
                    );

                $this->auditLogger->record(
                    action: 'CANCELLATION_STOCK_REVERSAL',

                    entityType: 'stock_movement',

                    entityId: $reversal->id,

                    newValues: [
                        'original_stock_movement_id' =>
                        $original->id,

                        'ingredient_id' =>
                        $original->ingredient_id,

                        'quantity' =>
                        $quantity,

                        'unit_cost' =>
                        (float)
                        $original->unit_cost,
                    ],

                    metadata: [
                        'initiated_by' =>
                        $initiator->id,

                        'authorized_by' =>
                        $authorizer->id,

                        'reason' =>
                        $reason,

                        'financial_refund' =>
                        false,
                    ],

                    userId: $authorizer->id
                );

                return [
                    'movement' =>
                    $reversal,

                    'created' =>
                    true,
                ];
            }
        );
    }
}
