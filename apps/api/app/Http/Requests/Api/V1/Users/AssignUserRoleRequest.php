<?php

namespace App\Http\Requests\Api\V1\Users;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AssignUserRoleRequest extends FormRequest
{
    /*
    |--------------------------------------------------------------------------
    | Authorization
    |--------------------------------------------------------------------------
    |
    | Route middleware already checks:
    |
    | users.role
    |
    | RoleHierarchyService performs the important business-level hierarchy
    | authorization before the role is actually changed.
    |
    */

    public function authorize(): bool
    {
        return true;
    }

    /*
    |--------------------------------------------------------------------------
    | Validation
    |--------------------------------------------------------------------------
    */

    public function rules(): array
    {
        return [
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
        ];
    }
}
