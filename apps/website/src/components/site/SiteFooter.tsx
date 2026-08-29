import Link
    from "next/link";

import {
    publicEmail,
    publicPhone,
    whatsappUrl,
} from "../../lib/website-api";

import type {
    RestaurantSettings,
} from "../../types/website";

interface SiteFooterProps {
    settings:
    RestaurantSettings;
}

export default function SiteFooter({
    settings,
}: SiteFooterProps) {
    const phone =
        publicPhone(
            settings,
        );

    const email =
        publicEmail(
            settings,
        );

    const whatsapp =
        whatsappUrl(
            settings
                .website_contact
                .whatsapp,
        );

    const socials =
        [
            {
                label:
                    "Facebook",

                url:
                    settings
                        .social_media
                        .facebook,
            },
            {
                label:
                    "Instagram",

                url:
                    settings
                        .social_media
                        .instagram,
            },
            {
                label:
                    "TikTok",

                url:
                    settings
                        .social_media
                        .tiktok,
            },
            {
                label:
                    "YouTube",

                url:
                    settings
                        .social_media
                        .youtube,
            },
        ].filter(
            (
                item,
            ) =>
                Boolean(
                    item.url,
                ),
        );

    return (
        <footer
            className="site-footer"
        >
            <div
                className="site-container site-footer-grid"
            >
                <div
                    className="site-footer-brand"
                >
                    <span
                        className="site-eyebrow light"
                    >
                        WELCOME
                    </span>

                    <h2>
                        {
                            settings
                                .restaurant_name
                        }
                    </h2>

                    <p>
                        Fresh food,
                        thoughtful hospitality
                        and memorable dining.
                    </p>
                </div>

                <div>
                    <h3>
                        Explore
                    </h3>

                    <div
                        className="site-footer-links"
                    >
                        <Link href="/about">
                            About
                        </Link>

                        <Link href="/menu">
                            Menu
                        </Link>

                        <Link href="/gallery">
                            Gallery
                        </Link>

                        <Link href="/reviews">
                            Reviews
                        </Link>

                        <Link href="/contact">
                            Contact
                        </Link>
                    </div>
                </div>

                <div>
                    <h3>
                        Contact
                    </h3>

                    <div
                        className="site-footer-links"
                    >
                        {
                            phone
                                ? (
                                    <a
                                        href={`tel:${phone}`}
                                    >
                                        {phone}
                                    </a>
                                )
                                : null
                        }

                        {
                            email
                                ? (
                                    <a
                                        href={`mailto:${email}`}
                                    >
                                        {email}
                                    </a>
                                )
                                : null
                        }

                        {
                            whatsapp
                                ? (
                                    <a
                                        href={
                                            whatsapp
                                        }
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        WhatsApp
                                    </a>
                                )
                                : null
                        }

                        {
                            settings.address
                                ? (
                                    <span>
                                        {
                                            settings
                                                .address
                                        }
                                    </span>
                                )
                                : null
                        }
                    </div>
                </div>

                <div>
                    <h3>
                        Follow
                    </h3>

                    <div
                        className="site-footer-links"
                    >
                        {
                            socials.length
                                > 0
                                ? (
                                    socials.map(
                                        (
                                            item,
                                        ) => (
                                            <a
                                                key={
                                                    item.label
                                                }
                                                href={
                                                    item.url
                                                    ??
                                                    "#"
                                                }
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                {
                                                    item.label
                                                }
                                            </a>
                                        ),
                                    )
                                )
                                : (
                                    <span>
                                        Social links
                                        coming soon.
                                    </span>
                                )
                        }
                    </div>
                </div>
            </div>

            <div
                className="site-container site-footer-bottom"
            >
                <span>
                    © {new Date().getFullYear()}{" "}
                    {
                        settings
                            .restaurant_name
                    }
                </span>

                <span>
                    All rights reserved.
                </span>
            </div>
        </footer>
    );
}