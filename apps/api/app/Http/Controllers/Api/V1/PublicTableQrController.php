<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\TableOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\PublicApi\OpenPublicTableSessionRequest;
use App\Http\Resources\PublicTableQrResource;
use App\Http\Resources\PublicTableSessionResource;
use App\Models\RestaurantTable;
use App\Services\TableQrCodeService;
use App\Services\TableSessionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicTableQrController extends Controller
{
    public function __construct(
        private readonly TableQrCodeService $qrCodeService,
        private readonly TableSessionService $sessionService
    ) {}

    public function resolve(
        Request $request,
        string $token
    ): JsonResponse {
        try {
            $qrToken =
                $this->qrCodeService
                ->resolve(
                    $token
                );

            $qrToken->loadMissing(
                'restaurantTable.openSession'
            );
        } catch (
            TableOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                status: $exception->status
            );
        }

        return ApiResponse::success(
            data: (
                new PublicTableQrResource(
                    $qrToken
                )
            )->resolve(
                $request
            ),

            message: 'Table QR code validated successfully.'
        );
    }

    public function openSession(
        OpenPublicTableSessionRequest $request,
        string $token
    ): JsonResponse {
        try {
            $qrToken =
                $this->qrCodeService
                ->resolve(
                    $token
                );

            $qrToken->loadMissing(
                'restaurantTable'
            );

            /** @var RestaurantTable|null $restaurantTable */
            $restaurantTable =
                $qrToken->restaurantTable;

            if ($restaurantTable === null) {
                throw new TableOperationException(
                    message: 'The table linked to this QR code could not be found.',

                    errorCode: 'TABLE_NOT_FOUND',

                    status: 404
                );
            }

            $validated =
                $request->validated();

            $guestCount =
                (int)
                (
                    $validated['guest_count']
                    ?? 1
                );

            $result =
                $this->sessionService
                ->openFromQr(
                    table: $restaurantTable,

                    guestCount: $guestCount
                );
        } catch (
            TableOperationException $exception
        ) {
            return ApiResponse::error(
                message: $exception->getMessage(),

                code: $exception->errorCode,

                status: $exception->status
            );
        }

        return ApiResponse::success(
            data: (
                new PublicTableSessionResource(
                    $result['session']
                )
            )->resolve(
                $request
            ),

            message: $result['created']
                ? 'Table session started successfully.'
                : 'Existing table session retrieved.',

            status: $result['created']
                ? 201
                : 200
        );
    }
}
