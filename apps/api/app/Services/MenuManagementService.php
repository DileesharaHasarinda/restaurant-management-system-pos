<?php

namespace App\Services;

use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\Category;
use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

final class MenuManagementService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Categories
    |--------------------------------------------------------------------------
    */

    public function createCategory(
        User $actor,
        array $data
    ): Category {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $data
            ): Category {
                $category =
                    Category::query()
                    ->create([
                        'name' =>
                        trim(
                            $data['name']
                        ),

                        'slug' =>
                        $this->uniqueCategorySlug(
                            $data['name']
                        ),

                        'description' =>
                        $data['description']
                            ?? null,

                        'sort_order' =>
                        $data['sort_order']
                            ?? 0,

                        'is_active' =>
                        $data['is_active']
                            ?? true,

                        'is_visible_on_website' =>
                        $data['is_visible_on_website']
                            ?? true,

                        'is_visible_on_qr' =>
                        $data['is_visible_on_qr']
                            ?? true,
                    ]);

                $this->auditLogger->record(
                    action: 'MENU_CATEGORY_CREATED',

                    entityType: 'category',

                    entityId: $category->id,

                    newValues: $category
                        ->toArray(),

                    userId: $actor->id
                );

                return $category;
            }
        );
    }

    public function updateCategory(
        User $actor,
        Category $category,
        array $data
    ): Category {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $category,
                $data
            ): Category {
                $locked =
                    Category::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $category->id
                    );

                $old =
                    $locked
                    ->toArray();

                $locked->fill([
                    'name' =>
                    trim(
                        $data['name']
                    ),

                    'slug' =>
                    $this->uniqueCategorySlug(
                        $data['name'],
                        $locked->id
                    ),

                    'description' =>
                    $data['description']
                        ?? null,

                    'sort_order' =>
                    $data['sort_order'],
                ]);

                $locked->save();

                $this->auditLogger->record(
                    action: 'MENU_CATEGORY_UPDATED',

                    entityType: 'category',

                    entityId: $locked->id,

                    oldValues: $old,

                    newValues: $locked
                        ->fresh()
                        ->toArray(),

                    userId: $actor->id
                );

                return $locked->refresh();
            }
        );
    }

    public function updateCategoryState(
        User $actor,
        Category $category,
        array $data
    ): Category {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $category,
                $data
            ): Category {
                $locked =
                    Category::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $category->id
                    );

                $old =
                    $locked->only([
                        'is_active',
                        'is_visible_on_website',
                        'is_visible_on_qr',
                        'sort_order',
                    ]);

                $locked->fill(
                    array_intersect_key(
                        $data,
                        array_flip([
                            'is_active',
                            'is_visible_on_website',
                            'is_visible_on_qr',
                            'sort_order',
                        ])
                    )
                );

                $locked->save();

                $this->auditLogger->record(
                    action: 'MENU_CATEGORY_STATE_UPDATED',

                    entityType: 'category',

                    entityId: $locked->id,

                    oldValues: $old,

                    newValues: $locked->only([
                        'is_active',
                        'is_visible_on_website',
                        'is_visible_on_qr',
                        'sort_order',
                    ]),

                    userId: $actor->id
                );

                return $locked->refresh();
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Menu Items
    |--------------------------------------------------------------------------
    */

    public function createMenuItem(
        User $actor,
        array $data
    ): MenuItem {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $data
            ): MenuItem {
                $variants =
                    $data['variants']
                    ?? [];

                $addons =
                    $data['addons']
                    ?? [];

                $this->validateVariantDefaults(
                    $variants
                );

                $item =
                    MenuItem::query()
                    ->create([
                        'category_id' =>
                        $data['category_id'],

                        'sku' =>
                        null,

                        'name' =>
                        trim(
                            $data['name']
                        ),

                        'slug' =>
                        $this->uniqueMenuItemSlug(
                            $data['name']
                        ),

                        'description' =>
                        $data['description']
                            ?? null,

                        'price' =>
                        round(
                            (float)
                            $data['price'],
                            2
                        ),

                        'tax_rate' =>
                        round(
                            (float)
                            (
                                $data['tax_rate']
                                ?? 0
                            ),
                            4
                        ),

                        'is_available' =>
                        $data['is_available']
                            ?? true,

                        'is_active' =>
                        $data['is_active']
                            ?? true,

                        'is_visible_on_website' =>
                        $data['is_visible_on_website']
                            ?? true,

                        'is_visible_on_qr' =>
                        $data['is_visible_on_qr']
                            ?? true,

                        'has_variants' =>
                        $variants !== [],

                        'sort_order' =>
                        $data['sort_order']
                            ?? 0,

                        'metadata' =>
                        [],
                    ]);

                /*
                 * Stable menu SKU.
                 */
                $item->sku =
                    sprintf(
                        'MENU-%06d',
                        $item->id
                    );

                $item->save();

                $this->syncVariants(
                    $item,
                    $variants
                );

                $this->syncAddons(
                    $item,
                    $addons
                );

                $this->auditLogger->record(
                    action: 'MENU_ITEM_CREATED',

                    entityType: 'menu_item',

                    entityId: $item->id,

                    newValues: [
                        'name' =>
                        $item->name,

                        'price' =>
                        $item->price,

                        'category_id' =>
                        $item->category_id,

                        'has_variants' =>
                        $item->has_variants,
                    ],

                    userId: $actor->id
                );

                return $this->loadMenuItem(
                    $item
                );
            }
        );
    }

    public function updateMenuItem(
        User $actor,
        MenuItem $item,
        array $data
    ): MenuItem {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $item,
                $data
            ): MenuItem {
                $locked =
                    MenuItem::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $item->id
                    );

                $variants =
                    $data['variants'];

                $addons =
                    $data['addons'];

                $this->validateVariantDefaults(
                    $variants
                );

                $old =
                    $locked->only([
                        'category_id',
                        'name',
                        'description',
                        'price',
                        'tax_rate',
                        'has_variants',
                        'sort_order',
                    ]);

                $locked->fill([
                    'category_id' =>
                    $data['category_id'],

                    'name' =>
                    trim(
                        $data['name']
                    ),

                    'slug' =>
                    $this->uniqueMenuItemSlug(
                        $data['name'],
                        $locked->id
                    ),

                    'description' =>
                    $data['description']
                        ?? null,

                    'price' =>
                    round(
                        (float)
                        $data['price'],
                        2
                    ),

                    'tax_rate' =>
                    round(
                        (float)
                        (
                            $data['tax_rate']
                            ?? 0
                        ),
                        4
                    ),

                    'has_variants' =>
                    $variants !== [],

                    'sort_order' =>
                    $data['sort_order'],
                ]);

                $locked->save();

                $this->syncVariants(
                    $locked,
                    $variants
                );

                $this->syncAddons(
                    $locked,
                    $addons
                );

                $this->auditLogger->record(
                    action: 'MENU_ITEM_UPDATED',

                    entityType: 'menu_item',

                    entityId: $locked->id,

                    oldValues: $old,

                    newValues: $locked->fresh()
                        ->only([
                            'category_id',
                            'name',
                            'description',
                            'price',
                            'tax_rate',
                            'has_variants',
                            'sort_order',
                        ]),

                    userId: $actor->id
                );

                return $this->loadMenuItem(
                    $locked
                );
            }
        );
    }

    public function updateMenuItemState(
        User $actor,
        MenuItem $item,
        array $data
    ): MenuItem {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $item,
                $data
            ): MenuItem {
                $locked =
                    MenuItem::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $item->id
                    );

                $allowed = [
                    'is_active',
                    'is_available',
                    'is_visible_on_website',
                    'is_visible_on_qr',
                    'sort_order',
                ];

                $old =
                    $locked->only(
                        $allowed
                    );

                $locked->fill(
                    array_intersect_key(
                        $data,
                        array_flip(
                            $allowed
                        )
                    )
                );

                $locked->save();

                $this->auditLogger->record(
                    action: 'MENU_ITEM_STATE_UPDATED',

                    entityType: 'menu_item',

                    entityId: $locked->id,

                    oldValues: $old,

                    newValues: $locked->only(
                        $allowed
                    ),

                    userId: $actor->id
                );

                return $this->loadMenuItem(
                    $locked
                );
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Photo
    |--------------------------------------------------------------------------
    */

    public function uploadPhoto(
        User $actor,
        MenuItem $item,
        UploadedFile $photo
    ): MenuItem {
        $column =
            $this->menuImageColumn();

        $newPath =
            $photo->store(
                'menu/items',
                'public'
            );

        try {
            [
                $updated,
                $oldPath,
            ] = DatabaseTransaction::run(
                function () use (
                    $actor,
                    $item,
                    $column,
                    $newPath
                ): array {
                    $locked =
                        MenuItem::query()
                        ->lockForUpdate()
                        ->findOrFail(
                            $item->id
                        );

                    $oldPath =
                        $locked->getAttribute(
                            $column
                        );

                    $locked->setAttribute(
                        $column,
                        $newPath
                    );

                    $locked->save();

                    $this->auditLogger
                        ->record(
                            action: 'MENU_ITEM_PHOTO_UPDATED',

                            entityType: 'menu_item',

                            entityId: $locked->id,

                            oldValues: [
                                'photo' =>
                                $oldPath,
                            ],

                            newValues: [
                                'photo' =>
                                $newPath,
                            ],

                            userId: $actor->id
                        );

                    return [
                        $this->loadMenuItem(
                            $locked
                        ),
                        $oldPath,
                    ];
                }
            );
        } catch (Throwable $exception) {
            Storage::disk('public')
                ->delete(
                    $newPath
                );

            throw $exception;
        }

        if ($oldPath) {
            Storage::disk('public')
                ->delete(
                    $oldPath
                );
        }

        return $updated;
    }

    public function removePhoto(
        User $actor,
        MenuItem $item
    ): MenuItem {
        $column =
            $this->menuImageColumn();

        [
            $updated,
            $oldPath,
        ] = DatabaseTransaction::run(
            function () use (
                $actor,
                $item,
                $column
            ): array {
                $locked =
                    MenuItem::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $item->id
                    );

                $oldPath =
                    $locked
                    ->getAttribute(
                        $column
                    );

                $locked->setAttribute(
                    $column,
                    null
                );

                $locked->save();

                $this->auditLogger
                    ->record(
                        action: 'MENU_ITEM_PHOTO_REMOVED',

                        entityType: 'menu_item',

                        entityId: $locked->id,

                        oldValues: [
                            'photo' =>
                            $oldPath,
                        ],

                        newValues: [
                            'photo' =>
                            null,
                        ],

                        userId: $actor->id
                    );

                return [
                    $this->loadMenuItem(
                        $locked
                    ),
                    $oldPath,
                ];
            }
        );

        if ($oldPath) {
            Storage::disk('public')
                ->delete(
                    $oldPath
                );
        }

        return $updated;
    }

    /*
    |--------------------------------------------------------------------------
    | Add-on Groups
    |--------------------------------------------------------------------------
    */

    public function createAddonGroup(
        User $actor,
        array $data
    ): AddonGroup {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $data
            ): AddonGroup {
                $group =
                    AddonGroup::query()
                    ->create([
                        'name' =>
                        trim(
                            $data['name']
                        ),

                        'description' =>
                        $data['description']
                            ?? null,

                        'is_required' =>
                        $data['is_required']
                            ?? false,

                        'is_active' =>
                        $data['is_active']
                            ?? true,

                        'sort_order' =>
                        $data['sort_order']
                            ?? 0,
                    ]);

                $this->auditLogger
                    ->record(
                        action: 'ADDON_GROUP_CREATED',

                        entityType: 'addon_group',

                        entityId: $group->id,

                        newValues: $group
                            ->toArray(),

                        userId: $actor->id
                    );

                return $group
                    ->load('addons');
            }
        );
    }

    public function createAddon(
        User $actor,
        array $data
    ): Addon {
        return DatabaseTransaction::run(
            function () use (
                $actor,
                $data
            ): Addon {
                $addon =
                    Addon::query()
                    ->create([
                        'addon_group_id' =>
                        $data['addon_group_id'],

                        'name' =>
                        trim(
                            $data['name']
                        ),

                        'sku' =>
                        null,

                        'price' =>
                        round(
                            (float)
                            $data['price'],
                            2
                        ),

                        'is_available' =>
                        $data['is_available']
                            ?? true,

                        'is_active' =>
                        $data['is_active']
                            ?? true,

                        'sort_order' =>
                        $data['sort_order']
                            ?? 0,
                    ]);

                $addon->sku =
                    sprintf(
                        'ADD-%06d',
                        $addon->id
                    );

                $addon->save();

                $this->auditLogger
                    ->record(
                        action: 'ADDON_CREATED',

                        entityType: 'addon',

                        entityId: $addon->id,

                        newValues: $addon
                            ->toArray(),

                        userId: $actor->id
                    );

                return $addon
                    ->load('group');
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Variant synchronization
    |--------------------------------------------------------------------------
    */

    private function syncVariants(
        MenuItem $item,
        array $variants
    ): void {
        if ($variants === []) {
            $item->variants()
                ->update([
                    'is_active' =>
                    false,

                    'is_available' =>
                    false,

                    'is_default' =>
                    false,
                ]);

            return;
        }

        $seenIds = [];

        foreach (
            $variants as $index => $data
        ) {
            $variantId =
                isset($data['id'])
                ? (int) $data['id']
                : null;

            if ($variantId !== null) {
                $variant =
                    $item->variants()
                    ->whereKey(
                        $variantId
                    )
                    ->first();

                if (! $variant) {
                    throw ValidationException::withMessages([
                        "variants.{$index}.id" => [
                            'The selected variant does not belong to this menu item.',
                        ],
                    ]);
                }
            } else {
                $variant =
                    new MenuItemVariant([
                        'menu_item_id' =>
                        $item->id,
                    ]);
            }

            $variant->fill([
                'name' =>
                trim(
                    $data['name']
                ),

                'price' =>
                round(
                    (float)
                    $data['price'],
                    2
                ),

                'is_default' =>
                $data['is_default']
                    ?? false,

                'is_available' =>
                $data['is_available']
                    ?? true,

                'is_active' =>
                $data['is_active']
                    ?? true,

                'sort_order' =>
                $data['sort_order']
                    ?? $index,
            ]);

            $variant->save();

            if (! $variant->sku) {
                $variant->sku =
                    sprintf(
                        '%s-V%02d',
                        $item->sku,
                        $variant->id
                    );

                $variant->save();
            }

            $seenIds[] =
                $variant->id;
        }

        $item->variants()
            ->whereNotIn(
                'id',
                $seenIds
            )
            ->update([
                'is_active' =>
                false,

                'is_available' =>
                false,

                'is_default' =>
                false,
            ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Add-on synchronization
    |--------------------------------------------------------------------------
    */

    private function syncAddons(
        MenuItem $item,
        array $addons
    ): void {
        $sync = [];

        foreach (
            $addons as $index => $data
        ) {
            $addonId =
                (int)
                $data['addon_id'];

            if (
                isset(
                    $sync[$addonId]
                )
            ) {
                throw ValidationException::withMessages([
                    "addons.{$index}.addon_id" => [
                        'The same add-on cannot be attached more than once.',
                    ],
                ]);
            }

            $sync[$addonId] = [
                'price_override' =>
                isset(
                    $data['price_override']
                )
                    && $data['price_override'] !== null
                    ? round(
                        (float)
                        $data['price_override'],
                        2
                    )
                    : null,

                'is_default' =>
                $data['is_default']
                    ?? false,

                'sort_order' =>
                $data['sort_order']
                    ?? $index,
            ];
        }

        $item->addons()
            ->sync(
                $sync
            );
    }

    private function validateVariantDefaults(
        array $variants
    ): void {
        if ($variants === []) {
            return;
        }

        $defaults =
            collect($variants)
            ->filter(
                fn(array $variant): bool =>
                (bool)
                (
                    $variant['is_default']
                    ?? false
                )
            )
            ->count();

        if ($defaults > 1) {
            throw ValidationException::withMessages([
                'variants' => [
                    'Only one variant may be the default variant.',
                ],
            ]);
        }
    }

    private function uniqueCategorySlug(
        string $name,
        ?int $ignoreId = null
    ): string {
        return $this->uniqueSlug(
            Category::class,
            $name,
            $ignoreId
        );
    }

    private function uniqueMenuItemSlug(
        string $name,
        ?int $ignoreId = null
    ): string {
        return $this->uniqueSlug(
            MenuItem::class,
            $name,
            $ignoreId
        );
    }

    private function uniqueSlug(
        string $modelClass,
        string $name,
        ?int $ignoreId = null
    ): string {
        $base =
            Str::slug(
                $name
            );

        if ($base === '') {
            $base =
                'item';
        }

        $slug =
            $base;

        $counter =
            2;

        while (true) {
            $query =
                $modelClass::query()
                ->where(
                    'slug',
                    $slug
                );

            if ($ignoreId !== null) {
                $query->where(
                    'id',
                    '!=',
                    $ignoreId
                );
            }

            if (! $query->exists()) {
                return $slug;
            }

            $slug =
                $base . '-' . $counter;

            $counter++;
        }
    }

    private function loadMenuItem(
        MenuItem $item
    ): MenuItem {
        return $item
            ->refresh()
            ->load([
                'category',
                'variants',
                'addons.group',
            ]);
    }

    private function menuImageColumn(): string
    {
        if (
            Schema::hasColumn(
                'menu_items',
                'image_path'
            )
        ) {
            return 'image_path';
        }

        if (
            Schema::hasColumn(
                'menu_items',
                'image'
            )
        ) {
            return 'image';
        }

        throw ValidationException::withMessages([
            'photo' => [
                'The menu_items table does not contain an image storage column.',
            ],
        ]);
    }
}
