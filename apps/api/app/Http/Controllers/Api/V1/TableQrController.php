<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\TableQrTokenResource;
use App\Models\RestaurantSetting;
use App\Models\RestaurantTable;
use App\Models\User;
use App\Services\TableQrCodeService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class TableQrController extends Controller
{
    public function __construct(
        private readonly TableQrCodeService $qrCodeService
    ) {}

    public function show(
        Request $request,
        RestaurantTable $table
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $token =
            $this->qrCodeService
            ->ensureActiveToken(
                $table,
                $user
            );

        return ApiResponse::success(
            data: (
                new TableQrTokenResource(
                    $token
                )
            )->resolve(
                $request
            ),

            message: 'Table QR information retrieved successfully.'
        );
    }

    public function regenerate(
        Request $request,
        RestaurantTable $table
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $token =
            $this->qrCodeService
            ->regenerate(
                $table,
                $user
            );

        return ApiResponse::success(
            data: (
                new TableQrTokenResource(
                    $token
                )
            )->resolve(
                $request
            ),

            message: 'Table QR code regenerated successfully.'
        );
    }

    public function svg(
        Request $request,
        RestaurantTable $table
    ): Response {
        /** @var User $user */
        $user =
            $request->user();

        $token =
            $this->qrCodeService
            ->ensureActiveToken(
                $table,
                $user
            );

        $svg =
            $this->qrCodeService
            ->svg(
                $token
            );

        return response(
            $svg,
            200,
            [
                'Content-Type' =>
                'image/svg+xml; charset=UTF-8',

                'Content-Disposition' =>
                sprintf(
                    'inline; filename="table-%02d-qr.svg"',
                    $table
                        ->table_number
                ),
            ]
        );
    }

    public function download(
        Request $request,
        RestaurantTable $table
    ): Response {
        /** @var User $user */
        $user =
            $request->user();

        $token =
            $this->qrCodeService
            ->ensureActiveToken(
                $table,
                $user
            );

        $svg =
            $this->qrCodeService
            ->svg(
                $token,
                1000
            );

        return response(
            $svg,
            200,
            [
                'Content-Type' =>
                'image/svg+xml; charset=UTF-8',

                'Content-Disposition' =>
                sprintf(
                    'attachment; filename="table-%02d-qr.svg"',
                    $table
                        ->table_number
                ),
            ]
        );
    }

    public function print(
        Request $request,
        RestaurantTable $table
    ): Response {
        /** @var User $user */
        $user =
            $request->user();

        $token =
            $this->qrCodeService
            ->ensureActiveToken(
                $table,
                $user
            );

        $svg =
            $this->qrCodeService
            ->svg(
                $token,
                800
            );

        $url =
            $this->qrCodeService
            ->orderUrl(
                $token
            );

        $restaurant =
            RestaurantSetting::query()
            ->first();

        $restaurantName =
            e(
                $restaurant
                    ?->business_name
                    ?? 'Restaurant'
            );

        $tableName =
            e(
                $table->name
            );

        $tableNumber =
            (int)
            $table->table_number;

        $safeUrl =
            e($url);

        $html = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width, initial-scale=1"
    >

    <title>{$tableName} QR Code</title>

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            background: #f5f5f5;
            font-family:
                Arial,
                Helvetica,
                sans-serif;
        }

        .toolbar {
            padding: 16px;
            text-align: center;
        }

        .toolbar button {
            border: 0;
            border-radius: 8px;
            padding: 12px 24px;
            font-size: 16px;
            cursor: pointer;
        }

        .sheet {
            width: 148mm;
            min-height: 210mm;
            margin: 0 auto 30px;
            background: white;
            padding: 18mm;
            text-align: center;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .restaurant {
            margin: 0 0 12px;
            font-size: 28px;
            font-weight: 700;
        }

        .table {
            margin: 0;
            font-size: 36px;
            font-weight: 800;
        }

        .instruction {
            margin: 16px 0 24px;
            font-size: 20px;
        }

        .qr {
            width: 100%;
            max-width: 90mm;
            margin: 0 auto;
        }

        .qr svg {
            width: 100%;
            height: auto;
        }

        .url {
            margin-top: 24px;
            font-size: 11px;
            word-break: break-all;
        }

        .number {
            margin-top: 18px;
            font-size: 18px;
            font-weight: 700;
        }

        @media print {
            body {
                background: white;
            }

            .toolbar {
                display: none;
            }

            .sheet {
                margin: 0;
                width: 100%;
                min-height: 100vh;
            }
        }
    </style>
</head>

<body>
    <div class="toolbar">
        <button
            type="button"
            onclick="window.print()"
        >
            Print QR
        </button>
    </div>

    <main class="sheet">
        <h1 class="restaurant">
            {$restaurantName}
        </h1>

        <h2 class="table">
            {$tableName}
        </h2>

        <p class="instruction">
            Scan the QR code to view the menu and place your order.
        </p>

        <div class="qr">
            {$svg}
        </div>

        <div class="number">
            Table {$tableNumber}
        </div>

        <div class="url">
            {$safeUrl}
        </div>
    </main>
</body>
</html>
HTML;

        return response(
            $html,
            200,
            [
                'Content-Type' =>
                'text/html; charset=UTF-8',
            ]
        );
    }
}
