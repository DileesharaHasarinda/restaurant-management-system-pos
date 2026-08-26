<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\KitchenPrintException;
use App\Http\Controllers\Controller;
use App\Http\Resources\KitchenPrintJobResource;
use App\Models\KitchenPrintJob;
use App\Models\User;
use App\Services\KitchenPrintService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Throwable;

class KitchenPrintJobController extends Controller
{
    public function __construct(
        private readonly KitchenPrintService $kitchenPrintService
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Print Job History
    |--------------------------------------------------------------------------
    */

    public function index(
        Request $request
    ): JsonResponse {
        $data =
            $request->validate([
                'status' => [
                    'nullable',
                    'string',
                    Rule::in(
                        KitchenPrintJob::STATUSES
                    ),
                ],

                'job_type' => [
                    'nullable',
                    'string',
                    Rule::in(
                        KitchenPrintJob::TYPES
                    ),
                ],

                'order_id' => [
                    'nullable',
                    'integer',
                    'min:1',
                ],

                'per_page' => [
                    'nullable',
                    'integer',
                    'min:1',
                    'max:100',
                ],
            ]);

        $query =
            KitchenPrintJob::query()
            ->latest(
                'id'
            );

        if (
            filled(
                $data['status']
                    ?? null
            )
        ) {
            $query->where(
                'status',
                $data['status']
            );
        }

        if (
            filled(
                $data['job_type']
                    ?? null
            )
        ) {
            $query->where(
                'job_type',
                $data['job_type']
            );
        }

        if (
            filled(
                $data['order_id']
                    ?? null
            )
        ) {
            $query->where(
                'order_id',
                $data['order_id']
            );
        }

        $jobs =
            $query->paginate(
                $data['per_page']
                    ?? 30
            );

        $items =
            collect(
                $jobs->items()
            )
            ->map(
                fn(KitchenPrintJob $job) => (
                    new KitchenPrintJobResource(
                        $job
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $items,

            message: 'Kitchen print jobs retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $jobs->currentPage(),

                    'per_page' =>
                    $jobs->perPage(),

                    'total' =>
                    $jobs->total(),

                    'last_page' =>
                    $jobs->lastPage(),
                ],
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Claim Next
    |--------------------------------------------------------------------------
    */

    public function claimNext(
        Request $request
    ): JsonResponse {
        $data =
            $request->validate([
                'printer_name' => [
                    'nullable',
                    'string',
                    'max:190',
                ],

                'printer_address' => [
                    'nullable',
                    'string',
                    'max:190',
                ],
            ]);

        /** @var User $user */
        $user =
            $request->user();

        try {
            $job =
                $this
                ->kitchenPrintService
                ->claimNext(
                    actor: $user,

                    printerName: $data['printer_name']
                        ?? null,

                    printerAddress: $data['printer_address']
                        ?? null
                );
        } catch (
            KitchenPrintException $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                status: $exception->status
            );
        } catch (
            Throwable $exception
        ) {
            report(
                $exception
            );

            return ApiResponse::error(
                message: 'The next kitchen print job could not be claimed.',

                code: 'KITCHEN_PRINT_CLAIM_FAILED',

                status: 500
            );
        }

        if (! $job) {
            return ApiResponse::success(
                data: null,

                message: 'No kitchen print jobs are currently pending.'
            );
        }

        return ApiResponse::success(
            data: (
                new KitchenPrintJobResource(
                    $job
                )
            )->resolve(
                $request
            ),

            message: 'Kitchen print job claimed successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Printed
    |--------------------------------------------------------------------------
    */

    public function printed(
        Request $request,
        KitchenPrintJob $kitchenPrintJob
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $job =
                $this
                ->kitchenPrintService
                ->markPrinted(
                    job: $kitchenPrintJob,

                    actor: $user
                );
        } catch (
            KitchenPrintException $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                status: $exception->status
            );
        } catch (
            Throwable $exception
        ) {
            report(
                $exception
            );

            return ApiResponse::error(
                message: 'The kitchen print result could not be recorded.',

                code: 'KITCHEN_PRINT_ACKNOWLEDGEMENT_FAILED',

                status: 500
            );
        }

        return ApiResponse::success(
            data: (
                new KitchenPrintJobResource(
                    $job
                )
            )->resolve(
                $request
            ),

            message: 'Kitchen print job marked as printed.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Failed
    |--------------------------------------------------------------------------
    */

    public function failed(
        Request $request,
        KitchenPrintJob $kitchenPrintJob
    ): JsonResponse {
        $data =
            $request->validate([
                'error' => [
                    'required',
                    'string',
                    'max:2000',
                ],
            ]);

        /** @var User $user */
        $user =
            $request->user();

        try {
            $job =
                $this
                ->kitchenPrintService
                ->markFailed(
                    job: $kitchenPrintJob,

                    actor: $user,

                    error: $data['error']
                );
        } catch (
            KitchenPrintException $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                status: $exception->status
            );
        } catch (
            Throwable $exception
        ) {
            report(
                $exception
            );

            return ApiResponse::error(
                message: 'The kitchen print failure could not be recorded.',

                code: 'KITCHEN_PRINT_FAILURE_UPDATE_FAILED',

                status: 500
            );
        }

        return ApiResponse::success(
            data: (
                new KitchenPrintJobResource(
                    $job
                )
            )->resolve(
                $request
            ),

            message: 'Kitchen print job marked as failed.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Retry
    |--------------------------------------------------------------------------
    */

    public function retry(
        Request $request,
        KitchenPrintJob $kitchenPrintJob
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $job =
                $this
                ->kitchenPrintService
                ->retry(
                    job: $kitchenPrintJob,

                    actor: $user
                );
        } catch (
            KitchenPrintException $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                status: $exception->status
            );
        } catch (
            Throwable $exception
        ) {
            report(
                $exception
            );

            return ApiResponse::error(
                message: 'The kitchen print job could not be retried.',

                code: 'KITCHEN_PRINT_RETRY_FAILED',

                status: 500
            );
        }

        return ApiResponse::success(
            data: (
                new KitchenPrintJobResource(
                    $job
                )
            )->resolve(
                $request
            ),

            message: 'Kitchen print job queued for retry.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Reprint
    |--------------------------------------------------------------------------
    */

    public function reprint(
        Request $request,
        KitchenPrintJob $kitchenPrintJob
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $job =
                $this
                ->kitchenPrintService
                ->reprint(
                    source: $kitchenPrintJob,

                    actor: $user
                );
        } catch (
            KitchenPrintException $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                status: $exception->status
            );
        } catch (
            Throwable $exception
        ) {
            report(
                $exception
            );

            return ApiResponse::error(
                message: 'The kitchen print job could not be reprinted.',

                code: 'KITCHEN_PRINT_REPRINT_FAILED',

                status: 500
            );
        }

        return ApiResponse::success(
            data: (
                new KitchenPrintJobResource(
                    $job
                )
            )->resolve(
                $request
            ),

            message: 'Kitchen reprint queued successfully.'
        );
    }
}
