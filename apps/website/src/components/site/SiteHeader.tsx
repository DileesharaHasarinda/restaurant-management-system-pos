import Link
    from "next/link";

import {
    resolveAssetUrl,
} from "../../lib/website-api";

import type {
    RestaurantSettings,
} from "../../types/website";

interface SiteHeaderProps {
    settings:
    RestaurantSettings;
}

const navigation = [
    {
        href: "/",
        label: "Home",
    },
    {
        href: "/about",
        label: "About",
    },
    {
        href: "/menu",
        label: "Menu",
    },
    {
        href: "/gallery",
        label: "Gallery",
    },
    {
        href: "/reviews",
        label: "Reviews",
    },
    {
        href: "/contact",
        label: "Contact",
    },
];

export default function SiteHeader({
    settings,
}: SiteHeaderProps) {
    const logo =
        resolveAssetUrl(
            settings.logo_url,
        );

    return (
        <header
            className="site-header"
        >
            <div
                className="site-container site-header-inner"
            >
                <Link
                    href="/"
                    className="site-brand"
                    aria-label={`${settings.restaurant_name} home`}
                >
                    {
                        logo
                            ? (
                                <img
                                    src={logo}
                                    alt={`${settings.restaurant_name} logo`}
                                    className="site-brand-logo"
                                />
                            )
                            : (
                                <span
                                    className="site-brand-mark"
                                    aria-hidden="true"
                                >
                                    {settings.restaurant_name
                                        .charAt(0)
                                        .toUpperCase()}
                                </span>
                            )
                    }

                    <span
                        className="site-brand-copy"
                    >
                        <strong>
                            {
                                settings
                                    .restaurant_name
                            }
                        </strong>

                        <small>
                            Restaurant & Dining
                        </small>
                    </span>
                </Link>

                <nav
                    className="site-desktop-nav"
                    aria-label="Main navigation"
                >
                    {
                        navigation.map(
                            (
                                item,
                            ) => (
                                <Link
                                    key={
                                        item.href
                                    }
                                    href={
                                        item.href
                                    }
                                >
                                    {
                                        item.label
                                    }
                                </Link>
                            ),
                        )
                    }
                </nav>

                <Link
                    href="/menu"
                    className="site-header-cta"
                >
                    View Menu
                </Link>

                <details
                    className="site-mobile-nav"
                >
                    <summary
                        aria-label="Open navigation menu"
                    >
                        <span />
                        <span />
                        <span />
                    </summary>

                    <div
                        className="site-mobile-nav-panel"
                    >
                        {
                            navigation.map(
                                (
                                    item,
                                ) => (
                                    <Link
                                        key={
                                            item.href
                                        }
                                        href={
                                            item.href
                                        }
                                    >
                                        {
                                            item.label
                                        }
                                    </Link>
                                ),
                            )
                        }
                    </div>
                </details>
            </div>
        </header>
    );
}