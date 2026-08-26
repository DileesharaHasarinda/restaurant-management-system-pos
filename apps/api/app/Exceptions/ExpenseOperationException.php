<?php

namespace App\Exceptions;

use RuntimeException;

class ExpenseOperationException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode =
        'EXPENSE_OPERATION_FAILED',
        public readonly int $status =
        409
    ) {
        parent::__construct(
            $message
        );
    }
}
