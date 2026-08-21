<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class UnitSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $baseUnits = [
            [
                'name' => 'Gram',
                'symbol' => 'g',
                'measurement_type' => 'MASS',
            ],
            [
                'name' => 'Millilitre',
                'symbol' => 'ml',
                'measurement_type' => 'VOLUME',
            ],
            [
                'name' => 'Piece',
                'symbol' => 'pcs',
                'measurement_type' => 'COUNT',
            ],
            [
                'name' => 'Pack',
                'symbol' => 'pack',
                'measurement_type' => 'COUNT',
            ],
            [
                'name' => 'Bottle',
                'symbol' => 'bottle',
                'measurement_type' => 'COUNT',
            ],
        ];

        foreach ($baseUnits as $unit) {
            DB::table('units')->updateOrInsert(
                [
                    'symbol' => $unit['symbol'],
                ],
                [
                    'name' => $unit['name'],
                    'measurement_type' =>
                    $unit['measurement_type'],
                    'base_unit_id' => null,
                    'conversion_factor' => 1,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        $gramId = DB::table('units')
            ->where('symbol', 'g')
            ->value('id');

        $millilitreId = DB::table('units')
            ->where('symbol', 'ml')
            ->value('id');

        DB::table('units')->updateOrInsert(
            [
                'symbol' => 'kg',
            ],
            [
                'name' => 'Kilogram',
                'measurement_type' => 'MASS',
                'base_unit_id' => $gramId,
                'conversion_factor' => 1000,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );

        DB::table('units')->updateOrInsert(
            [
                'symbol' => 'L',
            ],
            [
                'name' => 'Litre',
                'measurement_type' => 'VOLUME',
                'base_unit_id' => $millilitreId,
                'conversion_factor' => 1000,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]
        );
    }
}
