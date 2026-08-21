<?php

namespace App\Http\Requests\Api\V1\Restaurant;

use Illuminate\Foundation\Http\FormRequest;

class UploadRestaurantLogoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'logo' => [
                'required',
                'file',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'logo.required' =>
            'Please select a restaurant logo.',

            'logo.image' =>
            'The logo must be a valid image.',

            'logo.max' =>
            'The logo must not exceed 5 MB.',
        ];
    }
}
