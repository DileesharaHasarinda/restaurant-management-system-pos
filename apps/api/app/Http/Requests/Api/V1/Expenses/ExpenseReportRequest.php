<?php

namespace App\Http\Requests\Api\V1\Expenses;

use App\Models\Expense;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExpenseReportRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (
            filled(
                $this->input(
                    'payment_method'
                )
            )
        ) {
            $this->merge([
                'payment_method' =>
                strtoupper(
                    trim(
                        (string)
                        $this->input(
                            'payment_method'
                        )
                    )
                ),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'date_from' => [
                'nullable',
                'date',
            ],

            'date_to' => [
                'nullable',
                'date',
                'after_or_equal:date_from',
            ],

            'expense_category_id' => [
                'nullable',
                'integer',
                'exists:expense_categories,id',
            ],

            'payment_method' => [
                'nullable',
                Rule::in(
                    Expense::paymentMethods()
                ),
            ],
        ];
    }
}
