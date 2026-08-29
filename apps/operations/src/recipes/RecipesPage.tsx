import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";

import {
    useStaffRealtimeRefresh,
} from "../realtime/realtimeBus";

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
    target:
    RecipeEditorTarget;

    recipe:
    RecipeResponse;
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
    error:
        unknown
): string {
    if (
        error instanceof Error
        &&
        error.message
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

    /*
    |--------------------------------------------------------------------------
    | Tabs
    |--------------------------------------------------------------------------
    */

    const [
        activeTab,
        setActiveTab,
    ] =
        useState<RecipesTab>(
            "MENU"
        );

    /*
    |--------------------------------------------------------------------------
    | Menu Items
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Add-ons
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Loading
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Modals / Selection
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Recipe Editor Catalog
    |--------------------------------------------------------------------------
    */

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
            async (): Promise<void> => {
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

    /*
    |--------------------------------------------------------------------------
    | Load Add-ons
    |--------------------------------------------------------------------------
    */

    const loadAddons =
        useCallback(
            async (): Promise<void> => {
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

    /*
    |--------------------------------------------------------------------------
    | Initial Menu Load
    |--------------------------------------------------------------------------
    */

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

    /*
    |--------------------------------------------------------------------------
    | Initial Add-on Load
    |--------------------------------------------------------------------------
    */

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
    | Load All Ingredients
    |--------------------------------------------------------------------------
    |
    | Recipe editor needs the full ingredient catalog rather than only one
    | paginated ingredient page.
    |--------------------------------------------------------------------------
    */

    const loadAllIngredients =
        useCallback(
            async (): Promise<
                Ingredient[]
            > => {
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
                    <=
                    lastPage
                );

                return collected;
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Load Recipe Editor Catalog
    |--------------------------------------------------------------------------
    */

    const loadEditorCatalog =
        useCallback(
            async (): Promise<void> => {
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
                loadAllIngredients,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Ensure Recipe Editor Catalog
    |--------------------------------------------------------------------------
    */

    const ensureEditorCatalog =
        useCallback(
            async (): Promise<void> => {
                if (
                    !canManage
                    ||
                    editorCatalogLoaded
                ) {
                    return;
                }

                await loadEditorCatalog();
            },
            [
                canManage,
                editorCatalogLoaded,
                loadEditorCatalog,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Filters
    |--------------------------------------------------------------------------
    */

    const submitSearch =
        (
            event:
                FormEvent
        ): void => {
            event.preventDefault();

            setPage(
                1
            );

            setSearch(
                searchDraft.trim()
            );
        };

    const resetSearch =
        (): void => {
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

    /*
    |--------------------------------------------------------------------------
    | Filtered Add-ons
    |--------------------------------------------------------------------------
    */

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
                    (
                        addon
                    ) =>
                        addon.name
                            .toLowerCase()
                            .includes(
                                value
                            )
                        ||
                        (
                            addon.sku
                                ?.toLowerCase()
                                .includes(
                                    value
                                )
                            ??
                            false
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
    | Refresh Selected Menu Target
    |--------------------------------------------------------------------------
    |
    | The target-selection modal does not contain editable form data, so it
    | can safely be reconciled while it is open.
    |--------------------------------------------------------------------------
    */

    const refreshSelectedMenuItem =
        useCallback(
            async (): Promise<void> => {
                if (
                    !selectedMenuItem
                ) {
                    return;
                }

                const menuItemId =
                    selectedMenuItem.id;

                try {
                    const current =
                        await getRecipeMenuItem(
                            menuItemId
                        );

                    setSelectedMenuItem(
                        (
                            existing
                        ) => {
                            if (
                                !existing
                                ||
                                existing.id
                                !==
                                menuItemId
                            ) {
                                return existing;
                            }

                            return current;
                        }
                    );
                } catch (
                caught
                ) {
                    console.error(
                        "Unable to reconcile realtime recipe target data.",
                        caught
                    );
                }
            },
            [
                selectedMenuItem,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Refresh Consumption Preview Menu Item
    |--------------------------------------------------------------------------
    |
    | ConsumptionPreviewModal is read-only from the Recipes page's
    | perspective, therefore menu/variant/add-on metadata can safely refresh.
    |--------------------------------------------------------------------------
    */

    const refreshPreviewMenuItem =
        useCallback(
            async (): Promise<void> => {
                if (
                    !previewMenuItem
                ) {
                    return;
                }

                const menuItemId =
                    previewMenuItem.id;

                try {
                    const current =
                        await getRecipeMenuItem(
                            menuItemId
                        );

                    setPreviewMenuItem(
                        (
                            existing
                        ) => {
                            if (
                                !existing
                                ||
                                existing.id
                                !==
                                menuItemId
                            ) {
                                return existing;
                            }

                            return current;
                        }
                    );
                } catch (
                caught
                ) {
                    console.error(
                        "Unable to reconcile realtime consumption preview menu data.",
                        caught
                    );
                }
            },
            [
                previewMenuItem,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Refresh Editor Catalog From Realtime
    |--------------------------------------------------------------------------
    |
    | Ingredient and unit changes can make the recipe editor's lookup catalog
    | stale.
    |
    | If no editor is open, invalidate the cache and defer the API call until
    | the next editor opening.
    |
    | If an editor is already open, refresh only the ingredient/unit catalog.
    | The recipe currently being edited is deliberately NOT replaced because
    | doing so could destroy unsaved manager input.
    |--------------------------------------------------------------------------
    */

    const refreshEditorCatalogFromRealtime =
        useCallback(
            async (): Promise<void> => {
                if (
                    !canManage
                ) {
                    return;
                }

                if (
                    !editor
                ) {
                    setEditorCatalogLoaded(
                        false
                    );

                    return;
                }

                try {
                    await loadEditorCatalog();
                } catch (
                caught
                ) {
                    console.error(
                        "Unable to reconcile realtime recipe editor catalog.",
                        caught
                    );
                }
            },
            [
                canManage,
                editor,
                loadEditorCatalog,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Manual Refresh
    |--------------------------------------------------------------------------
    */

    const refresh =
        async (): Promise<void> => {
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
                const jobs:
                    Array<
                        Promise<unknown>
                    > = [
                        loadMenuItems(),
                        loadAddons(),
                        refreshSelectedMenuItem(),
                        refreshPreviewMenuItem(),
                    ];

                /*
                 * If editor catalogs are already in use, refresh them as part
                 * of the manual refresh as well.
                 */
                if (
                    canManage
                    &&
                    (
                        editor
                        ||
                        editorCatalogLoaded
                    )
                ) {
                    jobs.push(
                        loadEditorCatalog()
                    );
                }

                await Promise.all(
                    jobs
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
            item:
                MenuItem
        ): Promise<void> => {
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
    | Prepare Editor
    |--------------------------------------------------------------------------
    */

    const prepareEditor =
        async (): Promise<void> => {
            if (
                canManage
            ) {
                await ensureEditorCatalog();
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Open Base Recipe
    |--------------------------------------------------------------------------
    */

    const openBaseRecipe =
        async (
            item:
                MenuItem
        ): Promise<void> => {
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

    /*
    |--------------------------------------------------------------------------
    | Open Variant Recipe
    |--------------------------------------------------------------------------
    */

    const openVariantRecipe =
        async (
            item:
                MenuItem,

            variant:
                MenuItemVariant
        ): Promise<void> => {
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

    /*
    |--------------------------------------------------------------------------
    | Open Add-on Recipe
    |--------------------------------------------------------------------------
    */

    const openAddonRecipe =
        async (
            addon:
                MenuAddon
        ): Promise<void> => {
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
            item:
                MenuItem
        ): Promise<void> => {
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
                        >
                        0
                        ||
                        item.variants
                            .length
                        >
                        0
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
    | Save Current Recipe
    |--------------------------------------------------------------------------
    */

    const saveCurrentRecipe =
        async (
            payload:
                SaveRecipePayload
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
                ===
                "ADDON"
            ) {
                const result =
                    await saveAddonRecipe(
                        target.addon.id,
                        payload
                    );

                /*
                 * Saving an add-on recipe can change consumes_inventory.
                 */
                void loadAddons();

                return result;
            }

            if (
                target.kind
                ===
                "VARIANT"
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

    /*
    |--------------------------------------------------------------------------
    | Clear Current Recipe
    |--------------------------------------------------------------------------
    */

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
                ===
                "ADDON"
            ) {
                const result =
                    await clearAddonRecipe(
                        target.addon.id
                    );

                /*
                 * Saving / clearing an add-on recipe also changes
                 * consumes_inventory on the backend.
                 */
                void loadAddons();

                return result;
            }

            if (
                target.kind
                ===
                "VARIANT"
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
    | Menu + Recipe Realtime Reconciliation
    |--------------------------------------------------------------------------
    |
    | `menu`
    |   Menu item, variant and add-on metadata changed.
    |
    | `recipes`
    |   Recipe components changed.
    |
    | Laravel REST remains authoritative. Reverb simply tells this screen
    | that something relevant changed.
    |
    | Important:
    |
    | We deliberately DO NOT replace `editor.recipe` when an editor is open.
    | That could overwrite unsaved recipe quantities currently being entered
    | by a manager.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            "menu",
            "recipes",
        ],
        async () => {
            try {
                await Promise.all([
                    loadMenuItems(),
                    loadAddons(),
                    refreshSelectedMenuItem(),
                    refreshPreviewMenuItem(),
                ]);
            } catch (
            caught
            ) {
                console.error(
                    "Unable to reconcile realtime recipe/menu data.",
                    caught
                );
            }
        }
    );

    /*
    |--------------------------------------------------------------------------
    | Inventory Realtime Reconciliation
    |--------------------------------------------------------------------------
    |
    | Recipe editor ingredient and unit choices come from the inventory
    | domain.
    |
    | If the editor is closed, only invalidate the cached catalog.
    |
    | If the editor is open, refresh its supporting lookup data without
    | replacing the recipe being edited.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            "inventory",
        ],
        async () => {
            await refreshEditorCatalogFromRealtime();
        }
    );

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <div className="recipes-page">
            {/*
            |--------------------------------------------------------------------------
            | Header
            |--------------------------------------------------------------------------
            */}

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
                    disabled={
                        refreshing
                    }
                >
                    {
                        refreshing
                            ? "Refreshing..."
                            : "Refresh"
                    }
                </button>
            </header>

            {/*
            |--------------------------------------------------------------------------
            | Error
            |--------------------------------------------------------------------------
            */}

            {
                error
                && (
                    <div className="recipes-alert recipes-alert-error">
                        {
                            error
                        }
                    </div>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Access Information
            |--------------------------------------------------------------------------
            */}

            {
                !canManage
                && (
                    <div className="recipes-alert recipes-alert-info">
                        Recipe management controls are read-only for your account.
                        Viewing and consumption preview remain available.
                    </div>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Summary
            |--------------------------------------------------------------------------
            */}

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

            {/*
            |--------------------------------------------------------------------------
            | Tabs
            |--------------------------------------------------------------------------
            */}

            <div className="recipes-tabs">
                <button
                    type="button"
                    className={
                        activeTab
                            ===
                            "MENU"
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
                            ===
                            "ADDONS"
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

            {/*
            |--------------------------------------------------------------------------
            | Menu Recipes
            |--------------------------------------------------------------------------
            */}

            {
                activeTab
                    ===
                    "MENU"
                    ? (
                        <section className="recipes-panel">
                            <div className="recipes-panel-header">
                                <div>
                                    <h2>
                                        Menu Recipes
                                    </h2>

                                    <p>
                                        Open a menu item to configure its base recipe,
                                        variant recipes or run a consumption preview.
                                    </p>
                                </div>

                                <form
                                    className="recipes-search"
                                    onSubmit={
                                        submitSearch
                                    }
                                >
                                    <input
                                        type="search"
                                        value={
                                            searchDraft
                                        }
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
                                                onClick={
                                                    resetSearch
                                                }
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
                                        ===
                                        0
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
                                                                key={
                                                                    item.id
                                                                }
                                                                className="recipes-item-card"
                                                            >
                                                                <div className="recipes-item-main">
                                                                    {
                                                                        item.photo_url
                                                                            ? (
                                                                                <img
                                                                                    src={
                                                                                        item.photo_url
                                                                                    }
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
                                                                                    ||
                                                                                    "No SKU"
                                                                                }
                                                                            </span>

                                                                            <span>
                                                                                {
                                                                                    item.category
                                                                                        ?.name
                                                                                    ||
                                                                                    "Uncategorised"
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
                                                                    disabled={
                                                                        opening
                                                                    }
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
                                >
                                1
                                && (
                                    <div className="recipes-pagination">
                                        <button
                                            type="button"
                                            className="recipes-button recipes-button-secondary"
                                            disabled={
                                                menuLoading
                                                ||
                                                menuPagination
                                                    .current_page
                                                <=
                                                1
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
                                                                -
                                                                1
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
                                                ||
                                                menuPagination
                                                    .current_page
                                                >=
                                                menuPagination
                                                    .last_page
                                            }
                                            onClick={
                                                () =>
                                                    setPage(
                                                        (
                                                            current
                                                        ) =>
                                                            current
                                                            +
                                                            1
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
                        /*
                        |--------------------------------------------------------------------------
                        | Add-on Recipes
                        |--------------------------------------------------------------------------
                        */

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
                                        value={
                                            addonSearch
                                        }
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
                                        ===
                                        0
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
                                                                key={
                                                                    addon.id
                                                                }
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
                                                                                ||
                                                                                "No SKU"
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
                                                                    disabled={
                                                                        opening
                                                                    }
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

            {/*
            |--------------------------------------------------------------------------
            | Recipe Target Modal
            |--------------------------------------------------------------------------
            */}

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
                            aria-label={
                                `Recipes for ${selectedMenuItem.name}`
                            }
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
                                        Choose the exact recipe definition you want to
                                        view or manage.
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
                                    disabled={
                                        opening
                                    }
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
                                        disabled={
                                            opening
                                        }
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
                                                        key={
                                                            variant.id
                                                        }
                                                        type="button"
                                                        className="recipes-target-card"
                                                        onClick={
                                                            () =>
                                                                void openVariantRecipe(
                                                                    selectedMenuItem,
                                                                    variant
                                                                )
                                                        }
                                                        disabled={
                                                            opening
                                                        }
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
                                        disabled={
                                            opening
                                        }
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
                                        disabled={
                                            opening
                                        }
                                    >
                                        Consumption Preview
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Recipe Editor
            |--------------------------------------------------------------------------
            |
            | Realtime events never replace `editor.recipe` while this modal
            | is open. This protects unsaved quantities/rows.
            |--------------------------------------------------------------------------
            */}

            {
                editor
                && (
                    <RecipeEditorModal
                        target={
                            editor.target
                        }
                        recipe={
                            editor.recipe
                        }
                        ingredients={
                            ingredients
                        }
                        units={
                            units
                        }
                        canManage={
                            canManage
                        }
                        onClose={
                            () =>
                                setEditor(
                                    null
                                )
                        }
                        onSave={
                            saveCurrentRecipe
                        }
                        onClear={
                            clearCurrentRecipe
                        }
                    />
                )
            }

            {/*
            |--------------------------------------------------------------------------
            | Consumption Preview
            |--------------------------------------------------------------------------
            */}

            {
                previewMenuItem
                && (
                    <ConsumptionPreviewModal
                        menuItem={
                            previewMenuItem
                        }
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