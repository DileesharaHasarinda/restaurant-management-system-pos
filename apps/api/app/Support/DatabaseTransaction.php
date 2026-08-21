<?php

namespace App\Support;

use Closure;
use Illuminate\Support\Facades\DB;

final class DatabaseTransaction
{
    public static function run(
        Closure $callback,
        int $attempts = 3
    ): mixed {
        return DB::transaction(
            $callback,
            attempts: $attempts
        );
    }
}
