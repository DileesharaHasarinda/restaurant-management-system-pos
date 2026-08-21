<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\TableOperationException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Tables\CloseTableSessionRequest;
use App\Http\Requests\Api\V1\Tables\OpenTableSessionRequest;
use App\Http\Resources\TableSessionResource;
use App\Models\RestaurantTable;
use App\Models\TableSession;
use App\Models\User;
use App\Services\TableSessionService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TableSessionController extends Controller
{
    public function __construct(
        private readonly TableSessionService $sessionService
    ) {}

    public function current(
        RestaurantTable $table
    ): JsonResponse {
        $session =
            $this->sessionService
            ->current(
                $table
            );

        return ApiResponse::success(
            data: $session
                ? new TableSessionResource(
                    $session
                )
                : null,

            message: $session
                ? 'Current table session retrieved.'
                : 'This table has no open session.'
        );
    }

    public function open(
        OpenTableSessionRequest $request,
        RestaurantTable $table
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $result =
                $this->sessionService
                ->openForStaff(
                    $table,
                    $user,
                    (int)
                    $request
                        ->validated()['guest_count']
                );
        } catch (
            TableOperationException $exception
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
                new TableSessionResource(
                    $result['session']
                )
            )->resolve(
                $request
            ),

            message: $result['created']
                ? 'Table session opened successfully.'
                : 'Existing table session retrieved.',

            status: $result['created']
                ? 201
                : 200
        );
    }

    public function close(
        CloseTableSessionRequest $request,
        TableSession $session
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        try {
            $session =
                $this->sessionService
                ->close(
                    $session,
                    $user,
                    $request
                        ->validated()['reason']
                        ?? null
                );
        } catch (
            TableOperationException $exception
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
                new TableSessionResource(
                    $session
                )
            )->resolve(
                $request
            ),

            message: 'Table session closed successfully.'
        );
    }
}
