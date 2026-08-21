<?php

namespace App\Http\Requests\Api\V1\Users;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $email = $this->input('email');

        $this->merge([
            'name' =>
            trim(
                (string)
                $this->input('name')
            ),

            'username' =>
            Str::lower(
                trim(
                    (string)
                    $this->input(
                        'username'
                    )
                )
            ),

            'email' =>
            filled($email)
                ? Str::lower(
                    trim(
                        (string)
                        $email
                    )
                )
                : null,

            'phone' =>
            filled(
                $this->input('phone')
            )
                ? trim(
                    (string)
                    $this->input(
                        'phone'
                    )
                )
                : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'name' => [
                'required',
                'string',
                'max:150',
            ],

            'username' => [
                'required',
                'string',
                'min:3',
                'max:100',
                'regex:/^[A-Za-z0-9._-]+$/',
                Rule::unique(
                    'users',
                    'username'
                ),
            ],

            'email' => [
                'nullable',
                'email:rfc',
                'max:190',
                Rule::unique(
                    'users',
                    'email'
                ),
            ],

            'phone' => [
                'nullable',
                'string',
                'max:30',
            ],

            'role_id' => [
                'required',
                'integer',

                Rule::exists(
                    'roles',
                    'id'
                )->where(
                    fn($query) =>
                    $query->where(
                        'is_active',
                        true
                    )
                ),
            ],

            'password' => [
                'required',
                'string',
                'confirmed',

                Password::min(12)
                    ->mixedCase()
                    ->numbers()
                    ->symbols(),
            ],
        ];
    }
}
