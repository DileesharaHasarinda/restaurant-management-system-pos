<?php

namespace App\Http\Requests\Api\V1\Inventory;

use Illuminate\Foundation\Http\FormRequest;

class OpeningStockRequest extends FormRequest
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
             * Cost per ingredient BASE unit.
             *
             * Rice base unit G:
             * Rs. 0.30 per G
             */
            'unit_cost' => [
                'required',
                'numeric',
                'min:0',
            ],

            'reference' => [
                'nullable',
                'string',
                'max:190',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ];
    }
}
