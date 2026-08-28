<?php

namespace App\Http\Requests\Api\V1\BusinessDay;

use Illuminate\Foundation\Http\FormRequest;

class CloseBusinessDayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'closing_notes' =>
            filled(
                $this->input(
                    'closing_notes'
                )
            )
                ? trim(
                    (string)
                    $this->input(
                        'closing_notes'
                    )
                )
                : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'client_request_id' => [
                'required',
                'uuid',
                'max:64',
            ],

            'closing_notes' => [
                'nullable',
                'string',
                'max:2000',
            ],
        ];
    }
}
