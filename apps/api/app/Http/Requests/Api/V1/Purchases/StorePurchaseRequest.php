<?php

namespace App\Http\Requests\Api\V1\Purchases;

use Illuminate\Foundation\Http\FormRequest;

class StorePurchaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'supplier_id' => [
                'required',
                'integer',
                'exists:suppliers,id',
            ],

            'purchase_date' => [
                'required',
                'date',
            ],

            'supplier_invoice_number' => [
                'nullable',
                'string',
                'max:100',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],

            'items' => [
                'required',
                'array',
                'min:1',
                'max:200',
            ],

            'items.*.ingredient_id' => [
                'required',
                'integer',
                'distinct',
                'exists:ingredients,id',
            ],

            'items.*.unit_id' => [
                'required',
                'integer',
                'exists:units,id',
            ],

            'items.*.quantity' => [
                'required',
                'numeric',
                'gt:0',
            ],

            /*
             * Cost per selected purchase unit.
             *
             * Example:
             * 5 KG Rice
             * unit_cost = Rs. 1000 / KG
             */
            'items.*.unit_cost' => [
                'required',
                'numeric',
                'min:0',
            ],
        ];
    }
}
