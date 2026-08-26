<?php

namespace App\Exceptions;

use RuntimeException;

final class PaymentOperationException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode =
        'PAYMENT_OPERATION_FAILED',
        public readonly int $status =
        409
    ) {
        parent::__construct(
            $message
        );
    }
}
