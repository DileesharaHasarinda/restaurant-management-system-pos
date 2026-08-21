<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;

class FoundationController extends Controller
{
    public function show(): JsonResponse
    {
        return ApiResponse::success(
            data: [
                'api_version' =>
                'v1',

                'authentication' =>
                'sanctum',

                'authorization' =>
                'roles_permissions',

                'database' =>
                config(
                    'database.default'
                ),

                'cache' =>
                config(
                    'cache.default'
                ),

                'queue' =>
                config(
                    'queue.default'
                ),

                'broadcasting' =>
                config(
                    'broadcasting.default'
                ),

                'environment' =>
                app()->environment(),
            ],
            message: 'Laravel foundation is operational.'
        );
    }
}
