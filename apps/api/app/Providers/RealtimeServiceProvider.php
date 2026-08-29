<?php

namespace App\Providers;

use App\Observers\StaffRealtimeObserver;
use Illuminate\Support\ServiceProvider;

final class RealtimeServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        foreach (
            StaffRealtimeObserver::models()
            as $modelClass
        ) {
            $modelClass::observe(
                StaffRealtimeObserver::class,
            );
        }
    }
}
