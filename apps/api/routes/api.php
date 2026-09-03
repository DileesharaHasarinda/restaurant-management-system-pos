<?php

use App\Http\Controllers\Api\V1\AddonController;
use App\Http\Controllers\Api\V1\AddonRecipeController;
use App\Http\Controllers\Api\V1\Auth\AuthController;
use App\Http\Controllers\Api\V1\AuditLogController;
use App\Http\Controllers\Api\V1\BusinessDayClosingController;
use App\Http\Controllers\Api\V1\CashDrawerController;
use App\Http\Controllers\Api\V1\CashierShiftController;
use App\Http\Controllers\Api\V1\CustomerPaymentController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\FoundationController;
use App\Http\Controllers\Api\V1\GalleryManagementController;
use App\Http\Controllers\Api\V1\ExpenseCategoryController;
use App\Http\Controllers\Api\V1\ExpenseController;
use App\Http\Controllers\Api\V1\ExpenseReportController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\IngredientController;
use App\Http\Controllers\Api\V1\InventoryStockController;
use App\Http\Controllers\Api\V1\InvoiceController;
use App\Http\Controllers\Api\V1\KitchenPrintJobController;
use App\Http\Controllers\Api\V1\MenuCategoryController;
use App\Http\Controllers\Api\V1\MenuItemController;
use App\Http\Controllers\Api\V1\OrderController;
use App\Http\Controllers\Api\V1\PublicMenuController;
use App\Http\Controllers\Api\V1\PublicQrOrderController;
use App\Http\Controllers\Api\V1\PublicTableQrController;
use App\Http\Controllers\Api\V1\PublicWebsiteController;
use App\Http\Controllers\Api\V1\PurchaseController;
use App\Http\Controllers\Api\V1\RecipeConsumptionController;
use App\Http\Controllers\Api\V1\RecipeController;
use App\Http\Controllers\Api\V1\RefundController;
use App\Http\Controllers\Api\V1\RestaurantSettingsController;
use App\Http\Controllers\Api\V1\ReviewModerationController;
use App\Http\Controllers\Api\V1\ReportController;
use App\Http\Controllers\Api\V1\RolePermissionController;
use App\Http\Controllers\Api\V1\StockAdjustmentController;
use App\Http\Controllers\Api\V1\StockCancellationReversalController;
use App\Http\Controllers\Api\V1\SupplierController;
use App\Http\Controllers\Api\V1\SupplierPaymentController;
use App\Http\Controllers\Api\V1\TableController;
use App\Http\Controllers\Api\V1\TableHistoryController;
use App\Http\Controllers\Api\V1\TableQrController;
use App\Http\Controllers\Api\V1\TableSessionController;
use App\Http\Controllers\Api\V1\TakeawayOrderController;
use App\Http\Controllers\Api\V1\UnitController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\UserSessionController;
use App\Http\Controllers\Api\V1\WaiterOrderController;
use App\Http\Controllers\Api\V1\WaiterTableController;
use App\Http\Controllers\Api\V1\WastageController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API V1 Routes
|--------------------------------------------------------------------------
|
| bootstrap/app.php already applies:
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
    | Public Website
    |--------------------------------------------------------------------------
    */

    Route::get(
        '/public/gallery',
        [
            PublicWebsiteController::class,
            'gallery',
        ]
    )->name(
        'v1.public.gallery'
    );

    Route::get(
        '/public/reviews',
        [
            PublicWebsiteController::class,
            'reviews',
        ]
    )->name(
        'v1.public.reviews'
    );

    Route::post(
        '/public/reviews',
        [
            PublicWebsiteController::class,
            'storeReview',
        ]
    )
        ->middleware(
            'throttle:10,1'
        )
        ->name(
            'v1.public.reviews.store'
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
    | Phase 15 - Customer QR Ordering
    |--------------------------------------------------------------------------
    |
    | First QR order:
    |
    | source = QR_CUSTOMER
    | type   = DINE_IN
    | status = PENDING
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
    | Phase 15 - Customer Additional Items
    |--------------------------------------------------------------------------
    |
    | Additional items are appended to the SAME order.
    |
    | No second orders row is created.
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
        | Operations Dashboard
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/dashboard',
            [
                DashboardController::class,
                'show',
            ]
        )
            ->middleware(
                'permission:dashboard.view'
            )
            ->name(
                'v1.dashboard.show'
            );

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
        | Phase 38 - Review Moderation
        |--------------------------------------------------------------------------
        |
        | Only authorized staff may moderate customer reviews.
        |
        | Public visibility still requires:
        |
        | status = APPROVED
        | is_visible = true
        |
        */

        Route::get(
            '/reviews',
            [
                ReviewModerationController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:reviews.moderate'
            )
            ->name(
                'v1.reviews.index'
            );

        Route::patch(
            '/reviews/{review}/approve',
            [
                ReviewModerationController::class,
                'approve',
            ]
        )
            ->whereNumber(
                'review'
            )
            ->middleware(
                'permission:reviews.moderate'
            )
            ->name(
                'v1.reviews.approve'
            );

        Route::patch(
            '/reviews/{review}/reject',
            [
                ReviewModerationController::class,
                'reject',
            ]
        )
            ->whereNumber(
                'review'
            )
            ->middleware(
                'permission:reviews.moderate'
            )
            ->name(
                'v1.reviews.reject'
            );

        Route::patch(
            '/reviews/{review}/visibility',
            [
                ReviewModerationController::class,
                'visibility',
            ]
        )
            ->whereNumber(
                'review'
            )
            ->middleware(
                'permission:reviews.moderate'
            )
            ->name(
                'v1.reviews.visibility'
            );

        Route::delete(
            '/reviews/{review}',
            [
                ReviewModerationController::class,
                'destroy',
            ]
        )
            ->whereNumber(
                'review'
            )
            ->middleware(
                'permission:reviews.moderate'
            )
            ->name(
                'v1.reviews.destroy'
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 38 - Gallery Management
        |--------------------------------------------------------------------------
        |
        | Authorized staff can upload gallery images, edit captions / sort
        | order, and enable or disable public visibility.
        |
        */

        Route::get(
            '/gallery',
            [
                GalleryManagementController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:website.manage'
            )
            ->name(
                'v1.gallery.index'
            );

        Route::post(
            '/gallery',
            [
                GalleryManagementController::class,
                'store',
            ]
        )
            ->middleware(
                'permission:website.manage'
            )
            ->name(
                'v1.gallery.store'
            );

        Route::put(
            '/gallery/{galleryImage}',
            [
                GalleryManagementController::class,
                'update',
            ]
        )
            ->whereNumber(
                'galleryImage'
            )
            ->middleware(
                'permission:website.manage'
            )
            ->name(
                'v1.gallery.update'
            );

        Route::patch(
            '/gallery/{galleryImage}/state',
            [
                GalleryManagementController::class,
                'updateState',
            ]
        )
            ->whereNumber(
                'galleryImage'
            )
            ->middleware(
                'permission:website.manage'
            )
            ->name(
                'v1.gallery.state'
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
        | Phase 19 - Table Transfer
        |--------------------------------------------------------------------------
        */

        Route::post(
            '/tables/{table}/transfer',
            [
                TableController::class,
                'transfer',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.transfer'
            )
            ->name(
                'v1.tables.transfer'
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 20 - Table Merge
        |--------------------------------------------------------------------------
        */

        Route::post(
            '/tables/{table}/merge',
            [
                TableController::class,
                'merge',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.merge'
            )
            ->name(
                'v1.tables.merge'
            );

        /*
        |--------------------------------------------------------------------------
        | Table Transfer / Merge History
        |--------------------------------------------------------------------------
        |
        | These routes must stay inside the authenticated API group so they
        | inherit auth:sanctum and active-user middleware, just like the
        | rest of the protected table-management endpoints.
        |
        */

        Route::get(
            '/tables/{table}/transfers',
            [
                TableHistoryController::class,
                'transfers',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.view'
            )
            ->name(
                'v1.tables.transfers.index'
            );

        Route::get(
            '/tables/{table}/merges',
            [
                TableHistoryController::class,
                'merges',
            ]
        )
            ->whereNumber(
                'table'
            )
            ->middleware(
                'permission:tables.view'
            )
            ->name(
                'v1.tables.merges.index'
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
        | Phase 16 - Waiter Operations
        |--------------------------------------------------------------------------
        */

        Route::prefix(
            'waiter'
        )
            ->name(
                'v1.waiter.'
            )
            ->group(
                function (): void {

                    Route::get(
                        '/tables',
                        [
                            WaiterTableController::class,
                            'index',
                        ]
                    )
                        ->middleware(
                            'permission:tables.view'
                        )
                        ->name(
                            'tables.index'
                        );

                    Route::get(
                        '/tables/{table}',
                        [
                            WaiterTableController::class,
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
                            'tables.show'
                        );

                    Route::post(
                        '/orders',
                        [
                            WaiterOrderController::class,
                            'store',
                        ]
                    )
                        ->middleware(
                            'permission:orders.create'
                        )
                        ->name(
                            'orders.store'
                        );

                    Route::post(
                        '/orders/{order}/items',
                        [
                            WaiterOrderController::class,
                            'append',
                        ]
                    )
                        ->whereNumber(
                            'order'
                        )
                        ->middleware(
                            'permission:orders.create'
                        )
                        ->name(
                            'orders.items.append'
                        );

                    Route::post(
                        '/tables/{table}/request-bill',
                        [
                            WaiterTableController::class,
                            'requestBill',
                        ]
                    )
                        ->whereNumber(
                            'table'
                        )
                        ->middleware(
                            'permission:orders.create'
                        )
                        ->name(
                            'tables.request-bill'
                        );
                }
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 17 - Core Order Engine
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/orders',
            [
                OrderController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:orders.view'
            )
            ->name(
                'v1.orders.index'
            );

        Route::get(
            '/orders/{order}',
            [
                OrderController::class,
                'show',
            ]
        )
            ->whereNumber(
                'order'
            )
            ->middleware(
                'permission:orders.view'
            )
            ->name(
                'v1.orders.show'
            );

        Route::post(
            '/orders/{order}/confirm',
            [
                OrderController::class,
                'confirm',
            ]
        )
            ->whereNumber(
                'order'
            )
            ->middleware(
                'permission:orders.confirm'
            )
            ->name(
                'v1.orders.confirm'
            );

        Route::post(
            '/orders/{order}/reject',
            [
                OrderController::class,
                'reject',
            ]
        )
            ->whereNumber(
                'order'
            )
            ->middleware(
                'permission:orders.confirm'
            )
            ->name(
                'v1.orders.reject'
            );

        Route::post(
            '/orders/{order}/send-to-kitchen',
            [
                OrderController::class,
                'sendToKitchen',
            ]
        )
            ->whereNumber(
                'order'
            )
            ->middleware(
                'permission:orders.send_kitchen'
            )
            ->name(
                'v1.orders.send-to-kitchen'
            );

        Route::post(
            '/orders/{order}/serve',
            [
                OrderController::class,
                'serve',
            ]
        )
            ->whereNumber(
                'order'
            )
            ->middleware(
                'permission:orders.serve'
            )
            ->name(
                'v1.orders.serve'
            );

        Route::post(
            '/orders/{order}/complete',
            [
                OrderController::class,
                'complete',
            ]
        )
            ->whereNumber(
                'order'
            )
            ->middleware(
                'permission:orders.complete'
            )
            ->name(
                'v1.orders.complete'
            );

        Route::post(
            '/orders/{order}/cancel',
            [
                OrderController::class,
                'cancel',
            ]
        )
            ->whereNumber(
                'order'
            )
            ->middleware(
                'permission:orders.cancel'
            )
            ->name(
                'v1.orders.cancel'
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 27 - Billing / Invoice Generation
        |--------------------------------------------------------------------------
        */

        Route::post(
            '/orders/{order}/invoice',
            [
                InvoiceController::class,
                'generateForOrder',
            ]
        )
            ->whereNumber(
                'order'
            )
            ->middleware(
                'permission:invoices.create'
            )
            ->name(
                'v1.orders.invoice.generate'
            );

        Route::post(
            '/table-sessions/{tableSession}/invoice',
            [
                InvoiceController::class,
                'generateForTableSession',
            ]
        )
            ->whereNumber(
                'tableSession'
            )
            ->middleware(
                'permission:invoices.create'
            )
            ->name(
                'v1.table-sessions.invoice.generate'
            );

        Route::get(
            '/invoices/{invoice}',
            [
                InvoiceController::class,
                'show',
            ]
        )
            ->whereNumber(
                'invoice'
            )
            ->middleware(
                'permission:invoices.view'
            )
            ->name(
                'v1.invoices.show'
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 28 - Customer Multiple Payments
        |--------------------------------------------------------------------------
        |
        | Supported payment methods:
        |
        | CASH
        | CARD
        | QR
        | BANK_TRANSFER
        | OTHER
        |
        | One request can contain multiple payment methods.
        |
        | Example:
        |
        | Invoice Rs. 10,000
        |
        | CASH Rs. 3,000
        | CARD Rs. 5,000
        | QR   Rs. 2,000
        |
        | The complete payment batch is processed atomically.
        |
        */

        Route::post(
            '/invoices/{invoice}/payments',
            [
                CustomerPaymentController::class,
                'store',
            ]
        )
            ->whereNumber(
                'invoice'
            )
            ->middleware(
                'permission:payments.create'
            )
            ->name(
                'v1.invoices.payments.store'
            );

        Route::get(
            '/invoices/{invoice}/payments',
            [
                CustomerPaymentController::class,
                'index',
            ]
        )
            ->whereNumber(
                'invoice'
            )
            ->middleware(
                'permission:invoices.view'
            )
            ->name(
                'v1.invoices.payments.index'
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 33 - Cancellations, Refunds & Corrections
        |--------------------------------------------------------------------------
        |
        | Financial refunds are intentionally separate from:
        |
        | - order cancellation
        | - inventory cancellation reversal
        | - wastage
        |
        | After-kitchen order cancellation is protected inside the
        | cancellation service by manager authorization.
        |
        */

        Route::get(
            '/invoices/{invoice}/refunds',
            [
                RefundController::class,
                'index',
            ]
        )
            ->whereNumber(
                'invoice'
            )
            ->middleware(
                'permission:refunds.view'
            )
            ->name(
                'v1.invoices.refunds.index'
            );

        Route::post(
            '/invoices/{invoice}/refunds',
            [
                RefundController::class,
                'store',
            ]
        )
            ->whereNumber(
                'invoice'
            )
            ->middleware(
                'permission:refunds.create'
            )
            ->name(
                'v1.invoices.refunds.store'
            );

        Route::get(
            '/refunds/{refund}',
            [
                RefundController::class,
                'show',
            ]
        )
            ->whereNumber(
                'refund'
            )
            ->middleware(
                'permission:refunds.view'
            )
            ->name(
                'v1.refunds.show'
            );

        Route::post(
            '/stock-movements/{stockMovement}/cancellation-reversal',
            [
                StockCancellationReversalController::class,
                'store',
            ]
        )
            ->whereNumber(
                'stockMovement'
            )
            ->middleware(
                'permission:inventory.cancellation_reversal.request'
            )
            ->name(
                'v1.stock-movements.cancellation-reversal'
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 29 - Cashier Shift Management
        |--------------------------------------------------------------------------
        |
        | Shift cash formula:
        |
        | Opening Cash
        | + Cash Sales
        | - Cash Refunds
        | + Cash In
        | - Cash Out
        | = Expected Drawer Balance
        |
        */

        Route::get(
            '/cashier-shifts/current',
            [
                CashierShiftController::class,
                'current',
            ]
        )
            ->middleware(
                'permission:cash_shift.view'
            )
            ->name(
                'v1.cashier-shifts.current'
            );

        Route::post(
            '/cashier-shifts/open',
            [
                CashierShiftController::class,
                'open',
            ]
        )
            ->middleware(
                'permission:cash_shift.open'
            )
            ->name(
                'v1.cashier-shifts.open'
            );

        Route::get(
            '/cashier-shifts/{cashierShift}',
            [
                CashierShiftController::class,
                'show',
            ]
        )
            ->whereNumber(
                'cashierShift'
            )
            ->middleware(
                'permission:cash_shift.view'
            )
            ->name(
                'v1.cashier-shifts.show'
            );

        Route::get(
            '/cashier-shifts/{cashierShift}/movements',
            [
                CashierShiftController::class,
                'movements',
            ]
        )
            ->whereNumber(
                'cashierShift'
            )
            ->middleware(
                'permission:cash_shift.view'
            )
            ->name(
                'v1.cashier-shifts.movements'
            );

        Route::post(
            '/cashier-shifts/{cashierShift}/cash-in',
            [
                CashierShiftController::class,
                'cashIn',
            ]
        )
            ->whereNumber(
                'cashierShift'
            )
            ->middleware(
                'permission:cash_drawer.movement'
            )
            ->name(
                'v1.cashier-shifts.cash-in'
            );

        Route::post(
            '/cashier-shifts/{cashierShift}/cash-out',
            [
                CashierShiftController::class,
                'cashOut',
            ]
        )
            ->whereNumber(
                'cashierShift'
            )
            ->middleware(
                'permission:cash_drawer.movement'
            )
            ->name(
                'v1.cashier-shifts.cash-out'
            );

        Route::post(
            '/cashier-shifts/{cashierShift}/close',
            [
                CashierShiftController::class,
                'close',
            ]
        )
            ->whereNumber(
                'cashierShift'
            )
            ->middleware(
                'permission:cash_shift.close'
            )
            ->name(
                'v1.cashier-shifts.close'
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 30 - Cash Drawer Manual Open
        |--------------------------------------------------------------------------
        |
        | This endpoint authorizes and audits a manual drawer opening.
        |
        | Electron must only send the physical ESC/POS drawer pulse when
        | the API response returns:
        |
        | cash_drawer.should_open = true
        |
        | Idempotent retries return should_open = false.
        |
        */

        Route::post(
            '/cashier-shifts/{cashierShift}/manual-open',
            [
                CashDrawerController::class,
                'manualOpen',
            ]
        )
            ->whereNumber(
                'cashierShift'
            )
            ->middleware(
                'permission:cash_drawer.open'
            )
            ->name(
                'v1.cashier-shifts.manual-open'
            );


        /*
        |--------------------------------------------------------------------------
        | Phase 32 - Restaurant Business Day Control
        |--------------------------------------------------------------------------
        |
        | Authorized POS users can start the restaurant business day.
        | Manager / owner reviews the current restaurant business day,
        | resolves all operational blockers, and closes the day.
        |
        | Laravel is authoritative for:
        |
        | - open table validation
        | - active order validation
        | - unpaid invoice validation
        | - open cashier shift validation
        | - final financial snapshot
        | - business day CLOSED state
        |
        */

        /*
        |--------------------------------------------------------------------------
        | Open / Start Business Day
        |--------------------------------------------------------------------------
        |
        | Authorized POS users can start the restaurant business day before
        | opening cashier shifts or processing restaurant operations.
        | Laravel remains authoritative for business-date and open-day rules.
        |
        */

        Route::post(
            '/business-days/open',
            [
                BusinessDayClosingController::class,
                'open',
            ]
        )
            ->middleware(
                'permission:business_day.open'
            )
            ->name(
                'v1.business-days.open'
            );

        Route::get(
            '/business-days/current',
            [
                BusinessDayClosingController::class,
                'current',
            ]
        )
            ->middleware(
                'permission:business_day.view'
            )
            ->name(
                'v1.business-days.current'
            );

        Route::get(
            '/business-days/{businessDay}/closing-preview',
            [
                BusinessDayClosingController::class,
                'preview',
            ]
        )
            ->whereNumber(
                'businessDay'
            )
            ->middleware(
                'permission:business_day.view'
            )
            ->name(
                'v1.business-days.closing-preview'
            );

        Route::post(
            '/business-days/{businessDay}/close',
            [
                BusinessDayClosingController::class,
                'close',
            ]
        )
            ->whereNumber(
                'businessDay'
            )
            ->middleware(
                'permission:business_day.close'
            )
            ->name(
                'v1.business-days.close'
            );

        Route::get(
            '/business-day-closings/{businessDayClosing}',
            [
                BusinessDayClosingController::class,
                'show',
            ]
        )
            ->whereNumber(
                'businessDayClosing'
            )
            ->middleware(
                'permission:business_day.view'
            )
            ->name(
                'v1.business-day-closings.show'
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 22 - Kitchen KOT Printing
        |--------------------------------------------------------------------------
        */

        Route::prefix(
            'kitchen/print-jobs'
        )
            ->name(
                'v1.kitchen.print-jobs.'
            )
            ->group(
                function (): void {

                    Route::get(
                        '/',
                        [
                            KitchenPrintJobController::class,
                            'index',
                        ]
                    )
                        ->middleware(
                            'permission:kitchen.reprint'
                        )
                        ->name(
                            'index'
                        );

                    Route::post(
                        '/claim-next',
                        [
                            KitchenPrintJobController::class,
                            'claimNext',
                        ]
                    )
                        ->middleware(
                            'permission:orders.send_kitchen'
                        )
                        ->name(
                            'claim-next'
                        );

                    Route::post(
                        '/{kitchenPrintJob}/printed',
                        [
                            KitchenPrintJobController::class,
                            'printed',
                        ]
                    )
                        ->whereNumber(
                            'kitchenPrintJob'
                        )
                        ->middleware(
                            'permission:orders.send_kitchen'
                        )
                        ->name(
                            'printed'
                        );

                    Route::post(
                        '/{kitchenPrintJob}/failed',
                        [
                            KitchenPrintJobController::class,
                            'failed',
                        ]
                    )
                        ->whereNumber(
                            'kitchenPrintJob'
                        )
                        ->middleware(
                            'permission:orders.send_kitchen'
                        )
                        ->name(
                            'failed'
                        );

                    Route::post(
                        '/{kitchenPrintJob}/retry',
                        [
                            KitchenPrintJobController::class,
                            'retry',
                        ]
                    )
                        ->whereNumber(
                            'kitchenPrintJob'
                        )
                        ->middleware(
                            'permission:kitchen.reprint'
                        )
                        ->name(
                            'retry'
                        );

                    Route::post(
                        '/{kitchenPrintJob}/reprint',
                        [
                            KitchenPrintJobController::class,
                            'reprint',
                        ]
                    )
                        ->whereNumber(
                            'kitchenPrintJob'
                        )
                        ->middleware(
                            'permission:kitchen.reprint'
                        )
                        ->name(
                            'reprint'
                        );
                }
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 24 - Wastage Management
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/wastages',
            [
                WastageController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:wastage.view'
            )
            ->name(
                'v1.wastages.index'
            );

        Route::post(
            '/wastages',
            [
                WastageController::class,
                'store',
            ]
        )
            ->middleware(
                'permission:wastage.create'
            )
            ->name(
                'v1.wastages.store'
            );

        Route::get(
            '/wastages/{wastage}',
            [
                WastageController::class,
                'show',
            ]
        )
            ->whereNumber(
                'wastage'
            )
            ->middleware(
                'permission:wastage.view'
            )
            ->name(
                'v1.wastages.show'
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 18 - Takeaway Orders
        |--------------------------------------------------------------------------
        */

        Route::prefix(
            'takeaway'
        )
            ->name(
                'v1.takeaway.'
            )
            ->group(
                function (): void {

                    Route::get(
                        '/orders',
                        [
                            TakeawayOrderController::class,
                            'index',
                        ]
                    )
                        ->middleware(
                            'permission:orders.view'
                        )
                        ->name(
                            'orders.index'
                        );

                    Route::post(
                        '/orders',
                        [
                            TakeawayOrderController::class,
                            'store',
                        ]
                    )
                        ->middleware([
                            'permission:orders.create',
                            'permission:orders.confirm',
                        ])
                        ->name(
                            'orders.store'
                        );

                    Route::get(
                        '/orders/{order}',
                        [
                            TakeawayOrderController::class,
                            'show',
                        ]
                    )
                        ->whereNumber(
                            'order'
                        )
                        ->middleware(
                            'permission:orders.view'
                        )
                        ->name(
                            'orders.show'
                        );
                }
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
        | Menu Add-on Groups
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
        | Menu Add-ons
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
        | Phase 14 - Recipe Consumption Preview
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
        | Phase 25 - Physical Stock Adjustments
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/inventory/stock-adjustments',
            [
                StockAdjustmentController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:inventory.view'
            )
            ->name(
                'v1.inventory.stock-adjustments.index'
            );

        Route::get(
            '/inventory/stock-adjustments/{stockAdjustment}',
            [
                StockAdjustmentController::class,
                'show',
            ]
        )
            ->whereNumber(
                'stockAdjustment'
            )
            ->middleware(
                'permission:inventory.view'
            )
            ->name(
                'v1.inventory.stock-adjustments.show'
            );

        Route::post(
            '/inventory/ingredients/{ingredient}/physical-count',
            [
                StockAdjustmentController::class,
                'physicalCount',
            ]
        )
            ->whereNumber(
                'ingredient'
            )
            ->middleware(
                'permission:inventory.adjust'
            )
            ->name(
                'v1.inventory.ingredients.physical-count'
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 26 - Expense Management
        |--------------------------------------------------------------------------
        */

        Route::get(
            '/expense-categories',
            [
                ExpenseCategoryController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:expenses.view'
            )
            ->name(
                'v1.expense-categories.index'
            );

        Route::get(
            '/expenses/payment-methods',
            [
                ExpenseController::class,
                'paymentMethods',
            ]
        )
            ->middleware(
                'permission:expenses.view'
            )
            ->name(
                'v1.expenses.payment-methods'
            );

        Route::get(
            '/expenses',
            [
                ExpenseController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:expenses.view'
            )
            ->name(
                'v1.expenses.index'
            );

        Route::post(
            '/expenses',
            [
                ExpenseController::class,
                'store',
            ]
        )
            ->middleware(
                'permission:expenses.create'
            )
            ->name(
                'v1.expenses.store'
            );

        Route::get(
            '/expense-reports/summary',
            [
                ExpenseReportController::class,
                'summary',
            ]
        )
            ->middleware([
                'permission:expenses.view',
                'permission:reports.view',
            ])
            ->name(
                'v1.expense-reports.summary'
            );

        Route::get(
            '/expenses/{expense}',
            [
                ExpenseController::class,
                'show',
            ]
        )
            ->whereNumber(
                'expense'
            )
            ->middleware(
                'permission:expenses.view'
            )
            ->name(
                'v1.expenses.show'
            );

        Route::put(
            '/expenses/{expense}',
            [
                ExpenseController::class,
                'update',
            ]
        )
            ->whereNumber(
                'expense'
            )
            ->middleware(
                'permission:expenses.manage'
            )
            ->name(
                'v1.expenses.update'
            );

        Route::post(
            '/expenses/{expense}/receipt',
            [
                ExpenseController::class,
                'uploadReceipt',
            ]
        )
            ->whereNumber(
                'expense'
            )
            ->middleware(
                'permission:expenses.manage'
            )
            ->name(
                'v1.expenses.receipt.upload'
            );

        Route::get(
            '/expenses/{expense}/receipt',
            [
                ExpenseController::class,
                'downloadReceipt',
            ]
        )
            ->whereNumber(
                'expense'
            )
            ->middleware(
                'permission:expenses.view'
            )
            ->name(
                'v1.expenses.receipt.download'
            );

        Route::delete(
            '/expenses/{expense}/receipt',
            [
                ExpenseController::class,
                'removeReceipt',
            ]
        )
            ->whereNumber(
                'expense'
            )
            ->middleware(
                'permission:expenses.manage'
            )
            ->name(
                'v1.expenses.receipt.remove'
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
        | Supplier-Specific Payment History
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
        | Purchase Supplier Payments
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
        | Global Supplier Payment History
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
        | Phase 34 - Reports
        |--------------------------------------------------------------------------
        |
        | Central reporting endpoints.
        |
        | All report endpoints require reports.view.
        | Expense and inventory reports retain their domain-specific
        | visibility permissions as well.
        |
        */

        Route::prefix(
            'reports'
        )
            ->middleware(
                'permission:reports.view'
            )
            ->name(
                'v1.reports.'
            )
            ->group(
                function (): void {

                    Route::get(
                        '/overview',
                        [
                            ReportController::class,
                            'overview',
                        ]
                    )->name(
                        'overview'
                    );

                    Route::get(
                        '/sales',
                        [
                            ReportController::class,
                            'sales',
                        ]
                    )->name(
                        'sales'
                    );

                    Route::get(
                        '/items',
                        [
                            ReportController::class,
                            'items',
                        ]
                    )->name(
                        'items'
                    );

                    Route::get(
                        '/profit',
                        [
                            ReportController::class,
                            'profit',
                        ]
                    )->name(
                        'profit'
                    );

                    Route::get(
                        '/payments',
                        [
                            ReportController::class,
                            'payments',
                        ]
                    )->name(
                        'payments'
                    );

                    Route::get(
                        '/expenses',
                        [
                            ReportController::class,
                            'expenses',
                        ]
                    )
                        ->middleware(
                            'permission:expenses.view'
                        )
                        ->name(
                            'expenses'
                        );

                    Route::get(
                        '/inventory',
                        [
                            ReportController::class,
                            'inventory',
                        ]
                    )
                        ->middleware(
                            'permission:inventory.view'
                        )
                        ->name(
                            'inventory'
                        );

                    Route::get(
                        '/purchases',
                        [
                            ReportController::class,
                            'purchases',
                        ]
                    )->name(
                        'purchases'
                    );

                    Route::get(
                        '/orders',
                        [
                            ReportController::class,
                            'orders',
                        ]
                    )->name(
                        'orders'
                    );

                    Route::get(
                        '/cashier',
                        [
                            ReportController::class,
                            'cashier',
                        ]
                    )->name(
                        'cashier'
                    );
                }
            );

        /*
        |--------------------------------------------------------------------------
        | Phase 39 - Audit Logs
        |--------------------------------------------------------------------------
        |
        | Immutable, read-only administrative and financial activity history.
        |
        | Audit records are created by the existing AuditLogger service.
        | This API only exposes authorized GET access for remote owner/admin
        | review. No create, update or delete audit-log routes are provided.
        |
        */

        Route::get(
            '/audit-logs',
            [
                AuditLogController::class,
                'index',
            ]
        )
            ->middleware(
                'permission:audit.view'
            )
            ->name(
                'v1.audit-logs.index'
            );

        Route::get(
            '/audit-logs/{auditLog}',
            [
                AuditLogController::class,
                'show',
            ]
        )
            ->whereNumber(
                'auditLog'
            )
            ->middleware(
                'permission:audit.view'
            )
            ->name(
                'v1.audit-logs.show'
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
