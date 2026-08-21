<?php

namespace App\Http\Requests\Api\V1\Tables;

use App\Models\RestaurantTable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTableStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            /*
             * OCCUPIED is intentionally excluded.
             *
             * OCCUPIED is controlled automatically
             * by Table Session.
             */
            'status' => [
                'required',
                Rule::in([
                    RestaurantTable::STATUS_AVAILABLE,
                    RestaurantTable::STATUS_RESERVED,
                    RestaurantTable::STATUS_CLEANING,
                    RestaurantTable::STATUS_OUT_OF_SERVICE,
                ]),
            ],
        ];
    }
}
