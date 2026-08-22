<?php

namespace App\Http\Requests\Api\V1\SupplierPayments;

use App\Models\SupplierPayment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListSupplierPaymentsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => [
                'nullable',
                'string',
                'max:150',
            ],

            'supplier_id' => [
                'nullable',
                'integer',
                'exists:suppliers,id',
            ],

            'purchase_id' => [
                'nullable',
                'integer',
                'exists:purchases,id',
            ],

            'payment_method' => [
                'nullable',

                Rule::in(
                    SupplierPayment::methods()
                ),
            ],

            'date_from' => [
                'nullable',
                'date',
            ],

            'date_to' => [
                'nullable',
                'date',
                'after_or_equal:date_from',
            ],

            'per_page' => [
                'nullable',
                'integer',
                'min:1',
                'max:100',
            ],
        ];
    }
}
