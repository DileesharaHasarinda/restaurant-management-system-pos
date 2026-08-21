<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create(
            'reviews',
            function (Blueprint $table) {
                $table->id();

                $table->string(
                    'customer_name',
                    150
                );

                $table->string(
                    'customer_email',
                    190
                )->nullable();

                $table->unsignedTinyInteger(
                    'rating'
                );

                $table->text('review');

                /*
                 * PENDING
                 * APPROVED
                 * REJECTED
                 */
                $table->string('status', 30)
                    ->default('PENDING')
                    ->index();

                $table->foreignId('reviewed_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamp('reviewed_at')
                    ->nullable();

                $table->boolean('is_featured')
                    ->default(false);

                $table->timestamps();
            }
        );

        Schema::create(
            'gallery_images',
            function (Blueprint $table) {
                $table->id();

                $table->string('title', 190)
                    ->nullable();

                $table->string('image_path');

                $table->string(
                    'alt_text',
                    255
                )->nullable();

                $table->unsignedInteger(
                    'sort_order'
                )->default(0);

                $table->boolean('is_active')
                    ->default(true);

                $table->foreignId('uploaded_by')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->timestamps();
            }
        );

        Schema::create(
            'website_settings',
            function (Blueprint $table) {
                $table->id();

                $table->string(
                    'key',
                    150
                )->unique();

                $table->json('value')
                    ->nullable();

                $table->boolean('is_public')
                    ->default(true);

                $table->timestamps();
            }
        );

        Schema::create(
            'audit_logs',
            function (Blueprint $table) {
                $table->id();

                $table->foreignId('user_id')
                    ->nullable()
                    ->constrained('users')
                    ->nullOnDelete();

                $table->string(
                    'action',
                    100
                )->index();

                $table->string(
                    'entity_type',
                    120
                )->nullable();

                $table->unsignedBigInteger(
                    'entity_id'
                )->nullable();

                $table->json('old_values')
                    ->nullable();

                $table->json('new_values')
                    ->nullable();

                $table->string(
                    'ip_address',
                    45
                )->nullable();

                $table->text('user_agent')
                    ->nullable();

                $table->string(
                    'request_method',
                    10
                )->nullable();

                $table->string(
                    'request_path',
                    500
                )->nullable();

                $table->json('metadata')
                    ->nullable();

                $table->timestamp('created_at');

                $table->index([
                    'entity_type',
                    'entity_id',
                ]);

                $table->index([
                    'user_id',
                    'created_at',
                ]);
            }
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('website_settings');
        Schema::dropIfExists('gallery_images');
        Schema::dropIfExists('reviews');
    }
};
