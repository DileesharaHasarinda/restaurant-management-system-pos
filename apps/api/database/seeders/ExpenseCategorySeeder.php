<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class ExpenseCategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            ['Electricity', 'ELECTRICITY'],
            ['Water', 'WATER'],
            ['Gas', 'GAS'],
            ['Rent', 'RENT'],
            ['Salary', 'SALARY'],
            ['Transport', 'TRANSPORT'],
            ['Internet', 'INTERNET'],
            ['Cleaning', 'CLEANING'],
            ['Maintenance', 'MAINTENANCE'],
            ['Marketing', 'MARKETING'],
            ['Other', 'OTHER'],
        ];

        foreach ($categories as $category) {
            DB::table('expense_categories')
                ->updateOrInsert(
                    [
                        'code' => $category[1],
                    ],
                    [
                        'name' => $category[0],
                        'is_active' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]
                );
        }
    }
}
