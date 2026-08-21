<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\FoundationController;
use App\Http\Controllers\Api\V1\HealthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API V1
|--------------------------------------------------------------------------
|
| bootstrap/app.php automatically adds:
|
| /api/v1
|
*/

Route::middleware(
    'throttle:api'
)->group(function (): void {

    /*
     * Public health endpoint.
     *
     * GET /api/v1/health
     */
    Route::get(
        '/health',
        [HealthController::class, 'show']
    )->name('v1.health');

    /*
     * Authentication
     */
    Route::prefix('auth')
        ->name('v1.auth.')
        ->group(function (): void {
            Route::post(
                '/login',
                [
                    AuthController::class,
                    'login',
                ]
            )
                ->middleware(
                    'throttle:login'
                )
                ->name('login');

            Route::middleware([
                'auth:sanctum',
                'active',
            ])->group(
                function (): void {
                    Route::get(
                        '/me',
                        [
                            AuthController::class,
                            'me',
                        ]
                    )->name('me');

                    Route::post(
                        '/logout',
                        [
                            AuthController::class,
                            'logout',
                        ]
                    )->name('logout');

                    Route::post(
                        '/logout-all',
                        [
                            AuthController::class,
                            'logoutAll',
                        ]
                    )->name('logout-all');
                }
            );
        });

    /*
     * Protected API.
     */
    Route::middleware([
        'auth:sanctum',
        'active',
    ])->group(function (): void {

        /*
         * Foundation verification.
         *
         * Owner/Admin permission.
         */
        Route::get(
            '/system/foundation',
            [
                FoundationController::class,
                'show',
            ]
        )
            ->middleware(
                'permission:audit.view'
            )
            ->name(
                'v1.system.foundation'
            );
    });
});
