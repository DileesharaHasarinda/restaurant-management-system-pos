<?php

namespace App\Http\Requests\Api\V1\Inventory;

use Illuminate\Foundation\Http\FormRequest;

class PhysicalStockCountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_request_id' => [
                'required',
                'uuid',
            ],

            'unit_id' => [
                'required',
                'integer',
                'exists:units,id',
            ],

            /*
             * Zero is valid.
             *
             * Example:
             * Physical count confirms ingredient
             * stock is completely empty.
             */
            'actual_quantity' => [
                'required',
                'numeric',
                'gte:0',
            ],

            /*
             * Mandatory Phase 25 requirement.
             */
            'reason' => [
                'required',
                'string',
                'max:255',
            ],
        ];
    }
}
