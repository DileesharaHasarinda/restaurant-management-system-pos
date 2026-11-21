<?php

namespace Tests\Feature;

use App\Exceptions\ManagerAuthorizationException;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\ManagerAuthorizationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Tests\TestCase;

class AuthHardeningTest extends TestCase
{
    use RefreshDatabase;

    private function user(string $username, array $permissions = []): User
    {
        $role = Role::query()->create([
            'name' => $username,
            'code' => Str::upper($username) . Str::random(4),
            'description' => 'test',
            'is_active' => true,
        ]);

        $ids = [];

        foreach ($permissions as $code) {
            $ids[] = Permission::query()->firstOrCreate(
                ['code' => $code],
                ['name' => $code, 'group' => 'test', 'description' => $code]
            )->id;
        }

        $role->permissions()->sync($ids);

        return User::query()->create([
            'role_id' => $role->id,
            'name' => $username,
            'username' => $username,
            'email' => "{$username}@example.test",
            'password' => Hash::make('correct-password'),
            'status' => 'ACTIVE',
        ]);
    }

    public function test_manager_override_is_throttled_after_five_failures(): void
    {
        $cashier = $this->user('cashier1');
        $this->user('manager1', ['orders.cancel_after_kitchen']);

        $service = app(ManagerAuthorizationService::class);

        $attempt = fn () => $service->authorize(
            $cashier,
            'orders.cancel_after_kitchen',
            'manager1',
            'wrong-password',
            'test'
        );

        for ($i = 0; $i < 5; $i++) {
            try {
                $attempt();
                $this->fail('Expected failure.');
            } catch (ManagerAuthorizationException $e) {
                $this->assertSame(403, $e->status);
            }
        }

        // Sixth attempt is blocked even with the CORRECT password.
        try {
            $service->authorize(
                $cashier,
                'orders.cancel_after_kitchen',
                'manager1',
                'correct-password',
                'test'
            );
            $this->fail('Expected throttle.');
        } catch (ManagerAuthorizationException $e) {
            $this->assertSame(429, $e->status);
        }

        RateLimiter::clear('manager-auth:' . $cashier->id);
    }

    public function test_login_cookie_mode_sets_httponly_cookie_and_hides_token(): void
    {
        $this->user('waiter1');

        $response = $this->withHeaders(['X-Auth-Mode' => 'cookie'])
            ->postJson('/api/v1/auth/login', [
                'login' => 'waiter1',
                'password' => 'correct-password',
                'device_name' => 'ops-web',
            ]);

        $response->assertOk()->assertJsonPath('data.access_token', null);

        $cookie = collect($response->headers->getCookies())
            ->first(fn ($c) => $c->getName() === 'ops_token');

        $this->assertNotNull($cookie);
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('strict', $cookie->getSameSite());
    }

    public function test_cookie_auth_requires_csrf_header_and_works_with_it(): void
    {
        $this->user('waiter2');

        $login = $this->withHeaders(['X-Auth-Mode' => 'cookie'])
            ->postJson('/api/v1/auth/login', [
                'login' => 'waiter2',
                'password' => 'correct-password',
                'device_name' => 'ops-web',
            ]);

        $token = collect($login->headers->getCookies())
            ->first(fn ($c) => $c->getName() === 'ops_token')->getValue();

        $this->withUnencryptedCookie('ops_token', $token)
            ->withCredentials()
            ->getJson('/api/v1/auth/me')
            ->assertStatus(403)
            ->assertJsonPath('code', 'CSRF_HEADER_REQUIRED');

        $this->withUnencryptedCookie('ops_token', $token)
            ->withCredentials()
            ->withHeaders(['X-Requested-With' => 'XMLHttpRequest'])
            ->getJson('/api/v1/auth/me')
            ->assertOk();
    }

    public function test_bearer_login_still_returns_token(): void
    {
        $this->user('pos1');

        $this->postJson('/api/v1/auth/login', [
            'login' => 'pos1',
            'password' => 'correct-password',
            'device_name' => 'pos',
        ])->assertOk()->assertJsonStructure(['data' => ['access_token']]);
    }

    public function test_unknown_login_is_hashed_in_audit_log(): void
    {
        $this->postJson('/api/v1/auth/login', [
            'login' => 'hunter2-typed-as-username',
            'password' => 'x',
            'device_name' => 'pos',
        ])->assertStatus(401);

        $this->assertDatabaseMissing('audit_logs', [
            'action' => 'AUTH_LOGIN_FAILED',
            'metadata' => json_encode(['login' => 'hunter2-typed-as-username']),
        ]);
        $this->assertStringNotContainsString(
            'hunter2-typed-as-username',
            json_encode(\App\Models\AuditLog::all()->toArray())
        );
    }

    public function test_gallery_upload_is_reencoded_and_strips_appended_payload(): void
    {
        \Illuminate\Support\Facades\Storage::fake('public');

        $admin = $this->user('webadmin', ['website.manage']);

        $source = \Illuminate\Http\UploadedFile::fake()->image('a.jpg', 300, 300);
        $payload = '<?php echo "pwned"; ?>';
        file_put_contents($source->getRealPath(), $payload, FILE_APPEND);

        \Laravel\Sanctum\Sanctum::actingAs($admin, ['staff']);

        $this->postJson('/api/v1/gallery', [
            'image' => $source,
            'caption' => 'x',
        ])->assertSuccessful();

        $files = \Illuminate\Support\Facades\Storage::disk('public')->allFiles('website/gallery');
        $this->assertCount(1, $files);

        $stored = \Illuminate\Support\Facades\Storage::disk('public')->get($files[0]);
        $this->assertStringNotContainsString('pwned', $stored);
        $this->assertNotFalse(@imagecreatefromstring($stored));
    }

    public function test_token_without_staff_ability_is_rejected(): void
    {
        $user = $this->user('limited1');

        \Laravel\Sanctum\Sanctum::actingAs($user, ['something-else']);
        $this->getJson('/api/v1/auth/me')->assertStatus(403);

        \Laravel\Sanctum\Sanctum::actingAs($user, ['staff']);
        $this->getJson('/api/v1/auth/me')->assertOk();
    }
}
