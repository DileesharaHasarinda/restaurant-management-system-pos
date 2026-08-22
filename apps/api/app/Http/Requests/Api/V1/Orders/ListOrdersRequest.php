<?php

namespace App\Http\Requests\Api\V1\Orders;

use App\Models\Order;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListOrdersRequest extends FormRequest
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
                'max:100',
            ],

            'status' => [
                'nullable',
                Rule::in(
                    Order::STATUSES
                ),
            ],

            'order_source' => [
                'nullable',
                Rule::in(
                    Order::SOURCES
                ),
            ],

            'order_type' => [
                'nullable',
                Rule::in(
                    Order::TYPES
                ),
            ],

            'table_id' => [
                'nullable',
                'integer',
                'exists:tables,id',
            ],

            'business_day_id' => [
                'nullable',
                'integer',
                'exists:business_days,id',
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
