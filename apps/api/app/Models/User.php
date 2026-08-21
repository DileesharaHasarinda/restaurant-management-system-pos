<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Collection;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens;
    use HasFactory;
    use Notifiable;

    protected $fillable = [
        'role_id',
        'name',
        'username',
        'email',
        'phone',
        'password',
        'status',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function isActive(): bool
    {
        $this->loadMissing('role');

        return $this->status === 'ACTIVE'
            && $this->role !== null
            && $this->role->is_active;
    }

    public function hasRole(string $roleCode): bool
    {
        $this->loadMissing('role');

        return $this->role?->code === $roleCode;
    }

    public function permissionCodes(): Collection
    {
        $this->loadMissing('role.permissions');

        if (! $this->role) {
            return collect();
        }

        return $this->role
            ->permissions
            ->pluck('code')
            ->values();
    }

    public function hasPermission(string $permission): bool
    {
        $this->loadMissing('role.permissions');

        if (! $this->role || ! $this->role->is_active) {
            return false;
        }

        return $this->role
            ->permissions
            ->contains(
                fn(Permission $item): bool =>
                $item->code === $permission
            );
    }

    public function hasAnyPermission(
        array|string $permissions
    ): bool {
        $permissions = is_array($permissions)
            ? $permissions
            : [$permissions];

        foreach ($permissions as $permission) {
            if ($this->hasPermission($permission)) {
                return true;
            }
        }

        return false;
    }
}
