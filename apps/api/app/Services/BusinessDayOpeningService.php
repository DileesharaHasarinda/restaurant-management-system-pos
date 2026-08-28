<?php

namespace App\Services;

use App\Exceptions\BusinessDayOpeningException;
use App\Models\BusinessDay;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;

final class BusinessDayOpeningService
{
    private const OPENING_LOCK =
    'restaurant:business-day:opening';

    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Open Restaurant Business Day
    |--------------------------------------------------------------------------
    |
    | Rules:
    |
    | - only one OPEN restaurant business day may exist
    | - business date is controlled by Laravel
    | - frontend cannot select an arbitrary business date
    | - reopening a CLOSED day is not allowed
    | - repeated calls while a day is already OPEN are idempotent
    |--------------------------------------------------------------------------
    */

    public function open(
        User $actor,
        array $data
    ): array {
        $notes =
            $this->nullableString(
                $data['notes']
                    ??
                    null
            );

        try {
            return Cache::lock(
                self::OPENING_LOCK,
                10
            )
                ->block(
                    5,
                    function () use (
                        $actor,
                        $notes
                    ): array {
                        return DatabaseTransaction::run(
                            function () use (
                                $actor,
                                $notes
                            ): array {
                                /*
                                |--------------------------------------------------------------------------
                                | Existing Open Business Day
                                |--------------------------------------------------------------------------
                                */

                                /** @var BusinessDay|null $existingOpen */
                                $existingOpen =
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

                                if (
                                    $existingOpen
                                ) {
                                    $existingOpen
                                        ->load([
                                            'openedBy',
                                            'closedBy',
                                        ]);

                                    return [
                                        'business_day' =>
                                        $existingOpen,

                                        'created' =>
                                        false,
                                    ];
                                }

                                /*
                                |--------------------------------------------------------------------------
                                | Server-Controlled Business Date
                                |--------------------------------------------------------------------------
                                */

                                $businessDate =
                                    now()
                                    ->toDateString();

                                /*
                                |--------------------------------------------------------------------------
                                | Prevent Reopening Today's Closed Day
                                |--------------------------------------------------------------------------
                                |
                                | Once the restaurant business day for this calendar date
                                | has been closed it remains historical and immutable.
                                |--------------------------------------------------------------------------
                                */

                                /** @var BusinessDay|null $today */
                                $today =
                                    BusinessDay::query()
                                    ->whereDate(
                                        'business_date',
                                        $businessDate
                                    )
                                    ->orderByDesc(
                                        'id'
                                    )
                                    ->lockForUpdate()
                                    ->first();

                                if (
                                    $today
                                    &&
                                    $today->status
                                    ===
                                    BusinessDay::STATUS_CLOSED
                                ) {
                                    throw new BusinessDayOpeningException(
                                        message: 'Today\'s restaurant business day has already been closed and cannot be reopened.',

                                        errorCode: 'BUSINESS_DAY_ALREADY_CLOSED_FOR_DATE',

                                        status: 409
                                    );
                                }

                                if (
                                    $today
                                    &&
                                    $today->status
                                    ===
                                    BusinessDay::STATUS_OPEN
                                ) {
                                    $today
                                        ->load([
                                            'openedBy',
                                            'closedBy',
                                        ]);

                                    return [
                                        'business_day' =>
                                        $today,

                                        'created' =>
                                        false,
                                    ];
                                }

                                /*
                                |--------------------------------------------------------------------------
                                | Create Business Day
                                |--------------------------------------------------------------------------
                                */

                                /** @var BusinessDay $businessDay */
                                $businessDay =
                                    BusinessDay::query()
                                    ->create([
                                        'business_date' =>
                                        $businessDate,

                                        'status' =>
                                        BusinessDay::STATUS_OPEN,

                                        'opened_by' =>
                                        $actor->id,

                                        'closed_by' =>
                                        null,

                                        'opened_at' =>
                                        now(),

                                        'closed_at' =>
                                        null,

                                        'notes' =>
                                        $notes,
                                    ]);

                                /*
                                |--------------------------------------------------------------------------
                                | Audit
                                |--------------------------------------------------------------------------
                                */

                                $this
                                    ->auditLogger
                                    ->record(
                                        action: 'BUSINESS_DAY_OPENED',

                                        entityType: 'business_day',

                                        entityId: $businessDay->id,

                                        newValues: [
                                            'business_date' =>
                                            $businessDate,

                                            'status' =>
                                            BusinessDay::STATUS_OPEN,

                                            'opened_by' =>
                                            $actor->id,

                                            'opened_at' =>
                                            $businessDay
                                                ->opened_at
                                                ?->toISOString(),

                                            'notes' =>
                                            $notes,
                                        ],

                                        metadata: [
                                            'source' =>
                                            'RESTAURANT_POS',
                                        ],

                                        userId: $actor->id
                                    );

                                $businessDay
                                    ->load([
                                        'openedBy',
                                        'closedBy',
                                    ]);

                                return [
                                    'business_day' =>
                                    $businessDay,

                                    'created' =>
                                    true,
                                ];
                            }
                        );
                    }
                );
        } catch (
            LockTimeoutException) {
            throw new BusinessDayOpeningException(
                message: 'Another business day operation is currently in progress. Please try again.',

                errorCode: 'BUSINESS_DAY_OPEN_LOCK_TIMEOUT',

                status: 409
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function nullableString(
        mixed $value
    ): ?string {
        if (
            $value === null
        ) {
            return null;
        }

        $value =
            trim(
                (string)
                $value
            );

        return $value
            !==
            ''
            ? $value
            : null;
    }
}
