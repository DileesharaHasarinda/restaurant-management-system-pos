<?php

namespace App\Services;

use App\Exceptions\ExpenseOperationException;
use App\Models\BusinessDay;
use App\Models\CashDrawerMovement;
use App\Models\CashierShift;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

final class ExpenseService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Create Expense
    |--------------------------------------------------------------------------
    */

    public function create(
        User $actor,
        array $data
    ): array {
        $clientRequestId =
            trim(
                (string)
                $data['client_request_id']
            );

        if (
            ! Str::isUuid(
                $clientRequestId
            )
        ) {
            throw new ExpenseOperationException(
                message: 'The expense request ID must be a valid UUID.',

                errorCode: 'INVALID_EXPENSE_REQUEST_ID',

                status: 422
            );
        }

        $existing =
            Expense::query()
            ->where(
                'client_request_id',
                $clientRequestId
            )
            ->first();

        if ($existing) {
            $this->assertSameCreateRequest(
                expense: $existing,

                data: $data
            );

            return [
                'expense' =>
                $this->loadExpense(
                    $existing
                ),

                'created' =>
                false,
            ];
        }

        try {
            return DatabaseTransaction::run(
                function () use (
                    $actor,
                    $data,
                    $clientRequestId
                ): array {
                    /*
                    |--------------------------------------------------------------------------
                    | Transaction Idempotency Check
                    |--------------------------------------------------------------------------
                    */

                    $existing =
                        Expense::query()
                        ->where(
                            'client_request_id',
                            $clientRequestId
                        )
                        ->first();

                    if ($existing) {
                        $this
                            ->assertSameCreateRequest(
                                expense: $existing,

                                data: $data
                            );

                        return [
                            'expense' =>
                            $this
                                ->loadExpense(
                                    $existing
                                ),

                            'created' =>
                            false,
                        ];
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Open Business Day
                    |--------------------------------------------------------------------------
                    */

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
                        throw new ExpenseOperationException(
                            message: 'An open business day is required before an expense can be recorded.',

                            errorCode: 'BUSINESS_DAY_NOT_OPEN',

                            status: 409
                        );
                    }

                    /*
                    |--------------------------------------------------------------------------
                    | Category
                    |--------------------------------------------------------------------------
                    */

                    $category =
                        ExpenseCategory::query()
                        ->find(
                            (int)
                            $data['expense_category_id']
                        );

                    if (! $category) {
                        throw new ExpenseOperationException(
                            message: 'The selected expense category could not be found.',

                            errorCode: 'EXPENSE_CATEGORY_NOT_FOUND',

                            status: 422
                        );
                    }

                    if (
                        ! $category
                            ->is_active
                    ) {
                        throw new ExpenseOperationException(
                            message: 'The selected expense category is inactive.',

                            errorCode: 'EXPENSE_CATEGORY_INACTIVE',

                            status: 422
                        );
                    }

                    $paymentMethod =
                        strtoupper(
                            trim(
                                (string)
                                $data['payment_method']
                            )
                        );

                    $amount =
                        round(
                            (float)
                            $data['amount'],
                            2
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Resolve Cashier Shift
                    |--------------------------------------------------------------------------
                    */

                    $shiftId =
                        $this
                        ->resolveDesiredShiftId(
                            actor: $actor,

                            businessDay: $businessDay,

                            paymentMethod: $paymentMethod,

                            data: $data
                        );

                    $shift =
                        $this
                        ->lockAndValidateShift(
                            actor: $actor,

                            businessDay: $businessDay,

                            shiftId: $shiftId
                        );

                    /*
                    |--------------------------------------------------------------------------
                    | Create Expense
                    |--------------------------------------------------------------------------
                    */

                    $expense =
                        Expense::query()
                        ->create([
                            'client_request_id' =>
                            $clientRequestId,

                            'expense_number' =>
                            $this
                                ->generateExpenseNumber(),

                            'expense_category_id' =>
                            $category->id,

                            'business_day_id' =>
                            $businessDay->id,

                            'cashier_shift_id' =>
                            $shift?->id,

                            'description' =>
                            trim(
                                (string)
                                $data['description']
                            ),

                            'notes' =>
                            $this
                                ->nullableString(
                                    $data['notes']
                                        ?? null
                                ),

                            'amount' =>
                            $amount,

                            'payment_method' =>
                            $paymentMethod,

                            'reference_number' =>
                            $this
                                ->nullableString(
                                    $data['reference_number']
                                        ?? null
                                ),

                            'receipt_path' =>
                            null,

                            'receipt_original_name' =>
                            null,

                            'receipt_mime_type' =>
                            null,

                            'receipt_size' =>
                            null,

                            'receipt_uploaded_at' =>
                            null,

                            'status' =>
                            Expense::STATUS_POSTED,

                            'expense_date' =>
                            $data['expense_date'],

                            'created_by' =>
                            $actor->id,

                            'approved_by' =>
                            null,
                        ]);

                    /*
                    |--------------------------------------------------------------------------
                    | Cash Drawer
                    |--------------------------------------------------------------------------
                    |
                    | Only actual CASH paid from an open shift
                    | affects physical drawer cash.
                    |
                    */

                    if (
                        $paymentMethod
                        ===
                        Expense::METHOD_CASH
                        &&
                        $shift
                    ) {
                        $this
                            ->recordDrawerMovement(
                                shift: $shift,

                                type: CashDrawerMovement::TYPE_CASH_OUT,

                                amount: $amount,

                                expense: $expense,

                                actor: $actor,

                                reason: sprintf(
                                    'Cash expense %s.',
                                    $expense
                                        ->expense_number
                                )
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
                            action: 'EXPENSE_CREATED',

                            entityType: 'expense',

                            entityId: $expense->id,

                            newValues: [
                                'expense_number' =>
                                $expense
                                    ->expense_number,

                                'expense_category_id' =>
                                $category->id,

                                'business_day_id' =>
                                $businessDay->id,

                                'cashier_shift_id' =>
                                $shift?->id,

                                'expense_date' =>
                                $expense
                                    ->expense_date
                                    ?->toDateString(),

                                'description' =>
                                $expense
                                    ->description,

                                'notes' =>
                                $expense
                                    ->notes,

                                'amount' =>
                                $amount,

                                'payment_method' =>
                                $paymentMethod,

                                'reference_number' =>
                                $expense
                                    ->reference_number,

                                'status' =>
                                $expense
                                    ->status,
                            ],

                            metadata: [
                                'client_request_id' =>
                                $clientRequestId,

                                'cash_drawer_affected' =>
                                $paymentMethod
                                    ===
                                    Expense::METHOD_CASH
                                    &&
                                    $shift !== null,
                            ],

                            userId: $actor->id
                        );

                    return [
                        'expense' =>
                        $this
                            ->loadExpense(
                                $expense
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
             * Concurrent duplicate request protection.
             */
            $existing =
                Expense::query()
                ->where(
                    'client_request_id',
                    $clientRequestId
                )
                ->first();

            if (! $existing) {
                throw $exception;
            }

            $this->assertSameCreateRequest(
                expense: $existing,

                data: $data
            );

            return [
                'expense' =>
                $this
                    ->loadExpense(
                        $existing
                    ),

                'created' =>
                false,
            ];
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Edit Expense
    |--------------------------------------------------------------------------
    */

    public function update(
        User $actor,
        Expense $expense,
        array $data
    ): Expense {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $expense,
                $data
            ): Expense {
                $locked =
                    Expense::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $expense->id
                    );

                /*
                 * Closed accounting days must remain immutable.
                 */
                $businessDay =
                    BusinessDay::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $locked
                            ->business_day_id
                    );

                if (
                    $businessDay->status
                    !==
                    BusinessDay::STATUS_OPEN
                ) {
                    throw new ExpenseOperationException(
                        message: 'Expenses from a closed business day cannot be edited.',

                        errorCode: 'EXPENSE_BUSINESS_DAY_CLOSED',

                        status: 409
                    );
                }

                $category =
                    ExpenseCategory::query()
                    ->find(
                        (int)
                        $data['expense_category_id']
                    );

                if (
                    ! $category
                    ||
                    ! $category->is_active
                ) {
                    throw new ExpenseOperationException(
                        message: 'The selected expense category is not available.',

                        errorCode: 'EXPENSE_CATEGORY_INACTIVE',

                        status: 422
                    );
                }

                $old = [
                    'expense_category_id' =>
                    $locked
                        ->expense_category_id,

                    'cashier_shift_id' =>
                    $locked
                        ->cashier_shift_id,

                    'expense_date' =>
                    $locked
                        ->expense_date
                        ?->toDateString(),

                    'description' =>
                    $locked
                        ->description,

                    'notes' =>
                    $locked
                        ->notes,

                    'amount' =>
                    (float)
                    $locked
                        ->amount,

                    'payment_method' =>
                    $locked
                        ->payment_method,

                    'reference_number' =>
                    $locked
                        ->reference_number,
                ];

                $newAmount =
                    round(
                        (float)
                        $data['amount'],
                        2
                    );

                $newPaymentMethod =
                    strtoupper(
                        trim(
                            (string)
                            $data['payment_method']
                        )
                    );

                /*
                |--------------------------------------------------------------------------
                | Determine New Cash Shift
                |--------------------------------------------------------------------------
                */

                $fallbackShiftId =
                    $locked->payment_method
                    ===
                    Expense::METHOD_CASH
                    ? $locked
                    ->cashier_shift_id
                    : null;

                $newShiftId =
                    $this
                    ->resolveDesiredShiftId(
                        actor: $actor,

                        businessDay: $businessDay,

                        paymentMethod: $newPaymentMethod,

                        data: $data,

                        fallbackShiftId: $fallbackShiftId
                    );

                /*
                |--------------------------------------------------------------------------
                | Lock Old + New Shifts in Stable ID Order
                |--------------------------------------------------------------------------
                */

                $shiftIds =
                    collect([
                        $locked
                            ->cashier_shift_id,

                        $newShiftId,
                    ])
                    ->filter(
                        fn(
                            mixed $id
                        ): bool =>
                        $id !== null
                    )
                    ->map(
                        fn(
                            mixed $id
                        ): int =>
                        (int)
                        $id
                    )
                    ->unique()
                    ->sort()
                    ->values()
                    ->all();

                /** @var Collection<int, CashierShift> $shifts */
                $shifts =
                    CashierShift::query()
                    ->whereIn(
                        'id',
                        $shiftIds
                    )
                    ->orderBy(
                        'id'
                    )
                    ->lockForUpdate()
                    ->get()
                    ->keyBy(
                        'id'
                    );

                $oldShift =
                    $locked
                    ->cashier_shift_id
                    ? $shifts->get(
                        (int)
                        $locked
                            ->cashier_shift_id
                    )
                    : null;

                $newShift =
                    $newShiftId
                    ? $shifts->get(
                        $newShiftId
                    )
                    : null;

                if ($newShiftId) {
                    if (! $newShift) {
                        throw new ExpenseOperationException(
                            message: 'The selected cashier shift could not be found.',

                            errorCode: 'CASHIER_SHIFT_NOT_FOUND',

                            status: 422
                        );
                    }

                    $this
                        ->assertShiftUsable(
                            actor: $actor,

                            businessDay: $businessDay,

                            shift: $newShift
                        );
                }

                /*
                 * Existing linked cash expense cannot be
                 * modified after its shift is closed because
                 * that shift may already be reconciled.
                 */
                if (
                    $locked->payment_method
                    ===
                    Expense::METHOD_CASH
                    &&
                    $oldShift
                    &&
                    $oldShift->status
                    !==
                    CashierShift::STATUS_OPEN
                ) {
                    throw new ExpenseOperationException(
                        message: 'This cash expense belongs to a closed cashier shift and cannot be edited.',

                        errorCode: 'EXPENSE_CASH_SHIFT_CLOSED',

                        status: 409
                    );
                }

                /*
                |--------------------------------------------------------------------------
                | Reconcile Physical Drawer
                |--------------------------------------------------------------------------
                */

                $oldHasDrawerEffect =
                    $locked->payment_method
                    ===
                    Expense::METHOD_CASH
                    &&
                    $oldShift !== null;

                $newHasDrawerEffect =
                    $newPaymentMethod
                    ===
                    Expense::METHOD_CASH
                    &&
                    $newShift !== null;

                if (
                    $oldHasDrawerEffect
                    &&
                    $newHasDrawerEffect
                    &&
                    $oldShift->id
                    ===
                    $newShift->id
                ) {
                    /*
                     * Same drawer.
                     *
                     * Apply only the difference.
                     */
                    $difference =
                        round(
                            $newAmount
                                -
                                (float)
                                $locked->amount,
                            2
                        );

                    if (
                        $difference > 0
                    ) {
                        $this
                            ->recordDrawerMovement(
                                shift: $newShift,

                                type: CashDrawerMovement::TYPE_CASH_OUT,

                                amount: $difference,

                                expense: $locked,

                                actor: $actor,

                                reason: sprintf(
                                    'Additional cash-out after editing expense %s.',
                                    $locked
                                        ->expense_number
                                )
                            );
                    } elseif (
                        $difference < 0
                    ) {
                        $this
                            ->recordDrawerMovement(
                                shift: $newShift,

                                type: CashDrawerMovement::TYPE_CASH_IN,

                                amount: abs(
                                    $difference
                                ),

                                expense: $locked,

                                actor: $actor,

                                reason: sprintf(
                                    'Cash adjustment returned after editing expense %s.',
                                    $locked
                                        ->expense_number
                                )
                            );
                    }
                } else {
                    /*
                     * Reverse old drawer effect.
                     */
                    if (
                        $oldHasDrawerEffect
                    ) {
                        $this
                            ->recordDrawerMovement(
                                shift: $oldShift,

                                type: CashDrawerMovement::TYPE_CASH_IN,

                                amount: (float)
                                $locked
                                    ->amount,

                                expense: $locked,

                                actor: $actor,

                                reason: sprintf(
                                    'Reversal of cash effect for edited expense %s.',
                                    $locked
                                        ->expense_number
                                )
                            );
                    }

                    /*
                     * Apply new drawer effect.
                     */
                    if (
                        $newHasDrawerEffect
                    ) {
                        $this
                            ->recordDrawerMovement(
                                shift: $newShift,

                                type: CashDrawerMovement::TYPE_CASH_OUT,

                                amount: $newAmount,

                                expense: $locked,

                                actor: $actor,

                                reason: sprintf(
                                    'Cash-out after editing expense %s.',
                                    $locked
                                        ->expense_number
                                )
                            );
                    }
                }

                /*
                |--------------------------------------------------------------------------
                | Save Updated Expense
                |--------------------------------------------------------------------------
                */

                $locked->expense_category_id =
                    $category->id;

                $locked->cashier_shift_id =
                    $newShift?->id;

                $locked->expense_date =
                    $data['expense_date'];

                $locked->description =
                    trim(
                        (string)
                        $data['description']
                    );

                $locked->notes =
                    $this
                    ->nullableString(
                        $data['notes']
                            ?? null
                    );

                $locked->amount =
                    $newAmount;

                $locked->payment_method =
                    $newPaymentMethod;

                $locked->reference_number =
                    $this
                    ->nullableString(
                        $data['reference_number']
                            ?? null
                    );

                $locked->save();

                $new = [
                    'expense_category_id' =>
                    $locked
                        ->expense_category_id,

                    'cashier_shift_id' =>
                    $locked
                        ->cashier_shift_id,

                    'expense_date' =>
                    $locked
                        ->expense_date
                        ?->toDateString(),

                    'description' =>
                    $locked
                        ->description,

                    'notes' =>
                    $locked
                        ->notes,

                    'amount' =>
                    (float)
                    $locked
                        ->amount,

                    'payment_method' =>
                    $locked
                        ->payment_method,

                    'reference_number' =>
                    $locked
                        ->reference_number,
                ];

                $this
                    ->auditLogger
                    ->record(
                        action: 'EXPENSE_UPDATED',

                        entityType: 'expense',

                        entityId: $locked->id,

                        oldValues: $old,

                        newValues: $new,

                        userId: $actor->id
                    );

                return $this
                    ->loadExpense(
                        $locked
                    );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Upload Receipt
    |--------------------------------------------------------------------------
    */

    public function uploadReceipt(
        User $actor,
        Expense $expense,
        UploadedFile $receipt
    ): Expense {
        /*
         * "local" is private storage.
         */
        $newPath =
            $receipt->store(
                "expenses/receipts/{$expense->id}",
                'local'
            );

        try {
            [
                $updated,
                $oldPath,
            ] = DatabaseTransaction::run(
                function () use (
                    $actor,
                    $expense,
                    $receipt,
                    $newPath
                ): array {
                    $locked =
                        Expense::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $expense->id
                        );

                    $oldPath =
                        $locked
                        ->receipt_path;

                    $old = [
                        'receipt_original_name' =>
                        $locked
                            ->receipt_original_name,

                        'receipt_mime_type' =>
                        $locked
                            ->receipt_mime_type,

                        'receipt_size' =>
                        $locked
                            ->receipt_size,
                    ];

                    $locked->receipt_path =
                        $newPath;

                    $locked->receipt_original_name =
                        $receipt
                        ->getClientOriginalName();

                    $locked->receipt_mime_type =
                        $receipt
                        ->getMimeType();

                    $locked->receipt_size =
                        $receipt
                        ->getSize();

                    $locked->receipt_uploaded_at =
                        now();

                    $locked->save();

                    $this
                        ->auditLogger
                        ->record(
                            action: 'EXPENSE_RECEIPT_UPDATED',

                            entityType: 'expense',

                            entityId: $locked->id,

                            oldValues: $old,

                            newValues: [
                                'receipt_original_name' =>
                                $locked
                                    ->receipt_original_name,

                                'receipt_mime_type' =>
                                $locked
                                    ->receipt_mime_type,

                                'receipt_size' =>
                                $locked
                                    ->receipt_size,
                            ],

                            userId: $actor->id
                        );

                    return [
                        $this
                            ->loadExpense(
                                $locked
                            ),

                        $oldPath,
                    ];
                }
            );
        } catch (
            Throwable $exception
        ) {
            Storage::disk(
                'local'
            )->delete(
                $newPath
            );

            throw $exception;
        }

        if (
            $oldPath
            &&
            $oldPath !== $newPath
        ) {
            Storage::disk(
                'local'
            )->delete(
                $oldPath
            );
        }

        return $updated;
    }

    /*
    |--------------------------------------------------------------------------
    | Remove Receipt
    |--------------------------------------------------------------------------
    */

    public function removeReceipt(
        User $actor,
        Expense $expense
    ): Expense {
        [
            $updated,
            $oldPath,
        ] = DatabaseTransaction::run(
            function () use (
                $actor,
                $expense
            ): array {
                $locked =
                    Expense::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $expense->id
                    );

                $oldPath =
                    $locked
                    ->receipt_path;

                $old = [
                    'receipt_original_name' =>
                    $locked
                        ->receipt_original_name,

                    'receipt_mime_type' =>
                    $locked
                        ->receipt_mime_type,

                    'receipt_size' =>
                    $locked
                        ->receipt_size,
                ];

                $locked->receipt_path =
                    null;

                $locked->receipt_original_name =
                    null;

                $locked->receipt_mime_type =
                    null;

                $locked->receipt_size =
                    null;

                $locked->receipt_uploaded_at =
                    null;

                $locked->save();

                $this
                    ->auditLogger
                    ->record(
                        action: 'EXPENSE_RECEIPT_REMOVED',

                        entityType: 'expense',

                        entityId: $locked->id,

                        oldValues: $old,

                        newValues: [
                            'receipt_original_name' =>
                            null,

                            'receipt_mime_type' =>
                            null,

                            'receipt_size' =>
                            null,
                        ],

                        userId: $actor->id
                    );

                return [
                    $this
                        ->loadExpense(
                            $locked
                        ),

                    $oldPath,
                ];
            }
        );

        if ($oldPath) {
            Storage::disk(
                'local'
            )->delete(
                $oldPath
            );
        }

        return $updated;
    }

    /*
    |--------------------------------------------------------------------------
    | Cashier Shift Resolution
    |--------------------------------------------------------------------------
    */

    private function resolveDesiredShiftId(
        User $actor,
        BusinessDay $businessDay,
        string $paymentMethod,
        array $data,
        ?int $fallbackShiftId = null
    ): ?int {
        /*
         * Non-cash payments must never be connected
         * to a physical drawer.
         */
        if (
            $paymentMethod
            !==
            Expense::METHOD_CASH
        ) {
            if (
                array_key_exists(
                    'cashier_shift_id',
                    $data
                )
                &&
                $data['cashier_shift_id']
                !== null
            ) {
                throw new ExpenseOperationException(
                    message: 'A cashier shift can only be linked to a cash expense.',

                    errorCode: 'CASHIER_SHIFT_ONLY_FOR_CASH',

                    status: 422
                );
            }

            return null;
        }

        /*
         * Explicit value from caller.
         *
         * Explicit null means:
         * "This cash expense did not come from
         * the POS drawer."
         */
        if (
            array_key_exists(
                'cashier_shift_id',
                $data
            )
        ) {
            return $data['cashier_shift_id'] !== null
                ? (int)
                $data['cashier_shift_id']
                : null;
        }

        /*
         * During an edit, preserve existing shift
         * unless caller explicitly changes it.
         */
        if (
            $fallbackShiftId !== null
        ) {
            return $fallbackShiftId;
        }

        /*
         * Automatically use actor's current open
         * shift when available.
         */
        return CashierShift::query()
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
    }

    private function lockAndValidateShift(
        User $actor,
        BusinessDay $businessDay,
        ?int $shiftId
    ): ?CashierShift {
        if (
            $shiftId === null
        ) {
            return null;
        }

        $shift =
            CashierShift::query()
            ->lockForUpdate()
            ->find(
                $shiftId
            );

        if (! $shift) {
            throw new ExpenseOperationException(
                message: 'The selected cashier shift could not be found.',

                errorCode: 'CASHIER_SHIFT_NOT_FOUND',

                status: 422
            );
        }

        $this->assertShiftUsable(
            actor: $actor,

            businessDay: $businessDay,

            shift: $shift
        );

        return $shift;
    }

    private function assertShiftUsable(
        User $actor,
        BusinessDay $businessDay,
        CashierShift $shift
    ): void {
        if (
            $shift->status
            !==
            CashierShift::STATUS_OPEN
        ) {
            throw new ExpenseOperationException(
                message: 'The selected cashier shift is not open.',

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
            throw new ExpenseOperationException(
                message: 'The cashier shift belongs to a different business day.',

                errorCode: 'CASHIER_SHIFT_BUSINESS_DAY_MISMATCH',

                status: 422
            );
        }

        /*
         * Prevent changing another cashier's
         * physical drawer.
         */
        if (
            (int)
            $shift->cashier_id
            !==
            (int)
            $actor->id
        ) {
            throw new ExpenseOperationException(
                message: 'You cannot record an expense against another user\'s cashier shift.',

                errorCode: 'CASHIER_SHIFT_NOT_OWNED',

                status: 403
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Drawer Movement
    |--------------------------------------------------------------------------
    */

    private function recordDrawerMovement(
        CashierShift $shift,
        string $type,
        float $amount,
        Expense $expense,
        User $actor,
        string $reason
    ): CashDrawerMovement {
        $amount =
            round(
                abs(
                    $amount
                ),
                2
            );

        if (
            $amount <= 0
        ) {
            throw new ExpenseOperationException(
                message: 'Cash drawer movement amount must be greater than zero.',

                errorCode: 'INVALID_CASH_DRAWER_AMOUNT',

                status: 422
            );
        }

        $movement =
            CashDrawerMovement::query()
            ->create([
                'cashier_shift_id' =>
                $shift->id,

                'movement_type' =>
                $type,

                'amount' =>
                $amount,

                'reference_type' =>
                'expense',

                'reference_id' =>
                $expense->id,

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
            $shift
                ->expected_cash;

        if (
            $type
            ===
            CashDrawerMovement::TYPE_CASH_OUT
        ) {
            $shift->expected_cash =
                round(
                    $currentExpected
                        -
                        $amount,
                    2
                );
        } elseif (
            $type
            ===
            CashDrawerMovement::TYPE_CASH_IN
        ) {
            $shift->expected_cash =
                round(
                    $currentExpected
                        +
                        $amount,
                    2
                );
        }

        $shift->save();

        return $movement;
    }

    /*
    |--------------------------------------------------------------------------
    | Idempotency
    |--------------------------------------------------------------------------
    */

    private function assertSameCreateRequest(
        Expense $expense,
        array $data
    ): void {
        $same =
            (int)
            $expense
                ->expense_category_id
            ===
            (int)
            $data['expense_category_id']
            &&
            $expense
            ->expense_date
            ?->toDateString()
            ===
            (string)
            $data['expense_date']
            &&
            $expense
            ->description
            ===
            trim(
                (string)
                $data['description']
            )
            &&
            $expense
            ->notes
            ===
            $this
            ->nullableString(
                $data['notes']
                    ?? null
            )
            &&
            abs(
                (float)
                $expense->amount
                    -
                    round(
                        (float)
                        $data['amount'],
                        2
                    )
            )
            <
            0.005
            &&
            $expense
            ->payment_method
            ===
            strtoupper(
                trim(
                    (string)
                    $data['payment_method']
                )
            )
            &&
            $expense
            ->reference_number
            ===
            $this
            ->nullableString(
                $data['reference_number']
                    ?? null
            );

        /*
         * Only compare an explicitly requested
         * shift ID. Auto-selected shift is server
         * operational data.
         */
        if (
            $same
            &&
            array_key_exists(
                'cashier_shift_id',
                $data
            )
            &&
            $data['cashier_shift_id']
            !== null
        ) {
            $same =
                (int)
                $expense
                    ->cashier_shift_id
                ===
                (int)
                $data['cashier_shift_id'];
        }

        if (! $same) {
            throw new ExpenseOperationException(
                message: 'This expense request ID has already been used for different data.',

                errorCode: 'EXPENSE_IDEMPOTENCY_KEY_REUSED',

                status: 409
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Helpers
    |--------------------------------------------------------------------------
    */

    private function generateExpenseNumber(): string
    {
        return sprintf(
            'EXP-%s-%s',
            now()->format(
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

        return $value !== ''
            ? $value
            : null;
    }

    private function loadExpense(
        Expense $expense
    ): Expense {
        return $expense
            ->fresh([
                'category',
                'businessDay',
                'cashierShift.cashier',
                'createdBy',
                'approvedBy',
            ]);
    }
}
