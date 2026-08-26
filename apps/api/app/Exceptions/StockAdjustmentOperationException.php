<?php

namespace App\Exceptions;

use RuntimeException;

class StockAdjustmentOperationException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode =
        'STOCK_ADJUSTMENT_ERROR',
        public readonly int $status =
        409
    ) {
        parent::__construct(
            $message
        );
    }
}
