<?php

namespace App\Exceptions;

use RuntimeException;

class WastageOperationException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode =
        'WASTAGE_ERROR',
        public readonly int $status =
        409
    ) {
        parent::__construct(
            $message
        );
    }
}
