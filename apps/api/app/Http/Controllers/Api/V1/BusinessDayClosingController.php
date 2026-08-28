<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\BusinessDayClosingException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\BusinessDay\CloseBusinessDayRequest;
use App\Http\Resources\BusinessDayClosingResource;
use App\Http\Resources\BusinessDayResource;
use App\Models\BusinessDay;
use App\Models\BusinessDayClosing;
use App\Services\BusinessDayClosingService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

final class BusinessDayClosingController extends Controller
{
    public function __construct(
        private readonly BusinessDayClosingService $closingService
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Current Business Day
    |--------------------------------------------------------------------------
    */

    public function current(
        Request $request
    ): JsonResponse {
        $result =
            $this
            ->closingService
            ->current();

        if (
            $result === null
        ) {
            return ApiResponse::success(
                data: [
                    'business_day' =>
                    null,

                    'blockers' =>
                    null,

                    'summary' =>
                    null,

                    'closing' =>
                    null,
                ],

                message: 'No open restaurant business day was found.'
            );
        }

        return ApiResponse::success(
            data: $this->previewData(
                request: $request,

                result: $result
            ),

            message: 'Current restaurant business day retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Closing Preview
    |--------------------------------------------------------------------------
    */

    public function preview(
        Request $request,
        BusinessDay $businessDay
    ): JsonResponse {
        $result =
            $this
            ->closingService
            ->preview(
                $businessDay
            );

        return ApiResponse::success(
            data: $this->previewData(
                request: $request,

                result: $result
            ),

            message: 'Restaurant day closing preview generated successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Close
    |--------------------------------------------------------------------------
    */

    public function close(
        CloseBusinessDayRequest $request,
        BusinessDay $businessDay
    ): JsonResponse {
        try {
            $result =
                $this
                ->closingService
                ->close(
                    actor: $request->user(),

                    businessDay: $businessDay,

                    data: $request->validated()
                );

            return ApiResponse::success(
                data: [
                    'closing' => (
                        new BusinessDayClosingResource(
                            $result['closing']
                        )
                    )
                        ->resolve(
                            $request
                        ),

                    'closed' =>
                    $result['closed'],
                ],

                message: $result['closed']
                    ? 'Restaurant business day closed successfully.'
                    : 'Existing restaurant day closing returned successfully.'
            );
        } catch (
            BusinessDayClosingException $exception
        ) {
            return ApiResponse::error(
                message: $exception
                    ->getMessage(),

                code: $exception
                    ->errorCode,

                errors: $exception
                    ->errors,

                status: $exception
                    ->status
            );
        } catch (
            Throwable $exception
        ) {
            report(
                $exception
            );

            return ApiResponse::error(
                message: 'Unable to close the restaurant business day.',

                code: 'BUSINESS_DAY_CLOSE_FAILED',

                status: 500
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Historical Closing
    |--------------------------------------------------------------------------
    */

    public function show(
        Request $request,
        BusinessDayClosing $businessDayClosing
    ): JsonResponse {
        $businessDayClosing
            ->load([
                'businessDay.openedBy',
                'businessDay.closedBy',
                'closedBy',
            ]);

        return ApiResponse::success(
            data: (
                new BusinessDayClosingResource(
                    $businessDayClosing
                )
            )
                ->resolve(
                    $request
                ),

            message: 'Restaurant day closing retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Preview Serializer
    |--------------------------------------------------------------------------
    */

    private function previewData(
        Request $request,
        array $result
    ): array {
        return [
            'business_day' => (
                new BusinessDayResource(
                    $result['business_day']
                )
            )
                ->resolve(
                    $request
                ),

            'blockers' =>
            $result['blockers'],

            'summary' =>
            $result['summary'],

            'closing' =>
            $result['closing']
                ? (
                    new BusinessDayClosingResource(
                        $result['closing']
                    )
                )
                ->resolve(
                    $request
                )
                : null,
        ];
    }
}
