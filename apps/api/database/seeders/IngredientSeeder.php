<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class IngredientSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $units =
            DB::table('units')
            ->pluck(
                'id',
                'symbol'
            );

        $ingredients = [
            [
                'sku' => 'ING-CARROT',
                'name' => 'Carrot',
                'unit' => 'G',
            ],

            [
                'sku' => 'ING-CHICKEN',
                'name' => 'Chicken',
                'unit' => 'G',
            ],

            [
                'sku' => 'ING-RICE',
                'name' => 'Rice',
                'unit' => 'G',
            ],

            [
                'sku' => 'ING-OIL',
                'name' => 'Oil',
                'unit' => 'ML',
            ],

            [
                'sku' => 'ING-EGG',
                'name' => 'Egg',
                'unit' => 'PCS',
            ],

            [
                'sku' => 'ING-CHEESE',
                'name' => 'Cheese',
                'unit' => 'G',
            ],
        ];

        foreach ($ingredients as $ingredient) {
            $unitId =
                $units[$ingredient['unit']] ?? null;

            if (! $unitId) {
                continue;
            }

            DB::table('ingredients')
                ->updateOrInsert(
                    [
                        'sku' =>
                        $ingredient['sku'],
                    ],
                    [
                        'name' =>
                        $ingredient['name'],

                        'base_unit_id' =>
                        $unitId,

                        /*
                         * Stock values remain zero
                         * until opening inventory or
                         * purchase processing.
                         */
                        'current_stock' =>
                        0,

                        'reorder_level' =>
                        0,

                        'average_cost' =>
                        0,

                        'track_stock' =>
                        true,

                        'is_active' =>
                        true,

                        'storage_location' =>
                        null,

                        'created_at' =>
                        $now,

                        'updated_at' =>
                        $now,
                    ]
                );
        }
    }
}
