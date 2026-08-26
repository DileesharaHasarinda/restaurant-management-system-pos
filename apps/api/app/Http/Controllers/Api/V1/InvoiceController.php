<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\InvoiceOperationException;
use App\Http\Controllers\Controller;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Models\Order;
use App\Models\TableSession;
use App\Services\InvoiceGenerationService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class InvoiceController extends Controller
{
    public function __construct(
        private readonly InvoiceGenerationService $invoiceGenerationService
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Generate Invoice From Order
    |--------------------------------------------------------------------------
    |
    | Takeaway:
    |
    |     creates invoice for this order.
    |
    | Dine-in:
    |
    |     resolves the order's table session and creates ONE final invoice
    |     containing all billable orders from that session.
    |
    */

    public function generateForOrder(
        Request $request,
        Order $order
    ): JsonResponse {
        try {
            $result =
                $this
                ->invoiceGenerationService
                ->generateForOrder(
                    actor: $request->user(),

                    order: $order
                );

            return ApiResponse::success(
                data: [
                    'invoice' =>
                    new InvoiceResource(
                        $result['invoice']
                    ),

                    'created' =>
                    $result['created'],
                ],

                message: $result['created']
                    ? 'Invoice generated successfully.'
                    : 'Existing invoice returned successfully.',

                status: $result['created']
                    ? 201
                    : 200
            );
        } catch (
            InvoiceOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception
                    ->getMessage(),

                code: $exception
                    ->errorCode,

                errors: [],

                status: $exception
                    ->status
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Generate Invoice From Table Session
    |--------------------------------------------------------------------------
    */

    public function generateForTableSession(
        Request $request,
        TableSession $tableSession
    ): JsonResponse {
        try {
            $result =
                $this
                ->invoiceGenerationService
                ->generateForTableSession(
                    actor: $request->user(),

                    tableSession: $tableSession
                );

            return ApiResponse::success(
                data: [
                    'invoice' =>
                    new InvoiceResource(
                        $result['invoice']
                    ),

                    'created' =>
                    $result['created'],
                ],

                message: $result['created']
                    ? 'Final table invoice generated successfully.'
                    : 'Existing final table invoice returned successfully.',

                status: $result['created']
                    ? 201
                    : 200
            );
        } catch (
            InvoiceOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception
                    ->getMessage(),

                code: $exception
                    ->errorCode,

                errors: [],

                status: $exception
                    ->status
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Show Invoice
    |--------------------------------------------------------------------------
    */

    public function show(
        Invoice $invoice
    ): JsonResponse {
        $invoice =
            $this
            ->invoiceGenerationService
            ->loadInvoice(
                $invoice
            );

        return ApiResponse::success(
            data: new InvoiceResource(
                $invoice
            ),

            message: 'Invoice retrieved successfully.'
        );
    }
}
