<?php

namespace App\Http\Requests\Api\V1\PublicApi;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;

class StorePublicReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $email =
            $this->input(
                'customer_email'
            );

        $this->merge([
            'customer_name' =>
            trim(
                (string)
                $this->input(
                    'customer_name'
                )
            ),

            'customer_email' =>
            filled(
                $email
            )
                ? Str::lower(
                    trim(
                        (string)
                        $email
                    )
                )
                : null,

            'review' =>
            trim(
                (string)
                $this->input(
                    'review'
                )
            ),
        ]);
    }

    public function rules(): array
    {
        return [
            'customer_name' => [
                'required',
                'string',
                'max:150',
            ],

            'customer_email' => [
                'nullable',
                'email:rfc',
                'max:190',
            ],

            'rating' => [
                'required',
                'integer',
                'min:1',
                'max:5',
            ],

            'review' => [
                'required',
                'string',
                'min:5',
                'max:2000',
            ],
        ];
    }
}
