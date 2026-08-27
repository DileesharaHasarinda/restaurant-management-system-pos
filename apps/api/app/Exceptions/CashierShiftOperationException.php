<?php

namespace App\Exceptions;

use RuntimeException;

final class CashierShiftOperationException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode =
        'CASHIER_SHIFT_OPERATION_FAILED',
        public readonly int $status =
        409
    ) {
        parent::__construct(
            $message
        );
    }
}
