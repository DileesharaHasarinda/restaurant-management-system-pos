<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        /*
        |--------------------------------------------------------------------------
        | Roles
        |--------------------------------------------------------------------------
        */

        $roles = [
            [
                'name' => 'Owner',
                'code' => 'OWNER',
                'description' =>
                'Restaurant owner with full system access.',
            ],

            [
                'name' => 'Administrator',
                'code' => 'ADMIN',
                'description' =>
                'System administrator with broad application access.',
            ],

            [
                'name' => 'Manager',
                'code' => 'MANAGER',
                'description' =>
                'Restaurant operational manager.',
            ],

            [
                'name' => 'Cashier',
                'code' => 'CASHIER',
                'description' =>
                'Cashier and POS operator.',
            ],

            [
                'name' => 'Waiter',
                'code' => 'WAITER',
                'description' =>
                'Restaurant waiter.',
            ],
        ];

        foreach ($roles as $role) {
            DB::table('roles')
                ->updateOrInsert(
                    [
                        'code' =>
                        $role['code'],
                    ],
                    [
                        'name' =>
                        $role['name'],

                        'description' =>
                        $role['description'],

                        'is_active' =>
                        true,

                        'updated_at' =>
                        $now,
                    ]
                );
        }

        /*
        |--------------------------------------------------------------------------
        | Remove Legacy Permissions
        |--------------------------------------------------------------------------
        |
        | Earlier phases used the broad:
        |
        | users.manage
        |
        | It has now been replaced with granular user-management permissions.
        |
        */

        $legacyPermissionId =
            DB::table('permissions')
            ->where(
                'code',
                'users.manage'
            )
            ->value('id');

        if ($legacyPermissionId) {
            DB::table('role_permission')
                ->where(
                    'permission_id',
                    $legacyPermissionId
                )
                ->delete();

            DB::table('permissions')
                ->where(
                    'id',
                    $legacyPermissionId
                )
                ->delete();
        }

        /*
        |--------------------------------------------------------------------------
        | Permissions
        |--------------------------------------------------------------------------
        */

        $permissions = [

            /*
             * Dashboard
             */
            [
                'Dashboard View',
                'dashboard.view',
                'Dashboard',
            ],

            /*
             * Users
             */
            [
                'Users View',
                'users.view',
                'Users',
            ],

            [
                'Users Create',
                'users.create',
                'Users',
            ],

            [
                'Users Update',
                'users.update',
                'Users',
            ],

            [
                'Users Status',
                'users.status',
                'Users',
            ],

            [
                'Users Role Assignment',
                'users.role',
                'Users',
            ],

            [
                'Users Session Revocation',
                'users.sessions.revoke',
                'Users',
            ],

            [
                'Roles View',
                'roles.view',
                'Users',
            ],

            [
                'Permissions View',
                'permissions.view',
                'Users',
            ],

            /*
             * Restaurant Settings
             */
            [
                'Restaurant Manage',
                'restaurant.manage',
                'Restaurant',
            ],

            /*
             * Tables
             */
            [
                'Tables View',
                'tables.view',
                'Tables',
            ],

            [
                'Tables Manage',
                'tables.manage',
                'Tables',
            ],

            [
                'Tables Transfer',
                'tables.transfer',
                'Tables',
            ],

            [
                'Tables Merge',
                'tables.merge',
                'Tables',
            ],

            /*
             * Menu
             */
            [
                'Menu View',
                'menu.view',
                'Menu',
            ],

            [
                'Menu Manage',
                'menu.manage',
                'Menu',
            ],

            /*
             * Orders
             */
            [
                'Orders View',
                'orders.view',
                'Orders',
            ],

            [
                'Orders Create',
                'orders.create',
                'Orders',
            ],

            [
                'Orders Confirm',
                'orders.confirm',
                'Orders',
            ],

            [
                'Orders Send Kitchen',
                'orders.send_kitchen',
                'Orders',
            ],

            [
                'Orders Serve',
                'orders.serve',
                'Orders',
            ],

            [
                'Orders Complete',
                'orders.complete',
                'Orders',
            ],

            [
                'Orders Cancel',
                'orders.cancel',
                'Orders',
            ],

            /*
             * Kitchen
             */
            [
                'Kitchen Reprint',
                'kitchen.reprint',
                'Kitchen',
            ],

            /*
             * Billing
             */
            [
                'Invoices View',
                'invoices.view',
                'Billing',
            ],

            [
                'Invoices Create',
                'invoices.create',
                'Billing',
            ],

            [
                'Invoices Void',
                'invoices.void',
                'Billing',
            ],

            [
                'Payments Create',
                'payments.create',
                'Billing',
            ],

            [
                'Refunds Create',
                'refunds.create',
                'Billing',
            ],

            /*
             * Cashier / Cash Drawer
             */
            [
                'Cash Shift View',
                'cash_shift.view',
                'Cash',
            ],

            [
                'Cash Shift Open',
                'cash_shift.open',
                'Cash',
            ],

            [
                'Cash Shift Close',
                'cash_shift.close',
                'Cash',
            ],

            [
                'Cash Drawer Open',
                'cash_drawer.open',
                'Cash',
            ],

            [
                'Cash Drawer Movement',
                'cash_drawer.movement',
                'Cash',
            ],

            /*
             * Inventory
             *
             * inventory.view
             * → Read ingredients, units and stock.
             *
             * inventory.manage
             * → Create/update units and ingredient master data.
             *
             * inventory.adjust
             * → Perform actual stock adjustments.
             *
             * These must remain separate.
             */
            [
                'Inventory View',
                'inventory.view',
                'Inventory',
            ],

            [
                'Inventory Manage',
                'inventory.manage',
                'Inventory',
            ],

            [
                'Inventory Adjust',
                'inventory.adjust',
                'Inventory',
            ],

            /*
             * Recipes
             */
            [
                'Recipes View',
                'recipes.view',
                'Recipes',
            ],

            [
                'Recipes Manage',
                'recipes.manage',
                'Recipes',
            ],

            /*
             * Suppliers
             */
            [
                'Suppliers View',
                'suppliers.view',
                'Suppliers',
            ],

            [
                'Suppliers Manage',
                'suppliers.manage',
                'Suppliers',
            ],

            /*
             * Purchases
             */
            [
                'Purchases View',
                'purchases.view',
                'Purchases',
            ],

            [
                'Purchases Create',
                'purchases.create',
                'Purchases',
            ],

            [
                'Purchases Manage',
                'purchases.manage',
                'Purchases',
            ],

            [
                'Supplier Payments',
                'purchases.pay',
                'Purchases',
            ],

            /*
             * Wastage
             */
            [
                'Wastage View',
                'wastage.view',
                'Wastage',
            ],

            [
                'Wastage Create',
                'wastage.create',
                'Wastage',
            ],

            [
                'Wastage Manage',
                'wastage.manage',
                'Wastage',
            ],

            /*
             * Expenses
             */
            [
                'Expenses View',
                'expenses.view',
                'Expenses',
            ],

            [
                'Expenses Create',
                'expenses.create',
                'Expenses',
            ],

            [
                'Expenses Manage',
                'expenses.manage',
                'Expenses',
            ],

            /*
             * Reports
             */
            [
                'Reports View',
                'reports.view',
                'Reports',
            ],

            /*
             * Business Day
             */
            [
                'Business Day View',
                'business_day.view',
                'Business Day',
            ],

            [
                'Business Day Close',
                'business_day.close',
                'Business Day',
            ],

            /*
             * Website
             */
            [
                'Website Manage',
                'website.manage',
                'Website',
            ],

            [
                'Reviews Moderate',
                'reviews.moderate',
                'Website',
            ],

            /*
             * System / Audit
             */
            [
                'Audit Logs View',
                'audit.view',
                'System',
            ],
        ];

        /*
        |--------------------------------------------------------------------------
        | Create / Update Permissions
        |--------------------------------------------------------------------------
        */

        foreach ($permissions as $permission) {
            DB::table('permissions')
                ->updateOrInsert(
                    [
                        'code' =>
                        $permission[1],
                    ],
                    [
                        'name' =>
                        $permission[0],

                        'group' =>
                        $permission[2],

                        'description' =>
                        null,

                        'updated_at' =>
                        $now,
                    ]
                );
        }

        /*
        |--------------------------------------------------------------------------
        | Load Permission and Role IDs
        |--------------------------------------------------------------------------
        */

        /** @var Collection<string, int> $permissionMap */
        $permissionMap =
            DB::table('permissions')
            ->pluck(
                'id',
                'code'
            );

        /** @var Collection<string, int> $roleMap */
        $roleMap =
            DB::table('roles')
            ->pluck(
                'id',
                'code'
            );

        /*
        |--------------------------------------------------------------------------
        | OWNER Permissions
        |--------------------------------------------------------------------------
        |
        | Owner has every permission.
        |
        */

        $this->syncPermissions(
            roleId: (int) $roleMap['OWNER'],

            permissionCodes: $permissionMap
                ->keys()
                ->all(),

            permissionMap: $permissionMap
        );

        /*
        |--------------------------------------------------------------------------
        | ADMIN Permissions
        |--------------------------------------------------------------------------
        |
        | Administrator also receives all application permissions.
        |
        | RoleHierarchyService remains responsible for preventing an ADMIN
        | from changing, disabling or taking over an OWNER account.
        |
        */

        $this->syncPermissions(
            roleId: (int) $roleMap['ADMIN'],

            permissionCodes: $permissionMap
                ->keys()
                ->all(),

            permissionMap: $permissionMap
        );

        /*
        |--------------------------------------------------------------------------
        | MANAGER Permissions
        |--------------------------------------------------------------------------
        */

        $this->syncPermissions(
            roleId: (int) $roleMap['MANAGER'],

            permissionCodes: [

                /*
                 * Dashboard
                 */
                'dashboard.view',

                /*
                 * User Management
                 */
                'users.view',
                'users.create',
                'users.update',
                'users.status',
                'users.role',
                'users.sessions.revoke',

                'roles.view',
                'permissions.view',

                /*
                 * Tables
                 */
                'tables.view',
                'tables.manage',
                'tables.transfer',
                'tables.merge',

                /*
                 * Menu
                 */
                'menu.view',
                'menu.manage',

                /*
                 * Orders
                 */
                'orders.view',
                'orders.create',
                'orders.confirm',
                'orders.send_kitchen',
                'orders.serve',
                'orders.complete',
                'orders.cancel',

                /*
                 * Kitchen
                 */
                'kitchen.reprint',

                /*
                 * Billing
                 */
                'invoices.view',
                'invoices.create',
                'invoices.void',

                'payments.create',
                'refunds.create',

                /*
                 * Cash
                 */
                'cash_shift.view',
                'cash_shift.open',
                'cash_shift.close',

                'cash_drawer.open',
                'cash_drawer.movement',

                /*
                 * Inventory
                 */
                'inventory.view',
                'inventory.manage',
                'inventory.adjust',

                /*
                 * Recipes
                 */
                'recipes.view',
                'recipes.manage',

                /*
                 * Suppliers
                 */
                'suppliers.view',
                'suppliers.manage',

                /*
                 * Purchases
                 */
                'purchases.view',
                'purchases.create',
                'purchases.manage',
                'purchases.pay',

                /*
                 * Wastage
                 */
                'wastage.view',
                'wastage.create',
                'wastage.manage',

                /*
                 * Expenses
                 */
                'expenses.view',
                'expenses.create',
                'expenses.manage',

                /*
                 * Reports
                 */
                'reports.view',

                /*
                 * Business Day
                 */
                'business_day.view',
                'business_day.close',

                /*
                 * Website
                 */
                'website.manage',
                'reviews.moderate',
            ],

            permissionMap: $permissionMap
        );

        /*
        |--------------------------------------------------------------------------
        | CASHIER Permissions
        |--------------------------------------------------------------------------
        */

        $this->syncPermissions(
            roleId: (int) $roleMap['CASHIER'],

            permissionCodes: [

                /*
                 * Dashboard
                 */
                'dashboard.view',

                /*
                 * Tables
                 */
                'tables.view',
                'tables.transfer',
                'tables.merge',

                /*
                 * Menu
                 */
                'menu.view',

                /*
                 * Orders
                 */
                'orders.view',
                'orders.create',
                'orders.confirm',
                'orders.send_kitchen',
                'orders.serve',
                'orders.complete',
                'orders.cancel',

                /*
                 * Kitchen
                 */
                'kitchen.reprint',

                /*
                 * Billing
                 */
                'invoices.view',
                'invoices.create',

                'payments.create',
                'refunds.create',

                /*
                 * Cash
                 */
                'cash_shift.view',
                'cash_shift.open',
                'cash_shift.close',

                'cash_drawer.open',
                'cash_drawer.movement',

                /*
                 * Business Day
                 */
                'business_day.view',
            ],

            permissionMap: $permissionMap
        );

        /*
        |--------------------------------------------------------------------------
        | WAITER Permissions
        |--------------------------------------------------------------------------
        */

        $this->syncPermissions(
            roleId: (int) $roleMap['WAITER'],

            permissionCodes: [
                'dashboard.view',

                'tables.view',
                'tables.transfer',

                'menu.view',

                'orders.view',
                'orders.create',
                'orders.serve',
            ],

            permissionMap: $permissionMap
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Permission Synchronization
    |--------------------------------------------------------------------------
    */

    private function syncPermissions(
        int $roleId,
        array $permissionCodes,
        Collection $permissionMap
    ): void {
        /*
         * Clear the current permissions for
         * this role before rebuilding them.
         */
        DB::table('role_permission')
            ->where(
                'role_id',
                $roleId
            )
            ->delete();

        $now = now();

        $rows = [];

        foreach (
            $permissionCodes as $permissionCode
        ) {
            $permissionId =
                $permissionMap[$permissionCode] ?? null;

            if (! $permissionId) {
                continue;
            }

            $rows[] = [
                'role_id' =>
                $roleId,

                'permission_id' =>
                (int) $permissionId,

                'created_at' =>
                $now,

                'updated_at' =>
                $now,
            ];
        }

        if ($rows !== []) {
            DB::table(
                'role_permission'
            )->insert(
                $rows
            );
        }
    }
}
