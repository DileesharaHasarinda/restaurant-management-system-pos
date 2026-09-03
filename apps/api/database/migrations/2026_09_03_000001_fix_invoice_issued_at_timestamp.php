<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /*
    |--------------------------------------------------------------------------
    | Fix Invoice Issued Timestamp
    |--------------------------------------------------------------------------
    |
    | Production/local database:
    | MySQL / MariaDB
    |
    | Test database:
    | SQLite :memory:
    |
    | The original MySQL invoice schema accidentally created issued_at as:
    |
    | TIMESTAMP NOT NULL
    | DEFAULT CURRENT_TIMESTAMP
    | ON UPDATE CURRENT_TIMESTAMP
    |
    | Therefore any later invoice update, such as recording payment, could
    | overwrite the original invoice issue time.
    |
    | SQLite does not implement MySQL's ON UPDATE CURRENT_TIMESTAMP behavior,
    | so there is no column alteration required for SQLite.
    |--------------------------------------------------------------------------
    */

    public function up(): void
    {
        if (
            ! Schema::hasTable(
                'invoices'
            )
        ) {
            return;
        }

        /*
        |--------------------------------------------------------------------------
        | Repair Existing Invoice Issue Times
        |--------------------------------------------------------------------------
        |
        | Existing rows may already have had issued_at overwritten by the
        | MySQL ON UPDATE behavior.
        |
        | Invoice creation time is the best historical value available for
        | recovering the original issue timestamp.
        |--------------------------------------------------------------------------
        */

        DB::table(
            'invoices'
        )
            ->whereNotNull(
                'created_at'
            )
            ->update([
                'issued_at' =>
                DB::raw(
                    'created_at'
                ),
            ]);

        /*
        |--------------------------------------------------------------------------
        | Database-Specific Schema Fix
        |--------------------------------------------------------------------------
        */

        $driver =
            DB::connection()
            ->getDriverName();

        /*
         * MySQL / MariaDB require a native ALTER statement to remove the
         * accidental DEFAULT / ON UPDATE attributes.
         */
        if (
            $driver === 'mysql'
            ||
            $driver === 'mariadb'
        ) {
            DB::statement(
                '
                ALTER TABLE invoices
                MODIFY issued_at TIMESTAMP NOT NULL
                '
            );

            return;
        }

        /*
         * SQLite requires no action.
         *
         * The original SQLite timestamp column does not have MySQL's
         * ON UPDATE CURRENT_TIMESTAMP behavior, and SQLite does not support
         * ALTER TABLE ... MODIFY.
         *
         * This intentional no-op keeps the in-memory feature-test database
         * compatible with production migrations.
         */
        if (
            $driver === 'sqlite'
        ) {
            return;
        }

        /*
         * Other database engines also do not inherit the MySQL-specific
         * ON UPDATE attribute from the original Laravel schema definition.
         *
         * No destructive/rebuild migration is necessary.
         */
    }

    /*
    |--------------------------------------------------------------------------
    | Rollback
    |--------------------------------------------------------------------------
    */

    public function down(): void
    {
        if (
            ! Schema::hasTable(
                'invoices'
            )
        ) {
            return;
        }

        $driver =
            DB::connection()
            ->getDriverName();

        /*
         * Restore the old MySQL/MariaDB definition only when explicitly
         * rolling this migration back.
         */
        if (
            $driver === 'mysql'
            ||
            $driver === 'mariadb'
        ) {
            DB::statement(
                '
                ALTER TABLE invoices
                MODIFY issued_at TIMESTAMP NOT NULL
                DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP
                '
            );

            return;
        }

        /*
         * SQLite has nothing to roll back because up() did not alter its
         * column definition.
         */
    }
};
