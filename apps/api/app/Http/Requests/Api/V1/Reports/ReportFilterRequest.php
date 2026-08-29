<?php

namespace App\Http\Requests\Api\V1\Reports;

use App\Models\Order;
use App\Models\Payment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReportFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date_from' => [
                'nullable',
                'date_format:Y-m-d',
            ],

            'date_to' => [
                'nullable',
                'date_format:Y-m-d',
                'after_or_equal:date_from',
            ],

            'business_day_id' => [
                'nullable',
                'integer',
                'exists:business_days,id',
            ],

            'order_type' => [
                'nullable',
                Rule::in(
                    Order::TYPES
                ),
            ],

            'order_source' => [
                'nullable',
                Rule::in(
                    Order::SOURCES
                ),
            ],

            'status' => [
                'nullable',
                Rule::in(
                    Order::STATUSES
                ),
            ],

            'payment_method' => [
                'nullable',
                Rule::in(
                    Payment::METHODS
                ),
            ],

            'supplier_id' => [
                'nullable',
                'integer',
                'exists:suppliers,id',
            ],

            'ingredient_id' => [
                'nullable',
                'integer',
                'exists:ingredients,id',
            ],

            'cashier_shift_id' => [
                'nullable',
                'integer',
                'exists:cashier_shifts,id',
            ],

            'expense_category_id' => [
                'nullable',
                'integer',
                'exists:expense_categories,id',
            ],

            'limit' => [
                'nullable',
                'integer',
                'min:1',
                'max:100',
            ],
        ];
    }
}
