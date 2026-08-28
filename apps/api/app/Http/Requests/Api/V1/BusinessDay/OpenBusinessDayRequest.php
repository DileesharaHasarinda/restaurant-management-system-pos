<?php

namespace App\Http\Requests\Api\V1\BusinessDay;

use Illuminate\Foundation\Http\FormRequest;

final class OpenBusinessDayRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (
            $this->has(
                'notes'
            )
        ) {
            $notes =
                $this->input(
                    'notes'
                );

            $this->merge([
                'notes' =>
                is_string(
                    $notes
                )
                    ? trim(
                        $notes
                    )
                    : $notes,
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],
        ];
    }
}
