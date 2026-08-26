<?php

namespace App\Exceptions;

use RuntimeException;

final class InvoiceOperationException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode =
        'INVOICE_OPERATION_FAILED',
        public readonly int $status =
        409
    ) {
        parent::__construct(
            $message
        );
    }
}
