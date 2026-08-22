<?php

use App\Http\Controllers\Api\V1\AddonController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\FoundationController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\MenuCategoryController;
use App\Http\Controllers\Api\V1\MenuItemController;
use App\Http\Controllers\Api\V1\PublicMenuController;
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
| bootstrap/app.php automatically adds the prefix:
|
| /api/v1
|
| Therefore:
|
| Route::get('/health', ...)
|
| becomes:
|
| GET /api/v1/health
|
|--------------------------------------------------------------------------
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
     * API health check.
     *
     * GET /api/v1/health
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
    |--------------------------------------------------------------------------
    | Public Restaurant Settings
    |--------------------------------------------------------------------------
    |
    | Used by:
    | - Public website
    | - QR ordering website
    |
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
    | Public Menu
    |--------------------------------------------------------------------------
    |
    | Website menu and QR menu are intentionally separated.
    |
    | This allows:
    |
    | is_visible_on_website
    | is_visible_on_qr
    |
    | to work independently.
    |
    */

    /*
     * Public website menu.
     *
     * GET /api/v1/public/menu/website
     */
    Route::get(
        '/public/menu/website',
        [
            PublicMenuController::class,
            'website',
        ]
    )->name(
        'v1.public.menu.website'
    );

    /*
     * QR ordering menu.
     *
     * GET /api/v1/public/menu/qr
     */
    Route::get(
        '/public/menu/qr',
        [
            PublicMenuController::class,
            'qr',
        ]
    )->name(
        'v1.public.menu.qr'
    );

    /*
    |--------------------------------------------------------------------------
    | Public Table QR
    |--------------------------------------------------------------------------
    */

    /*
     * Resolve and validate a table QR token.
     *
     * GET /api/v1/public/table-qr/{token}
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
     * Open or retrieve a table session
     * through a customer QR code.
     *
     * POST /api/v1/public/table-qr/{token}/session
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
             *
             * POST /api/v1/auth/login
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
             * Authenticated user's own endpoints.
             */
            Route::middleware([
                'auth:sanctum',
                'active',
            ])->group(
                function (): void {

                    /*
                     * Current authenticated user.
                     *
                     * GET /api/v1/auth/me
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
                     *
                     * PUT /api/v1/auth/password
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
                     * List own active Sanctum tokens.
                     *
                     * GET /api/v1/auth/sessions
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
                     *
                     * DELETE /api/v1/auth/sessions/{tokenId}
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
                     * Revoke all other sessions
                     * while keeping current session.
                     *
                     * POST /api/v1/auth/revoke-other-sessions
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
                     *
                     * POST /api/v1/auth/logout
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
                     *
                     * POST /api/v1/auth/logout-all
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
         * View one user.
         */
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
            ->whereNumber(
                'user'
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
            ->whereNumber(
                'user'
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
            ->whereNumber(
                'user'
            )
            ->middleware(
                'permission:users.sessions.revoke'
            )
            ->name(
                'v1.users.sessions.index'
            );

        /*
         * Revoke one user's session.
         */
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

        /*
         * Revoke all sessions belonging to a user.
         */
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

        /*
         * Retrieve complete restaurant configuration.
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
         * Update restaurant configuration.
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
         * View one table.
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
         * Update table status.
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
         * Retrieve QR information.
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
         * Regenerate secure QR token.
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
         * Download QR as SVG.
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
         * Current open table session.
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
         * Staff opens or retrieves table session.
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
        | Menu Categories
        |--------------------------------------------------------------------------
        */

        /*
         * List categories.
         *
         * Supports search.
         */
        Route::get(
            '/menu/categories',
            [
                MenuCategoryController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:menu.view'
            )
            ->name(
                'v1.menu.categories.index'
            );

        /*
         * Create category.
         */
        Route::post(
            '/menu/categories',
            [
                MenuCategoryController::class,
                'store',
            ]
        )
            ->middleware(
                'permission:menu.manage'
            )
            ->name(
                'v1.menu.categories.store'
            );

        /*
         * View category.
         */
        Route::get(
            '/menu/categories/{category}',
            [
                MenuCategoryController::class,
                'show',
            ]
        )
            ->whereNumber(
                'category'
            )
            ->middleware(
                'permission:menu.view'
            )
            ->name(
                'v1.menu.categories.show'
            );

        /*
         * Edit category.
         */
        Route::put(
            '/menu/categories/{category}',
            [
                MenuCategoryController::class,
                'update',
            ]
        )
            ->whereNumber(
                'category'
            )
            ->middleware(
                'permission:menu.manage'
            )
            ->name(
                'v1.menu.categories.update'
            );

        /*
         * Category state:
         *
         * - active / inactive
         * - website visibility
         * - QR visibility
         * - sort order
         */
        Route::patch(
            '/menu/categories/{category}/state',
            [
                MenuCategoryController::class,
                'updateState',
            ]
        )
            ->whereNumber(
                'category'
            )
            ->middleware(
                'permission:menu.manage'
            )
            ->name(
                'v1.menu.categories.state'
            );

        /*
        |--------------------------------------------------------------------------
        | Menu Items
        |--------------------------------------------------------------------------
        */

        /*
         * List/search/filter menu items.
         */
        Route::get(
            '/menu/items',
            [
                MenuItemController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:menu.view'
            )
            ->name(
                'v1.menu.items.index'
            );

        /*
         * Create menu item with optional:
         *
         * - variants
         * - add-ons
         */
        Route::post(
            '/menu/items',
            [
                MenuItemController::class,
                'store',
            ]
        )
            ->middleware(
                'permission:menu.manage'
            )
            ->name(
                'v1.menu.items.store'
            );

        /*
         * View menu item.
         */
        Route::get(
            '/menu/items/{menuItem}',
            [
                MenuItemController::class,
                'show',
            ]
        )
            ->whereNumber(
                'menuItem'
            )
            ->middleware(
                'permission:menu.view'
            )
            ->name(
                'v1.menu.items.show'
            );

        /*
         * Update menu item.
         *
         * Includes variants and add-on assignments.
         */
        Route::put(
            '/menu/items/{menuItem}',
            [
                MenuItemController::class,
                'update',
            ]
        )
            ->whereNumber(
                'menuItem'
            )
            ->middleware(
                'permission:menu.manage'
            )
            ->name(
                'v1.menu.items.update'
            );

        /*
         * Menu item operational state.
         *
         * Supports:
         *
         * - activate/deactivate
         * - available/sold out
         * - website visibility
         * - QR visibility
         * - sorting
         */
        Route::patch(
            '/menu/items/{menuItem}/state',
            [
                MenuItemController::class,
                'updateState',
            ]
        )
            ->whereNumber(
                'menuItem'
            )
            ->middleware(
                'permission:menu.manage'
            )
            ->name(
                'v1.menu.items.state'
            );

        /*
         * Upload menu item photo.
         */
        Route::post(
            '/menu/items/{menuItem}/photo',
            [
                MenuItemController::class,
                'uploadPhoto',
            ]
        )
            ->whereNumber(
                'menuItem'
            )
            ->middleware(
                'permission:menu.manage'
            )
            ->name(
                'v1.menu.items.photo.upload'
            );

        /*
         * Remove menu item photo.
         */
        Route::delete(
            '/menu/items/{menuItem}/photo',
            [
                MenuItemController::class,
                'removePhoto',
            ]
        )
            ->whereNumber(
                'menuItem'
            )
            ->middleware(
                'permission:menu.manage'
            )
            ->name(
                'v1.menu.items.photo.remove'
            );

        /*
        |--------------------------------------------------------------------------
        | Add-on Groups
        |--------------------------------------------------------------------------
        */

        /*
         * List add-on groups and their add-ons.
         */
        Route::get(
            '/menu/addon-groups',
            [
                AddonController::class,
                'groups',
            ]
        )
            ->middleware(
                'permission:menu.view'
            )
            ->name(
                'v1.menu.addon-groups.index'
            );

        /*
         * Create add-on group.
         *
         * Example:
         *
         * Extras
         */
        Route::post(
            '/menu/addon-groups',
            [
                AddonController::class,
                'storeGroup',
            ]
        )
            ->middleware(
                'permission:menu.manage'
            )
            ->name(
                'v1.menu.addon-groups.store'
            );

        /*
        |--------------------------------------------------------------------------
        | Add-ons
        |--------------------------------------------------------------------------
        */

        /*
         * List/search add-ons.
         *
         * Examples:
         *
         * Extra Chicken
         * Cheese
         * Egg
         * Extra Sauce
         */
        Route::get(
            '/menu/addons',
            [
                AddonController::class,
                'addons',
            ]
        )
            ->middleware(
                'permission:menu.view'
            )
            ->name(
                'v1.menu.addons.index'
            );

        /*
         * Create add-on.
         */
        Route::post(
            '/menu/addons',
            [
                AddonController::class,
                'storeAddon',
            ]
        )
            ->middleware(
                'permission:menu.manage'
            )
            ->name(
                'v1.menu.addons.store'
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
