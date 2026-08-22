<?php

use App\Http\Controllers\Api\V1\AddonController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\FoundationController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\IngredientController;
use App\Http\Controllers\Api\V1\MenuCategoryController;
use App\Http\Controllers\Api\V1\MenuItemController;
use App\Http\Controllers\Api\V1\PublicMenuController;
use App\Http\Controllers\Api\V1\PublicTableQrController;
use App\Http\Controllers\Api\V1\RestaurantSettingsController;
use App\Http\Controllers\Api\V1\RolePermissionController;
use App\Http\Controllers\Api\V1\TableController;
use App\Http\Controllers\Api\V1\TableQrController;
use App\Http\Controllers\Api\V1\TableSessionController;
use App\Http\Controllers\Api\V1\UnitController;
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
| Route: /health
| URL:   /api/v1/health
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
     * API health check.
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
    | - Customer QR ordering website
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
    | Website menu and QR menu are separated because
    | menu items/categories can have different visibility.
    |
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
     * Validate / resolve a table QR token.
     *
     * Phase 7 QR tokens contain 32 hexadecimal characters.
     */
    Route::get(
        '/public/table-qr/{token}',
        [
            PublicTableQrController::class,
            'resolve',
        ]
    )
        ->where(
            'token',
            '[A-Fa-f0-9]{32}'
        )
        ->middleware(
            'throttle:table-qr'
        )
        ->name(
            'v1.public.table-qr.resolve'
        );

    /*
     * Open or retrieve the current table session
     * when a customer scans a QR code.
     */
    Route::post(
        '/public/table-qr/{token}/session',
        [
            PublicTableQrController::class,
            'openSession',
        ]
    )
        ->where(
            'token',
            '[A-Fa-f0-9]{32}'
        )
        ->middleware(
            'throttle:public-table-session'
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
             * Routes requiring authentication.
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
                     * List current user's active
                     * Sanctum access-token sessions.
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
                     * Revoke one current-user session.
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
                     * Revoke every other session while
                     * keeping the current session.
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
                     * Logout current device/session.
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
         * Manually update statuses such as:
         *
         * AVAILABLE
         * RESERVED
         * CLEANING
         * OUT_OF_SERVICE
         *
         * OCCUPIED remains controlled by Table Session.
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
         * Enable / disable customer QR ordering.
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
         * Staff opens or retrieves a session.
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
         * Used for:
         * - Activate/deactivate
         * - Available/sold out
         * - Website visibility
         * - QR visibility
         * - Sort order
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
         * Upload menu item photograph.
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
         * Remove menu item photograph.
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
        | Inventory — Units
        |--------------------------------------------------------------------------
        |
        | Phase 9
        |
        | Examples:
        |
        | KG -> G
        | L  -> ML
        | PCS
        | BOTTLE
        | PACK
        |
        */

        /*
         * List/search units.
         */
        Route::get(
            '/inventory/units',
            [
                UnitController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:inventory.view'
            )
            ->name(
                'v1.inventory.units.index'
            );

        /*
         * Unit conversion.
         *
         * Important:
         * Keep this explicit route before any future
         * generic POST /inventory/units/{unit} routes.
         */
        Route::post(
            '/inventory/units/convert',
            [
                UnitController::class,
                'convert',
            ]
        )
            ->middleware(
                'permission:inventory.view'
            )
            ->name(
                'v1.inventory.units.convert'
            );

        /*
         * Create unit.
         */
        Route::post(
            '/inventory/units',
            [
                UnitController::class,
                'store',
            ]
        )
            ->middleware(
                'permission:inventory.manage'
            )
            ->name(
                'v1.inventory.units.store'
            );

        /*
         * Update unit.
         */
        Route::put(
            '/inventory/units/{unit}',
            [
                UnitController::class,
                'update',
            ]
        )
            ->whereNumber(
                'unit'
            )
            ->middleware(
                'permission:inventory.manage'
            )
            ->name(
                'v1.inventory.units.update'
            );

        /*
         * Activate/deactivate unit.
         */
        Route::patch(
            '/inventory/units/{unit}/status',
            [
                UnitController::class,
                'updateStatus',
            ]
        )
            ->whereNumber(
                'unit'
            )
            ->middleware(
                'permission:inventory.manage'
            )
            ->name(
                'v1.inventory.units.status'
            );

        /*
        |--------------------------------------------------------------------------
        | Inventory — Ingredients
        |--------------------------------------------------------------------------
        */

        /*
         * List/search/filter ingredients.
         */
        Route::get(
            '/inventory/ingredients',
            [
                IngredientController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:inventory.view'
            )
            ->name(
                'v1.inventory.ingredients.index'
            );

        /*
         * Create ingredient.
         *
         * Does NOT directly set:
         *
         * current_stock
         * average_cost
         *
         * Those values will be controlled through
         * stock transactions.
         */
        Route::post(
            '/inventory/ingredients',
            [
                IngredientController::class,
                'store',
            ]
        )
            ->middleware(
                'permission:inventory.manage'
            )
            ->name(
                'v1.inventory.ingredients.store'
            );

        /*
         * View ingredient.
         */
        Route::get(
            '/inventory/ingredients/{ingredient}',
            [
                IngredientController::class,
                'show',
            ]
        )
            ->whereNumber(
                'ingredient'
            )
            ->middleware(
                'permission:inventory.view'
            )
            ->name(
                'v1.inventory.ingredients.show'
            );

        /*
         * Update ingredient master information.
         *
         * Does NOT directly edit current stock
         * or average cost.
         */
        Route::put(
            '/inventory/ingredients/{ingredient}',
            [
                IngredientController::class,
                'update',
            ]
        )
            ->whereNumber(
                'ingredient'
            )
            ->middleware(
                'permission:inventory.manage'
            )
            ->name(
                'v1.inventory.ingredients.update'
            );

        /*
         * Activate/deactivate ingredient.
         */
        Route::patch(
            '/inventory/ingredients/{ingredient}/status',
            [
                IngredientController::class,
                'updateStatus',
            ]
        )
            ->whereNumber(
                'ingredient'
            )
            ->middleware(
                'permission:inventory.manage'
            )
            ->name(
                'v1.inventory.ingredients.status'
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
