<?php

use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Restaurant private channels
|--------------------------------------------------------------------------
*/

Broadcast::channel(
    'user.{userId}',
    function (
        User $user,
        int $userId
    ): bool {
        return $user->id === $userId;
    }
);

Broadcast::channel(
    'restaurant.orders',
    function (
        User $user
    ): bool {
        return $user->hasAnyPermission([
            'orders.view',
            'orders.confirm',
            'orders.send_kitchen',
        ]);
    }
);

Broadcast::channel(
    'restaurant.inventory',
    function (
        User $user
    ): bool {
        return $user->hasAnyPermission([
            'inventory.view',
            'inventory.adjust',
        ]);
    }
);

Broadcast::channel(
    'restaurant.cash',
    function (
        User $user
    ): bool {
        return $user->hasAnyPermission([
            'cash_shift.view',
            'cash_drawer.open',
        ]);
    }
);

Broadcast::channel(
    'restaurant.system',
    function (
        User $user
    ): bool {
        return $user->hasPermission(
            'audit.view'
        );
    }
);
