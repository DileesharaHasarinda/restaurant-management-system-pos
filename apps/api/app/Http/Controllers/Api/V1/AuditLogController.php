<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Audit\ListAuditLogsRequest;
use App\Http\Resources\AuditLogResource;
use App\Models\AuditLog;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(
        ListAuditLogsRequest $request
    ): JsonResponse {
        $data =
            $request->validated();

        $query =
            AuditLog::query()
            ->with(
                'user.role'
            );

        /*
        |--------------------------------------------------------------------------
        | Search
        |--------------------------------------------------------------------------
        */

        if (
            filled(
                $data['search']
                    ?? null
            )
        ) {
            $search =
                (string)
                $data['search'];

            $like =
                "%{$search}%";

            $query->where(
                function (
                    Builder $query
                ) use (
                    $search,
                    $like
                ): void {
                    $query
                        ->where(
                            'action',
                            'like',
                            $like
                        )
                        ->orWhere(
                            'entity_type',
                            'like',
                            $like
                        )
                        ->orWhereHas(
                            'user',
                            function (
                                Builder $userQuery
                            ) use (
                                $like
                            ): void {
                                $userQuery
                                    ->where(
                                        'name',
                                        'like',
                                        $like
                                    )
                                    ->orWhere(
                                        'username',
                                        'like',
                                        $like
                                    )
                                    ->orWhere(
                                        'email',
                                        'like',
                                        $like
                                    );
                            }
                        );

                    if (
                        ctype_digit(
                            $search
                        )
                    ) {
                        $query->orWhere(
                            'entity_id',
                            (int) $search
                        );
                    }

                    /*
                     * Useful for:
                     *
                     * - failed login identifiers
                     * - reasons
                     * - document numbers
                     * - table names
                     *
                     * stored inside JSON audit payloads.
                     */

                    $query
                        ->orWhereRaw(
                            'CAST(metadata AS CHAR) LIKE ?',
                            [
                                $like,
                            ]
                        )
                        ->orWhereRaw(
                            'CAST(old_values AS CHAR) LIKE ?',
                            [
                                $like,
                            ]
                        )
                        ->orWhereRaw(
                            'CAST(new_values AS CHAR) LIKE ?',
                            [
                                $like,
                            ]
                        );
                }
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Exact Filters
        |--------------------------------------------------------------------------
        */

        if (
            filled(
                $data['action']
                    ?? null
            )
        ) {
            $query->where(
                'action',
                $data['action']
            );
        }

        if (
            filled(
                $data['entity_type']
                    ?? null
            )
        ) {
            $query->where(
                'entity_type',
                $data['entity_type']
            );
        }

        if (
            isset(
                $data['user_id']
            )
        ) {
            $query->where(
                'user_id',
                (int)
                $data['user_id']
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Date Filters
        |--------------------------------------------------------------------------
        */

        if (
            filled(
                $data['date_from']
                    ?? null
            )
        ) {
            $query->whereDate(
                'created_at',
                '>=',
                $data['date_from']
            );
        }

        if (
            filled(
                $data['date_to']
                    ?? null
            )
        ) {
            $query->whereDate(
                'created_at',
                '<=',
                $data['date_to']
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Pagination
        |--------------------------------------------------------------------------
        */

        $perPage =
            (int)
            (
                $data['per_page']
                ?? 25
            );

        $logs =
            $query
            ->orderByDesc(
                'created_at'
            )
            ->orderByDesc(
                'id'
            )
            ->paginate(
                $perPage
            );

        $items =
            collect(
                $logs->items()
            )
            ->map(
                fn(
                    AuditLog $auditLog
                ) => (
                    new AuditLogResource(
                        $auditLog
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $items,

            message: 'Audit logs retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $logs
                        ->currentPage(),

                    'per_page' =>
                    $logs
                        ->perPage(),

                    'total' =>
                    $logs
                        ->total(),

                    'last_page' =>
                    $logs
                        ->lastPage(),
                ],
            ]
        );
    }

    public function show(
        AuditLog $auditLog,
        Request $request
    ): JsonResponse {
        $auditLog->load(
            'user.role'
        );

        return ApiResponse::success(
            data: (
                new AuditLogResource(
                    $auditLog
                )
            )->resolve(
                $request
            ),

            message: 'Audit log retrieved successfully.'
        );
    }
}
