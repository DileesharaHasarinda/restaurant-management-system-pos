<?php

namespace App\Services;

use App\Models\Order;
use App\Models\User;
use App\Support\DatabaseTransaction;

final class OrderCancellationService
{
    public function __construct(
        private readonly OrderLifecycleService $lifecycle,
        private readonly ManagerAuthorizationService $managerAuthorization
    ) {}

    public function cancel(
        Order $order,
        User $initiator,
        array $data
    ): array {
        return DatabaseTransaction::run(
            function () use (
                $order,
                $initiator,
                $data
            ): array {
                /** @var Order $locked */
                $locked =
                    Order::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $order->id
                    );

                $reason =
                    trim(
                        (string)
                        $data['reason']
                    );

                /*
                |--------------------------------------------------------------------------
                | Manager Approval Only After Kitchen
                |--------------------------------------------------------------------------
                */

                $afterKitchen =
                    in_array(
                        $locked->status,
                        [
                            Order::STATUS_SENT_TO_KITCHEN,
                            Order::STATUS_SERVED,
                        ],
                        true
                    );

                $authorizer =
                    $initiator;

                if (
                    $afterKitchen
                ) {
                    $authorizer =
                        $this
                        ->managerAuthorization
                        ->authorize(
                            initiator: $initiator,

                            permission: 'orders.cancel_after_kitchen',

                            login: $data['manager_login']
                                ?? null,

                            password: $data['manager_password']
                                ?? null,

                            action: 'ORDER_CANCEL_AFTER_KITCHEN',

                            entityType: 'order',

                            entityId: $locked->id
                        );
                }

                /*
                |--------------------------------------------------------------------------
                | Existing Lifecycle Remains Authoritative
                |--------------------------------------------------------------------------
                |
                | It already:
                | - marks order/items CANCELLED
                | - preserves sent_to_kitchen_at
                | - queues cancellation KOT only for sent items
                | - does NOT reverse inventory automatically
                |
                */

                return $this
                    ->lifecycle
                    ->cancel(
                        order: $locked,

                        actor: $authorizer,

                        reason: $reason,

                        auditMetadata: [
                            'initiated_by' =>
                            $initiator->id,

                            'authorized_by' =>
                            $authorizer->id,

                            'manager_authorization_required' =>
                            $afterKitchen,

                            'inventory_reversed' =>
                            false,

                            'financial_refund_created' =>
                            false,
                        ]
                    );
            }
        );
    }
}
