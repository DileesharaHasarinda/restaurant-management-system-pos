<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(
            'restaurant_settings',
            function (Blueprint $table): void {
                $table->json('opening_hours')
                    ->nullable();

                $table->json('social_media')
                    ->nullable();

                $table->json('website_contact')
                    ->nullable();
            }
        );

        Schema::create(
            'document_sequences',
            function (Blueprint $table): void {
                $table->id();

                /*
                 * INVOICE
                 * ORDER
                 * TOKEN
                 */
                $table->string(
                    'sequence_type',
                    30
                )->unique();

                $table->string(
                    'prefix',
                    20
                );

                $table->unsignedBigInteger(
                    'current_number'
                )->default(0);

                $table->unsignedTinyInteger(
                    'padding'
                )->default(6);

                /*
                 * NEVER
                 * DAILY
                 * MONTHLY
                 * YEARLY
                 */
                $table->string(
                    'reset_period',
                    20
                )->default('NEVER');

                $table->string(
                    'last_reset_key',
                    20
                )->nullable();

                $table->boolean(
                    'is_active'
                )->default(true);

                $table->timestamps();

                $table->index([
                    'sequence_type',
                    'is_active',
                ]);
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists(
            'document_sequences'
        );

        Schema::table(
            'restaurant_settings',
            function (Blueprint $table): void {
                $table->dropColumn([
                    'opening_hours',
                    'social_media',
                    'website_contact',
                ]);
            }
        );
    }
};
