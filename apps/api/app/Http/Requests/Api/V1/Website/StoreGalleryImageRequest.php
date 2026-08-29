<?php

namespace App\Http\Requests\Api\V1\Website;

use Illuminate\Foundation\Http\FormRequest;

class StoreGalleryImageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'image' => [
                'required',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
            ],

            'caption' => [
                'nullable',
                'string',
                'max:190',
            ],

            'alt_text' => [
                'nullable',
                'string',
                'max:255',
            ],

            'sort_order' => [
                'nullable',
                'integer',
                'min:0',
                'max:100000',
            ],

            'is_active' => [
                'nullable',
                'boolean',
            ],
        ];
    }
}
