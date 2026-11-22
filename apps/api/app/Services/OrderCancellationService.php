<?php

namespace App\Services;

use App\Models\Order;
use App\Models\TableSession;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Support\Facades\DB;

final class OrderCancellationService
{
    public function __construct(
        private readonly OrderLifecycleService $lifecycle,
        private readonly ManagerAuthorizationService $managerAuthorization,
        private readonly TableSessionService $tableSessionService
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
                |
                | - marks order/items CANCELLED
                | - preserves sent_to_kitchen_at
                | - queues cancellation KOT only for sent items
                | - does NOT reverse inventory automatically
                |
                */

                $result =
                    $this
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

                /*
                |--------------------------------------------------------------------------
                | Release Dine-In Table When Session Is Now Empty
                |--------------------------------------------------------------------------
                |
                | Cancelling a dine-in order does not automatically mean that
                | the table can be released.
                |
                | A single table session may contain multiple orders.
                |
                | Therefore:
                |
                | - if another active order exists:
                |       keep table OCCUPIED
                |
                | - if an unpaid invoice exists:
                |       keep table OCCUPIED
                |
                | - if no active orders and no unpaid invoice exist:
                |       close table session
                |       TableSessionService changes table to AVAILABLE
                |
                | Takeaway orders have no table_session_id, so nothing happens.
                |--------------------------------------------------------------------------
                */

                $cancelledOrder =
                    $result['order'];

                if (
                    $cancelledOrder->table_session_id
                    !== null
                ) {
                    $this
                        ->releaseTableSessionIfIdle(
                            sessionId: (int)
                            $cancelledOrder
                                ->table_session_id,

                            actor: $authorizer,

                            cancelledOrder: $cancelledOrder
                        );
                }

                /*
                |--------------------------------------------------------------------------
                | Return Cancellation Result
                |--------------------------------------------------------------------------
                |
                | Keep the original lifecycle response shape unchanged so the
                | existing OrderController and desktop application continue
                | working without any API contract changes.
                |--------------------------------------------------------------------------
                */

                return $result;
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Release Table Session If Idle
    |--------------------------------------------------------------------------
    */

    private function releaseTableSessionIfIdle(
        int $sessionId,
        User $actor,
        Order $cancelledOrder
    ): void {
        /** @var TableSession|null $session */
        $session =
            TableSession::query()
            ->lockForUpdate()
            ->find(
                $sessionId
            );

        /*
         * Session may already have been closed by another valid operation.
         */
        if (
            ! $session
            ||
            $session->status
            !==
            TableSession::STATUS_OPEN
        ) {
            return;
        }

        /*
        |--------------------------------------------------------------------------
        | Check For Other Active Orders
        |--------------------------------------------------------------------------
        |
        | The order that was just cancelled is already CANCELLED, therefore it
        | is naturally excluded by this query.
        |
        | COMPLETED, CANCELLED and REJECTED orders do not keep a table occupied.
        |--------------------------------------------------------------------------
        */

        $hasActiveOrders =
            Order::query()
            ->where(
                'table_session_id',
                $session->id
            )
            ->whereNotIn(
                'status',
                [
                    Order::STATUS_COMPLETED,
                    Order::STATUS_CANCELLED,
                    Order::STATUS_REJECTED,
                ]
            )
            ->exists();

        if (
            $hasActiveOrders
        ) {
            return;
        }

        /*
        |--------------------------------------------------------------------------
        | Check For Unpaid Invoice
        |--------------------------------------------------------------------------
        |
        | Even when no active order remains, the table must not be released if
        | money is still due for this table session.
        |--------------------------------------------------------------------------
        */

        $hasUnpaidInvoice =
            DB::table(
                'invoices'
            )
            ->where(
                'table_session_id',
                $session->id
            )
            ->where(
                'status',
                '!=',
                'VOID'
            )
            ->where(
                'balance_due',
                '>',
                0
            )
            ->exists();

        if (
            $hasUnpaidInvoice
        ) {
            return;
        }

        /*
        |--------------------------------------------------------------------------
        | Close Session Through Authoritative Service
        |--------------------------------------------------------------------------
        |
        | Never change restaurant_tables.status directly here.
        |
        | TableSessionService::close() performs its own safety checks again,
        | closes the session, records the audit entry and changes the active
        | restaurant table from OCCUPIED to AVAILABLE.
        |--------------------------------------------------------------------------
        */

        $this
            ->tableSessionService
            ->close(
                session: $session,

                actor: $actor,

                reason: sprintf(
                    'Table session automatically closed after order %s was cancelled and no active orders remained.',
                    $cancelledOrder
                        ->order_number
                )
            );
    }
}
