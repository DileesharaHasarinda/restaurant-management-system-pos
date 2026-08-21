<?php

namespace App\Support;

use Illuminate\Http\JsonResponse;

final class ApiResponse
{
    public static function success(
        mixed $data = null,
        string $message = 'Request completed successfully.',
        int $status = 200,
        array $meta = []
    ): JsonResponse {
        $payload = [
            'success' => true,
            'message' => $message,
            'data' => $data,
        ];

        if ($meta !== []) {
            $payload['meta'] = $meta;
        }

        return response()->json(
            $payload,
            $status
        );
    }

    public static function error(
        string $message,
        string $code = 'ERROR',
        array $errors = [],
        int $status = 400
    ): JsonResponse {
        return response()->json(
            [
                'success' => false,
                'message' => $message,
                'code' => $code,
                'errors' => $errors,
            ],
            $status
        );
    }
}
