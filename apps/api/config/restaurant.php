<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Customer QR Ordering URL
    |--------------------------------------------------------------------------
    |
    | Local:
    | http://127.0.0.1:3000/order/t
    |
    | Production:
    | https://restaurant.lk/order/t
    |
    */

    'customer_order_base_url' => rtrim(
        env(
            'CUSTOMER_ORDER_BASE_URL',
            'http://127.0.0.1:3000/order/t'
        ),
        '/'
    ),
];
