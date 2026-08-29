import {
    formatMoney,
    resolveAssetUrl,
} from "../../lib/website-api";

import type {
    MenuItem,
} from "../../types/website";

interface MenuCardProps {
    item:
    MenuItem;

    currency:
    string;
}

export default function MenuCard({
    item,
    currency,
}: MenuCardProps) {
    const photo =
        resolveAssetUrl(
            item.photo_url,
        );

    const minimumPrice =
        item.variants.length
            > 0
            ? Math.min(
                ...item
                    .variants
                    .map(
                        (
                            variant,
                        ) =>
                            Number(
                                variant.price,
                            ),
                    ),
            )
            : Number(
                item.price,
            );

    return (
        <article
            className="site-menu-card"
        >
            <div
                className="site-menu-card-image"
            >
                {
                    photo
                        ? (
                            <img
                                src={
                                    photo
                                }
                                alt={
                                    item.name
                                }
                            />
                        )
                        : (
                            <div
                                className="site-food-placeholder"
                                aria-hidden="true"
                            >
                                <span>
                                    {
                                        item.name
                                            .charAt(
                                                0,
                                            )
                                            .toUpperCase()
                                    }
                                </span>
                            </div>
                        )
                }

                <span
                    className="site-menu-category-label"
                >
                    {
                        item
                            .category
                            ?.name
                        ??
                        "Menu"
                    }
                </span>
            </div>

            <div
                className="site-menu-card-content"
            >
                <div
                    className="site-menu-card-title"
                >
                    <h3>
                        {
                            item.name
                        }
                    </h3>

                    <strong>
                        {
                            item
                                .variants
                                .length
                                > 0
                                ? `From ${formatMoney(
                                    minimumPrice,
                                    currency,
                                )}`
                                : formatMoney(
                                    Number(
                                        item.price,
                                    ),
                                    currency,
                                )
                        }
                    </strong>
                </div>

                {
                    item.description
                        ? (
                            <p>
                                {
                                    item
                                        .description
                                }
                            </p>
                        )
                        : null
                }

                {
                    item.variants.length
                        > 0
                        ? (
                            <div
                                className="site-menu-options"
                            >
                                <span>
                                    Sizes / Options
                                </span>

                                {
                                    item.variants.map(
                                        (
                                            variant,
                                        ) => (
                                            <div
                                                key={
                                                    variant.id
                                                }
                                            >
                                                <span>
                                                    {
                                                        variant.name
                                                    }
                                                </span>

                                                <strong>
                                                    {
                                                        formatMoney(
                                                            Number(
                                                                variant
                                                                    .price,
                                                            ),
                                                            currency,
                                                        )
                                                    }
                                                </strong>
                                            </div>
                                        ),
                                    )
                                }
                            </div>
                        )
                        : null
                }

                {
                    item.addons.length
                        > 0
                        ? (
                            <details
                                className="site-addon-details"
                            >
                                <summary>
                                    Available extras
                                </summary>

                                <div>
                                    {
                                        item.addons.map(
                                            (
                                                addon,
                                            ) => (
                                                <span
                                                    key={
                                                        addon.id
                                                    }
                                                >
                                                    {
                                                        addon.name
                                                    }{" "}
                                                    <strong>
                                                        +
                                                        {
                                                            formatMoney(
                                                                Number(
                                                                    addon
                                                                        .price,
                                                                ),
                                                                currency,
                                                            )
                                                        }
                                                    </strong>
                                                </span>
                                            ),
                                        )
                                    }
                                </div>
                            </details>
                        )
                        : null
                }
            </div>
        </article>
    );
}