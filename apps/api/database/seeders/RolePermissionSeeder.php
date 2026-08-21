<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $roles = [
            [
                'name' => 'Owner',
                'code' => 'OWNER',
                'description' => 'Restaurant owner with full access.',
            ],
            [
                'name' => 'Administrator',
                'code' => 'ADMIN',
                'description' => 'System administrator.',
            ],
            [
                'name' => 'Manager',
                'code' => 'MANAGER',
                'description' => 'Restaurant manager.',
            ],
            [
                'name' => 'Cashier',
                'code' => 'CASHIER',
                'description' => 'Cashier and POS operator.',
            ],
            [
                'name' => 'Waiter',
                'code' => 'WAITER',
                'description' => 'Restaurant waiter.',
            ],
        ];

        foreach ($roles as $role) {
            DB::table('roles')->updateOrInsert(
                [
                    'code' => $role['code'],
                ],
                [
                    'name' => $role['name'],
                    'description' =>
                    $role['description'],
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        $permissions = [
            ['Dashboard View', 'dashboard.view', 'Dashboard'],

            ['Users View', 'users.view', 'Users'],
            ['Users Manage', 'users.manage', 'Users'],

            ['Restaurant Manage', 'restaurant.manage', 'Restaurant'],

            ['Tables View', 'tables.view', 'Tables'],
            ['Tables Manage', 'tables.manage', 'Tables'],
            ['Tables Transfer', 'tables.transfer', 'Tables'],
            ['Tables Merge', 'tables.merge', 'Tables'],

            ['Menu View', 'menu.view', 'Menu'],
            ['Menu Manage', 'menu.manage', 'Menu'],

            ['Orders View', 'orders.view', 'Orders'],
            ['Orders Create', 'orders.create', 'Orders'],
            ['Orders Confirm', 'orders.confirm', 'Orders'],
            ['Orders Send Kitchen', 'orders.send_kitchen', 'Orders'],
            ['Orders Serve', 'orders.serve', 'Orders'],
            ['Orders Complete', 'orders.complete', 'Orders'],
            ['Orders Cancel', 'orders.cancel', 'Orders'],

            ['Kitchen Reprint', 'kitchen.reprint', 'Kitchen'],

            ['Invoices View', 'invoices.view', 'Billing'],
            ['Invoices Create', 'invoices.create', 'Billing'],
            ['Invoices Void', 'invoices.void', 'Billing'],

            ['Payments Create', 'payments.create', 'Billing'],
            ['Refunds Create', 'refunds.create', 'Billing'],

            ['Cash Shift View', 'cash_shift.view', 'Cash'],
            ['Cash Shift Open', 'cash_shift.open', 'Cash'],
            ['Cash Shift Close', 'cash_shift.close', 'Cash'],

            ['Cash Drawer Open', 'cash_drawer.open', 'Cash'],
            ['Cash Drawer Movement', 'cash_drawer.movement', 'Cash'],

            ['Inventory View', 'inventory.view', 'Inventory'],
            ['Inventory Adjust', 'inventory.adjust', 'Inventory'],

            ['Recipes View', 'recipes.view', 'Recipes'],
            ['Recipes Manage', 'recipes.manage', 'Recipes'],

            ['Suppliers View', 'suppliers.view', 'Suppliers'],
            ['Suppliers Manage', 'suppliers.manage', 'Suppliers'],

            ['Purchases View', 'purchases.view', 'Purchases'],
            ['Purchases Create', 'purchases.create', 'Purchases'],
            ['Purchases Manage', 'purchases.manage', 'Purchases'],
            ['Supplier Payments', 'purchases.pay', 'Purchases'],

            ['Wastage View', 'wastage.view', 'Wastage'],
            ['Wastage Create', 'wastage.create', 'Wastage'],
            ['Wastage Manage', 'wastage.manage', 'Wastage'],

            ['Expenses View', 'expenses.view', 'Expenses'],
            ['Expenses Create', 'expenses.create', 'Expenses'],
            ['Expenses Manage', 'expenses.manage', 'Expenses'],

            ['Reports View', 'reports.view', 'Reports'],

            ['Business Day View', 'business_day.view', 'Business Day'],
            ['Business Day Close', 'business_day.close', 'Business Day'],

            ['Website Manage', 'website.manage', 'Website'],
            ['Reviews Moderate', 'reviews.moderate', 'Website'],

            ['Audit Logs View', 'audit.view', 'System'],
        ];

        foreach ($permissions as $permission) {
            DB::table('permissions')->updateOrInsert(
                [
                    'code' => $permission[1],
                ],
                [
                    'name' => $permission[0],
                    'group' => $permission[2],
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        $allPermissions = DB::table('permissions')
            ->pluck('id', 'code');

        $rolesByCode = DB::table('roles')
            ->pluck('id', 'code');

        $this->assignPermissions(
            $rolesByCode['OWNER'],
            $allPermissions->keys()->all(),
            $allPermissions
        );

        $this->assignPermissions(
            $rolesByCode['ADMIN'],
            $allPermissions->keys()->all(),
            $allPermissions
        );

        $managerPermissions = $allPermissions
            ->keys()
            ->reject(
                fn(string $code) =>
                in_array(
                    $code,
                    [
                        'users.manage',
                    ],
                    true
                )
            )
            ->all();

        $this->assignPermissions(
            $rolesByCode['MANAGER'],
            $managerPermissions,
            $allPermissions
        );

        $this->assignPermissions(
            $rolesByCode['CASHIER'],
            [
                'dashboard.view',
                'tables.view',
                'tables.transfer',
                'tables.merge',
                'menu.view',
                'orders.view',
                'orders.create',
                'orders.confirm',
                'orders.send_kitchen',
                'orders.serve',
                'orders.complete',
                'orders.cancel',
                'kitchen.reprint',
                'invoices.view',
                'invoices.create',
                'payments.create',
                'refunds.create',
                'cash_shift.view',
                'cash_shift.open',
                'cash_shift.close',
                'cash_drawer.open',
                'cash_drawer.movement',
                'business_day.view',
            ],
            $allPermissions
        );

        $this->assignPermissions(
            $rolesByCode['WAITER'],
            [
                'dashboard.view',
                'tables.view',
                'tables.transfer',
                'menu.view',
                'orders.view',
                'orders.create',
                'orders.serve',
            ],
            $allPermissions
        );
    }

    private function assignPermissions(
        int $roleId,
        array $codes,
        $permissions
    ): void {
        DB::table('role_permission')
            ->where('role_id', $roleId)
            ->delete();

        $now = now();

        foreach ($codes as $code) {
            if (!isset($permissions[$code])) {
                continue;
            }

            DB::table('role_permission')->insert([
                'role_id' => $roleId,
                'permission_id' =>
                $permissions[$code],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
