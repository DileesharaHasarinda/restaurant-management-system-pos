<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\CashierShiftOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Cash\ManualOpenCashDrawerRequest;
use App\Http\Resources\CashDrawerMovementResource;
use App\Http\Resources\CashierShiftResource;
use App\Models\CashierShift;
use App\Services\CashDrawerService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

final class CashDrawerController extends Controller
{
    public function __construct(
        private readonly CashDrawerService $cashDrawerService
    ) {}

    public function manualOpen(
        ManualOpenCashDrawerRequest $request,
        CashierShift $cashierShift
    ): JsonResponse {
        try {
            $result =
                $this
                ->cashDrawerService
                ->manualOpen(
                    actor: $request->user(),

                    shift: $cashierShift,

                    data: $request->validated()
                );

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

                    /*
                     * Electron must obey this.
                     *
                     * New request:
                     * true
                     *
                     * Idempotent retry:
                     * false
                     */
                    'cash_drawer' => [
                        'should_open' =>
                        $result['created'],
                    ],

                    'created' =>
                    $result['created'],
                ],

                message: $result['created']
                    ? 'Manual cash drawer opening authorized.'
                    : 'Existing manual drawer opening request returned.',

                status: $result['created']
                    ? 201
                    : 200
            );
        } catch (
            CashierShiftOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                errors: [],

                status: $exception->status
            );
        }
    }
}
