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
        /*
         * Main authenticated/public API.
         */
        RateLimiter::for(
            'api',
            function (
                Request $request
            ): Limit {
                return Limit::perMinute(
                    120
                )->by(
                    (string)
                    (
                        $request
                        ->user()
                        ?->getAuthIdentifier()
                        ?? $request->ip()
                    )
                );
            }
        );

        /*
         * Authentication.
         */
        RateLimiter::for(
            'login',
            function (
                Request $request
            ): Limit {
                $login =
                    Str::lower(
                        trim(
                            (string)
                            $request->input(
                                'login',
                                'unknown'
                            )
                        )
                    );

                return Limit::perMinute(
                    5
                )->by(
                    $login
                        . '|'
                        . $request->ip()
                );
            }
        );

        /*
         * Public QR resolution.
         */
        RateLimiter::for(
            'table-qr',
            function (
                Request $request
            ): Limit {
                return Limit::perMinute(
                    60
                )->by(
                    $request->ip()
                );
            }
        );

        /*
         * Starting sessions through
         * anonymous customer QR access
         * needs a tighter limit.
         */
        RateLimiter::for(
            'public-table-session',
            function (
                Request $request
            ): Limit {
                $token =
                    (string)
                    $request->route(
                        'token'
                    );

                return Limit::perMinute(
                    10
                )->by(
                    $request->ip()
                        . '|'
                        . $token
                );
            }
        );
    }
}
