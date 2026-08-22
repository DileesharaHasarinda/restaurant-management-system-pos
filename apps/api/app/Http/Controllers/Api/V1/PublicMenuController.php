<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\MenuItemResource;
use App\Models\Category;
use App\Support\ApiResponse;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicMenuController extends Controller
{
    public function website(
        Request $request
    ): JsonResponse {
        return $this->menu(
            $request,
            'website'
        );
    }

    public function qr(
        Request $request
    ): JsonResponse {
        return $this->menu(
            $request,
            'qr'
        );
    }

    private function menu(
        Request $request,
        string $mode
    ): JsonResponse {
        $search =
            trim(
                (string)
                $request->query(
                    'search',
                    ''
                )
            );

        $visibilityColumn =
            $mode === 'qr'
            ? 'is_visible_on_qr'
            : 'is_visible_on_website';

        $categories =
            Category::query()
            ->where(
                'is_active',
                true
            )
            ->where(
                $visibilityColumn,
                true
            )
            ->whereHas(
                'menuItems',
                function (
                    Builder $query
                ) use (
                    $visibilityColumn,
                    $search
                ): void {
                    $query
                        ->where(
                            'is_active',
                            true
                        )
                        ->where(
                            $visibilityColumn,
                            true
                        );

                    if ($search !== '') {
                        $query->where(
                            function (
                                Builder $query
                            ) use (
                                $search
                            ): void {
                                $query
                                    ->where(
                                        'name',
                                        'like',
                                        "%{$search}%"
                                    )
                                    ->orWhere(
                                        'description',
                                        'like',
                                        "%{$search}%"
                                    );
                            }
                        );
                    }
                }
            )
            ->with([
                'menuItems' =>
                function (
                    $query
                ) use (
                    $visibilityColumn,
                    $search
                ): void {
                    $query
                        ->where(
                            'is_active',
                            true
                        )
                        ->where(
                            $visibilityColumn,
                            true
                        )
                        ->orderBy(
                            'sort_order'
                        )
                        ->orderBy(
                            'name'
                        );

                    if ($search !== '') {
                        $query->where(
                            function (
                                $query
                            ) use (
                                $search
                            ): void {
                                $query
                                    ->where(
                                        'name',
                                        'like',
                                        "%{$search}%"
                                    )
                                    ->orWhere(
                                        'description',
                                        'like',
                                        "%{$search}%"
                                    );
                            }
                        );
                    }

                    $query->with([
                        'category',

                        'variants' =>
                        fn($query) =>
                        $query
                            ->where(
                                'is_active',
                                true
                            )
                            ->orderBy(
                                'sort_order'
                            ),

                        'addons' =>
                        fn($query) =>
                        $query
                            ->where(
                                'addons.is_active',
                                true
                            ),
                    ]);
                },
            ])
            ->orderBy(
                'sort_order'
            )
            ->orderBy(
                'name'
            )
            ->get();

        $data =
            $categories
            ->map(
                function (
                    Category $category
                ) use (
                    $request
                ): array {
                    return [
                        'id' =>
                        $category->id,

                        'name' =>
                        $category->name,

                        'slug' =>
                        $category->slug,

                        'description' =>
                        $category
                            ->description,

                        'items' =>
                        $category
                            ->menuItems
                            ->map(
                                fn($item) => (
                                    new MenuItemResource(
                                        $item
                                    )
                                )->resolve(
                                    $request
                                )
                            )
                            ->values()
                            ->all(),
                    ];
                }
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $data,

            message: $mode === 'qr'
                ? 'QR menu retrieved successfully.'
                : 'Website menu retrieved successfully.'
        );
    }
}
