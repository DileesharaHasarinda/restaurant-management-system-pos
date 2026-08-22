<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolePermissionSeeder::class,
            UnitSeeder::class,
            RestaurantSettingsSeeder::class,
            DocumentSequenceSeeder::class,
            ExpenseCategorySeeder::class,
            MenuSeeder::class,
        ]);
    }
}
