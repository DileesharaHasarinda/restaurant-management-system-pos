<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ManagerAuthorizationException;
use App\Exceptions\RefundOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Refunds\CreateRefundRequest;
use App\Http\Resources\RefundResource;
use App\Models\Invoice;
use App\Models\Refund;
use App\Services\RefundService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

final class RefundController extends Controller
{
    public function __construct(
        private readonly RefundService $refundService
    ) {}

    public function index(
        Request $request,
        Invoice $invoice
    ): JsonResponse {
        $refunds =
            Refund::query()
            ->where(
                'invoice_id',
                $invoice->id
            )
            ->with([
                'initiatedBy',
                'authorizedBy',
                'processedBy',
            ])
            ->latest('id')
            ->get();

        return ApiResponse::success(
            data: $refunds
                ->map(
                    fn(Refund $refund): array => (
                        new RefundResource(
                            $refund
                        )
                    )->resolve(
                        $request
                    )
                )
                ->values()
                ->all(),

            message: 'Invoice refunds retrieved successfully.'
        );
    }

    public function store(
        CreateRefundRequest $request,
        Invoice $invoice
    ): JsonResponse {
        try {
            $result =
                $this
                ->refundService
                ->create(
                    invoice: $invoice,

                    initiator: $request->user(),

                    data: $request->validated()
                );

            return ApiResponse::success(
                data: [
                    'refund' => (
                        new RefundResource(
                            $result['refund']
                        )
                    )->resolve(
                        $request
                    ),

                    'created' =>
                    $result['created'],

                    'cash_drawer' =>
                    $result['cash_drawer'],
                ],

                message: $result['created']
                    ? 'Refund completed successfully.'
                    : 'Existing refund request returned successfully.',

                status: $result['created']
                    ? 201
                    : 200
            );
        } catch (
            RefundOperationException |
            ManagerAuthorizationException
            $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                errors: $exception->errors,

                status: $exception->status
            );
        } catch (
            Throwable $exception
        ) {
            report(
                $exception
            );

            return ApiResponse::error(
                message: 'Unable to process the refund.',

                code: 'REFUND_FAILED',

                status: 500
            );
        }
    }

    public function show(
        Request $request,
        Refund $refund
    ): JsonResponse {
        $refund->load([
            'initiatedBy',
            'authorizedBy',
            'processedBy',
        ]);

        return ApiResponse::success(
            data: (
                new RefundResource(
                    $refund
                )
            )->resolve(
                $request
            ),

            message: 'Refund retrieved successfully.'
        );
    }
}
