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
         * Fail fast on unsafe production configuration.
         */
        if ($this->app->isProduction()) {
            $problems = [];

            if (config('app.debug')) {
                $problems[] = 'APP_DEBUG must be false';
            }

            if (! config('session.encrypt')) {
                $problems[] = 'SESSION_ENCRYPT must be true';
            }

            if (! str_starts_with((string) config('app.url'), 'https://')) {
                $problems[] = 'APP_URL must be https://';
            }

            if ($problems !== [] && ! $this->app->runningInConsole()) {
                throw new \RuntimeException(
                    'Unsafe production configuration: ' . implode('; ', $problems) . '.'
                );
            }
        }

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
            ): array {
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

                return [
                    Limit::perMinute(
                        5
                    )->by(
                        $login
                            . '|'
                            . $request->ip()
                    ),

                    // Per-IP cap across all logins (blocks password spraying).
                    Limit::perMinute(
                        20
                    )->by(
                        'ip:'
                            . $request->ip()
                    ),
                ];
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
