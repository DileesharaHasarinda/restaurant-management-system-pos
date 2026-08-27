import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";

import {
    ApiError,
} from "../lib/api";

import {
    useAuth,
} from "../auth/useAuth";

import {
    createAddon,
    createAddonGroup,
    createMenuCategory,
    createMenuItem,
    getAddonGroups,
    getAddons,
    getMenuCategories,
    getMenuItems,
    removeMenuItemPhoto,
    updateMenuCategory,
    updateMenuCategoryState,
    updateMenuItem,
    updateMenuItemState,
    uploadMenuItemPhoto,
} from "./menuService";

import MenuItemFormModal
    from "./items/MenuItemFormModal";

import type {
    CreateAddonGroupPayload,
    CreateAddonPayload,
    CreateCategoryPayload,
    MenuAddon,
    MenuAddonGroup,
    MenuCategory,
    MenuItem,
    MenuItemEditorSubmission,
    PaginationMeta,
} from "./types";

import "./MenuManagementPage.css";

type MenuTab =
    | "items"
    | "categories"
    | "addons";

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
        }
    );

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

/*
|--------------------------------------------------------------------------
| Page
|--------------------------------------------------------------------------
*/

export default function MenuManagementPage() {
    const {
        hasPermission,
    } =
        useAuth();

    const canManage =
        hasPermission(
            "menu.manage"
        );

    const [
        activeTab,
        setActiveTab,
    ] =
        useState<MenuTab>(
            "items"
        );

    const [
        categories,
        setCategories,
    ] =
        useState<MenuCategory[]>(
            []
        );

    const [
        items,
        setItems,
    ] =
        useState<MenuItem[]>(
            []
        );

    const [
        addonGroups,
        setAddonGroups,
    ] =
        useState<MenuAddonGroup[]>(
            []
        );

    const [
        addons,
        setAddons,
    ] =
        useState<MenuAddon[]>(
            []
        );

    const [
        pagination,
        setPagination,
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
        categoryFilter,
        setCategoryFilter,
    ] =
        useState<number | null>(
            null
        );

    const [
        activeFilter,
        setActiveFilter,
    ] =
        useState<boolean | null>(
            null
        );

    const [
        availableFilter,
        setAvailableFilter,
    ] =
        useState<boolean | null>(
            null
        );

    const [
        loading,
        setLoading,
    ] =
        useState(
            true
        );

    const [
        busy,
        setBusy,
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
        message,
        setMessage,
    ] =
        useState(
            ""
        );

    const [
        editingItem,
        setEditingItem,
    ] =
        useState<MenuItem | null | undefined>(
            undefined
        );

    const [
        categoryModal,
        setCategoryModal,
    ] =
        useState<MenuCategory | null | undefined>(
            undefined
        );

    const [
        addonGroupModal,
        setAddonGroupModal,
    ] =
        useState(
            false
        );

    const [
        addonModal,
        setAddonModal,
    ] =
        useState(
            false
        );

    /*
    |--------------------------------------------------------------------------
    | Error
    |--------------------------------------------------------------------------
    */

    const showError =
        useCallback(
            (
                exception: unknown
            ): void => {
                if (
                    exception
                    instanceof
                    ApiError
                ) {
                    const validation =
                        Object
                            .values(
                                exception.errors
                            )
                            .flat()[0];

                    setError(
                        validation
                        ??
                        exception.message
                    );

                    return;
                }

                setError(
                    "The request could not be completed."
                );
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Catalog Data
    |--------------------------------------------------------------------------
    */

    const loadCatalogs =
        useCallback(
            async (): Promise<void> => {
                const [
                    categoryData,
                    groupData,
                    addonData,
                ] =
                    await Promise.all([
                        getMenuCategories(),
                        getAddonGroups(),
                        getAddons(),
                    ]);

                setCategories(
                    categoryData
                );

                setAddonGroups(
                    groupData
                );

                setAddons(
                    addonData
                );
            },
            []
        );

    /*
    |--------------------------------------------------------------------------
    | Items
    |--------------------------------------------------------------------------
    */

    const loadItems =
        useCallback(
            async (): Promise<void> => {
                const result =
                    await getMenuItems({
                        page,

                        search,

                        categoryId:
                            categoryFilter,

                        isActive:
                            activeFilter,

                        isAvailable:
                            availableFilter,
                    });

                setItems(
                    result.items
                );

                setPagination(
                    result.pagination
                );
            },
            [
                page,
                search,
                categoryFilter,
                activeFilter,
                availableFilter,
            ]
        );

    useEffect(
        () => {
            const loadInitialData =
                async (): Promise<void> => {
                    try {
                        await Promise.all([
                            loadCatalogs(),
                            loadItems(),
                        ]);
                    } catch (
                    exception
                    ) {
                        showError(
                            exception
                        );
                    } finally {
                        setLoading(
                            false
                        );
                    }
                };

            void loadInitialData();
        },
        [
            loadCatalogs,
            loadItems,
            showError,
        ]
    );

    /*
    |--------------------------------------------------------------------------
    | Summary
    |--------------------------------------------------------------------------
    */

    const summary =
        useMemo(
            () => ({
                categories:
                    categories.length,

                activeCategories:
                    categories.filter(
                        (
                            category
                        ) =>
                            category.is_active
                    ).length,

                totalItems:
                    pagination.total,

                visibleItems:
                    items.filter(
                        (
                            item
                        ) =>
                            item.is_active
                            &&
                            item.is_available
                    ).length,

                addonGroups:
                    addonGroups.length,

                addons:
                    addons.length,
            }),
            [
                categories,
                items,
                pagination.total,
                addonGroups,
                addons,
            ]
        );

    /*
    |--------------------------------------------------------------------------
    | Search
    |--------------------------------------------------------------------------
    */

    const submitSearch =
        (
            event:
                FormEvent<HTMLFormElement>
        ): void => {
            event.preventDefault();

            setPage(
                1
            );

            setSearch(
                searchDraft.trim()
            );
        };

    /*
    |--------------------------------------------------------------------------
    | Save Item
    |--------------------------------------------------------------------------
    */

    const saveItem =
        async (
            submission:
                MenuItemEditorSubmission
        ): Promise<void> => {
            setBusy(
                true
            );

            setError(
                ""
            );

            setMessage(
                ""
            );

            try {
                let saved:
                    MenuItem;

                if (
                    editingItem
                ) {
                    saved =
                        await updateMenuItem(
                            editingItem.id,

                            {
                                category_id:
                                    submission.category_id,

                                name:
                                    submission.name,

                                description:
                                    submission.description,

                                price:
                                    submission.price,

                                tax_rate:
                                    submission.tax_rate,

                                sort_order:
                                    submission.sort_order,

                                variants:
                                    submission.variants,

                                addons:
                                    submission.addons,
                            }
                        );

                    const stateChanged =
                        saved.is_active
                        !==
                        submission.is_active
                        ||
                        saved.is_available
                        !==
                        submission.is_available
                        ||
                        saved.is_visible_on_website
                        !==
                        submission.is_visible_on_website
                        ||
                        saved.is_visible_on_qr
                        !==
                        submission.is_visible_on_qr;

                    if (
                        stateChanged
                    ) {
                        saved =
                            await updateMenuItemState(
                                saved.id,

                                {
                                    is_active:
                                        submission.is_active,

                                    is_available:
                                        submission.is_available,

                                    is_visible_on_website:
                                        submission.is_visible_on_website,

                                    is_visible_on_qr:
                                        submission.is_visible_on_qr,
                                }
                            );
                    }
                } else {
                    saved =
                        await createMenuItem({
                            category_id:
                                submission.category_id,

                            name:
                                submission.name,

                            description:
                                submission.description,

                            price:
                                submission.price,

                            tax_rate:
                                submission.tax_rate,

                            sort_order:
                                submission.sort_order,

                            is_active:
                                submission.is_active,

                            is_available:
                                submission.is_available,

                            is_visible_on_website:
                                submission.is_visible_on_website,

                            is_visible_on_qr:
                                submission.is_visible_on_qr,

                            variants:
                                submission.variants,

                            addons:
                                submission.addons,
                        });
                }

                if (
                    submission.photo
                ) {
                    saved =
                        await uploadMenuItemPhoto(
                            saved.id,
                            submission.photo
                        );
                }

                setEditingItem(
                    undefined
                );

                setMessage(
                    editingItem
                        ? "Menu item updated successfully."
                        : "Menu item created successfully."
                );

                await Promise.all([
                    loadItems(),
                    loadCatalogs(),
                ]);
            } catch (
            exception
            ) {
                showError(
                    exception
                );
            } finally {
                setBusy(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Item State
    |--------------------------------------------------------------------------
    */

    const changeItemState =
        async (
            item:
                MenuItem,

            field:
                "is_active"
                |
                "is_available"
                |
                "is_visible_on_website"
                |
                "is_visible_on_qr"
        ): Promise<void> => {
            if (
                !canManage
            ) {
                return;
            }

            setBusy(
                true
            );

            setError(
                ""
            );

            try {
                await updateMenuItemState(
                    item.id,

                    {
                        [field]:
                            !item[field],
                    }
                );

                await loadItems();
            } catch (
            exception
            ) {
                showError(
                    exception
                );
            } finally {
                setBusy(
                    false
                );
            }
        };

    const removePhoto =
        async (
            item:
                MenuItem
        ): Promise<void> => {
            if (
                !window.confirm(
                    `Remove the photo from "${item.name}"?`
                )
            ) {
                return;
            }

            setBusy(
                true
            );

            try {
                const updated =
                    await removeMenuItemPhoto(
                        item.id
                    );

                setEditingItem(
                    updated
                );

                await loadItems();
            } catch (
            exception
            ) {
                showError(
                    exception
                );
            } finally {
                setBusy(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Category
    |--------------------------------------------------------------------------
    */

    const saveCategory =
        async (
            payload:
                CreateCategoryPayload
        ): Promise<void> => {
            setBusy(
                true
            );

            setError(
                ""
            );

            try {
                if (
                    categoryModal
                ) {
                    await updateMenuCategory(
                        categoryModal.id,

                        {
                            name:
                                payload.name,

                            description:
                                payload.description,

                            sort_order:
                                payload.sort_order,
                        }
                    );

                    await updateMenuCategoryState(
                        categoryModal.id,

                        {
                            is_active:
                                payload.is_active,

                            is_visible_on_website:
                                payload.is_visible_on_website,

                            is_visible_on_qr:
                                payload.is_visible_on_qr,
                        }
                    );

                    setMessage(
                        "Category updated successfully."
                    );
                } else {
                    await createMenuCategory(
                        payload
                    );

                    setMessage(
                        "Category created successfully."
                    );
                }

                setCategoryModal(
                    undefined
                );

                await Promise.all([
                    loadCatalogs(),
                    loadItems(),
                ]);
            } catch (
            exception
            ) {
                showError(
                    exception
                );
            } finally {
                setBusy(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Add-ons
    |--------------------------------------------------------------------------
    */

    const saveAddonGroup =
        async (
            payload:
                CreateAddonGroupPayload
        ): Promise<void> => {
            setBusy(
                true
            );

            setError(
                ""
            );

            try {
                await createAddonGroup(
                    payload
                );

                setAddonGroupModal(
                    false
                );

                setMessage(
                    "Add-on group created successfully."
                );

                await loadCatalogs();
            } catch (
            exception
            ) {
                showError(
                    exception
                );
            } finally {
                setBusy(
                    false
                );
            }
        };

    const saveAddon =
        async (
            payload:
                CreateAddonPayload
        ): Promise<void> => {
            setBusy(
                true
            );

            setError(
                ""
            );

            try {
                await createAddon(
                    payload
                );

                setAddonModal(
                    false
                );

                setMessage(
                    "Add-on created successfully."
                );

                await loadCatalogs();
            } catch (
            exception
            ) {
                showError(
                    exception
                );
            } finally {
                setBusy(
                    false
                );
            }
        };

    /*
    |--------------------------------------------------------------------------
    | Render
    |--------------------------------------------------------------------------
    */

    return (
        <section className="ops-menu-page">
            <header className="ops-menu-page-header">
                <div>
                    <span>
                        RESTAURANT MENU
                    </span>

                    <h2>
                        Menu Management
                    </h2>

                    <p>
                        Manage categories, menu items, variants, pricing,
                        customer visibility and add-ons.
                    </p>
                </div>

                {
                    canManage
                    &&
                    activeTab
                    ===
                    "items"
                    &&
                    (
                        <button
                            type="button"
                            className="ops-menu-primary-button"
                            disabled={
                                categories.length
                                ===
                                0
                            }
                            onClick={
                                () =>
                                    setEditingItem(
                                        null
                                    )
                            }
                        >
                            + New Menu Item
                        </button>
                    )
                }
            </header>

            {
                error
                &&
                (
                    <div
                        className="ops-menu-alert error"
                        role="alert"
                    >
                        {
                            error
                        }
                    </div>
                )
            }

            {
                message
                &&
                (
                    <div className="ops-menu-alert success">
                        {
                            message
                        }
                    </div>
                )
            }

            <div className="ops-menu-summary-grid">
                <SummaryCard
                    label="Menu Items"
                    value={
                        summary.totalItems
                    }
                />

                <SummaryCard
                    label="Categories"
                    value={
                        summary.categories
                    }
                    note={
                        `${summary.activeCategories} active`
                    }
                />

                <SummaryCard
                    label="Visible Items"
                    value={
                        summary.visibleItems
                    }
                    note="Current page"
                />

                <SummaryCard
                    label="Add-ons"
                    value={
                        summary.addons
                    }
                    note={
                        `${summary.addonGroups} groups`
                    }
                />
            </div>

            <nav className="ops-menu-tabs">
                <Tab
                    label="Menu Items"
                    active={
                        activeTab
                        ===
                        "items"
                    }
                    onClick={
                        () =>
                            setActiveTab(
                                "items"
                            )
                    }
                />

                <Tab
                    label="Categories"
                    active={
                        activeTab
                        ===
                        "categories"
                    }
                    onClick={
                        () =>
                            setActiveTab(
                                "categories"
                            )
                    }
                />

                <Tab
                    label="Add-ons"
                    active={
                        activeTab
                        ===
                        "addons"
                    }
                    onClick={
                        () =>
                            setActiveTab(
                                "addons"
                            )
                    }
                />
            </nav>

            {
                activeTab
                ===
                "items"
                &&
                (
                    <>
                        <form
                            className="ops-menu-toolbar"
                            onSubmit={
                                submitSearch
                            }
                        >
                            <input
                                type="search"
                                placeholder="Search menu item, SKU or description..."
                                value={
                                    searchDraft
                                }
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setSearchDraft(
                                            event.target.value
                                        )
                                }
                            />

                            <select
                                value={
                                    categoryFilter
                                    ??
                                    ""
                                }
                                onChange={
                                    (
                                        event
                                    ) => {
                                        setPage(
                                            1
                                        );

                                        setCategoryFilter(
                                            event.target.value
                                                ===
                                                ""
                                                ? null
                                                : Number(
                                                    event.target.value
                                                )
                                        );
                                    }
                                }
                            >
                                <option value="">
                                    All Categories
                                </option>

                                {
                                    categories.map(
                                        (
                                            category
                                        ) => (
                                            <option
                                                key={
                                                    category.id
                                                }
                                                value={
                                                    category.id
                                                }
                                            >
                                                {
                                                    category.name
                                                }
                                            </option>
                                        )
                                    )
                                }
                            </select>

                            <select
                                value={
                                    activeFilter
                                        ===
                                        null
                                        ? ""
                                        : activeFilter
                                            ? "1"
                                            : "0"
                                }
                                onChange={
                                    (
                                        event
                                    ) => {
                                        setPage(
                                            1
                                        );

                                        setActiveFilter(
                                            event.target.value
                                                ===
                                                ""
                                                ? null
                                                : event.target.value
                                                ===
                                                "1"
                                        );
                                    }
                                }
                            >
                                <option value="">
                                    All States
                                </option>

                                <option value="1">
                                    Active
                                </option>

                                <option value="0">
                                    Inactive
                                </option>
                            </select>

                            <select
                                value={
                                    availableFilter
                                        ===
                                        null
                                        ? ""
                                        : availableFilter
                                            ? "1"
                                            : "0"
                                }
                                onChange={
                                    (
                                        event
                                    ) => {
                                        setPage(
                                            1
                                        );

                                        setAvailableFilter(
                                            event.target.value
                                                ===
                                                ""
                                                ? null
                                                : event.target.value
                                                ===
                                                "1"
                                        );
                                    }
                                }
                            >
                                <option value="">
                                    All Availability
                                </option>

                                <option value="1">
                                    Available
                                </option>

                                <option value="0">
                                    Unavailable
                                </option>
                            </select>

                            <button
                                type="submit"
                            >
                                Search
                            </button>
                        </form>

                        {
                            loading
                                ? (
                                    <LoadingState />
                                )
                                : items.length
                                    ===
                                    0
                                    ? (
                                        <EmptyState
                                            title="No menu items found"
                                            text="Create a menu item or change the current filters."
                                        />
                                    )
                                    : (
                                        <div className="ops-menu-item-grid">
                                            {
                                                items.map(
                                                    (
                                                        item
                                                    ) => (
                                                        <MenuItemCard
                                                            key={
                                                                item.id
                                                            }
                                                            item={
                                                                item
                                                            }
                                                            canManage={
                                                                canManage
                                                            }
                                                            busy={
                                                                busy
                                                            }
                                                            onEdit={
                                                                setEditingItem
                                                            }
                                                            onToggle={
                                                                changeItemState
                                                            }
                                                        />
                                                    )
                                                )
                                            }
                                        </div>
                                    )
                        }

                        <div className="ops-menu-pagination">
                            <span>
                                {
                                    pagination.total
                                }
                                {" "}
                                menu items
                            </span>

                            <div>
                                <button
                                    type="button"
                                    disabled={
                                        page <= 1
                                    }
                                    onClick={
                                        () =>
                                            setPage(
                                                (
                                                    current
                                                ) =>
                                                    Math.max(
                                                        1,
                                                        current - 1
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
                                        pagination.current_page
                                    }
                                    {" "}
                                    of
                                    {" "}
                                    {
                                        pagination.last_page
                                    }
                                </span>

                                <button
                                    type="button"
                                    disabled={
                                        page
                                        >=
                                        pagination.last_page
                                    }
                                    onClick={
                                        () =>
                                            setPage(
                                                (
                                                    current
                                                ) =>
                                                    current + 1
                                            )
                                    }
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )
            }

            {
                activeTab
                ===
                "categories"
                &&
                (
                    <div className="ops-menu-panel">
                        <header className="ops-menu-panel-header">
                            <div>
                                <h3>
                                    Categories
                                </h3>

                                <p>
                                    Organize menu items and control website/QR visibility.
                                </p>
                            </div>

                            {
                                canManage
                                &&
                                (
                                    <button
                                        type="button"
                                        onClick={
                                            () =>
                                                setCategoryModal(
                                                    null
                                                )
                                        }
                                    >
                                        + New Category
                                    </button>
                                )
                            }
                        </header>

                        <div className="ops-menu-category-list">
                            {
                                categories.map(
                                    (
                                        category
                                    ) => (
                                        <article
                                            key={
                                                category.id
                                            }
                                        >
                                            <div>
                                                <strong>
                                                    {
                                                        category.name
                                                    }
                                                </strong>

                                                <span>
                                                    {
                                                        category.description
                                                        ??
                                                        "No description"
                                                    }
                                                </span>
                                            </div>

                                            <div className="ops-menu-category-count">
                                                <strong>
                                                    {
                                                        category.menu_items_count
                                                        ??
                                                        0
                                                    }
                                                </strong>

                                                <span>
                                                    Items
                                                </span>
                                            </div>

                                            <div className="ops-menu-badges">
                                                <StatusBadge
                                                    active={
                                                        category.is_active
                                                    }
                                                    activeText="Active"
                                                    inactiveText="Inactive"
                                                />

                                                <StatusBadge
                                                    active={
                                                        category.is_visible_on_website
                                                    }
                                                    activeText="Website"
                                                    inactiveText="Website Hidden"
                                                />

                                                <StatusBadge
                                                    active={
                                                        category.is_visible_on_qr
                                                    }
                                                    activeText="QR"
                                                    inactiveText="QR Hidden"
                                                />
                                            </div>

                                            {
                                                canManage
                                                &&
                                                (
                                                    <button
                                                        type="button"
                                                        className="ops-menu-edit-button"
                                                        onClick={
                                                            () =>
                                                                setCategoryModal(
                                                                    category
                                                                )
                                                        }
                                                    >
                                                        Edit
                                                    </button>
                                                )
                                            }
                                        </article>
                                    )
                                )
                            }
                        </div>
                    </div>
                )
            }

            {
                activeTab
                ===
                "addons"
                &&
                (
                    <div className="ops-menu-addon-layout">
                        <section className="ops-menu-panel">
                            <header className="ops-menu-panel-header">
                                <div>
                                    <h3>
                                        Add-on Groups
                                    </h3>

                                    <p>
                                        Group choices such as extras, sauces and toppings.
                                    </p>
                                </div>

                                {
                                    canManage
                                    &&
                                    (
                                        <button
                                            type="button"
                                            onClick={
                                                () =>
                                                    setAddonGroupModal(
                                                        true
                                                    )
                                            }
                                        >
                                            + New Group
                                        </button>
                                    )
                                }
                            </header>

                            <div className="ops-menu-addon-groups">
                                {
                                    addonGroups.map(
                                        (
                                            group
                                        ) => (
                                            <article
                                                key={
                                                    group.id
                                                }
                                            >
                                                <div>
                                                    <strong>
                                                        {
                                                            group.name
                                                        }
                                                    </strong>

                                                    <span>
                                                        {
                                                            group.description
                                                            ??
                                                            "No description"
                                                        }
                                                    </span>
                                                </div>

                                                <div>
                                                    <StatusBadge
                                                        active={
                                                            group.is_active
                                                        }
                                                        activeText="Active"
                                                        inactiveText="Inactive"
                                                    />

                                                    {
                                                        group.is_required
                                                        &&
                                                        (
                                                            <span className="ops-menu-badge required">
                                                                Required
                                                            </span>
                                                        )
                                                    }
                                                </div>

                                                <small>
                                                    {
                                                        group.addons.length
                                                    }
                                                    {" "}
                                                    add-ons
                                                </small>
                                            </article>
                                        )
                                    )
                                }
                            </div>
                        </section>

                        <section className="ops-menu-panel">
                            <header className="ops-menu-panel-header">
                                <div>
                                    <h3>
                                        Add-ons
                                    </h3>

                                    <p>
                                        Optional extras available for menu items.
                                    </p>
                                </div>

                                {
                                    canManage
                                    &&
                                    (
                                        <button
                                            type="button"
                                            disabled={
                                                addonGroups.length
                                                ===
                                                0
                                            }
                                            onClick={
                                                () =>
                                                    setAddonModal(
                                                        true
                                                    )
                                            }
                                        >
                                            + New Add-on
                                        </button>
                                    )
                                }
                            </header>

                            {
                                canManage
                                &&
                                (
                                    <div className="ops-menu-backend-note">
                                        Your current Laravel API supports creating add-ons,
                                        but does not yet expose add-on update routes.
                                    </div>
                                )
                            }

                            <div className="ops-menu-addon-list">
                                {
                                    addons.map(
                                        (
                                            addon
                                        ) => (
                                            <article
                                                key={
                                                    addon.id
                                                }
                                            >
                                                <div>
                                                    <strong>
                                                        {
                                                            addon.name
                                                        }
                                                    </strong>

                                                    <span>
                                                        {
                                                            addonGroups.find(
                                                                (
                                                                    group
                                                                ) =>
                                                                    group.id
                                                                    ===
                                                                    addon.addon_group_id
                                                            )?.name
                                                            ??
                                                            "Unknown Group"
                                                        }
                                                    </span>
                                                </div>

                                                <strong>
                                                    {
                                                        money.format(
                                                            addon.base_price
                                                        )
                                                    }
                                                </strong>

                                                <div className="ops-menu-badges">
                                                    <StatusBadge
                                                        active={
                                                            addon.is_active
                                                        }
                                                        activeText="Active"
                                                        inactiveText="Inactive"
                                                    />

                                                    <StatusBadge
                                                        active={
                                                            addon.is_available
                                                        }
                                                        activeText="Available"
                                                        inactiveText="Unavailable"
                                                    />

                                                    {
                                                        addon.consumes_inventory
                                                        &&
                                                        (
                                                            <span className="ops-menu-badge inventory">
                                                                Inventory
                                                            </span>
                                                        )
                                                    }
                                                </div>
                                            </article>
                                        )
                                    )
                                }
                            </div>
                        </section>
                    </div>
                )
            }

            {
                editingItem
                !==
                undefined
                &&
                (
                    <MenuItemFormModal
                        key={
                            editingItem
                                ?.id
                            ??
                            "new-item"
                        }
                        item={
                            editingItem
                        }
                        categories={
                            categories
                        }
                        addons={
                            addons
                        }
                        busy={
                            busy
                        }
                        onClose={
                            () =>
                                setEditingItem(
                                    undefined
                                )
                        }
                        onSave={
                            saveItem
                        }
                        onRemovePhoto={
                            removePhoto
                        }
                    />
                )
            }

            {
                categoryModal
                !==
                undefined
                &&
                (
                    <CategoryModal
                        key={
                            categoryModal
                                ?.id
                            ??
                            "new-category"
                        }
                        category={
                            categoryModal
                        }
                        busy={
                            busy
                        }
                        onClose={
                            () =>
                                setCategoryModal(
                                    undefined
                                )
                        }
                        onSave={
                            saveCategory
                        }
                    />
                )
            }

            {
                addonGroupModal
                &&
                (
                    <AddonGroupModal
                        busy={
                            busy
                        }
                        onClose={
                            () =>
                                setAddonGroupModal(
                                    false
                                )
                        }
                        onSave={
                            saveAddonGroup
                        }
                    />
                )
            }

            {
                addonModal
                &&
                (
                    <AddonModal
                        groups={
                            addonGroups
                        }
                        busy={
                            busy
                        }
                        onClose={
                            () =>
                                setAddonModal(
                                    false
                                )
                        }
                        onSave={
                            saveAddon
                        }
                    />
                )
            }
        </section>
    );
}

/*
|--------------------------------------------------------------------------
| Item Card
|--------------------------------------------------------------------------
*/

function MenuItemCard(
    {
        item,
        canManage,
        busy,
        onEdit,
        onToggle,
    }: {
        item: MenuItem;

        canManage: boolean;

        busy: boolean;

        onEdit: (
            item: MenuItem
        ) => void;

        onToggle: (
            item: MenuItem,

            field:
                "is_active"
                |
                "is_available"
                |
                "is_visible_on_website"
                |
                "is_visible_on_qr"
        ) => Promise<void>;
    }
) {
    return (
        <article className="ops-menu-item-card">
            <div className="ops-menu-item-photo">
                {
                    item.photo_url
                        ? (
                            <img
                                src={
                                    item.photo_url
                                }
                                alt={
                                    item.name
                                }
                            />
                        )
                        : (
                            <span>
                                MENU
                            </span>
                        )
                }
            </div>

            <div className="ops-menu-item-content">
                <div className="ops-menu-item-heading">
                    <div>
                        <span>
                            {
                                item.category
                                    ?.name
                                ??
                                "Uncategorized"
                            }
                        </span>

                        <h3>
                            {
                                item.name
                            }
                        </h3>
                    </div>

                    <strong>
                        {
                            money.format(
                                item.price
                            )
                        }
                    </strong>
                </div>

                <p>
                    {
                        item.description
                        ??
                        "No description"
                    }
                </p>

                <div className="ops-menu-badges">
                    <StatusBadge
                        active={
                            item.is_active
                        }
                        activeText="Active"
                        inactiveText="Inactive"
                    />

                    <StatusBadge
                        active={
                            item.is_available
                        }
                        activeText="Available"
                        inactiveText="Unavailable"
                    />

                    {
                        item.has_variants
                        &&
                        (
                            <span className="ops-menu-badge info">
                                {
                                    item.variants.length
                                }
                                {" "}
                                Variants
                            </span>
                        )
                    }

                    {
                        item.addons.length
                        >
                        0
                        &&
                        (
                            <span className="ops-menu-badge info">
                                {
                                    item.addons.length
                                }
                                {" "}
                                Add-ons
                            </span>
                        )
                    }
                </div>

                <div className="ops-menu-visibility-row">
                    <span>
                        Website:
                        {" "}
                        <strong>
                            {
                                item.is_visible_on_website
                                    ? "Visible"
                                    : "Hidden"
                            }
                        </strong>
                    </span>

                    <span>
                        QR:
                        {" "}
                        <strong>
                            {
                                item.is_visible_on_qr
                                    ? "Visible"
                                    : "Hidden"
                            }
                        </strong>
                    </span>
                </div>

                {
                    canManage
                    &&
                    (
                        <div className="ops-menu-item-actions">
                            <button
                                type="button"
                                disabled={
                                    busy
                                }
                                onClick={
                                    () =>
                                        onEdit(
                                            item
                                        )
                                }
                            >
                                Edit
                            </button>

                            <button
                                type="button"
                                disabled={
                                    busy
                                }
                                onClick={
                                    () => {
                                        void onToggle(
                                            item,
                                            "is_available"
                                        );
                                    }
                                }
                            >
                                {
                                    item.is_available
                                        ? "Make Unavailable"
                                        : "Make Available"
                                }
                            </button>

                            <button
                                type="button"
                                disabled={
                                    busy
                                }
                                onClick={
                                    () => {
                                        void onToggle(
                                            item,
                                            "is_active"
                                        );
                                    }
                                }
                            >
                                {
                                    item.is_active
                                        ? "Deactivate"
                                        : "Activate"
                                }
                            </button>
                        </div>
                    )
                }
            </div>
        </article>
    );
}

/*
|--------------------------------------------------------------------------
| Category Modal
|--------------------------------------------------------------------------
*/

function CategoryModal(
    {
        category,
        busy,
        onClose,
        onSave,
    }: {
        category: MenuCategory | null;

        busy: boolean;

        onClose: () => void;

        onSave: (
            payload: CreateCategoryPayload
        ) => Promise<void>;
    }
) {
    const [
        name,
        setName,
    ] =
        useState(
            category?.name
            ??
            ""
        );

    const [
        description,
        setDescription,
    ] =
        useState(
            category?.description
            ??
            ""
        );

    const [
        sortOrder,
        setSortOrder,
    ] =
        useState(
            category?.sort_order
            ??
            0
        );

    const [
        active,
        setActive,
    ] =
        useState(
            category?.is_active
            ??
            true
        );

    const [
        website,
        setWebsite,
    ] =
        useState(
            category?.is_visible_on_website
            ??
            true
        );

    const [
        qr,
        setQr,
    ] =
        useState(
            category?.is_visible_on_qr
            ??
            true
        );

    return (
        <div className="ops-menu-modal-backdrop">
            <form
                className="ops-menu-modal small"
                onSubmit={
                    (
                        event
                    ) => {
                        event.preventDefault();

                        void onSave({
                            name:
                                name.trim(),

                            description:
                                description.trim()
                                    ===
                                    ""
                                    ? null
                                    : description.trim(),

                            sort_order:
                                sortOrder,

                            is_active:
                                active,

                            is_visible_on_website:
                                website,

                            is_visible_on_qr:
                                qr,
                        });
                    }
                }
            >
                <header className="ops-menu-modal-header">
                    <div>
                        <span>
                            CATEGORY
                        </span>

                        <h3>
                            {
                                category
                                    ? "Edit Category"
                                    : "New Category"
                            }
                        </h3>
                    </div>

                    <button
                        type="button"
                        className="ops-menu-modal-close"
                        onClick={
                            onClose
                        }
                    >
                        ×
                    </button>
                </header>

                <div className="ops-menu-simple-form">
                    <label>
                        <span>
                            Name *
                        </span>

                        <input
                            required
                            maxLength={
                                150
                            }
                            value={
                                name
                            }
                            onChange={
                                (
                                    event
                                ) =>
                                    setName(
                                        event.target.value
                                    )
                            }
                        />
                    </label>

                    <label>
                        <span>
                            Description
                        </span>

                        <textarea
                            rows={
                                4
                            }
                            value={
                                description
                            }
                            onChange={
                                (
                                    event
                                ) =>
                                    setDescription(
                                        event.target.value
                                    )
                            }
                        />
                    </label>

                    <label>
                        <span>
                            Sort Order
                        </span>

                        <input
                            type="number"
                            min="0"
                            value={
                                sortOrder
                            }
                            onChange={
                                (
                                    event
                                ) =>
                                    setSortOrder(
                                        Number(
                                            event.target.value
                                        )
                                        ||
                                        0
                                    )
                            }
                        />
                    </label>

                    <ToggleInput
                        label="Active"
                        checked={
                            active
                        }
                        onChange={
                            setActive
                        }
                    />

                    <ToggleInput
                        label="Visible on Website"
                        checked={
                            website
                        }
                        onChange={
                            setWebsite
                        }
                    />

                    <ToggleInput
                        label="Visible on Customer QR"
                        checked={
                            qr
                        }
                        onChange={
                            setQr
                        }
                    />
                </div>

                <footer className="ops-menu-modal-footer">
                    <button
                        type="button"
                        className="secondary"
                        onClick={
                            onClose
                        }
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="primary"
                        disabled={
                            busy
                        }
                    >
                        {
                            busy
                                ? "Saving..."
                                : "Save Category"
                        }
                    </button>
                </footer>
            </form>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| Add-on Group Modal
|--------------------------------------------------------------------------
*/

function AddonGroupModal(
    {
        busy,
        onClose,
        onSave,
    }: {
        busy: boolean;

        onClose: () => void;

        onSave: (
            payload:
                CreateAddonGroupPayload
        ) => Promise<void>;
    }
) {
    const [
        name,
        setName,
    ] =
        useState(
            ""
        );

    const [
        description,
        setDescription,
    ] =
        useState(
            ""
        );

    const [
        required,
        setRequired,
    ] =
        useState(
            false
        );

    return (
        <div className="ops-menu-modal-backdrop">
            <form
                className="ops-menu-modal small"
                onSubmit={
                    (
                        event
                    ) => {
                        event.preventDefault();

                        void onSave({
                            name:
                                name.trim(),

                            description:
                                description.trim()
                                    ===
                                    ""
                                    ? null
                                    : description.trim(),

                            is_required:
                                required,

                            is_active:
                                true,

                            sort_order:
                                0,
                        });
                    }
                }
            >
                <header className="ops-menu-modal-header">
                    <div>
                        <span>
                            ADD-ON GROUP
                        </span>

                        <h3>
                            New Add-on Group
                        </h3>
                    </div>

                    <button
                        type="button"
                        className="ops-menu-modal-close"
                        onClick={
                            onClose
                        }
                    >
                        ×
                    </button>
                </header>

                <div className="ops-menu-simple-form">
                    <label>
                        <span>
                            Group Name *
                        </span>

                        <input
                            required
                            value={
                                name
                            }
                            onChange={
                                (
                                    event
                                ) =>
                                    setName(
                                        event.target.value
                                    )
                            }
                        />
                    </label>

                    <label>
                        <span>
                            Description
                        </span>

                        <textarea
                            rows={
                                4
                            }
                            value={
                                description
                            }
                            onChange={
                                (
                                    event
                                ) =>
                                    setDescription(
                                        event.target.value
                                    )
                            }
                        />
                    </label>

                    <ToggleInput
                        label="Customer must select from this group"
                        checked={
                            required
                        }
                        onChange={
                            setRequired
                        }
                    />
                </div>

                <footer className="ops-menu-modal-footer">
                    <button
                        type="button"
                        className="secondary"
                        onClick={
                            onClose
                        }
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="primary"
                        disabled={
                            busy
                        }
                    >
                        Create Group
                    </button>
                </footer>
            </form>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| Add-on Modal
|--------------------------------------------------------------------------
*/

function AddonModal(
    {
        groups,
        busy,
        onClose,
        onSave,
    }: {
        groups: MenuAddonGroup[];

        busy: boolean;

        onClose: () => void;

        onSave: (
            payload:
                CreateAddonPayload
        ) => Promise<void>;
    }
) {
    const [
        groupId,
        setGroupId,
    ] =
        useState(
            groups[0]?.id
            ??
            0
        );

    const [
        name,
        setName,
    ] =
        useState(
            ""
        );

    const [
        price,
        setPrice,
    ] =
        useState(
            "0"
        );

    return (
        <div className="ops-menu-modal-backdrop">
            <form
                className="ops-menu-modal small"
                onSubmit={
                    (
                        event
                    ) => {
                        event.preventDefault();

                        void onSave({
                            addon_group_id:
                                groupId,

                            name:
                                name.trim(),

                            price:
                                Number(
                                    price
                                ),

                            is_available:
                                true,

                            is_active:
                                true,

                            sort_order:
                                0,
                        });
                    }
                }
            >
                <header className="ops-menu-modal-header">
                    <div>
                        <span>
                            ADD-ON
                        </span>

                        <h3>
                            New Add-on
                        </h3>
                    </div>

                    <button
                        type="button"
                        className="ops-menu-modal-close"
                        onClick={
                            onClose
                        }
                    >
                        ×
                    </button>
                </header>

                <div className="ops-menu-simple-form">
                    <label>
                        <span>
                            Add-on Group *
                        </span>

                        <select
                            value={
                                groupId
                            }
                            onChange={
                                (
                                    event
                                ) =>
                                    setGroupId(
                                        Number(
                                            event.target.value
                                        )
                                    )
                            }
                        >
                            {
                                groups.map(
                                    (
                                        group
                                    ) => (
                                        <option
                                            key={
                                                group.id
                                            }
                                            value={
                                                group.id
                                            }
                                        >
                                            {
                                                group.name
                                            }
                                        </option>
                                    )
                                )
                            }
                        </select>
                    </label>

                    <label>
                        <span>
                            Add-on Name *
                        </span>

                        <input
                            required
                            value={
                                name
                            }
                            onChange={
                                (
                                    event
                                ) =>
                                    setName(
                                        event.target.value
                                    )
                            }
                        />
                    </label>

                    <label>
                        <span>
                            Price (Rs.) *
                        </span>

                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            required
                            value={
                                price
                            }
                            onChange={
                                (
                                    event
                                ) =>
                                    setPrice(
                                        event.target.value
                                    )
                            }
                        />
                    </label>
                </div>

                <footer className="ops-menu-modal-footer">
                    <button
                        type="button"
                        className="secondary"
                        onClick={
                            onClose
                        }
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        className="primary"
                        disabled={
                            busy
                        }
                    >
                        Create Add-on
                    </button>
                </footer>
            </form>
        </div>
    );
}

/*
|--------------------------------------------------------------------------
| Shared
|--------------------------------------------------------------------------
*/

function SummaryCard(
    {
        label,
        value,
        note,
    }: {
        label: string;

        value: number;

        note?: string;
    }
) {
    return (
        <article className="ops-menu-summary-card">
            <span>
                {
                    label
                }
            </span>

            <strong>
                {
                    value
                }
            </strong>

            {
                note
                &&
                (
                    <small>
                        {
                            note
                        }
                    </small>
                )
            }
        </article>
    );
}

function Tab(
    {
        label,
        active,
        onClick,
    }: {
        label: string;

        active: boolean;

        onClick: () => void;
    }
) {
    return (
        <button
            type="button"
            className={
                active
                    ? "active"
                    : ""
            }
            onClick={
                onClick
            }
        >
            {
                label
            }
        </button>
    );
}

function StatusBadge(
    {
        active,
        activeText,
        inactiveText,
    }: {
        active: boolean;

        activeText: string;

        inactiveText: string;
    }
) {
    return (
        <span
            className={
                active
                    ? "ops-menu-badge success"
                    : "ops-menu-badge muted"
            }
        >
            {
                active
                    ? activeText
                    : inactiveText
            }
        </span>
    );
}

function ToggleInput(
    {
        label,
        checked,
        onChange,
    }: {
        label: string;

        checked: boolean;

        onChange: (
            value: boolean
        ) => void;
    }
) {
    return (
        <label className="ops-menu-simple-toggle">
            <input
                type="checkbox"
                checked={
                    checked
                }
                onChange={
                    (
                        event
                    ) =>
                        onChange(
                            event.target.checked
                        )
                }
            />

            <span>
                {
                    label
                }
            </span>
        </label>
    );
}

function LoadingState() {
    return (
        <div className="ops-menu-loading">
            Loading menu...
        </div>
    );
}

function EmptyState(
    {
        title,
        text,
    }: {
        title: string;

        text: string;
    }
) {
    return (
        <div className="ops-menu-empty">
            <strong>
                {
                    title
                }
            </strong>

            <span>
                {
                    text
                }
            </span>
        </div>
    );
}