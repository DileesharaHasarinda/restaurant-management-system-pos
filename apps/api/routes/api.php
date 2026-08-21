<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\FoundationController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\PublicTableQrController;
use App\Http\Controllers\Api\V1\RestaurantSettingsController;
use App\Http\Controllers\Api\V1\RolePermissionController;
use App\Http\Controllers\Api\V1\TableController;
use App\Http\Controllers\Api\V1\TableQrController;
use App\Http\Controllers\Api\V1\TableSessionController;
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

    /*
     * Health check.
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
    | Public Table QR
    |--------------------------------------------------------------------------
    */

    /*
     * Validate / resolve table QR.
     */
    Route::get(
        '/public/table-qr/{token}',
        [
            PublicTableQrController::class,
            'resolve',
        ]
    )
        ->middleware(
            'throttle:table-qr'
        )
        ->where(
            'token',
            '[A-Fa-f0-9]{32}'
        )
        ->name(
            'v1.public.table-qr.resolve'
        );

    /*
     * Open or retrieve table session
     * from public QR ordering.
     */
    Route::post(
        '/public/table-qr/{token}/session',
        [
            PublicTableQrController::class,
            'openSession',
        ]
    )
        ->middleware(
            'throttle:public-table-session'
        )
        ->where(
            'token',
            '[A-Fa-f0-9]{32}'
        )
        ->name(
            'v1.public.table-qr.session'
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
             * Login.
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
             * Authenticated user's own
             * authentication endpoints.
             */
            Route::middleware([
                'auth:sanctum',
                'active',
            ])->group(
                function (): void {

                    /*
                     * Current authenticated user.
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
                     * Change current user's password.
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
                     * Current user's active
                     * Sanctum sessions.
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
                     * Revoke one own session.
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
                     * Revoke all sessions except
                     * the current one.
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
                     * Logout all sessions/devices.
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

        Route::get(
            '/users/{user}',
            [
                UserController::class,
                'show',
            ]
        )
            ->whereNumber(
                'user'
            )
            ->middleware(
                'permission:users.view'
            )
            ->name(
                'v1.users.show'
            );

        Route::put(
            '/users/{user}',
            [
                UserController::class,
                'update',
            ]
        )
            ->whereNumber(
                'user'
            )
            ->middleware(
                'permission:users.update'
            )
            ->name(
                'v1.users.update'
            );

        Route::patch(
            '/users/{user}/status',
            [
                UserController::class,
                'updateStatus',
            ]
        )
            ->whereNumber(
                'user'
            )
            ->middleware(
                'permission:users.status'
            )
            ->name(
                'v1.users.status'
            );

        Route::patch(
            '/users/{user}/role',
            [
                UserController::class,
                'assignRole',
            ]
        )
            ->whereNumber(
                'user'
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

        Route::get(
            '/users/{user}/sessions',
            [
                UserSessionController::class,
                'index',
            ]
        )
            ->whereNumber(
                'user'
            )
            ->middleware(
                'permission:users.sessions.revoke'
            )
            ->name(
                'v1.users.sessions.index'
            );

        Route::delete(
            '/users/{user}/sessions/{tokenId}',
            [
                UserSessionController::class,
                'destroy',
            ]
        )
            ->whereNumber(
                'user'
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

        Route::delete(
            '/users/{user}/sessions',
            [
                UserSessionController::class,
                'destroyAll',
            ]
        )
            ->whereNumber(
                'user'
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
        | Table Management
        |--------------------------------------------------------------------------
        */

        /*
         * List tables.
         */
        Route::get(
            '/tables',
            [
                TableController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:tables.view'
            )
            ->name(
                'v1.tables.index'
            );

        /*
         * Create table.
         */
        Route::post(
            '/tables',
            [
                TableController::class,
                'store',
            ]
        )
            ->middleware(
                'permission:tables.manage'
            )
            ->name(
                'v1.tables.store'
            );

        /*
         * View table.
         */
        Route::get(
            '/tables/{table}',
            [
                TableController::class,
                'show',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.view'
            )
            ->name(
                'v1.tables.show'
            );

        /*
         * Update table.
         */
        Route::put(
            '/tables/{table}',
            [
                TableController::class,
                'update',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.manage'
            )
            ->name(
                'v1.tables.update'
            );

        /*
         * Manually update non-session status.
         */
        Route::patch(
            '/tables/{table}/status',
            [
                TableController::class,
                'updateStatus',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.manage'
            )
            ->name(
                'v1.tables.status'
            );

        /*
         * Enable / disable QR ordering.
         */
        Route::patch(
            '/tables/{table}/qr-ordering',
            [
                TableController::class,
                'updateQrOrdering',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.manage'
            )
            ->name(
                'v1.tables.qr-ordering'
            );

        /*
        |--------------------------------------------------------------------------
        | Table QR Management
        |--------------------------------------------------------------------------
        */

        /*
         * Get QR token information.
         */
        Route::get(
            '/tables/{table}/qr',
            [
                TableQrController::class,
                'show',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.view'
            )
            ->name(
                'v1.tables.qr.show'
            );

        /*
         * Regenerate QR token.
         */
        Route::post(
            '/tables/{table}/qr/regenerate',
            [
                TableQrController::class,
                'regenerate',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.manage'
            )
            ->name(
                'v1.tables.qr.regenerate'
            );

        /*
         * SVG QR preview.
         */
        Route::get(
            '/tables/{table}/qr/svg',
            [
                TableQrController::class,
                'svg',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.view'
            )
            ->name(
                'v1.tables.qr.svg'
            );

        /*
         * SVG QR download.
         */
        Route::get(
            '/tables/{table}/qr/download',
            [
                TableQrController::class,
                'download',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.view'
            )
            ->name(
                'v1.tables.qr.download'
            );

        /*
         * Printable QR page.
         */
        Route::get(
            '/tables/{table}/qr/print',
            [
                TableQrController::class,
                'print',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.view'
            )
            ->name(
                'v1.tables.qr.print'
            );

        /*
        |--------------------------------------------------------------------------
        | Table Sessions
        |--------------------------------------------------------------------------
        */

        /*
         * Current open session.
         */
        Route::get(
            '/tables/{table}/session',
            [
                TableSessionController::class,
                'current',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.view'
            )
            ->name(
                'v1.tables.session.current'
            );

        /*
         * Staff opens / retrieves session.
         */
        Route::post(
            '/tables/{table}/session',
            [
                TableSessionController::class,
                'open',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.manage'
            )
            ->name(
                'v1.tables.session.open'
            );

        /*
         * Close table session.
         */
        Route::post(
            '/table-sessions/{session}/close',
            [
                TableSessionController::class,
                'close',
            ]
        )
            ->whereNumber(
                'session'
            )
            ->middleware(
                'permission:tables.manage'
            )
            ->name(
                'v1.table-sessions.close'
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
