<?php

namespace App\Http\Requests\Api\V1\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'login' =>
            trim((string) $this->input('login')),

            'device_name' =>
            trim(
                (string)
                $this->input('device_name')
            ),
        ]);
    }

    public function rules(): array
    {
        return [
            'login' => [
                'required',
                'string',
                'max:190',
            ],

            'password' => [
                'required',
                'string',
            ],

            'device_name' => [
                'required',
                'string',
                'max:100',
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'login.required' =>
            'Username or email is required.',

            'password.required' =>
            'Password is required.',

            'device_name.required' =>
            'Device name is required.',
        ];
    }
}
