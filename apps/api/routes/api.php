<?php

use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\FoundationController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\RolePermissionController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\UserSessionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API V1
|--------------------------------------------------------------------------
|
| bootstrap/app.php adds:
|
| /api/v1
|
*/

Route::middleware(
    'throttle:api'
)->group(function (): void {

    /*
     * ------------------------------------------------
     * Public
     * ------------------------------------------------
     */

    Route::get(
        '/health',
        [
            HealthController::class,
            'show',
        ]
    )->name('v1.health');

    /*
     * ------------------------------------------------
     * Authentication
     * ------------------------------------------------
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

                    Route::put(
                        '/password',
                        [
                            AuthController::class,
                            'changePassword',
                        ]
                    )->name(
                        'password.change'
                    );

                    Route::get(
                        '/sessions',
                        [
                            AuthController::class,
                            'sessions',
                        ]
                    )->name(
                        'sessions.index'
                    );

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

                    Route::post(
                        '/revoke-other-sessions',
                        [
                            AuthController::class,
                            'revokeOtherSessions',
                        ]
                    )->name(
                        'sessions.revoke-others'
                    );

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
                    )->name(
                        'logout-all'
                    );
                }
            );
        });

    /*
     * ------------------------------------------------
     * Authenticated APIs
     * ------------------------------------------------
     */

    Route::middleware([
        'auth:sanctum',
        'active',
    ])->group(function (): void {

        /*
         * --------------------------------------------
         * Roles & Permissions
         * --------------------------------------------
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
            ->name('v1.roles.index');

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
         * --------------------------------------------
         * Users
         * --------------------------------------------
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
            ->name('v1.users.index');

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
            ->name('v1.users.store');

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
            ->name('v1.users.show');

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
            ->name('v1.users.update');

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
         * --------------------------------------------
         * Administrative session management
         * --------------------------------------------
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

        Route::delete(
            '/users/{user}/sessions/{tokenId}',
            [
                UserSessionController::class,
                'destroy',
            ]
        )
            ->whereNumber('tokenId')
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
            ->middleware(
                'permission:users.sessions.revoke'
            )
            ->name(
                'v1.users.sessions.destroy-all'
            );

        /*
         * --------------------------------------------
         * Foundation
         * --------------------------------------------
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
