<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Redis;
use Throwable;

class HealthController extends Controller
{
    public function show(): JsonResponse
    {
        $database = false;
        $redis = false;

        $databaseError = null;
        $redisError = null;

        try {
            DB::connection()->getPdo();
            $database = true;
        } catch (Throwable $exception) {
            $databaseError =
                $exception->getMessage();
        }

        try {
            Redis::connection()
                ->command('ping');

            $redis = true;
        } catch (Throwable $exception) {
            $redisError =
                $exception->getMessage();
        }

        $healthy =
            $database && $redis;

        $data = [
            'application' =>
            config('app.name'),

            'environment' =>
            app()->environment(),

            'api_version' =>
            'v1',

            'services' => [
                'database' => [
                    'connected' =>
                    $database,
                ],

                'redis' => [
                    'connected' =>
                    $redis,
                ],
            ],

            'timestamp' =>
            now()->toISOString(),
        ];

        if (
            app()->isLocal()
            && ! $healthy
        ) {
            $data['debug'] = [
                'database_error' =>
                $databaseError,

                'redis_error' =>
                $redisError,
            ];
        }

        if (! $healthy) {
            return ApiResponse::error(
                message: 'One or more required services are unavailable.',
                code: 'SERVICE_UNAVAILABLE',
                errors: $data,
                status: 503
            );
        }

        return ApiResponse::success(
            data: $data,
            message: 'Restaurant API is healthy.'
        );
    }
}
