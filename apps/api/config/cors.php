<?php

return [

    /*
    |--------------------------------------------------------------------------
    | CORS Paths
    |--------------------------------------------------------------------------
    */

    'paths' => [
        'api/*',
        'sanctum/csrf-cookie',
        'broadcasting/auth',
    ],

    /*
    |--------------------------------------------------------------------------
    | Allowed Methods
    |--------------------------------------------------------------------------
    */

    'allowed_methods' => [
        '*',
    ],

    /*
    |--------------------------------------------------------------------------
    | Allowed Origins
    |--------------------------------------------------------------------------
    |
    | Fixed development / LAN origins.
    |
    | Localhost and 127.0.0.1 development ports are handled by
    | allowed_origins_patterns below so Vite can safely move between
    | ports such as 5173, 5174, 5175, etc.
    |
    */

    'allowed_origins' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env(
            'CORS_ALLOWED_ORIGINS',
            ''
        ))
    ))),

    /*
    |--------------------------------------------------------------------------
    | Allowed Origin Patterns
    |--------------------------------------------------------------------------
    |
    | Local development only.
    |
    | Examples accepted:
    |
    | http://localhost:3000
    | http://localhost:5173
    | http://localhost:5174
    | http://localhost:5175
    | http://127.0.0.1:3000
    | http://127.0.0.1:5175
    |
    */

    // Localhost dev ports are never allowed in production.
    'allowed_origins_patterns' => env('APP_ENV') === 'production'
        ? []
        : [
            '#^http://localhost:\d+$#',
            '#^http://127\.0\.0\.1:\d+$#',
        ],

    /*
    |--------------------------------------------------------------------------
    | Allowed Headers
    |--------------------------------------------------------------------------
    */

    'allowed_headers' => [
        'Accept',
        'Authorization',
        'Content-Type',
        'X-Requested-With',
        'X-XSRF-TOKEN',
        'Idempotency-Key',
    ],

    /*
    |--------------------------------------------------------------------------
    | Exposed Headers
    |--------------------------------------------------------------------------
    */

    'exposed_headers' => [],

    /*
    |--------------------------------------------------------------------------
    | Preflight Cache
    |--------------------------------------------------------------------------
    */

    'max_age' => 0,

    /*
    |--------------------------------------------------------------------------
    | Credentials
    |--------------------------------------------------------------------------
    |
    | Keep enabled because Sanctum first-party SPA support is configured.
    | Bearer-token clients also continue to work normally.
    |
    */

    'supports_credentials' => true,

];
