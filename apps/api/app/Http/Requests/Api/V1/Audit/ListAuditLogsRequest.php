<?php

namespace App\Http\Requests\Api\V1\Audit;

use Illuminate\Foundation\Http\FormRequest;

class ListAuditLogsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'search' =>
            $this->filled('search')
                ? trim(
                    (string) $this->input('search')
                )
                : null,

            'action' =>
            $this->filled('action')
                ? trim(
                    (string) $this->input('action')
                )
                : null,

            'entity_type' =>
            $this->filled('entity_type')
                ? trim(
                    (string) $this->input('entity_type')
                )
                : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'search' => [
                'nullable',
                'string',
                'max:150',
            ],

            'action' => [
                'nullable',
                'string',
                'max:100',
            ],

            'entity_type' => [
                'nullable',
                'string',
                'max:120',
            ],

            'user_id' => [
                'nullable',
                'integer',
                'exists:users,id',
            ],

            'date_from' => [
                'nullable',
                'date_format:Y-m-d',
            ],

            'date_to' => [
                'nullable',
                'date_format:Y-m-d',
                'after_or_equal:date_from',
            ],

            'page' => [
                'nullable',
                'integer',
                'min:1',
            ],

            'per_page' => [
                'nullable',
                'integer',
                'min:10',
                'max:100',
            ],
        ];
    }
}
