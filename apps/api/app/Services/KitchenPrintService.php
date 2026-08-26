<?php

namespace App\Services;

use App\Exceptions\KitchenPrintException;
use App\Models\KitchenPrintJob;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

final class KitchenPrintService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Queue Kitchen Order
    |--------------------------------------------------------------------------
    |
    | Called only after sendToKitchen() has identified the exact order items
    | that were newly sent to the kitchen.
    |
    | If older sent items already exist, this becomes ADDITIONAL_ORDER.
    | Otherwise it becomes INITIAL_ORDER.
    |
    */

    public function queueKitchenOrder(
        Order $order,
        array $itemIds,
        User $actor
    ): ?KitchenPrintJob {
        $itemIds =
            $this->normaliseItemIds(
                $itemIds
            );

        if ($itemIds === []) {
            return null;
        }

        $hasPreviouslySentItems =
            OrderItem::query()
            ->where(
                'order_id',
                $order->id
            )
            ->where(
                'status',
                OrderItem::STATUS_ACTIVE
            )
            ->whereNotNull(
                'sent_to_kitchen_at'
            )
            ->whereNotIn(
                'id',
                $itemIds
            )
            ->exists();

        $jobType =
            $hasPreviouslySentItems
            ? KitchenPrintJob::TYPE_ADDITIONAL_ORDER
            : KitchenPrintJob::TYPE_INITIAL_ORDER;

        return $this->createOrderJob(
            order: $order,
            itemIds: $itemIds,
            jobType: $jobType,
            actor: $actor
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Queue Cancellation
    |--------------------------------------------------------------------------
    |
    | Only items that have ALREADY reached the kitchen are supplied here.
    |
    | Cancelling an item/order before it reaches the kitchen must not create
    | a cancellation KOT.
    |
    */

    public function queueCancellation(
        Order $order,
        array $itemIds,
        User $actor,
        string $reason
    ): ?KitchenPrintJob {
        $itemIds =
            $this->normaliseItemIds(
                $itemIds
            );

        if ($itemIds === []) {
            return null;
        }

        return $this->createOrderJob(
            order: $order,
            itemIds: $itemIds,
            jobType: KitchenPrintJob::TYPE_CANCELLATION,
            actor: $actor,
            extraPayload: [
                'cancellation_reason' =>
                $reason,
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Claim Next Pending Job
    |--------------------------------------------------------------------------
    |
    | Electron calls this endpoint.
    |
    | The database lock prevents two cashier devices from claiming the same
    | KOT simultaneously.
    |
    */

    public function claimNext(
        User $actor,
        ?string $printerName = null,
        ?string $printerAddress = null
    ): ?KitchenPrintJob {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $printerName,
                $printerAddress
            ): ?KitchenPrintJob {

                /*
                 * If Electron crashed after claiming a job, do not silently
                 * auto-print it again.
                 *
                 * Raw TCP printers cannot provide true exactly-once delivery.
                 * Automatically retrying a stale PROCESSING job could produce
                 * a duplicate KOT if the printer actually received it before
                 * Electron crashed.
                 *
                 * Therefore stale jobs become FAILED and require manual retry.
                 */
                KitchenPrintJob::query()
                    ->where(
                        'status',
                        KitchenPrintJob::STATUS_PROCESSING
                    )
                    ->where(
                        'updated_at',
                        '<=',
                        now()->subMinutes(2)
                    )
                    ->update([
                        'status' =>
                        KitchenPrintJob::STATUS_FAILED,

                        'last_error' =>
                        'Print worker stopped before acknowledging the result. Manual retry is required to prevent an accidental duplicate print.',

                        'updated_at' =>
                        now(),
                    ]);

                /** @var KitchenPrintJob|null $job */
                $job =
                    KitchenPrintJob::query()
                    ->where(
                        'status',
                        KitchenPrintJob::STATUS_PENDING
                    )
                    ->orderBy(
                        'queued_at'
                    )
                    ->orderBy(
                        'id'
                    )
                    ->lockForUpdate()
                    ->first();

                if (! $job) {
                    return null;
                }

                $job->status =
                    KitchenPrintJob::STATUS_PROCESSING;

                $job->attempts =
                    ((int) $job->attempts)
                    + 1;

                $job->printer_name =
                    $printerName;

                $job->printer_address =
                    $printerAddress;

                $job->last_error =
                    null;

                $job->save();

                $this->auditLogger
                    ->record(
                        action: 'KITCHEN_PRINT_JOB_CLAIMED',

                        entityType: 'kitchen_print_job',

                        entityId: $job->id,

                        oldValues: [
                            'status' =>
                            KitchenPrintJob::STATUS_PENDING,
                        ],

                        newValues: [
                            'status' =>
                            KitchenPrintJob::STATUS_PROCESSING,

                            'attempts' =>
                            $job->attempts,
                        ],

                        metadata: [
                            'job_number' =>
                            $job->job_number,

                            'printer_name' =>
                            $printerName,

                            'printer_address' =>
                            $printerAddress,
                        ],

                        userId: $actor->id
                    );

                return $job->fresh();
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Mark Printed
    |--------------------------------------------------------------------------
    */

    public function markPrinted(
        KitchenPrintJob $job,
        User $actor
    ): KitchenPrintJob {
        return DatabaseTransaction::run(
            function () use (
                $job,
                $actor
            ): KitchenPrintJob {

                /** @var KitchenPrintJob $locked */
                $locked =
                    KitchenPrintJob::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $job->id
                    );

                if (
                    $locked->status
                    === KitchenPrintJob::STATUS_PRINTED
                ) {
                    return $locked;
                }

                if (
                    $locked->status
                    !== KitchenPrintJob::STATUS_PROCESSING
                ) {
                    throw new KitchenPrintException(
                        message: 'Only a processing kitchen print job can be marked as printed.',

                        errorCode: 'KITCHEN_PRINT_JOB_NOT_PROCESSING'
                    );
                }

                $from =
                    $locked->status;

                $locked->status =
                    KitchenPrintJob::STATUS_PRINTED;

                $locked->printed_at =
                    now();

                $locked->last_error =
                    null;

                $locked->save();

                $this->auditLogger
                    ->record(
                        action: 'KITCHEN_PRINT_JOB_PRINTED',

                        entityType: 'kitchen_print_job',

                        entityId: $locked->id,

                        oldValues: [
                            'status' =>
                            $from,
                        ],

                        newValues: [
                            'status' =>
                            KitchenPrintJob::STATUS_PRINTED,

                            'printed_at' =>
                            $locked
                                ->printed_at
                                ?->toISOString(),
                        ],

                        metadata: [
                            'job_number' =>
                            $locked->job_number,

                            'order_id' =>
                            $locked->order_id,

                            'printer_name' =>
                            $locked->printer_name,

                            'printer_address' =>
                            $locked->printer_address,
                        ],

                        userId: $actor->id
                    );

                return $locked->fresh();
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Mark Failed
    |--------------------------------------------------------------------------
    */

    public function markFailed(
        KitchenPrintJob $job,
        User $actor,
        string $error
    ): KitchenPrintJob {
        return DatabaseTransaction::run(
            function () use (
                $job,
                $actor,
                $error
            ): KitchenPrintJob {

                /** @var KitchenPrintJob $locked */
                $locked =
                    KitchenPrintJob::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $job->id
                    );

                if (
                    $locked->status
                    === KitchenPrintJob::STATUS_PRINTED
                ) {
                    throw new KitchenPrintException(
                        message: 'A printed kitchen job cannot be marked as failed.',

                        errorCode: 'KITCHEN_PRINT_JOB_ALREADY_PRINTED'
                    );
                }

                if (
                    $locked->status
                    !== KitchenPrintJob::STATUS_PROCESSING
                ) {
                    throw new KitchenPrintException(
                        message: 'Only a processing kitchen print job can be marked as failed.',

                        errorCode: 'KITCHEN_PRINT_JOB_NOT_PROCESSING'
                    );
                }

                $from =
                    $locked->status;

                $locked->status =
                    KitchenPrintJob::STATUS_FAILED;

                $locked->last_error =
                    mb_substr(
                        trim($error),
                        0,
                        2000
                    );

                $locked->printed_at =
                    null;

                $locked->save();

                $this->auditLogger
                    ->record(
                        action: 'KITCHEN_PRINT_JOB_FAILED',

                        entityType: 'kitchen_print_job',

                        entityId: $locked->id,

                        oldValues: [
                            'status' =>
                            $from,
                        ],

                        newValues: [
                            'status' =>
                            KitchenPrintJob::STATUS_FAILED,

                            'last_error' =>
                            $locked->last_error,
                        ],

                        metadata: [
                            'job_number' =>
                            $locked->job_number,

                            'order_id' =>
                            $locked->order_id,

                            'printer_name' =>
                            $locked->printer_name,

                            'printer_address' =>
                            $locked->printer_address,
                        ],

                        userId: $actor->id
                    );

                return $locked->fresh();
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Retry
    |--------------------------------------------------------------------------
    |
    | Retry uses the SAME job.
    |
    | This preserves attempts and failure history on the logical KOT instead
    | of creating another logical kitchen order.
    |
    */

    public function retry(
        KitchenPrintJob $job,
        User $actor
    ): KitchenPrintJob {
        return DatabaseTransaction::run(
            function () use (
                $job,
                $actor
            ): KitchenPrintJob {

                /** @var KitchenPrintJob $locked */
                $locked =
                    KitchenPrintJob::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $job->id
                    );

                if (
                    $locked->status
                    !== KitchenPrintJob::STATUS_FAILED
                ) {
                    throw new KitchenPrintException(
                        message: 'Only a failed kitchen print job can be retried.',

                        errorCode: 'KITCHEN_PRINT_JOB_NOT_FAILED'
                    );
                }

                $locked->status =
                    KitchenPrintJob::STATUS_PENDING;

                $locked->queued_at =
                    now();

                $locked->last_error =
                    null;

                $locked->printed_at =
                    null;

                $locked->save();

                $this->auditLogger
                    ->record(
                        action: 'KITCHEN_PRINT_JOB_RETRY_REQUESTED',

                        entityType: 'kitchen_print_job',

                        entityId: $locked->id,

                        oldValues: [
                            'status' =>
                            KitchenPrintJob::STATUS_FAILED,
                        ],

                        newValues: [
                            'status' =>
                            KitchenPrintJob::STATUS_PENDING,
                        ],

                        metadata: [
                            'job_number' =>
                            $locked->job_number,

                            'attempts' =>
                            $locked->attempts,
                        ],

                        userId: $actor->id
                    );

                return $locked->fresh();
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Reprint
    |--------------------------------------------------------------------------
    |
    | A REPRINT is deliberately different from a RETRY.
    |
    | RETRY:
    |   the original print failed.
    |
    | REPRINT:
    |   the original job was successfully printed and staff explicitly asks
    |   for another physical copy.
    |
    */

    public function reprint(
        KitchenPrintJob $source,
        User $actor
    ): KitchenPrintJob {
        return DatabaseTransaction::run(
            function () use (
                $source,
                $actor
            ): KitchenPrintJob {

                /** @var KitchenPrintJob $locked */
                $locked =
                    KitchenPrintJob::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $source->id
                    );

                if (
                    $locked->status
                    !== KitchenPrintJob::STATUS_PRINTED
                ) {
                    throw new KitchenPrintException(
                        message: 'Only a successfully printed kitchen job can be reprinted. Use Retry for a failed job.',

                        errorCode: 'KITCHEN_PRINT_JOB_NOT_PRINTED'
                    );
                }

                $payload =
                    $locked->payload
                    ?? [];

                $payload['reprint'] =
                    true;

                $payload['reprint_of_job_id'] =
                    $locked->id;

                $payload['reprint_of_job_number'] =
                    $locked->job_number;

                $payload['reprint_requested_at'] =
                    now()->toISOString();

                $job =
                    KitchenPrintJob::query()
                    ->create([
                        'job_number' =>
                        $this->generateJobNumber(),

                        /*
                             * An explicit user-requested reprint is allowed to
                             * create a new job every time.
                             */
                        'idempotency_key' =>
                        hash(
                            'sha256',
                            implode(
                                '|',
                                [
                                    'REPRINT',
                                    $locked->id,
                                    $actor->id,
                                    (string) Str::uuid(),
                                ]
                            )
                        ),

                        'order_id' =>
                        $locked->order_id,

                        'job_type' =>
                        KitchenPrintJob::TYPE_REPRINT,

                        'printer_name' =>
                        null,

                        'printer_address' =>
                        null,

                        'payload' =>
                        $payload,

                        'status' =>
                        KitchenPrintJob::STATUS_PENDING,

                        'attempts' =>
                        0,

                        'last_error' =>
                        null,

                        'requested_by' =>
                        $actor->id,

                        'queued_at' =>
                        now(),

                        'printed_at' =>
                        null,
                    ]);

                $this->auditLogger
                    ->record(
                        action: 'KITCHEN_PRINT_JOB_REPRINT_REQUESTED',

                        entityType: 'kitchen_print_job',

                        entityId: $job->id,

                        oldValues: [],

                        newValues: [
                            'status' =>
                            KitchenPrintJob::STATUS_PENDING,

                            'job_type' =>
                            KitchenPrintJob::TYPE_REPRINT,
                        ],

                        metadata: [
                            'job_number' =>
                            $job->job_number,

                            'source_job_id' =>
                            $locked->id,

                            'source_job_number' =>
                            $locked->job_number,
                        ],

                        userId: $actor->id
                    );

                return $job;
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Create Order Job
    |--------------------------------------------------------------------------
    */

    private function createOrderJob(
        Order $order,
        array $itemIds,
        string $jobType,
        User $actor,
        array $extraPayload = []
    ): KitchenPrintJob {
        $itemIds =
            $this->normaliseItemIds(
                $itemIds
            );

        if ($itemIds === []) {
            throw new KitchenPrintException(
                message: 'A kitchen print job requires at least one order item.',

                errorCode: 'KITCHEN_PRINT_JOB_HAS_NO_ITEMS'
            );
        }

        $idempotencyKey =
            $this->buildIdempotencyKey(
                orderId: $order->id,
                jobType: $jobType,
                itemIds: $itemIds
            );

        /** @var KitchenPrintJob|null $existing */
        $existing =
            KitchenPrintJob::query()
            ->where(
                'idempotency_key',
                $idempotencyKey
            )
            ->first();

        if ($existing) {
            return $existing;
        }

        $payload =
            array_merge(
                $this->buildPayload(
                    order: $order,
                    itemIds: $itemIds,
                    jobType: $jobType
                ),
                $extraPayload
            );

        $job =
            KitchenPrintJob::query()
            ->create([
                'job_number' =>
                $this->generateJobNumber(),

                'idempotency_key' =>
                $idempotencyKey,

                'order_id' =>
                $order->id,

                'job_type' =>
                $jobType,

                'printer_name' =>
                null,

                'printer_address' =>
                null,

                'payload' =>
                $payload,

                'status' =>
                KitchenPrintJob::STATUS_PENDING,

                'attempts' =>
                0,

                'last_error' =>
                null,

                'requested_by' =>
                $actor->id,

                'queued_at' =>
                now(),

                'printed_at' =>
                null,
            ]);

        $this->auditLogger
            ->record(
                action: 'KITCHEN_PRINT_JOB_QUEUED',

                entityType: 'kitchen_print_job',

                entityId: $job->id,

                oldValues: [],

                newValues: [
                    'job_type' =>
                    $jobType,

                    'status' =>
                    KitchenPrintJob::STATUS_PENDING,
                ],

                metadata: [
                    'job_number' =>
                    $job->job_number,

                    'order_id' =>
                    $order->id,

                    'order_number' =>
                    $order->order_number,

                    'item_ids' =>
                    $itemIds,
                ],

                userId: $actor->id
            );

        return $job;
    }

    /*
    |--------------------------------------------------------------------------
    | Payload Snapshot
    |--------------------------------------------------------------------------
    |
    | A KOT must remain historically correct even if menu names, variants or
    | add-ons are changed later.
    |
    | Therefore only snapshot fields from the order are placed in the job.
    |
    */

    private function buildPayload(
        Order $order,
        array $itemIds,
        string $jobType
    ): array {
        $order =
            $order
            ->fresh();

        if (! $order) {
            throw new KitchenPrintException(
                message: 'The order could not be loaded for kitchen printing.',

                errorCode: 'KITCHEN_PRINT_ORDER_NOT_FOUND',
                status: 404
            );
        }

        /** @var Collection<int, OrderItem> $items */
        $items =
            OrderItem::query()
            ->with([
                'addons' =>
                fn($query) =>
                $query->orderBy(
                    'id'
                ),
            ])
            ->where(
                'order_id',
                $order->id
            )
            ->whereIn(
                'id',
                $itemIds
            )
            ->orderBy(
                'id'
            )
            ->get();

        if (
            $items->count()
            !== count($itemIds)
        ) {
            throw new KitchenPrintException(
                message: 'One or more kitchen print items no longer belong to this order.',

                errorCode: 'KITCHEN_PRINT_ITEM_MISMATCH'
            );
        }

        return [
            'version' =>
            1,

            /*
             * document_type remains the original type even when a later
             * REPRINT job copies this payload.
             */
            'document_type' =>
            $jobType,

            'heading' =>
            $this->headingFor(
                $jobType
            ),

            'order_id' =>
            $order->id,

            'order_number' =>
            $order->order_number,

            'order_type' =>
            $order->order_type,

            'order_source' =>
            $order->order_source,

            'table_id' =>
            $order->table_id,

            'table' =>
            $order->table_name_snapshot
                ?? (
                    $order->isTakeaway()
                    ? 'TAKEAWAY'
                    : null
                ),

            /*
             * Human-friendly kitchen token.
             *
             * Takeaway token is preferred. For dine-in orders we derive the
             * visible three-digit token from the trailing order number.
             */
            'token' =>
            $this->resolveToken(
                $order
            ),

            'session_sequence' =>
            $order->session_sequence,

            'printed_for_time' =>
            now()->toISOString(),

            'items' =>
            $items
                ->map(
                    fn(OrderItem $item): array => [
                        'id' =>
                        $item->id,

                        'name' =>
                        $item
                            ->item_name_snapshot,

                        'variant' =>
                        $item
                            ->variant_name_snapshot,

                        'quantity' =>
                        (float)
                        $item->quantity,

                        'notes' =>
                        $item->special_notes,

                        'addons' =>
                        $item
                            ->addons
                            ->map(
                                fn($addon): array => [
                                    'id' =>
                                    $addon->id,

                                    'name' =>
                                    $addon
                                        ->addon_name_snapshot,

                                    'quantity' =>
                                    (float)
                                    $addon->quantity,
                                ]
                            )
                            ->values()
                            ->all(),
                    ]
                )
                ->values()
                ->all(),
        ];
    }

    private function headingFor(
        string $jobType
    ): string {
        return match ($jobType) {
            KitchenPrintJob::TYPE_INITIAL_ORDER =>
            'KITCHEN ORDER',

            KitchenPrintJob::TYPE_ADDITIONAL_ORDER =>
            '*** ADDITIONAL ORDER ***',

            KitchenPrintJob::TYPE_CANCELLATION =>
            '*** CANCEL ITEM ***',

            default =>
            'KITCHEN ORDER',
        };
    }

    private function resolveToken(
        Order $order
    ): string {
        $source =
            $order->takeaway_token
            ?: $order->order_number;

        if (
            is_string($source)
            &&
            preg_match(
                '/(\d+)$/',
                $source,
                $matches
            )
        ) {
            $digits =
                $matches[1];

            return str_pad(
                substr(
                    $digits,
                    -3
                ),
                3,
                '0',
                STR_PAD_LEFT
            );
        }

        return str_pad(
            (string) $order->id,
            3,
            '0',
            STR_PAD_LEFT
        );
    }

    private function buildIdempotencyKey(
        int $orderId,
        string $jobType,
        array $itemIds
    ): string {
        sort(
            $itemIds,
            SORT_NUMERIC
        );

        return hash(
            'sha256',
            implode(
                '|',
                [
                    'KITCHEN_KOT',
                    $jobType,
                    $orderId,
                    implode(
                        ',',
                        $itemIds
                    ),
                ]
            )
        );
    }

    private function normaliseItemIds(
        array $itemIds
    ): array {
        $itemIds =
            array_map(
                static fn($id): int =>
                (int) $id,
                $itemIds
            );

        $itemIds =
            array_filter(
                $itemIds,
                static fn(int $id): bool =>
                $id > 0
            );

        $itemIds =
            array_values(
                array_unique(
                    $itemIds
                )
            );

        sort(
            $itemIds,
            SORT_NUMERIC
        );

        return $itemIds;
    }

    private function generateJobNumber(): string
    {
        do {
            $number =
                'KOT-'
                . now()->format(
                    'Ymd-His'
                )
                . '-'
                . strtoupper(
                    Str::random(4)
                );
        } while (
            KitchenPrintJob::query()
            ->where(
                'job_number',
                $number
            )
            ->exists()
        );

        return $number;
    }
}
