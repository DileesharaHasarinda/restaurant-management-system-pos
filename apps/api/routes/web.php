<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'application' => 'Restaurant Management API',
        'status' => 'running',
        'environment' => app()->environment(),
        'version' => '0.1.0',
    ]);
});
