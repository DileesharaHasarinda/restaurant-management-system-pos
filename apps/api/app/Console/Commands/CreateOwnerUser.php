<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\DatabaseTransaction;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;

class CreateOwnerUser extends Command
{
    protected $signature =
    'app:create-owner';

    protected $description =
    'Create the initial restaurant owner user';

    public function handle(
        AuditLogger $auditLogger
    ): int {
        $role = Role::query()
            ->where('code', 'OWNER')
            ->where('is_active', true)
            ->first();

        if (! $role) {
            $this->error(
                'OWNER role was not found. Run the database seeders first.'
            );

            return self::FAILURE;
        }

        $name = trim(
            (string)
            $this->ask(
                'Owner name'
            )
        );

        $username = trim(
            (string)
            $this->ask(
                'Owner username'
            )
        );

        $emailInput = trim(
            (string)
            $this->ask(
                'Owner email (optional)'
            )
        );

        $email = $emailInput !== ''
            ? $emailInput
            : null;

        $phoneInput = trim(
            (string)
            $this->ask(
                'Owner phone (optional)'
            )
        );

        $phone = $phoneInput !== ''
            ? $phoneInput
            : null;

        if (
            $name === ''
            || $username === ''
        ) {
            $this->error(
                'Name and username are required.'
            );

            return self::FAILURE;
        }

        if (
            ! preg_match(
                '/^[A-Za-z0-9._-]+$/',
                $username
            )
        ) {
            $this->error(
                'Username may contain only letters, numbers, dot, underscore and hyphen.'
            );

            return self::FAILURE;
        }

        if (
            User::query()
            ->where(
                'username',
                $username
            )
            ->exists()
        ) {
            $this->error(
                'That username already exists.'
            );

            return self::FAILURE;
        }

        if (
            $email !== null
            && ! filter_var(
                $email,
                FILTER_VALIDATE_EMAIL
            )
        ) {
            $this->error(
                'Invalid email address.'
            );

            return self::FAILURE;
        }

        if (
            $email !== null
            && User::query()
            ->where(
                'email',
                $email
            )
            ->exists()
        ) {
            $this->error(
                'That email address already exists.'
            );

            return self::FAILURE;
        }

        $password = (string)
        $this->secret(
            'Password (minimum 12 characters)'
        );

        if (
            mb_strlen($password) < 12
        ) {
            $this->error(
                'Password must contain at least 12 characters.'
            );

            return self::FAILURE;
        }

        $passwordConfirmation =
            (string)
            $this->secret(
                'Confirm password'
            );

        if (
            $password
            !== $passwordConfirmation
        ) {
            $this->error(
                'Passwords do not match.'
            );

            return self::FAILURE;
        }

        $user = DatabaseTransaction::run(
            function () use (
                $role,
                $name,
                $username,
                $email,
                $phone,
                $password,
                $auditLogger
            ): User {
                $user =
                    User::query()->create([
                        'role_id' =>
                        $role->id,

                        'name' =>
                        $name,

                        'username' =>
                        $username,

                        'email' =>
                        $email,

                        'phone' =>
                        $phone,

                        'password' =>
                        Hash::make(
                            $password
                        ),

                        'status' =>
                        'ACTIVE',
                    ]);

                $auditLogger->record(
                    action: 'OWNER_USER_CREATED',
                    entityType: 'user',
                    entityId: $user->id,
                    newValues: [
                        'name' =>
                        $user->name,

                        'username' =>
                        $user->username,

                        'role' =>
                        'OWNER',
                    ],
                    userId: $user->id
                );

                return $user;
            }
        );

        $this->newLine();

        $this->info(
            'Owner account created successfully.'
        );

        $this->line(
            'User ID: ' . $user->id
        );

        $this->line(
            'Username: ' .
                $user->username
        );

        return self::SUCCESS;
    }
}
