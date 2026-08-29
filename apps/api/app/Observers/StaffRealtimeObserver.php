<?php

namespace App\Observers;

use App\Events\StaffRealtimeUpdated;
use App\Models\Addon;
use App\Models\AddonGroup;
use App\Models\AddonRecipeComponent;
use App\Models\BusinessDay;
use App\Models\BusinessDayClosing;
use App\Models\CashDrawerMovement;
use App\Models\CashierShift;
use App\Models\Category;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\GalleryImage;
use App\Models\Ingredient;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\MenuItem;
use App\Models\MenuItemVariant;
use App\Models\Order;
use App\Models\OrderAdditionSubmission;
use App\Models\OrderItem;
use App\Models\OrderItemAddon;
use App\Models\OrderStatusHistory;
use App\Models\Payment;
use App\Models\PaymentBatch;
use App\Models\Permission;
use App\Models\Purchase;
use App\Models\PurchaseItem;
use App\Models\RecipeComponent;
use App\Models\Refund;
use App\Models\RestaurantSetting;
use App\Models\RestaurantTable;
use App\Models\Review;
use App\Models\Role;
use App\Models\StockAdjustment;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\SupplierPayment;
use App\Models\SupplierPaymentBatch;
use App\Models\TableMerge;
use App\Models\TableQrToken;
use App\Models\TableSession;
use App\Models\TableTransfer;
use App\Models\Unit;
use App\Models\User;
use App\Models\Wastage;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Throwable;

final class StaffRealtimeObserver
{
    /**
     * @return array<class-string<Model>>
     */
    public static function models(): array
    {
        return [
            /*
            |--------------------------------------------------------------------------
            | Orders
            |--------------------------------------------------------------------------
            */

            Order::class,
            OrderItem::class,
            OrderItemAddon::class,
            OrderStatusHistory::class,
            OrderAdditionSubmission::class,

            /*
            |--------------------------------------------------------------------------
            | Tables
            |--------------------------------------------------------------------------
            */

            RestaurantTable::class,
            TableSession::class,
            TableTransfer::class,
            TableMerge::class,
            TableQrToken::class,

            /*
            |--------------------------------------------------------------------------
            | Menu
            |--------------------------------------------------------------------------
            */

            Category::class,
            MenuItem::class,
            MenuItemVariant::class,
            AddonGroup::class,
            Addon::class,

            /*
            |--------------------------------------------------------------------------
            | Inventory / Recipes
            |--------------------------------------------------------------------------
            */

            Ingredient::class,
            Unit::class,
            StockMovement::class,
            StockAdjustment::class,
            RecipeComponent::class,
            AddonRecipeComponent::class,

            /*
            |--------------------------------------------------------------------------
            | Suppliers / Purchases
            |--------------------------------------------------------------------------
            */

            Supplier::class,
            Purchase::class,
            PurchaseItem::class,
            SupplierPayment::class,
            SupplierPaymentBatch::class,

            /*
            |--------------------------------------------------------------------------
            | Wastage / Expenses
            |--------------------------------------------------------------------------
            */

            Wastage::class,
            Expense::class,
            ExpenseCategory::class,

            /*
            |--------------------------------------------------------------------------
            | Billing
            |--------------------------------------------------------------------------
            */

            Invoice::class,
            InvoiceItem::class,
            Payment::class,
            PaymentBatch::class,
            Refund::class,

            /*
            |--------------------------------------------------------------------------
            | Cash / Business Day
            |--------------------------------------------------------------------------
            */

            CashierShift::class,
            CashDrawerMovement::class,
            BusinessDay::class,
            BusinessDayClosing::class,

            /*
            |--------------------------------------------------------------------------
            | Users / Configuration
            |--------------------------------------------------------------------------
            */

            User::class,
            Role::class,
            Permission::class,
            RestaurantSetting::class,

            /*
            |--------------------------------------------------------------------------
            | Website Management
            |--------------------------------------------------------------------------
            */

            Review::class,
            GalleryImage::class,
        ];
    }

    public function created(Model $model): void
    {
        $this->broadcast(
            $model,
            'CREATED',
        );
    }

    public function updated(Model $model): void
    {
        $this->broadcast(
            $model,
            'UPDATED',
        );
    }

    public function deleted(Model $model): void
    {
        $this->broadcast(
            $model,
            'DELETED',
        );
    }

    public function restored(Model $model): void
    {
        $this->broadcast(
            $model,
            'RESTORED',
        );
    }

    public function forceDeleted(Model $model): void
    {
        $this->broadcast(
            $model,
            'FORCE_DELETED',
        );
    }

    private function broadcast(
        Model $model,
        string $action,
    ): void {
        $domain =
            $this->domainFor(
                $model,
            );

        if ($domain === null) {
            return;
        }

        try {
            StaffRealtimeUpdated::dispatch(
                eventId: (string) Str::uuid(),
                domain: $domain,
                resource: $model->getTable(),
                action: $action,
                entityId: $model->getKey(),
                occurredAt: now()->toIso8601String(),
            );
        } catch (Throwable $exception) {
            /*
             * Realtime is not allowed to turn a successful
             * business operation into a failed HTTP request.
             */
            report(
                $exception,
            );
        }
    }

    private function domainFor(
        Model $model,
    ): ?string {
        return match (true) {
            /*
            |--------------------------------------------------------------------------
            | Orders
            |--------------------------------------------------------------------------
            */

            $model instanceof Order,
            $model instanceof OrderItem,
            $model instanceof OrderItemAddon,
            $model instanceof OrderStatusHistory,
            $model instanceof OrderAdditionSubmission
                => 'orders',

            /*
            |--------------------------------------------------------------------------
            | Tables
            |--------------------------------------------------------------------------
            */

            $model instanceof RestaurantTable,
            $model instanceof TableSession,
            $model instanceof TableTransfer,
            $model instanceof TableMerge,
            $model instanceof TableQrToken
                => 'tables',

            /*
            |--------------------------------------------------------------------------
            | Menu
            |--------------------------------------------------------------------------
            */

            $model instanceof Category,
            $model instanceof MenuItem,
            $model instanceof MenuItemVariant,
            $model instanceof AddonGroup,
            $model instanceof Addon
                => 'menu',

            /*
            |--------------------------------------------------------------------------
            | Inventory
            |--------------------------------------------------------------------------
            */

            $model instanceof Ingredient,
            $model instanceof Unit,
            $model instanceof StockMovement,
            $model instanceof StockAdjustment
                => 'inventory',

            /*
            |--------------------------------------------------------------------------
            | Recipes
            |--------------------------------------------------------------------------
            */

            $model instanceof RecipeComponent,
            $model instanceof AddonRecipeComponent
                => 'recipes',

            /*
            |--------------------------------------------------------------------------
            | Suppliers
            |--------------------------------------------------------------------------
            */

            $model instanceof Supplier
                => 'suppliers',

            /*
            |--------------------------------------------------------------------------
            | Purchases
            |--------------------------------------------------------------------------
            */

            $model instanceof Purchase,
            $model instanceof PurchaseItem
                => 'purchases',

            /*
            |--------------------------------------------------------------------------
            | Supplier Payments
            |--------------------------------------------------------------------------
            */

            $model instanceof SupplierPayment,
            $model instanceof SupplierPaymentBatch
                => 'supplier_payments',

            /*
            |--------------------------------------------------------------------------
            | Wastage
            |--------------------------------------------------------------------------
            */

            $model instanceof Wastage
                => 'wastage',

            /*
            |--------------------------------------------------------------------------
            | Expenses
            |--------------------------------------------------------------------------
            */

            $model instanceof Expense,
            $model instanceof ExpenseCategory
                => 'expenses',

            /*
            |--------------------------------------------------------------------------
            | Billing
            |--------------------------------------------------------------------------
            */

            $model instanceof Invoice,
            $model instanceof InvoiceItem,
            $model instanceof Payment,
            $model instanceof PaymentBatch,
            $model instanceof Refund
                => 'billing',

            /*
            |--------------------------------------------------------------------------
            | Cash
            |--------------------------------------------------------------------------
            */

            $model instanceof CashierShift,
            $model instanceof CashDrawerMovement
                => 'cash',

            /*
            |--------------------------------------------------------------------------
            | Business Day
            |--------------------------------------------------------------------------
            */

            $model instanceof BusinessDay,
            $model instanceof BusinessDayClosing
                => 'business_day',

            /*
            |--------------------------------------------------------------------------
            | Users
            |--------------------------------------------------------------------------
            */

            $model instanceof User,
            $model instanceof Role,
            $model instanceof Permission
                => 'users',

            /*
            |--------------------------------------------------------------------------
            | Settings
            |--------------------------------------------------------------------------
            */

            $model instanceof RestaurantSetting
                => 'settings',

            /*
            |--------------------------------------------------------------------------
            | Website
            |--------------------------------------------------------------------------
            */

            $model instanceof Review,
            $model instanceof GalleryImage
                => 'website',

            default
                => null,
        };
    }
}
