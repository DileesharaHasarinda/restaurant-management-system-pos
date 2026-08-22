<?php

use App\Http\Controllers\Api\V1\AddonController;
use App\Http\Controllers\Api\V1\AddonRecipeController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\FoundationController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\IngredientController;
use App\Http\Controllers\Api\V1\InventoryStockController;
use App\Http\Controllers\Api\V1\MenuCategoryController;
use App\Http\Controllers\Api\V1\MenuItemController;
use App\Http\Controllers\Api\V1\PublicMenuController;
use App\Http\Controllers\Api\V1\PublicQrOrderController;
use App\Http\Controllers\Api\V1\PublicTableQrController;
use App\Http\Controllers\Api\V1\PurchaseController;
use App\Http\Controllers\Api\V1\RecipeConsumptionController;
use App\Http\Controllers\Api\V1\RecipeController;
use App\Http\Controllers\Api\V1\RestaurantSettingsController;
use App\Http\Controllers\Api\V1\RolePermissionController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\SupplierPaymentController;
use App\Http\Controllers\Api\V1\TableController;
use App\Http\Controllers\Api\V1\TableQrController;
use App\Http\Controllers\Api\V1\TableSessionController;
use App\Http\Controllers\Api\V1\UnitController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\UserSessionController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API V1 Routes
|--------------------------------------------------------------------------
|
| bootstrap/app.php already adds:
|
| /api/v1
|
| Therefore routes in this file must NOT start with /api/v1.
|
|--------------------------------------------------------------------------
*/

Route::middleware(
    'throttle:api'
)->group(function (): void {

    /*
    |--------------------------------------------------------------------------
    | Public Health
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
    |--------------------------------------------------------------------------
    | Public Restaurant Settings
    |--------------------------------------------------------------------------
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
    | Phase 15 - First Customer QR Order
    |--------------------------------------------------------------------------
    |
    | Customer submits the first cart.
    |
    | Creates:
    |
    | Order source = QR_CUSTOMER
    | Order type   = DINE_IN
    | Status       = PENDING
    |
    */

    Route::post(
        '/public/table-qr/{token}/orders',
        [
            PublicQrOrderController::class,
            'store',
        ]
    )
        ->middleware(
            'throttle:10,1'
        )
        ->where(
            'token',
            '[A-Fa-f0-9]{32}'
        )
        ->name(
            'v1.public.table-qr.orders.store'
        );

    /*
    |--------------------------------------------------------------------------
    | Phase 15 - Add More Items To Existing Order
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | This does NOT create another orders row.
    |
    | New order_items are appended to the SAME order.
    |
    | Example:
    |
    | ORD-260822-000025
    |
    | First order:
    | Chicken Fried Rice
    |
    | Additional order:
    | Coca Cola
    |
    | Additional order:
    | Ice Cream
    |
    | All remain under ORD-260822-000025.
    |
    */

    Route::post(
        '/public/orders/{statusToken}/items',
        [
            PublicQrOrderController::class,
            'append',
        ]
    )
        ->middleware(
            'throttle:10,1'
        )
        ->where(
            'statusToken',
            '[A-Za-z0-9]{64}'
        )
        ->name(
            'v1.public.orders.items.append'
        );

    /*
    |--------------------------------------------------------------------------
    | Public Customer Order Status
    |--------------------------------------------------------------------------
    |
    | No login is required.
    |
    | Customer uses the random 64-character status token.
    |
    | Returns the complete cumulative order:
    |
    | original items
    | +
    | all additional items
    |
    */

    Route::get(
        '/public/orders/{statusToken}',
        [
            PublicQrOrderController::class,
            'status',
        ]
    )
        ->middleware(
            'throttle:60,1'
        )
        ->where(
            'statusToken',
            '[A-Za-z0-9]{64}'
        )
        ->name(
            'v1.public.orders.status'
        );

    /*
    |--------------------------------------------------------------------------
    | Authentication
    |--------------------------------------------------------------------------
    */

    Route::prefix(
        'auth'
    )
        ->name(
            'v1.auth.'
        )
        ->group(
            function (): void {

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
                        )->name(
                            'me'
                        );

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
                        )->name(
                            'logout'
                        );

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
            }
        );

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
        | Tables
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
        | Phase 13 - Recipe Management
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/recipes/menu-items/{menuItem}/overview',
            [
                RecipeController::class,
                'overview',
            ]
        )
            ->whereNumber(
                'menuItem'
            )
            ->middleware(
                'permission:recipes.view'
            )
            ->name(
                'v1.recipes.menu-items.overview'
            );

        Route::get(
            '/recipes/menu-items/{menuItem}',
            [
                RecipeController::class,
                'show',
            ]
        )
            ->whereNumber(
                'menuItem'
            )
            ->middleware(
                'permission:recipes.view'
            )
            ->name(
                'v1.recipes.menu-items.show'
            );

        Route::put(
            '/recipes/menu-items/{menuItem}',
            [
                RecipeController::class,
                'update',
            ]
        )
            ->whereNumber(
                'menuItem'
            )
            ->middleware(
                'permission:recipes.manage'
            )
            ->name(
                'v1.recipes.menu-items.update'
            );

        Route::delete(
            '/recipes/menu-items/{menuItem}',
            [
                RecipeController::class,
                'destroy',
            ]
        )
            ->whereNumber(
                'menuItem'
            )
            ->middleware(
                'permission:recipes.manage'
            )
            ->name(
                'v1.recipes.menu-items.destroy'
            );

        Route::get(
            '/recipes/menu-items/{menuItem}/variants/{variant}',
            [
                RecipeController::class,
                'showVariant',
            ]
        )
            ->whereNumber(
                'menuItem'
            )
            ->whereNumber(
                'variant'
            )
            ->middleware(
                'permission:recipes.view'
            )
            ->name(
                'v1.recipes.variants.show'
            );

        Route::put(
            '/recipes/menu-items/{menuItem}/variants/{variant}',
            [
                RecipeController::class,
                'updateVariant',
            ]
        )
            ->whereNumber(
                'menuItem'
            )
            ->whereNumber(
                'variant'
            )
            ->middleware(
                'permission:recipes.manage'
            )
            ->name(
                'v1.recipes.variants.update'
            );

        Route::delete(
            '/recipes/menu-items/{menuItem}/variants/{variant}',
            [
                RecipeController::class,
                'destroyVariant',
            ]
        )
            ->whereNumber(
                'menuItem'
            )
            ->whereNumber(
                'variant'
            )
            ->middleware(
                'permission:recipes.manage'
            )
            ->name(
                'v1.recipes.variants.destroy'
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 14 - Add-on Inventory Recipes
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/recipes/addons/{addon}',
            [
                AddonRecipeController::class,
                'show',
            ]
        )
            ->whereNumber(
                'addon'
            )
            ->middleware(
                'permission:recipes.view'
            )
            ->name(
                'v1.recipes.addons.show'
            );

        Route::put(
            '/recipes/addons/{addon}',
            [
                AddonRecipeController::class,
                'update',
            ]
        )
            ->whereNumber(
                'addon'
            )
            ->middleware(
                'permission:recipes.manage'
            )
            ->name(
                'v1.recipes.addons.update'
            );

        Route::delete(
            '/recipes/addons/{addon}',
            [
                AddonRecipeController::class,
                'destroy',
            ]
        )
            ->whereNumber(
                'addon'
            )
            ->middleware(
                'permission:recipes.manage'
            )
            ->name(
                'v1.recipes.addons.destroy'
            );

        /*
        |--------------------------------------------------------------------------
        | Recipe Consumption Preview
        |--------------------------------------------------------------------------
        */

        Route::post(
            '/recipes/menu-items/{menuItem}/consumption-preview',
            [
                RecipeConsumptionController::class,
                'preview',
            ]
        )
            ->whereNumber(
                'menuItem'
            )
            ->middleware(
                'permission:recipes.view'
            )
            ->name(
                'v1.recipes.consumption-preview'
            );

        /*
        |--------------------------------------------------------------------------
        | Units
        |--------------------------------------------------------------------------
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
        | Ingredients
        |--------------------------------------------------------------------------
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
        | Phase 12 - Inventory Stock Engine
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/inventory/stock',
            [
                InventoryStockController::class,
                'current',
            ]
        )
            ->middleware(
                'permission:inventory.view'
            )
            ->name(
                'v1.inventory.stock.current'
            );

        Route::get(
            '/inventory/stock/low',
            [
                InventoryStockController::class,
                'lowStock',
            ]
        )
            ->middleware(
                'permission:inventory.view'
            )
            ->name(
                'v1.inventory.stock.low'
            );

        Route::get(
            '/inventory/stock/out-of-stock',
            [
                InventoryStockController::class,
                'outOfStock',
            ]
        )
            ->middleware(
                'permission:inventory.view'
            )
            ->name(
                'v1.inventory.stock.out-of-stock'
            );

        Route::get(
            '/inventory/stock/valuation',
            [
                InventoryStockController::class,
                'valuation',
            ]
        )
            ->middleware(
                'permission:inventory.view'
            )
            ->name(
                'v1.inventory.stock.valuation'
            );

        Route::get(
            '/inventory/stock/movements',
            [
                InventoryStockController::class,
                'movements',
            ]
        )
            ->middleware(
                'permission:inventory.view'
            )
            ->name(
                'v1.inventory.stock.movements'
            );

        Route::get(
            '/inventory/ingredients/{ingredient}/stock-history',
            [
                InventoryStockController::class,
                'ingredientHistory',
            ]
        )
            ->whereNumber(
                'ingredient'
            )
            ->middleware(
                'permission:inventory.view'
            )
            ->name(
                'v1.inventory.ingredients.stock-history'
            );

        Route::post(
            '/inventory/ingredients/{ingredient}/opening-balance',
            [
                InventoryStockController::class,
                'openingBalance',
            ]
        )
            ->whereNumber(
                'ingredient'
            )
            ->middleware(
                'permission:inventory.adjust'
            )
            ->name(
                'v1.inventory.ingredients.opening-balance'
            );

        Route::post(
            '/inventory/ingredients/{ingredient}/adjustments/in',
            [
                InventoryStockController::class,
                'adjustmentIn',
            ]
        )
            ->whereNumber(
                'ingredient'
            )
            ->middleware(
                'permission:inventory.adjust'
            )
            ->name(
                'v1.inventory.ingredients.adjustment-in'
            );

        Route::post(
            '/inventory/ingredients/{ingredient}/adjustments/out',
            [
                InventoryStockController::class,
                'adjustmentOut',
            ]
        )
            ->whereNumber(
                'ingredient'
            )
            ->middleware(
                'permission:inventory.adjust'
            )
            ->name(
                'v1.inventory.ingredients.adjustment-out'
            );

        /*
        |--------------------------------------------------------------------------
        | Suppliers
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/suppliers',
            [
                SupplierController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:suppliers.view'
            )
            ->name(
                'v1.suppliers.index'
            );

        Route::post(
            '/suppliers',
            [
                SupplierController::class,
                'store',
            ]
        )
            ->middleware(
                'permission:suppliers.manage'
            )
            ->name(
                'v1.suppliers.store'
            );

        Route::get(
            '/suppliers/{supplier}',
            [
                SupplierController::class,
                'show',
            ]
        )
            ->whereNumber(
                'supplier'
            )
            ->middleware(
                'permission:suppliers.view'
            )
            ->name(
                'v1.suppliers.show'
            );

        Route::put(
            '/suppliers/{supplier}',
            [
                SupplierController::class,
                'update',
            ]
        )
            ->whereNumber(
                'supplier'
            )
            ->middleware(
                'permission:suppliers.manage'
            )
            ->name(
                'v1.suppliers.update'
            );

        Route::patch(
            '/suppliers/{supplier}/status',
            [
                SupplierController::class,
                'updateStatus',
            ]
        )
            ->whereNumber(
                'supplier'
            )
            ->middleware(
                'permission:suppliers.manage'
            )
            ->name(
                'v1.suppliers.status'
            );

        /*
        |--------------------------------------------------------------------------
        | Supplier Payment History
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/suppliers/{supplier}/payments',
            [
                SupplierPaymentController::class,
                'supplierHistory',
            ]
        )
            ->whereNumber(
                'supplier'
            )
            ->middleware(
                'permission:suppliers.view'
            )
            ->name(
                'v1.suppliers.payments'
            );

        /*
        |--------------------------------------------------------------------------
        | Purchases
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/purchases',
            [
                PurchaseController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:purchases.view'
            )
            ->name(
                'v1.purchases.index'
            );

        Route::post(
            '/purchases',
            [
                PurchaseController::class,
                'store',
            ]
        )
            ->middleware(
                'permission:purchases.create'
            )
            ->name(
                'v1.purchases.store'
            );

        Route::get(
            '/purchases/{purchase}',
            [
                PurchaseController::class,
                'show',
            ]
        )
            ->whereNumber(
                'purchase'
            )
            ->middleware(
                'permission:purchases.view'
            )
            ->name(
                'v1.purchases.show'
            );

        Route::put(
            '/purchases/{purchase}',
            [
                PurchaseController::class,
                'update',
            ]
        )
            ->whereNumber(
                'purchase'
            )
            ->middleware(
                'permission:purchases.manage'
            )
            ->name(
                'v1.purchases.update'
            );

        Route::post(
            '/purchases/{purchase}/complete',
            [
                PurchaseController::class,
                'complete',
            ]
        )
            ->whereNumber(
                'purchase'
            )
            ->middleware(
                'permission:purchases.manage'
            )
            ->name(
                'v1.purchases.complete'
            );

        Route::post(
            '/purchases/{purchase}/cancel',
            [
                PurchaseController::class,
                'cancel',
            ]
        )
            ->whereNumber(
                'purchase'
            )
            ->middleware(
                'permission:purchases.manage'
            )
            ->name(
                'v1.purchases.cancel'
            );

        /*
        |--------------------------------------------------------------------------
        | Purchase Payments
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/purchases/{purchase}/payments',
            [
                SupplierPaymentController::class,
                'purchaseHistory',
            ]
        )
            ->whereNumber(
                'purchase'
            )
            ->middleware(
                'permission:purchases.view'
            )
            ->name(
                'v1.purchases.payments.index'
            );

        Route::post(
            '/purchases/{purchase}/payments',
            [
                SupplierPaymentController::class,
                'store',
            ]
        )
            ->whereNumber(
                'purchase'
            )
            ->middleware(
                'permission:purchases.pay'
            )
            ->name(
                'v1.purchases.payments.store'
            );

        /*
        |--------------------------------------------------------------------------
        | Global Supplier Payments
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/supplier-payments',
            [
                SupplierPaymentController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:purchases.view'
            )
            ->name(
                'v1.supplier-payments.index'
            );

        Route::get(
            '/supplier-payment-batches/{paymentBatch}',
            [
                SupplierPaymentController::class,
                'show',
            ]
        )
            ->whereNumber(
                'paymentBatch'
            )
            ->middleware(
                'permission:purchases.view'
            )
            ->name(
                'v1.supplier-payment-batches.show'
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
