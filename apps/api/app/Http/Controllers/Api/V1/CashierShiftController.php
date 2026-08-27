<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\CashierShiftOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Cash\CloseCashierShiftRequest;
use App\Http\Requests\Api\V1\Cash\OpenCashierShiftRequest;
use App\Http\Requests\Api\V1\Cash\StoreCashDrawerMovementRequest;
use App\Http\Resources\CashDrawerMovementResource;
use App\Http\Resources\CashierShiftResource;
use App\Models\CashierShift;
use App\Services\CashierShiftService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CashierShiftController extends Controller
{
    public function __construct(
        private readonly CashierShiftService $cashierShiftService
    ) {}

    public function current(
        Request $request
    ): JsonResponse {
        $result =
            $this
            ->cashierShiftService
            ->current(
                $request->user()
            );

        if ($result === null) {
            return ApiResponse::success(
                data: [
                    'shift' =>
                    null,
                ],

                message: 'No open cashier shift was found.'
            );
        }

        return ApiResponse::success(
            data: [
                'shift' =>
                new CashierShiftResource(
                    $result['shift']
                ),

                'summary' =>
                $result['summary'],
            ],

            message: 'Current cashier shift retrieved successfully.'
        );
    }

    public function open(
        OpenCashierShiftRequest $request
    ): JsonResponse {
        try {
            $result =
                $this
                ->cashierShiftService
                ->open(
                    actor: $request->user(),

                    data: $request->validated()
                );

            return ApiResponse::success(
                data: [
                    'shift' =>
                    new CashierShiftResource(
                        $result['shift']
                    ),

                    'summary' =>
                    $result['summary'],

                    'created' =>
                    $result['created'],
                ],

                message: $result['created']
                    ? 'Cashier shift opened successfully.'
                    : 'Existing cashier shift returned successfully.',

                status: $result['created']
                    ? 201
                    : 200
            );
        } catch (
            CashierShiftOperationException $exception
        ) {
            return $this->operationError(
                $exception
            );
        }
    }

    public function show(
        CashierShift $cashierShift
    ): JsonResponse {
        $result =
            $this
            ->cashierShiftService
            ->show(
                $cashierShift
            );

        return ApiResponse::success(
            data: [
                'shift' =>
                new CashierShiftResource(
                    $result['shift']
                ),

                'summary' =>
                $result['summary'],
            ],

            message: 'Cashier shift retrieved successfully.'
        );
    }

    public function movements(
        CashierShift $cashierShift
    ): JsonResponse {
        $movements =
            $this
            ->cashierShiftService
            ->movements(
                $cashierShift
            );

        return ApiResponse::success(
            data: [
                'shift_id' =>
                $cashierShift->id,

                'movements' =>
                CashDrawerMovementResource::collection(
                    $movements
                )->resolve(),
            ],

            message: 'Cash drawer movements retrieved successfully.'
        );
    }

    public function cashIn(
        StoreCashDrawerMovementRequest $request,
        CashierShift $cashierShift
    ): JsonResponse {
        try {
            $result =
                $this
                ->cashierShiftService
                ->cashIn(
                    actor: $request->user(),

                    shift: $cashierShift,

                    data: $request->validated()
                );

            return $this->movementResponse(
                result: $result,

                message: 'Cash added to drawer successfully.'
            );
        } catch (
            CashierShiftOperationException $exception
        ) {
            return $this->operationError(
                $exception
            );
        }
    }

    public function cashOut(
        StoreCashDrawerMovementRequest $request,
        CashierShift $cashierShift
    ): JsonResponse {
        try {
            $result =
                $this
                ->cashierShiftService
                ->cashOut(
                    actor: $request->user(),

                    shift: $cashierShift,

                    data: $request->validated()
                );

            return $this->movementResponse(
                result: $result,

                message: 'Cash removed from drawer successfully.'
            );
        } catch (
            CashierShiftOperationException $exception
        ) {
            return $this->operationError(
                $exception
            );
        }
    }

    public function close(
        CloseCashierShiftRequest $request,
        CashierShift $cashierShift
    ): JsonResponse {
        try {
            $result =
                $this
                ->cashierShiftService
                ->close(
                    actor: $request->user(),

                    shift: $cashierShift,

                    data: $request->validated()
                );

            return ApiResponse::success(
                data: [
                    'shift' =>
                    new CashierShiftResource(
                        $result['shift']
                    ),

                    'summary' =>
                    $result['summary'],

                    'closed' =>
                    $result['closed'],
                ],

                message: $result['closed']
                    ? 'Cashier shift closed successfully.'
                    : 'Existing closed cashier shift returned successfully.'
            );
        } catch (
            CashierShiftOperationException $exception
        ) {
            return $this->operationError(
                $exception
            );
        }
    }

    private function movementResponse(
        array $result,
        string $message
    ): JsonResponse {
        return ApiResponse::success(
            data: [
                'movement' =>
                new CashDrawerMovementResource(
                    $result['movement']
                ),

                'shift' =>
                new CashierShiftResource(
                    $result['shift']
                ),

                'summary' =>
                $result['summary'],

                'created' =>
                $result['created'],
            ],

            message: $result['created']
                ? $message
                : 'Existing cash movement returned successfully.',

            status: $result['created']
                ? 201
                : 200
        );
    }

    private function operationError(
        CashierShiftOperationException $exception
    ): JsonResponse {
        return ApiResponse::error(
            message: $exception->getMessage(),

            code: $exception->errorCode,

            errors: [],

            status: $exception->status
        );
    }
}
