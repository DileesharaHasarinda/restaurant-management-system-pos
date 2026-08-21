<?php

use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\EnsureUserIsActive;
use App\Support\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\Http\Middleware\CheckAbilities;
use Laravel\Sanctum\Http\Middleware\CheckForAnyAbility;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(
    basePath: dirname(__DIR__)
)
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
        apiPrefix: 'api/v1',
    )

    /*
     * Broadcasting authentication:
     *
     * POST
     * /api/v1/broadcasting/auth
     */
    ->withBroadcasting(
        __DIR__ . '/../routes/channels.php',
        [
            'prefix' => 'api/v1',

            'middleware' => [
                'api',
                'auth:sanctum',
                EnsureUserIsActive::class,
            ],
        ]
    )

    ->withMiddleware(
        function (
            Middleware $middleware
        ): void {
            /*
             * Enables Sanctum's
             * first-party SPA support.
             *
             * Bearer tokens continue
             * to work as well.
             */
            $middleware->statefulApi();

            $middleware->alias([
                'active' =>
                EnsureUserIsActive::class,

                'permission' =>
                EnsurePermission::class,

                'abilities' =>
                CheckAbilities::class,

                'ability' =>
                CheckForAnyAbility::class,
            ]);
        }
    )

    ->withExceptions(
        function (
            Exceptions $exceptions
        ): void {
            $exceptions
                ->dontReportDuplicates();

            $exceptions
                ->shouldRenderJsonWhen(
                    function (
                        Request $request,
                        Throwable $exception
                    ): bool {
                        return $request->is(
                            'api/*'
                        )
                            || $request
                            ->expectsJson();
                    }
                );

            /*
             * Validation
             */
            $exceptions->render(
                function (
                    ValidationException $exception,
                    Request $request
                ) {
                    if (
                        ! $request->is('api/*')
                    ) {
                        return null;
                    }

                    return ApiResponse::error(
                        message: 'The supplied data is invalid.',
                        code: 'VALIDATION_ERROR',
                        errors: $exception->errors(),
                        status: 422
                    );
                }
            );

            /*
             * Authentication
             */
            $exceptions->render(
                function (
                    AuthenticationException $exception,
                    Request $request
                ) {
                    if (
                        ! $request->is('api/*')
                    ) {
                        return null;
                    }

                    return ApiResponse::error(
                        message: 'Authentication is required.',
                        code: 'UNAUTHENTICATED',
                        status: 401
                    );
                }
            );

            /*
             * Authorization
             */
            $exceptions->render(
                function (
                    AuthorizationException $exception,
                    Request $request
                ) {
                    if (
                        ! $request->is('api/*')
                    ) {
                        return null;
                    }

                    return ApiResponse::error(
                        message: 'You are not authorized to perform this action.',
                        code: 'FORBIDDEN',
                        status: 403
                    );
                }
            );

            /*
             * Eloquent model not found
             */
            $exceptions->render(
                function (
                    ModelNotFoundException $exception,
                    Request $request
                ) {
                    if (
                        ! $request->is('api/*')
                    ) {
                        return null;
                    }

                    return ApiResponse::error(
                        message: 'The requested resource was not found.',
                        code: 'RESOURCE_NOT_FOUND',
                        status: 404
                    );
                }
            );

            /*
             * Route not found
             */
            $exceptions->render(
                function (
                    NotFoundHttpException $exception,
                    Request $request
                ) {
                    if (
                        ! $request->is('api/*')
                    ) {
                        return null;
                    }

                    return ApiResponse::error(
                        message: 'The requested API endpoint was not found.',
                        code: 'ENDPOINT_NOT_FOUND',
                        status: 404
                    );
                }
            );

            /*
             * Rate limiting
             */
            $exceptions->render(
                function (
                    ThrottleRequestsException $exception,
                    Request $request
                ) {
                    if (
                        ! $request->is('api/*')
                    ) {
                        return null;
                    }

                    return ApiResponse::error(
                        message: 'Too many requests. Please try again shortly.',
                        code: 'RATE_LIMIT_EXCEEDED',
                        status: 429
                    )->withHeaders(
                        $exception->getHeaders()
                    );
                }
            );

            /*
             * Other HTTP exceptions.
             */
            $exceptions->render(
                function (
                    HttpExceptionInterface $exception,
                    Request $request
                ) {
                    if (
                        ! $request->is('api/*')
                    ) {
                        return null;
                    }

                    $status =
                        $exception
                        ->getStatusCode();

                    $message = match ($status) {
                        400 =>
                        'Bad request.',

                        403 =>
                        'Forbidden.',

                        404 =>
                        'Resource not found.',

                        405 =>
                        'HTTP method not allowed.',

                        409 =>
                        'The request conflicts with the current state.',

                        default =>
                        'The request could not be completed.',
                    };

                    return ApiResponse::error(
                        message: $message,
                        code: 'HTTP_ERROR',
                        status: $status
                    );
                }
            );

            /*
             * Unexpected exceptions.
             *
             * Never expose internal
             * exception details in
             * production.
             */
            $exceptions->render(
                function (
                    Throwable $exception,
                    Request $request
                ) {
                    if (
                        ! $request->is('api/*')
                    ) {
                        return null;
                    }

                    $errors = [];

                    if (config('app.debug')) {
                        $errors = [
                            'exception' =>
                            get_class(
                                $exception
                            ),

                            'message' =>
                            $exception
                                ->getMessage(),
                        ];
                    }

                    return ApiResponse::error(
                        message: 'An unexpected server error occurred.',
                        code: 'INTERNAL_SERVER_ERROR',
                        errors: $errors,
                        status: 500
                    );
                }
            );
        }
    )
    ->create();
