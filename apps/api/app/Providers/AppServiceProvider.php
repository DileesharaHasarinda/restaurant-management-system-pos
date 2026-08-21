<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        RateLimiter::for(
            'api',
            function (
                Request $request
            ): Limit {
                return Limit::perMinute(120)
                    ->by(
                        (string) (
                            $request
                            ->user()
                            ?->getAuthIdentifier()
                            ?? $request->ip()
                        )
                    );
            }
        );

        RateLimiter::for(
            'login',
            function (
                Request $request
            ): Limit {
                $login = Str::lower(
                    trim(
                        (string)
                        $request->input(
                            'login',
                            'unknown'
                        )
                    )
                );

                return Limit::perMinute(5)
                    ->by(
                        $login
                            . '|'
                            . $request->ip()
                    );
            }
        );
    }
}
