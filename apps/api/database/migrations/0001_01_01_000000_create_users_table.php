<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();

            $table->string('name', 100);
            $table->string('code', 50)->unique();

            $table->string('description', 255)->nullable();

            $table->boolean('is_active')
                ->default(true);

            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->id();

            $table->string('name', 150);
            $table->string('code', 120)->unique();
            $table->string('group', 100)->nullable();

            $table->string('description', 255)->nullable();

            $table->timestamps();
        });

        Schema::create('role_permission', function (Blueprint $table) {
            $table->id();

            $table->foreignId('role_id')
                ->constrained('roles')
                ->cascadeOnDelete();

            $table->foreignId('permission_id')
                ->constrained('permissions')
                ->cascadeOnDelete();

            $table->timestamps();

            $table->unique([
                'role_id',
                'permission_id',
            ]);
        });

        Schema::create('users', function (Blueprint $table) {
            $table->id();

            $table->foreignId('role_id')
                ->nullable()
                ->constrained('roles')
                ->nullOnDelete();

            $table->string('name', 150);

            $table->string('username', 100)
                ->unique();

            $table->string('email', 190)
                ->nullable()
                ->unique();

            $table->string('phone', 30)
                ->nullable();

            $table->timestamp('email_verified_at')
                ->nullable();

            $table->string('password');

            $table->string('status', 30)
                ->default('ACTIVE')
                ->index();

            $table->timestamp('last_login_at')
                ->nullable();

            $table->rememberToken();

            $table->timestamps();
        });

        Schema::create(
            'password_reset_tokens',
            function (Blueprint $table) {
                $table->string('email')
                    ->primary();

                $table->string('token');

                $table->timestamp('created_at')
                    ->nullable();
            }
        );

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')
                ->primary();

            $table->foreignId('user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete();

            $table->string('ip_address', 45)
                ->nullable();

            $table->text('user_agent')
                ->nullable();

            $table->longText('payload');

            $table->integer('last_activity')
                ->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
        Schema::dropIfExists('role_permission');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
    }
};
