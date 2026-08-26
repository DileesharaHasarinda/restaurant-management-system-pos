<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\PaymentOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Payments\StoreCustomerPaymentsRequest;
use App\Http\Resources\InvoiceResource;
use App\Http\Resources\PaymentResource;
use App\Models\Invoice;
use App\Services\CustomerPaymentService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

final class CustomerPaymentController extends Controller
{
    public function __construct(
        private readonly CustomerPaymentService $customerPaymentService
    ) {}

    public function store(
        StoreCustomerPaymentsRequest $request,
        Invoice $invoice
    ): JsonResponse {
        try {
            $result =
                $this
                ->customerPaymentService
                ->record(
                    actor: $request->user(),

                    invoice: $invoice,

                    data: $request->validated()
                );

            return ApiResponse::success(
                data: [
                    'batch' => [
                        'id' =>
                        $result['batch']->id,

                        'client_request_id' =>
                        $result['batch']->client_request_id,

                        'total_amount' =>
                        (float)
                        $result['batch']->total_amount,

                        'cash_amount' =>
                        (float)
                        $result['batch']->cash_amount,

                        'payment_count' =>
                        (int)
                        $result['batch']->payment_count,

                        'status' =>
                        $result['batch']->status,

                        'processed_at' =>
                        $result['batch']->processed_at
                            ?->toISOString(),
                    ],

                    'payments' =>
                    PaymentResource::collection(
                        $result['payments']
                    )->resolve(),

                    'invoice' =>
                    new InvoiceResource(
                        $result['invoice']
                    ),

                    'cash_drawer' => [
                        'should_open' =>
                        $result['cash_drawer_should_open'],

                        'cash_amount' =>
                        $result['cash_amount'],
                    ],

                    'created' =>
                    $result['created'],
                ],

                message: $result['created']
                    ? 'Customer payment recorded successfully.'
                    : 'Existing customer payment returned successfully.',

                status: $result['created']
                    ? 201
                    : 200
            );
        } catch (
            PaymentOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                errors: [],

                status: $exception->status
            );
        }
    }

    public function index(
        Invoice $invoice
    ): JsonResponse {
        $payments =
            $invoice
            ->payments()
            ->orderBy(
                'paid_at'
            )
            ->orderBy(
                'id'
            )
            ->get();

        return ApiResponse::success(
            data: [
                'invoice_id' =>
                $invoice->id,

                'invoice_number' =>
                $invoice
                    ->invoice_number,

                'payment_status' =>
                $invoice
                    ->payment_status,

                'paid_amount' =>
                (float)
                $invoice
                    ->paid_amount,

                'balance_due' =>
                (float)
                $invoice
                    ->balance_due,

                'payments' =>
                PaymentResource::collection(
                    $payments
                )->resolve(),
            ],

            message: 'Customer payments retrieved successfully.'
        );
    }
}
