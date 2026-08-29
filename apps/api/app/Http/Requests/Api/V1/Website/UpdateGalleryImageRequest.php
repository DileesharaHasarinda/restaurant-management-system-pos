<?php

namespace App\Http\Requests\Api\V1\Website;

use Illuminate\Foundation\Http\FormRequest;

class UpdateGalleryImageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
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
                'required',
                'integer',
                'min:0',
                'max:100000',
            ],
        ];
    }
}
