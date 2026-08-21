<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RestaurantSettingsSeeder extends Seeder
{
    public function run(): void
    {
        DB::table('restaurant_settings')
            ->updateOrInsert(
                [
                    'id' => 1,
                ],
                [
                    'business_name' => 'Restaurant',
                    'legal_name' => null,
                    'phone' => null,
                    'email' => null,
                    'address' => null,
                    'currency' => 'LKR',
                    'timezone' => 'Asia/Colombo',
                    'tax_enabled' => false,
                    'default_tax_rate' => 0,
                    'service_charge_enabled' =>
                    false,
                    'default_service_charge_rate' =>
                    0,
                    'logo_path' => null,
                    'receipt_header' => null,
                    'receipt_footer' =>
                    'Thank you. Please visit again.',
                    'settings' => json_encode([
                        'country' => 'LK',
                        'date_format' => 'Y-m-d',
                        'time_format' => 'H:i',
                    ]),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
    }
}
