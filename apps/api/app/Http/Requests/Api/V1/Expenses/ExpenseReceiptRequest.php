<?php

namespace App\Http\Requests\Api\V1\Expenses;

use Illuminate\Foundation\Http\FormRequest;

class ExpenseReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'receipt' => [
                'required',
                'file',
                'mimes:pdf,jpg,jpeg,png',
                'max:10240',
            ],
        ];
    }
}
