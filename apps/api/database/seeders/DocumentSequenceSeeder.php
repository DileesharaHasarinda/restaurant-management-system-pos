<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DocumentSequenceSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        $sequences = [
            [
                'sequence_type' =>
                'INVOICE',

                'prefix' =>
                'INV',

                'padding' =>
                6,

                'reset_period' =>
                'NEVER',
            ],

            [
                'sequence_type' =>
                'ORDER',

                'prefix' =>
                'ORD',

                'padding' =>
                6,

                'reset_period' =>
                'NEVER',
            ],

            [
                'sequence_type' =>
                'TOKEN',

                'prefix' =>
                'TOK',

                'padding' =>
                4,

                'reset_period' =>
                'DAILY',
            ],
        ];

        foreach ($sequences as $sequence) {
            DB::table(
                'document_sequences'
            )->updateOrInsert(
                [
                    'sequence_type' =>
                    $sequence['sequence_type'],
                ],
                [
                    'prefix' =>
                    $sequence['prefix'],

                    'padding' =>
                    $sequence['padding'],

                    'reset_period' =>
                    $sequence['reset_period'],

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
}
