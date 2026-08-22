<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class MenuSeeder extends Seeder
{
    public function run(): void
    {
        $now =
            now();

        $categories = [
            [
                'name' => 'Rice',
                'slug' => 'rice',
                'sort_order' => 10,
            ],

            [
                'name' => 'Kottu',
                'slug' => 'kottu',
                'sort_order' => 20,
            ],

            [
                'name' => 'Noodles',
                'slug' => 'noodles',
                'sort_order' => 30,
            ],

            [
                'name' => 'Drinks',
                'slug' => 'drinks',
                'sort_order' => 40,
            ],

            [
                'name' => 'Desserts',
                'slug' => 'desserts',
                'sort_order' => 50,
            ],
        ];

        foreach (
            $categories as $category
        ) {
            DB::table(
                'categories'
            )->updateOrInsert(
                [
                    'slug' =>
                    $category['slug'],
                ],
                [
                    'parent_id' =>
                    null,

                    'name' =>
                    $category['name'],

                    'description' =>
                    null,

                    'sort_order' =>
                    $category['sort_order'],

                    'is_active' =>
                    true,

                    'is_visible_on_website' =>
                    true,

                    'is_visible_on_qr' =>
                    true,

                    'created_at' =>
                    $now,

                    'updated_at' =>
                    $now,
                ]
            );
        }

        DB::table(
            'addon_groups'
        )->updateOrInsert(
            [
                'name' =>
                'Extras',
            ],
            [
                'description' =>
                'Optional extras for menu items.',

                'is_required' =>
                false,

                'is_active' =>
                true,

                'sort_order' =>
                10,

                'created_at' =>
                $now,

                'updated_at' =>
                $now,
            ]
        );

        $groupId =
            DB::table(
                'addon_groups'
            )
            ->where(
                'name',
                'Extras'
            )
            ->value(
                'id'
            );

        $addons = [
            [
                'name' =>
                'Extra Chicken',

                'sku' =>
                'ADD-EXTRA-CHICKEN',

                'sort_order' =>
                10,
            ],

            [
                'name' =>
                'Cheese',

                'sku' =>
                'ADD-CHEESE',

                'sort_order' =>
                20,
            ],

            [
                'name' =>
                'Egg',

                'sku' =>
                'ADD-EGG',

                'sort_order' =>
                30,
            ],

            [
                'name' =>
                'Extra Sauce',

                'sku' =>
                'ADD-EXTRA-SAUCE',

                'sort_order' =>
                40,
            ],
        ];

        foreach (
            $addons as $addon
        ) {
            DB::table(
                'addons'
            )->updateOrInsert(
                [
                    'sku' =>
                    $addon['sku'],
                ],
                [
                    'addon_group_id' =>
                    $groupId,

                    'name' =>
                    $addon['name'],

                    /*
                     * Configure real price
                     * through menu management.
                     */
                    'price' =>
                    0,

                    'is_available' =>
                    true,

                    'is_active' =>
                    true,

                    'sort_order' =>
                    $addon['sort_order'],

                    'created_at' =>
                    $now,

                    'updated_at' =>
                    $now,
                ]
            );
        }
    }
}
