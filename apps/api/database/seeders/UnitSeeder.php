<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class UnitSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        /*
        |--------------------------------------------------------------------------
        | Root Units
        |--------------------------------------------------------------------------
        |
        | These units are the lowest stock units used by the
        | conversion engine.
        |
        */

        $rootUnits = [
            [
                'name' => 'Gram',
                'symbol' => 'G',
                'measurement_type' => 'MASS',
            ],

            [
                'name' => 'Millilitre',
                'symbol' => 'ML',
                'measurement_type' => 'VOLUME',
            ],

            [
                'name' => 'Piece',
                'symbol' => 'PCS',
                'measurement_type' => 'COUNT',
            ],

            [
                'name' => 'Bottle',
                'symbol' => 'BOTTLE',
                'measurement_type' => 'COUNT',
            ],

            [
                'name' => 'Pack',
                'symbol' => 'PACK',
                'measurement_type' => 'COUNT',
            ],
        ];

        foreach ($rootUnits as $unit) {
            DB::table('units')
                ->updateOrInsert(
                    [
                        'symbol' =>
                        $unit['symbol'],
                    ],
                    [
                        'name' =>
                        $unit['name'],

                        'measurement_type' =>
                        $unit['measurement_type'],

                        'base_unit_id' =>
                        null,

                        'conversion_factor' =>
                        1,

                        'is_active' =>
                        true,

                        'created_at' =>
                        $now,

                        'updated_at' =>
                        $now,
                    ]
                );
        }

        /*
        |--------------------------------------------------------------------------
        | Fetch Base Unit IDs
        |--------------------------------------------------------------------------
        */

        $gramId =
            DB::table('units')
            ->where(
                'symbol',
                'G'
            )
            ->value('id');

        $millilitreId =
            DB::table('units')
            ->where(
                'symbol',
                'ML'
            )
            ->value('id');

        /*
        |--------------------------------------------------------------------------
        | Converted Units
        |--------------------------------------------------------------------------
        */

        DB::table('units')
            ->updateOrInsert(
                [
                    'symbol' => 'KG',
                ],
                [
                    'name' =>
                    'Kilogram',

                    'measurement_type' =>
                    'MASS',

                    'base_unit_id' =>
                    $gramId,

                    /*
                     * 1 KG = 1000 G
                     */
                    'conversion_factor' =>
                    1000,

                    'is_active' =>
                    true,

                    'created_at' =>
                    $now,

                    'updated_at' =>
                    $now,
                ]
            );

        DB::table('units')
            ->updateOrInsert(
                [
                    'symbol' => 'L',
                ],
                [
                    'name' =>
                    'Litre',

                    'measurement_type' =>
                    'VOLUME',

                    'base_unit_id' =>
                    $millilitreId,

                    /*
                     * 1 L = 1000 ML
                     */
                    'conversion_factor' =>
                    1000,

                    'is_active' =>
                    true,

                    'created_at' =>
                    $now,

                    'updated_at' =>
                    $now,
                ]
            );
    }
}
