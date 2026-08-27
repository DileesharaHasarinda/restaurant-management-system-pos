import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";

import {
    useAuth,
} from "../auth/useAuth";

import {
    getIngredients,
    getUnits,
} from "../ingredients/ingredientService";

import type {
    Ingredient,
    IngredientUnit,
} from "../ingredients/types";

import {
    getAddons,
    getMenuItems,
} from "../menu/menuService";

import type {
    MenuAddon,
    MenuItem,
    MenuItemVariant,
    PaginationMeta,
} from "../menu/types";

import ConsumptionPreviewModal
    from "./ConsumptionPreviewModal";

import RecipeEditorModal
    from "./RecipeEditorModal";

import {
    clearAddonRecipe,
    clearMenuRecipe,
    clearVariantRecipe,
    getAddonRecipe,
    getMenuRecipe,
    getRecipeMenuItem,
    getVariantRecipe,
    saveAddonRecipe,
    saveMenuRecipe,
    saveVariantRecipe,
} from "./recipeService";

import type {
    RecipeEditorTarget,
    RecipeResponse,
    SaveRecipePayload,
} from "./types";

import "./RecipesPage.css";

/*
|--------------------------------------------------------------------------
| Local Types
|--------------------------------------------------------------------------
*/

type RecipesTab =
    | "MENU"
    | "ADDONS";

interface EditorState {
    target: RecipeEditorTarget;

    recipe: RecipeResponse;
}

/*
|--------------------------------------------------------------------------
| Constants
|--------------------------------------------------------------------------
*/

const EMPTY_PAGINATION:
    PaginationMeta = {
    current_page:
        1,

    per_page:
        30,

    total:
        0,

    last_page:
        1,
};

const money =
    new Intl.NumberFormat(
        "en-LK",
        {
            style:
                "currency",

            currency:
                "LKR",

            minimumFractionDigits:
                2,

            maximumFractionDigits:
                2,
        }
    );

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function errorMessage(
    error: unknown
): string {
    if (
        error instanceof Error
        && error.message
    ) {
        return error.message;
    }

    return "The requested recipe operation could not be completed.";
}

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

export default function RecipesPage() {
    const {
        hasPermission,
    } =
        useAuth();

    const canManage =
        hasPermission(
            "recipes.manage"
        );

    const [
        activeTab,
        setActiveTab,
    ] =
        useState<RecipesTab>(
            "MENU"
        );

    const [
        menuItems,
        setMenuItems,
    ] =
        useState<MenuItem[]>(
            []
        );

    const [
        menuPagination,
        setMenuPagination,
    ] =
        useState(
            EMPTY_PAGINATION
        );

    const [
        page,
        setPage,
    ] =
        useState(
            1
        );

    const [
        searchDraft,
        setSearchDraft,
    ] =
        useState(
            ""
        );

    const [
        search,
        setSearch,
    ] =
        useState(
            ""
        );

    const [
        addons,
        setAddons,
    ] =
        useState<MenuAddon[]>(
            []
        );

    const [
        addonSearch,
        setAddonSearch,
    ] =
        useState(
            ""
        );

    const [
        menuLoading,
        setMenuLoading,
    ] =
        useState(
            true
        );

    const [
        addonLoading,
        setAddonLoading,
    ] =
        useState(
            true
        );

    const [
        opening,
        setOpening,
    ] =
        useState(
            false
        );

    const [
        refreshing,
        setRefreshing,
    ] =
        useState(
            false
        );

    const [
        error,
        setError,
    ] =
        useState(
            ""
        );

    const [
        selectedMenuItem,
        setSelectedMenuItem,
    ] =
        useState<MenuItem | null>(
            null
        );

    const [
        previewMenuItem,
        setPreviewMenuItem,
    ] =
        useState<MenuItem | null>(
            null
        );

    const [
        editor,
        setEditor,
    ] =
        useState<EditorState | null>(
            null
        );

    const [
        ingredients,
        setIngredients,
    ] =
        useState<Ingredient[]>(
            []
        );

    const [
        units,
        setUnits,
    ] =
        useState<IngredientUnit[]>(
            []
        );

    const [
        editorCatalogLoaded,
        setEditorCatalogLoaded,
    ] =
        useState(
            false
        );

    /*
    |--------------------------------------------------------------------------
    | Load Menu Items
    |--------------------------------------------------------------------------
    */

    const loadMenuItems =
        useCallback(
            async () => {
                try {
                    const result =
                        await getMenuItems({
                            page,

                            search,

                            isActive:
                                null,

                            isAvailable:
                                null,
                        });

                    setMenuItems(
                        result.items
                    );

                    setMenuPagination(
                        result.pagination
                    );
                } catch (
                caught
                ) {
                    setError(
                        errorMessage(
                            caught
                        )
                    );
                } finally {
                    setMenuLoading(
                        false
                    );
                }
            },
            [
                page,
                search,
            ]
        );

    const loadAddons =
        useCallback(
            async () => {
                try {
                    const result =
                        await getAddons();

                    setAddons(
                        result
                    );
                } catch (
                caught
                ) {
                    setError(
                        errorMessage(
                            caught
                        )
                    );
                } finally {
                    setAddonLoading(
                        false
                    );
                }
            },
            []
        );

    useEffect(
        () => {
            const timeoutId =
                window.setTimeout(
                    () => {
                        void loadMenuItems();
                    },
                    0
                );

            return () => {
                window.clearTimeout(
                    timeoutId
                );
            };
        },
        [
            loadMenuItems,
        ]
    );

    useEffect(
        () => {
            const timeoutId =
                window.setTimeout(
                    () => {
                        void loadAddons();
                    },
                    0
                );

            return () => {
                window.clearTimeout(
                    timeoutId
                );
            };
        },
        [
            loadAddons,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Editor Catalog
    |--------------------------------------------------------------------------
    */

    const loadAllIngredients =
        useCallback(
            async (): Promise<Ingredient[]> => {
                const collected:
                    Ingredient[] = [];

                let currentPage =
                    1;

                let lastPage =
                    1;

                do {
                    const result =
                        await getIngredients({
                            page:
                                currentPage,

                            perPage:
                                100,

                            isActive:
                                null,

                            lowStock:
                                false,
                        });

                    collected.push(
                        ...result.ingredients
                    );

                    lastPage =
                        result
                            .pagination
                            .last_page;

                    currentPage +=
                        1;
                } while (
                    currentPage
                    <= lastPage
                );

                return collected;
            },
            []
        );

    const ensureEditorCatalog =
        useCallback(
            async () => {
                if (
                    !canManage
                    || editorCatalogLoaded
                ) {
                    return;
                }

                const [
                    ingredientRows,
                    unitRows,
                ] =
                    await Promise.all([
                        loadAllIngredients(),
                        getUnits(),
                    ]);

                setIngredients(
                    ingredientRows
                );

                setUnits(
                    unitRows
                );

                setEditorCatalogLoaded(
                    true
                );
            },
            [
                canManage,
                editorCatalogLoaded,
                loadAllIngredients,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Filters
    |--------------------------------------------------------------------------
    */

    const submitSearch =
        (
            event: FormEvent
        ) => {
            event.preventDefault();

            setPage(
                1
            );

            setSearch(
                searchDraft.trim()
            );
        };

    const resetSearch =
        () => {
            setSearchDraft(
                ""
            );

            setSearch(
                ""
            );

            setPage(
                1
            );
        };

    const filteredAddons =
        useMemo(
            () => {
                const value =
                    addonSearch
                        .trim()
                        .toLowerCase();

                if (
                    !value
                ) {
                    return addons;
                }

                return addons.filter(
                    (addon) =>
                        addon.name
                            .toLowerCase()
                            .includes(
                                value
                            )
                        || (
                            addon.sku
                                ?.toLowerCase()
                                .includes(
                                    value
                                )
                            ?? false
                        )
                );
            },
            [
                addons,
                addonSearch,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Refresh
    |--------------------------------------------------------------------------
    */

    const refresh =
        async () => {
            if (
                refreshing
            ) {
                return;
            }

            setRefreshing(
                true
            );

            setError(
                ""
            );

            try {
                await Promise.all([
                    loadMenuItems(),
                    loadAddons(),
                ]);
            } finally {
                setRefreshing(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Menu Item Selector
    |--------------------------------------------------------------------------
    */

    const openMenuOptions =
        async (
            item: MenuItem
        ) => {
            if (
                opening
            ) {
                return;
            }

            setOpening(
                true
            );

            setError(
                ""
            );

            try {
                const detailed =
                    await getRecipeMenuItem(
                        item.id
                    );

                setSelectedMenuItem(
                    detailed
                );
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );
            } finally {
                setOpening(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Open Editors
    |--------------------------------------------------------------------------
    */

    const prepareEditor =
        async () => {
            if (
                canManage
            ) {
                await ensureEditorCatalog();
            }
        };

    const openBaseRecipe =
        async (
            item: MenuItem
        ) => {
            setOpening(
                true
            );

            setError(
                ""
            );

            try {
                const [
                    recipe,
                ] =
                    await Promise.all([
                        getMenuRecipe(
                            item.id
                        ),
                        prepareEditor(),
                    ]);

                setEditor({
                    target: {
                        kind:
                            "BASE",

                        menuItem:
                            item,

                        variant:
                            null,
                    },

                    recipe,
                });

                setSelectedMenuItem(
                    null
                );
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );
            } finally {
                setOpening(
                    false
                );
            }
        };

    const openVariantRecipe =
        async (
            item: MenuItem,
            variant: MenuItemVariant
        ) => {
            setOpening(
                true
            );

            setError(
                ""
            );

            try {
                const [
                    recipe,
                ] =
                    await Promise.all([
                        getVariantRecipe(
                            item.id,
                            variant.id
                        ),
                        prepareEditor(),
                    ]);

                setEditor({
                    target: {
                        kind:
                            "VARIANT",

                        menuItem:
                            item,

                        variant,
                    },

                    recipe,
                });

                setSelectedMenuItem(
                    null
                );
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );
            } finally {
                setOpening(
                    false
                );
            }
        };

    const openAddonRecipe =
        async (
            addon: MenuAddon
        ) => {
            setOpening(
                true
            );

            setError(
                ""
            );

            try {
                const [
                    recipe,
                ] =
                    await Promise.all([
                        getAddonRecipe(
                            addon.id
                        ),
                        prepareEditor(),
                    ]);

                setEditor({
                    target: {
                        kind:
                            "ADDON",

                        addon,
                    },

                    recipe,
                });
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );
            } finally {
                setOpening(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Preview
    |--------------------------------------------------------------------------
    */

    const openPreview =
        async (
            item: MenuItem
        ) => {
            setOpening(
                true
            );

            setError(
                ""
            );

            try {
                const detailed =
                    item.addons
                        .length
                        > 0
                        || item.variants
                            .length
                        > 0
                        ? item
                        : await getRecipeMenuItem(
                            item.id
                        );

                setPreviewMenuItem(
                    detailed
                );

                setSelectedMenuItem(
                    null
                );
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );
            } finally {
                setOpening(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Editor Actions
    |--------------------------------------------------------------------------
    */

    const saveCurrentRecipe =
        async (
            payload: SaveRecipePayload
        ): Promise<RecipeResponse> => {
            if (
                !editor
            ) {
                throw new Error(
                    "No recipe is currently selected."
                );
            }

            const target =
                editor.target;

            if (
                target.kind
                === "ADDON"
            ) {
                const result =
                    await saveAddonRecipe(
                        target.addon.id,
                        payload
                    );

                void loadAddons();

                return result;
            }

            if (
                target.kind
                === "VARIANT"
            ) {
                return saveVariantRecipe(
                    target.menuItem.id,
                    target.variant.id,
                    payload
                );
            }

            return saveMenuRecipe(
                target.menuItem.id,
                payload
            );
        };

    const clearCurrentRecipe =
        async (): Promise<RecipeResponse> => {
            if (
                !editor
            ) {
                throw new Error(
                    "No recipe is currently selected."
                );
            }

            const target =
                editor.target;

            if (
                target.kind
                === "ADDON"
            ) {
                const result =
                    await clearAddonRecipe(
                        target.addon.id
                    );

                /*
                 * Saving / clearing an add-on recipe also changes
                 * consumes_inventory on the backend. Refresh the
                 * add-on catalog after the operation.
                 */
                void loadAddons();

                return result;
            }

            if (
                target.kind
                === "VARIANT"
            ) {
                return clearVariantRecipe(
                    target.menuItem.id,
                    target.variant.id
                );
            }

            return clearMenuRecipe(
                target.menuItem.id
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <div className="recipes-page">
            <header className="recipes-page-header">
                <div>
                    <div className="recipes-eyebrow">
                        Inventory Configuration
                    </div>

                    <h1>
                        Recipes
                    </h1>

                    <p>
                        Configure menu, variant and add-on ingredient consumption while
                        keeping costing and stock calculations authoritative in Laravel.
                    </p>
                </div>

                <button
                    type="button"
                    className="recipes-button recipes-button-secondary"
                    onClick={
                        () =>
                            void refresh()
                    }
                    disabled={refreshing}
                >
                    {
                        refreshing
                            ? "Refreshing..."
                            : "Refresh"
                    }
                </button>
            </header>

            {
                error
                && (
                    <div className="recipes-alert recipes-alert-error">
                        {error}
                    </div>
                )
            }

            {
                !canManage
                && (
                    <div className="recipes-alert recipes-alert-info">
                        Recipe management controls are read-only for your account.
                        Viewing and consumption preview remain available.
                    </div>
                )
            }

            <section className="recipes-summary-grid">
                <article className="recipes-summary-card">
                    <span>
                        Menu Items
                    </span>

                    <strong>
                        {
                            menuPagination.total
                        }
                    </strong>

                    <small>
                        Recipe-capable menu catalog
                    </small>
                </article>

                <article className="recipes-summary-card">
                    <span>
                        Add-ons
                    </span>

                    <strong>
                        {
                            addons.length
                        }
                    </strong>

                    <small>
                        Available recipe targets
                    </small>
                </article>

                <article className="recipes-summary-card">
                    <span>
                        Access
                    </span>

                    <strong className="recipes-summary-text">
                        {
                            canManage
                                ? "Manage"
                                : "View"
                        }
                    </strong>

                    <small>
                        {
                            canManage
                                ? "recipes.manage enabled"
                                : "recipes.view only"
                        }
                    </small>
                </article>
            </section>

            <div className="recipes-tabs">
                <button
                    type="button"
                    className={
                        activeTab
                            === "MENU"
                            ? "recipes-tab recipes-tab-active"
                            : "recipes-tab"
                    }
                    onClick={
                        () =>
                            setActiveTab(
                                "MENU"
                            )
                    }
                >
                    Menu & Variant Recipes
                </button>

                <button
                    type="button"
                    className={
                        activeTab
                            === "ADDONS"
                            ? "recipes-tab recipes-tab-active"
                            : "recipes-tab"
                    }
                    onClick={
                        () =>
                            setActiveTab(
                                "ADDONS"
                            )
                    }
                >
                    Add-on Recipes
                </button>
            </div>

            {
                activeTab
                    === "MENU"
                    ? (
                        <section className="recipes-panel">
                            <div className="recipes-panel-header">
                                <div>
                                    <h2>
                                        Menu Recipes
                                    </h2>

                                    <p>
                                        Open a menu item to configure its base recipe, variant recipes
                                        or run a consumption preview.
                                    </p>
                                </div>

                                <form
                                    className="recipes-search"
                                    onSubmit={submitSearch}
                                >
                                    <input
                                        type="search"
                                        value={searchDraft}
                                        placeholder="Search menu item or SKU..."
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setSearchDraft(
                                                    event
                                                        .target
                                                        .value
                                                )
                                        }
                                    />

                                    <button
                                        type="submit"
                                        className="recipes-button recipes-button-primary"
                                    >
                                        Search
                                    </button>

                                    {
                                        search
                                        && (
                                            <button
                                                type="button"
                                                className="recipes-button recipes-button-secondary"
                                                onClick={resetSearch}
                                            >
                                                Clear
                                            </button>
                                        )
                                    }
                                </form>
                            </div>

                            {
                                menuLoading
                                    ? (
                                        <div className="recipes-loading">
                                            Loading menu items...
                                        </div>
                                    )
                                    : menuItems.length
                                        === 0
                                        ? (
                                            <div className="recipes-empty">
                                                <strong>
                                                    No menu items found
                                                </strong>

                                                <p>
                                                    Adjust your search criteria and try again.
                                                </p>
                                            </div>
                                        )
                                        : (
                                            <div className="recipes-card-list">
                                                {
                                                    menuItems.map(
                                                        (
                                                            item
                                                        ) => (
                                                            <article
                                                                key={item.id}
                                                                className="recipes-item-card"
                                                            >
                                                                <div className="recipes-item-main">
                                                                    {
                                                                        item.photo_url
                                                                            ? (
                                                                                <img
                                                                                    src={item.photo_url}
                                                                                    alt=""
                                                                                    className="recipes-item-photo"
                                                                                />
                                                                            )
                                                                            : (
                                                                                <div className="recipes-item-photo recipes-item-photo-placeholder">
                                                                                    🍽
                                                                                </div>
                                                                            )
                                                                    }

                                                                    <div className="recipes-item-copy">
                                                                        <div className="recipes-item-title-row">
                                                                            <h3>
                                                                                {
                                                                                    item.name
                                                                                }
                                                                            </h3>

                                                                            <span
                                                                                className={
                                                                                    item.is_active
                                                                                        ? "recipes-badge recipes-badge-success"
                                                                                        : "recipes-badge recipes-badge-muted"
                                                                                }
                                                                            >
                                                                                {
                                                                                    item.is_active
                                                                                        ? "Active"
                                                                                        : "Inactive"
                                                                                }
                                                                            </span>

                                                                            <span
                                                                                className={
                                                                                    item.is_available
                                                                                        ? "recipes-badge recipes-badge-success"
                                                                                        : "recipes-badge recipes-badge-warning"
                                                                                }
                                                                            >
                                                                                {
                                                                                    item.is_available
                                                                                        ? "Available"
                                                                                        : "Unavailable"
                                                                                }
                                                                            </span>
                                                                        </div>

                                                                        <div className="recipes-item-meta">
                                                                            <span>
                                                                                {
                                                                                    item.sku
                                                                                    || "No SKU"
                                                                                }
                                                                            </span>

                                                                            <span>
                                                                                {
                                                                                    item.category
                                                                                        ?.name
                                                                                    || "Uncategorised"
                                                                                }
                                                                            </span>

                                                                            <span>
                                                                                {
                                                                                    money.format(
                                                                                        item.price
                                                                                    )
                                                                                }
                                                                            </span>

                                                                            {
                                                                                item.has_variants
                                                                                && (
                                                                                    <span>
                                                                                        Variants enabled
                                                                                    </span>
                                                                                )
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    className="recipes-button recipes-button-primary"
                                                                    onClick={
                                                                        () =>
                                                                            void openMenuOptions(
                                                                                item
                                                                            )
                                                                    }
                                                                    disabled={opening}
                                                                >
                                                                    Open Recipes
                                                                </button>
                                                            </article>
                                                        )
                                                    )
                                                }
                                            </div>
                                        )
                            }

                            {
                                menuPagination.last_page
                                > 1
                                && (
                                    <div className="recipes-pagination">
                                        <button
                                            type="button"
                                            className="recipes-button recipes-button-secondary"
                                            disabled={
                                                menuLoading
                                                || menuPagination
                                                    .current_page
                                                <= 1
                                            }
                                            onClick={
                                                () =>
                                                    setPage(
                                                        (
                                                            current
                                                        ) =>
                                                            Math.max(
                                                                1,
                                                                current
                                                                - 1
                                                            )
                                                    )
                                            }
                                        >
                                            Previous
                                        </button>

                                        <span>
                                            Page
                                            {" "}
                                            {
                                                menuPagination.current_page
                                            }
                                            {" of "}
                                            {
                                                menuPagination.last_page
                                            }
                                        </span>

                                        <button
                                            type="button"
                                            className="recipes-button recipes-button-secondary"
                                            disabled={
                                                menuLoading
                                                || menuPagination
                                                    .current_page
                                                >= menuPagination
                                                    .last_page
                                            }
                                            onClick={
                                                () =>
                                                    setPage(
                                                        (
                                                            current
                                                        ) =>
                                                            current
                                                            + 1
                                                    )
                                            }
                                        >
                                            Next
                                        </button>
                                    </div>
                                )
                            }
                        </section>
                    )
                    : (
                        <section className="recipes-panel">
                            <div className="recipes-panel-header">
                                <div>
                                    <h2>
                                        Add-on Recipes
                                    </h2>

                                    <p>
                                        Recipe configuration automatically controls whether an
                                        add-on consumes inventory.
                                    </p>
                                </div>

                                <div className="recipes-search recipes-search-single">
                                    <input
                                        type="search"
                                        value={addonSearch}
                                        placeholder="Search add-on or SKU..."
                                        onChange={
                                            (
                                                event
                                            ) =>
                                                setAddonSearch(
                                                    event
                                                        .target
                                                        .value
                                                )
                                        }
                                    />
                                </div>
                            </div>

                            {
                                addonLoading
                                    ? (
                                        <div className="recipes-loading">
                                            Loading add-ons...
                                        </div>
                                    )
                                    : filteredAddons.length
                                        === 0
                                        ? (
                                            <div className="recipes-empty">
                                                <strong>
                                                    No add-ons found
                                                </strong>
                                            </div>
                                        )
                                        : (
                                            <div className="recipes-addon-list">
                                                {
                                                    filteredAddons.map(
                                                        (
                                                            addon
                                                        ) => (
                                                            <article
                                                                key={addon.id}
                                                                className="recipes-addon-card"
                                                            >
                                                                <div>
                                                                    <div className="recipes-item-title-row">
                                                                        <h3>
                                                                            {
                                                                                addon.name
                                                                            }
                                                                        </h3>

                                                                        <span
                                                                            className={
                                                                                addon
                                                                                    .consumes_inventory
                                                                                    ? "recipes-badge recipes-badge-success"
                                                                                    : "recipes-badge recipes-badge-muted"
                                                                            }
                                                                        >
                                                                            {
                                                                                addon
                                                                                    .consumes_inventory
                                                                                    ? "Inventory recipe"
                                                                                    : "No inventory recipe"
                                                                            }
                                                                        </span>
                                                                    </div>

                                                                    <div className="recipes-item-meta">
                                                                        <span>
                                                                            {
                                                                                addon.sku
                                                                                || "No SKU"
                                                                            }
                                                                        </span>

                                                                        <span>
                                                                            {
                                                                                money.format(
                                                                                    addon.base_price
                                                                                )
                                                                            }
                                                                        </span>

                                                                        <span>
                                                                            {
                                                                                addon.is_active
                                                                                    ? "Active"
                                                                                    : "Inactive"
                                                                            }
                                                                        </span>

                                                                        <span>
                                                                            {
                                                                                addon.is_available
                                                                                    ? "Available"
                                                                                    : "Unavailable"
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    className="recipes-button recipes-button-primary"
                                                                    onClick={
                                                                        () =>
                                                                            void openAddonRecipe(
                                                                                addon
                                                                            )
                                                                    }
                                                                    disabled={opening}
                                                                >
                                                                    Open Recipe
                                                                </button>
                                                            </article>
                                                        )
                                                    )
                                                }
                                            </div>
                                        )
                            }
                        </section>
                    )
            }

            {
                selectedMenuItem
                && (
                    <div
                        className="recipes-modal-backdrop"
                        role="presentation"
                    >
                        <div
                            className="recipes-modal recipes-target-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-label={`Recipes for ${selectedMenuItem.name}`}
                        >
                            <div className="recipes-modal-header">
                                <div>
                                    <div className="recipes-modal-eyebrow">
                                        Recipe Targets
                                    </div>

                                    <h2>
                                        {
                                            selectedMenuItem.name
                                        }
                                    </h2>

                                    <p>
                                        Choose the exact recipe definition you want to view or
                                        manage.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    className="recipes-icon-button"
                                    onClick={
                                        () =>
                                            setSelectedMenuItem(
                                                null
                                            )
                                    }
                                    disabled={opening}
                                    aria-label="Close recipe target selector"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="recipes-modal-body">
                                <div className="recipes-target-grid">
                                    <button
                                        type="button"
                                        className="recipes-target-card"
                                        onClick={
                                            () =>
                                                void openBaseRecipe(
                                                    selectedMenuItem
                                                )
                                        }
                                        disabled={opening}
                                    >
                                        <span>
                                            Base Recipe
                                        </span>

                                        <strong>
                                            {
                                                selectedMenuItem.name
                                            }
                                        </strong>

                                        <small>
                                            {
                                                money.format(
                                                    selectedMenuItem.price
                                                )
                                            }
                                        </small>
                                    </button>

                                    {
                                        selectedMenuItem
                                            .variants
                                            .map(
                                                (
                                                    variant
                                                ) => (
                                                    <button
                                                        key={variant.id}
                                                        type="button"
                                                        className="recipes-target-card"
                                                        onClick={
                                                            () =>
                                                                void openVariantRecipe(
                                                                    selectedMenuItem,
                                                                    variant
                                                                )
                                                        }
                                                        disabled={opening}
                                                    >
                                                        <span>
                                                            Variant Recipe
                                                        </span>

                                                        <strong>
                                                            {
                                                                variant.name
                                                            }
                                                        </strong>

                                                        <small>
                                                            {
                                                                money.format(
                                                                    variant.price
                                                                )
                                                            }

                                                            {
                                                                !variant.is_active
                                                                    ? " · Inactive"
                                                                    : ""
                                                            }
                                                        </small>
                                                    </button>
                                                )
                                            )
                                    }
                                </div>

                                <div className="recipes-modal-actions">
                                    <button
                                        type="button"
                                        className="recipes-button recipes-button-secondary"
                                        onClick={
                                            () =>
                                                setSelectedMenuItem(
                                                    null
                                                )
                                        }
                                        disabled={opening}
                                    >
                                        Close
                                    </button>

                                    <button
                                        type="button"
                                        className="recipes-button recipes-button-primary"
                                        onClick={
                                            () =>
                                                void openPreview(
                                                    selectedMenuItem
                                                )
                                        }
                                        disabled={opening}
                                    >
                                        Consumption Preview
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {
                editor
                && (
                    <RecipeEditorModal
                        target={editor.target}
                        recipe={editor.recipe}
                        ingredients={ingredients}
                        units={units}
                        canManage={canManage}
                        onClose={
                            () =>
                                setEditor(
                                    null
                                )
                        }
                        onSave={saveCurrentRecipe}
                        onClear={clearCurrentRecipe}
                    />
                )
            }

            {
                previewMenuItem
                && (
                    <ConsumptionPreviewModal
                        menuItem={previewMenuItem}
                        onClose={
                            () =>
                                setPreviewMenuItem(
                                    null
                                )
                        }
                    />
                )
            }
        </div>
    );
}