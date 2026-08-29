<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\TableMergeResource;
use App\Http\Resources\TableTransferResource;
use App\Models\RestaurantTable;
use App\Models\TableMerge;
use App\Models\TableTransfer;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class TableHistoryController extends Controller
{
    public function transfers(
        Request $request,
        RestaurantTable $table
    ): JsonResponse {
        $perPage =
            max(
                1,
                min(
                    100,
                    (int) $request->query(
                        'per_page',
                        30
                    )
                )
            );

        $transfers =
            TableTransfer::query()
            ->where(
                function ($query) use ($table): void {
                    $query
                        ->where(
                            'from_table_id',
                            $table->id
                        )
                        ->orWhere(
                            'to_table_id',
                            $table->id
                        );
                }
            )
            ->with([
                'fromTable',
                'toTable',
                'transferredBy',
            ])
            ->latest('transferred_at')
            ->latest('id')
            ->paginate(
                $perPage
            );

        return ApiResponse::success(
            data: [
                'items' =>
                collect(
                    $transfers->items()
                )
                    ->map(
                        fn(TableTransfer $transfer): array => (
                            new TableTransferResource(
                                $transfer
                            )
                        )->resolve(
                            $request
                        )
                    )
                    ->values()
                    ->all(),

                'pagination' => [
                    'current_page' =>
                    $transfers->currentPage(),

                    'per_page' =>
                    $transfers->perPage(),

                    'total' =>
                    $transfers->total(),

                    'last_page' =>
                    $transfers->lastPage(),
                ],
            ],

            message: 'Table transfer history retrieved successfully.'
        );
    }

    public function merges(
        Request $request,
        RestaurantTable $table
    ): JsonResponse {
        $perPage =
            max(
                1,
                min(
                    100,
                    (int) $request->query(
                        'per_page',
                        30
                    )
                )
            );

        $merges =
            TableMerge::query()
            ->where(
                function ($query) use ($table): void {
                    $query
                        ->where(
                            'source_table_id',
                            $table->id
                        )
                        ->orWhere(
                            'target_table_id',
                            $table->id
                        );
                }
            )
            ->with([
                'sourceTable',
                'targetTable',
                'sourceSession',
                'targetSession',
                'mergedBy',
            ])
            ->latest('merged_at')
            ->latest('id')
            ->paginate(
                $perPage
            );

        return ApiResponse::success(
            data: [
                'items' =>
                collect(
                    $merges->items()
                )
                    ->map(
                        fn(TableMerge $merge): array => (
                            new TableMergeResource(
                                $merge
                            )
                        )->resolve(
                            $request
                        )
                    )
                    ->values()
                    ->all(),

                'pagination' => [
                    'current_page' =>
                    $merges->currentPage(),

                    'per_page' =>
                    $merges->perPage(),

                    'total' =>
                    $merges->total(),

                    'last_page' =>
                    $merges->lastPage(),
                ],
            ],

            message: 'Table merge history retrieved successfully.'
        );
    }
}
