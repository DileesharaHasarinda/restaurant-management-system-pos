<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\InventoryOperationException;
use App\Exceptions\WastageOperationException;
use App\Http\Controllers\Controller;
use App\Http\Resources\WastageResource;
use App\Models\Wastage;
use App\Services\WastageService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class WastageController extends Controller
{
    public function __construct(
        private readonly WastageService $wastageService
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Index
    |--------------------------------------------------------------------------
    */

    public function index(
        Request $request
    ): JsonResponse {
        $validated =
            $request->validate([
                'ingredient_id' =>
                [
                    'nullable',
                    'integer',
                    'exists:ingredients,id',
                ],

                'reason_code' =>
                [
                    'nullable',
                    'string',
                ],

                'status' =>
                [
                    'nullable',
                    'string',
                ],

                'from_date' =>
                [
                    'nullable',
                    'date',
                ],

                'to_date' =>
                [
                    'nullable',
                    'date',
                ],

                'per_page' =>
                [
                    'nullable',
                    'integer',
                    'min:1',
                    'max:100',
                ],
            ]);

        $query =
            Wastage::query()
            ->with([
                'businessDay',
                'ingredient.baseUnit',
                'unit',
                'createdBy',
            ])
            ->latest(
                'wasted_at'
            )
            ->latest(
                'id'
            );

        if (
            isset(
                $validated['ingredient_id']
            )
        ) {
            $query->where(
                'ingredient_id',
                (int)
                $validated['ingredient_id']
            );
        }

        if (
            ! empty($validated['reason_code']
                ?? null)
        ) {
            $query->where(
                'reason_code',
                strtoupper(
                    $validated['reason_code']
                )
            );
        }

        if (
            ! empty($validated['status']
                ?? null)
        ) {
            $query->where(
                'status',
                strtoupper(
                    $validated['status']
                )
            );
        }

        if (
            ! empty($validated['from_date']
                ?? null)
        ) {
            $query->whereDate(
                'wasted_at',
                '>=',
                $validated['from_date']
            );
        }

        if (
            ! empty($validated['to_date']
                ?? null)
        ) {
            $query->whereDate(
                'wasted_at',
                '<=',
                $validated['to_date']
            );
        }

        $paginator =
            $query->paginate(
                (int)
                (
                    $validated['per_page']
                    ?? 25
                )
            );

        return ApiResponse::success(
            data: WastageResource::collection(
                $paginator
                    ->getCollection()
            )
                ->resolve(
                    $request
                ),

            message: 'Wastage records retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $paginator
                        ->currentPage(),

                    'per_page' =>
                    $paginator
                        ->perPage(),

                    'total' =>
                    $paginator
                        ->total(),

                    'last_page' =>
                    $paginator
                        ->lastPage(),
                ],

                'reason_codes' =>
                Wastage::reasonLabels(),
            ]
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Show
    |--------------------------------------------------------------------------
    */

    public function show(
        Request $request,
        Wastage $wastage
    ): JsonResponse {
        $wastage->load([
            'businessDay',
            'ingredient.baseUnit',
            'unit',
            'createdBy',
        ]);

        return ApiResponse::success(
            data: (
                new WastageResource(
                    $wastage
                )
            )
                ->resolve(
                    $request
                ),

            message: 'Wastage record retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Store
    |--------------------------------------------------------------------------
    */

    public function store(
        Request $request
    ): JsonResponse {
        $validated =
            $request->validate([
                'client_request_id' =>
                [
                    'required',
                    'uuid',
                ],

                'ingredient_id' =>
                [
                    'required',
                    'integer',
                    'exists:ingredients,id',
                ],

                'quantity' =>
                [
                    'required',
                    'numeric',
                    'gt:0',
                ],

                'unit_id' =>
                [
                    'required',
                    'integer',
                    'exists:units,id',
                ],

                'reason_code' =>
                [
                    'required',
                    'string',
                ],

                'reason' =>
                [
                    'nullable',
                    'string',
                    'max:255',
                ],
            ]);

        try {
            $result =
                $this
                ->wastageService
                ->createIngredientWastage(
                    actor: $request->user(),

                    clientRequestId: $validated['client_request_id'],

                    ingredientId: (int)
                    $validated['ingredient_id'],

                    unitId: (int)
                    $validated['unit_id'],

                    quantity: (float)
                    $validated['quantity'],

                    reasonCode: $validated['reason_code'],

                    reason: $validated['reason']
                        ?? null
                );

            $created =
                (bool)
                $result['created'];

            return ApiResponse::success(
                data: (
                    new WastageResource(
                        $result['wastage']
                    )
                )
                    ->resolve(
                        $request
                    ),

                message: $created
                    ? 'Wastage recorded successfully.'
                    : 'Wastage request was already recorded.',

                status: $created
                    ? 201
                    : 200,

                meta: [
                    'created' =>
                    $created,
                ]
            );
        } catch (
            WastageOperationException |
            InventoryOperationException
            $exception
        ) {
            return ApiResponse::error(
                message: $exception
                    ->getMessage(),

                code: $exception
                    ->errorCode,

                status: $exception
                    ->status
            );
        } catch (
            Throwable $exception
        ) {
            report(
                $exception
            );

            return ApiResponse::error(
                message: 'Unable to record wastage.',

                code: 'WASTAGE_CREATE_FAILED',

                status: 500
            );
        }
    }
}
