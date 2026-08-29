import type {
    Metadata,
} from "next";

import MenuCard
    from "../../../components/site/MenuCard";

import {
    DEFAULT_RESTAURANT_SETTINGS,
    getRestaurantSettings,
    getWebsiteMenu,
} from "../../../lib/website-api";

export const metadata:
    Metadata = {
    title:
        "Menu",

    description:
        "Explore our restaurant menu and current prices.",
};

export const dynamic =
    "force-dynamic";

interface MenuPageProps {
    searchParams:
    Promise<{
        search?:
        string
        | string[];
    }>;
}

export default async function MenuPage({
    searchParams,
}: MenuPageProps) {
    const params =
        await searchParams;

    const search =
        typeof params.search
            === "string"
            ? params.search
            : "";

    const [
        settings,
        categories,
    ] =
        await Promise.all([
            getRestaurantSettings()
                .catch(
                    () =>
                        DEFAULT_RESTAURANT_SETTINGS,
                ),

            getWebsiteMenu(
                search,
            ).catch(
                () =>
                    [],
            ),
        ]);

    const itemCount =
        categories.reduce(
            (
                total,
                category,
            ) =>
                total
                +
                category.items.length,
            0,
        );

    return (
        <main>
            <section
                className="site-page-hero menu"
            >
                <div
                    className="site-container"
                >
                    <span
                        className="site-eyebrow light"
                    >
                        FRESHLY PREPARED
                    </span>

                    <h1>
                        Our Menu
                    </h1>

                    <p>
                        Explore dishes
                        currently available
                        from our kitchen.
                    </p>
                </div>
            </section>

            <section
                className="site-section"
            >
                <div
                    className="site-container"
                >
                    <form
                        className="site-menu-search"
                        action="/menu"
                        method="get"
                    >
                        <input
                            type="search"
                            name="search"
                            defaultValue={
                                search
                            }
                            placeholder="Search dishes..."
                        />

                        <button
                            type="submit"
                            className="site-button primary"
                        >
                            Search
                        </button>
                    </form>

                    {
                        search
                            ? (
                                <div
                                    className="site-search-summary"
                                >
                                    <span>
                                        {
                                            itemCount
                                        } result
                                        {
                                            itemCount
                                                === 1
                                                ? ""
                                                : "s"
                                        }{" "}
                                        for{" "}
                                        <strong>
                                            “{search}”
                                        </strong>
                                    </span>

                                    <a
                                        href="/menu"
                                    >
                                        Clear search
                                    </a>
                                </div>
                            )
                            : null
                    }

                    {
                        categories.length
                            > 0
                            ? (
                                <nav
                                    className="site-category-nav"
                                    aria-label="Menu categories"
                                >
                                    {
                                        categories.map(
                                            (
                                                category,
                                            ) => (
                                                <a
                                                    key={
                                                        category.id
                                                    }
                                                    href={`#${category.slug}`}
                                                >
                                                    {
                                                        category.name
                                                    }
                                                </a>
                                            ),
                                        )
                                    }
                                </nav>
                            )
                            : null
                    }

                    {
                        categories.length
                            === 0
                            ? (
                                <div
                                    className="site-empty-state large"
                                >
                                    No menu items
                                    matched your search.
                                </div>
                            )
                            : (
                                <div
                                    className="site-menu-sections"
                                >
                                    {
                                        categories.map(
                                            (
                                                category,
                                            ) => (
                                                <section
                                                    key={
                                                        category.id
                                                    }
                                                    id={
                                                        category.slug
                                                    }
                                                    className="site-menu-category-section"
                                                >
                                                    <header>
                                                        <div>
                                                            <span
                                                                className="site-eyebrow"
                                                            >
                                                                MENU
                                                            </span>

                                                            <h2>
                                                                {
                                                                    category.name
                                                                }
                                                            </h2>

                                                            {
                                                                category
                                                                    .description
                                                                    ? (
                                                                        <p>
                                                                            {
                                                                                category
                                                                                    .description
                                                                            }
                                                                        </p>
                                                                    )
                                                                    : null
                                                            }
                                                        </div>

                                                        <span>
                                                            {
                                                                category
                                                                    .items
                                                                    .length
                                                            }{" "}
                                                            item
                                                            {
                                                                category
                                                                    .items
                                                                    .length
                                                                    === 1
                                                                    ? ""
                                                                    : "s"
                                                            }
                                                        </span>
                                                    </header>

                                                    <div
                                                        className="site-menu-grid"
                                                    >
                                                        {
                                                            category
                                                                .items
                                                                .map(
                                                                    (
                                                                        item,
                                                                    ) => (
                                                                        <MenuCard
                                                                            key={
                                                                                item.id
                                                                            }
                                                                            item={
                                                                                item
                                                                            }
                                                                            currency={
                                                                                settings
                                                                                    .currency
                                                                            }
                                                                        />
                                                                    ),
                                                                )
                                                        }
                                                    </div>
                                                </section>
                                            ),
                                        )
                                    }
                                </div>
                            )
                    }
                </div>
            </section>
        </main>
    );
}