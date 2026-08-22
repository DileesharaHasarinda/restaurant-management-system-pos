<?php

namespace App\Http\Requests\Api\V1\Inventory;

use Illuminate\Foundation\Http\FormRequest;

class StockAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'idempotency_key' => [
                'required',
                'uuid',
                'max:64',
            ],

            'quantity' => [
                'required',
                'numeric',
                'gt:0',
            ],

            /*
             * Used for ADJUSTMENT_IN.
             *
             * If omitted, existing average cost
             * is used.
             */
            'unit_cost' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'reason' => [
                'required',
                'string',
                'min:3',
                'max:1000',
            ],

            'reference' => [
                'nullable',
                'string',
                'max:190',
            ],
        ];
    }
}
