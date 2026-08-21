<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\FoundationController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\RestaurantSettingsController;
use App\Http\Controllers\Api\V1\RolePermissionController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\UserSessionController;
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
    |--------------------------------------------------------------------------
    | Public API
    |--------------------------------------------------------------------------
    */

    Route::get(
        '/health',
        [
            HealthController::class,
            'show',
        ]
    )->name(
        'v1.health'
    );

    /*
     * Public restaurant information.
     *
     * Used by:
     * - Public website
     * - QR ordering website
     *
     * No authentication required.
     */
    Route::get(
        '/public/restaurant-settings',
        [
            RestaurantSettingsController::class,
            'publicShow',
        ]
    )->name(
        'v1.public.restaurant-settings'
    );

    /*
    |--------------------------------------------------------------------------
    | Authentication
    |--------------------------------------------------------------------------
    */

    Route::prefix('auth')
        ->name('v1.auth.')
        ->group(function (): void {

            /*
             * Login
             */
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
                ->name(
                    'login'
                );

            /*
             * Authenticated user endpoints.
             */
            Route::middleware([
                'auth:sanctum',
                'active',
            ])->group(
                function (): void {

                    /*
                     * Current user.
                     */
                    Route::get(
                        '/me',
                        [
                            AuthController::class,
                            'me',
                        ]
                    )->name(
                        'me'
                    );

                    /*
                     * Change own password.
                     */
                    Route::put(
                        '/password',
                        [
                            AuthController::class,
                            'changePassword',
                        ]
                    )->name(
                        'password.change'
                    );

                    /*
                     * Own active sessions.
                     */
                    Route::get(
                        '/sessions',
                        [
                            AuthController::class,
                            'sessions',
                        ]
                    )->name(
                        'sessions.index'
                    );

                    /*
                     * Revoke one own session/token.
                     */
                    Route::delete(
                        '/sessions/{tokenId}',
                        [
                            AuthController::class,
                            'revokeSession',
                        ]
                    )
                        ->whereNumber(
                            'tokenId'
                        )
                        ->name(
                            'sessions.destroy'
                        );

                    /*
                     * Revoke all other sessions.
                     */
                    Route::post(
                        '/revoke-other-sessions',
                        [
                            AuthController::class,
                            'revokeOtherSessions',
                        ]
                    )->name(
                        'sessions.revoke-others'
                    );

                    /*
                     * Logout current session.
                     */
                    Route::post(
                        '/logout',
                        [
                            AuthController::class,
                            'logout',
                        ]
                    )->name(
                        'logout'
                    );

                    /*
                     * Logout all devices.
                     */
                    Route::post(
                        '/logout-all',
                        [
                            AuthController::class,
                            'logoutAll',
                        ]
                    )->name(
                        'logout-all'
                    );
                }
            );
        });

    /*
    |--------------------------------------------------------------------------
    | Authenticated API
    |--------------------------------------------------------------------------
    */

    Route::middleware([
        'auth:sanctum',
        'active',
    ])->group(function (): void {

        /*
        |--------------------------------------------------------------------------
        | Roles
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/roles',
            [
                RolePermissionController::class,
                'roles',
            ]
        )
            ->middleware(
                'permission:roles.view'
            )
            ->name(
                'v1.roles.index'
            );

        /*
        |--------------------------------------------------------------------------
        | Permissions
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/permissions',
            [
                RolePermissionController::class,
                'permissions',
            ]
        )
            ->middleware(
                'permission:permissions.view'
            )
            ->name(
                'v1.permissions.index'
            );

        /*
        |--------------------------------------------------------------------------
        | Users
        |--------------------------------------------------------------------------
        */

        /*
         * List users.
         */
        Route::get(
            '/users',
            [
                UserController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:users.view'
            )
            ->name(
                'v1.users.index'
            );

        /*
         * Create user.
         */
        Route::post(
            '/users',
            [
                UserController::class,
                'store',
            ]
        )
            ->middleware(
                'permission:users.create'
            )
            ->name(
                'v1.users.store'
            );

        /*
         * View user.
         */
        Route::get(
            '/users/{user}',
            [
                UserController::class,
                'show',
            ]
        )
            ->middleware(
                'permission:users.view'
            )
            ->name(
                'v1.users.show'
            );

        /*
         * Update user.
         */
        Route::put(
            '/users/{user}',
            [
                UserController::class,
                'update',
            ]
        )
            ->middleware(
                'permission:users.update'
            )
            ->name(
                'v1.users.update'
            );

        /*
         * Activate / deactivate user.
         */
        Route::patch(
            '/users/{user}/status',
            [
                UserController::class,
                'updateStatus',
            ]
        )
            ->middleware(
                'permission:users.status'
            )
            ->name(
                'v1.users.status'
            );

        /*
         * Assign role.
         */
        Route::patch(
            '/users/{user}/role',
            [
                UserController::class,
                'assignRole',
            ]
        )
            ->middleware(
                'permission:users.role'
            )
            ->name(
                'v1.users.role'
            );

        /*
        |--------------------------------------------------------------------------
        | User Session Administration
        |--------------------------------------------------------------------------
        */

        /*
         * List another user's sessions.
         */
        Route::get(
            '/users/{user}/sessions',
            [
                UserSessionController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:users.sessions.revoke'
            )
            ->name(
                'v1.users.sessions.index'
            );

        /*
         * Revoke one user session.
         */
        Route::delete(
            '/users/{user}/sessions/{tokenId}',
            [
                UserSessionController::class,
                'destroy',
            ]
        )
            ->whereNumber(
                'tokenId'
            )
            ->middleware(
                'permission:users.sessions.revoke'
            )
            ->name(
                'v1.users.sessions.destroy'
            );

        /*
         * Revoke all user sessions.
         */
        Route::delete(
            '/users/{user}/sessions',
            [
                UserSessionController::class,
                'destroyAll',
            ]
        )
            ->middleware(
                'permission:users.sessions.revoke'
            )
            ->name(
                'v1.users.sessions.destroy-all'
            );

        /*
        |--------------------------------------------------------------------------
        | Restaurant Settings
        |--------------------------------------------------------------------------
        */

        /*
         * Get complete restaurant settings.
         */
        Route::get(
            '/restaurant/settings',
            [
                RestaurantSettingsController::class,
                'show',
            ]
        )
            ->middleware(
                'permission:restaurant.manage'
            )
            ->name(
                'v1.restaurant.settings.show'
            );

        /*
         * Update restaurant settings.
         */
        Route::put(
            '/restaurant/settings',
            [
                RestaurantSettingsController::class,
                'update',
            ]
        )
            ->middleware(
                'permission:restaurant.manage'
            )
            ->name(
                'v1.restaurant.settings.update'
            );

        /*
         * Upload restaurant logo.
         */
        Route::post(
            '/restaurant/settings/logo',
            [
                RestaurantSettingsController::class,
                'uploadLogo',
            ]
        )
            ->middleware(
                'permission:restaurant.manage'
            )
            ->name(
                'v1.restaurant.settings.logo.upload'
            );

        /*
         * Remove restaurant logo.
         */
        Route::delete(
            '/restaurant/settings/logo',
            [
                RestaurantSettingsController::class,
                'removeLogo',
            ]
        )
            ->middleware(
                'permission:restaurant.manage'
            )
            ->name(
                'v1.restaurant.settings.logo.remove'
            );

        /*
        |--------------------------------------------------------------------------
        | System Foundation
        |--------------------------------------------------------------------------
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
