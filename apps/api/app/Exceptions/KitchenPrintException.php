<?php

namespace App\Exceptions;

use RuntimeException;

class KitchenPrintException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode =
        'KITCHEN_PRINT_ERROR',
        public readonly int $status = 409
    ) {
        parent::__construct($message);
    }
}
