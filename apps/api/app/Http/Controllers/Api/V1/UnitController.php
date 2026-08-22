<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\InventoryOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Inventory\ConvertUnitRequest;
use App\Http\Requests\Api\V1\Inventory\StoreUnitRequest;
use App\Http\Requests\Api\V1\Inventory\UpdateUnitRequest;
use App\Http\Requests\Api\V1\Inventory\UpdateUnitStatusRequest;
use App\Http\Resources\UnitResource;
use App\Models\Unit;
use App\Models\User;
use App\Services\UnitConversionService;
use App\Services\UnitManagementService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UnitController extends Controller
{
    public function __construct(
        private readonly UnitManagementService $unitService,
        private readonly UnitConversionService $conversionService
    ) {}

    public function index(
        Request $request
    ): JsonResponse {
        $search =
            trim(
                (string)
                $request->query(
                    'search',
                    ''
                )
            );

        $query =
            Unit::query()
            ->with(
                'baseUnit'
            );

        if ($search !== '') {
            $query->where(
                function ($query) use (
                    $search
                ): void {
                    $query
                        ->where(
                            'name',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'symbol',
                            'like',
                            "%{$search}%"
                        );
                }
            );
        }

        if (
            $request->has(
                'is_active'
            )
        ) {
            $query->where(
                'is_active',
                $request->boolean(
                    'is_active'
                )
            );
        }

        $units =
            $query
            ->orderBy(
                'measurement_type'
            )
            ->orderBy(
                'name'
            )
            ->get();

        return ApiResponse::success(
            data: UnitResource::collection(
                $units
            )->resolve(
                $request
            ),

            message: 'Units retrieved successfully.'
        );
    }

    public function store(
        StoreUnitRequest $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $unit =
                $this->unitService
                ->create(
                    $user,
                    $request
                        ->validated()
                );
        } catch (
            InventoryOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception
                    ->getMessage(),

                code: $exception
                    ->errorCode,

                status: $exception
                    ->status
            );
        }

        return ApiResponse::success(
            data: (
                new UnitResource(
                    $unit
                )
            )->resolve(
                $request
            ),

            message: 'Unit created successfully.',

            status: 201
        );
    }

    public function update(
        UpdateUnitRequest $request,
        Unit $unit
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $unit =
                $this->unitService
                ->update(
                    $user,
                    $unit,
                    $request
                        ->validated()
                );
        } catch (
            InventoryOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception
                    ->getMessage(),

                code: $exception
                    ->errorCode,

                status: $exception
                    ->status
            );
        }

        return ApiResponse::success(
            data: (
                new UnitResource(
                    $unit
                )
            )->resolve(
                $request
            ),

            message: 'Unit updated successfully.'
        );
    }

    public function updateStatus(
        UpdateUnitStatusRequest $request,
        Unit $unit
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $unit =
                $this->unitService
                ->updateStatus(
                    $user,
                    $unit,
                    (bool)
                    $request
                        ->validated()['is_active']
                );
        } catch (
            InventoryOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception
                    ->getMessage(),

                code: $exception
                    ->errorCode,

                status: $exception
                    ->status
            );
        }

        return ApiResponse::success(
            data: (
                new UnitResource(
                    $unit
                )
            )->resolve(
                $request
            ),

            message: 'Unit status updated successfully.'
        );
    }

    public function convert(
        ConvertUnitRequest $request
    ): JsonResponse {
        $data =
            $request->validated();

        /** @var Unit $from */
        $from =
            Unit::query()
            ->findOrFail(
                $data['from_unit_id']
            );

        /** @var Unit $to */
        $to =
            Unit::query()
            ->findOrFail(
                $data['to_unit_id']
            );

        try {
            $converted =
                $this
                ->conversionService
                ->convert(
                    (float)
                    $data['quantity'],
                    $from,
                    $to
                );
        } catch (
            InventoryOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception
                    ->getMessage(),

                code: $exception
                    ->errorCode,

                status: $exception
                    ->status
            );
        }

        return ApiResponse::success(
            data: [
                'input' => [
                    'quantity' =>
                    (float)
                    $data['quantity'],

                    'unit' =>
                    $from->symbol,
                ],

                'output' => [
                    'quantity' =>
                    $converted,

                    'unit' =>
                    $to->symbol,
                ],
            ],

            message: 'Unit conversion completed successfully.'
        );
    }
}
