import Link
    from "next/link";

import OpeningHours
    from "../../components/site/OpeningHours";

import MenuCard
    from "../../components/site/MenuCard";

import {
    DEFAULT_RESTAURANT_SETTINGS,
    getGallery,
    getRestaurantSettings,
    getReviews,
    getWebsiteMenu,
    publicPhone,
    resolveAssetUrl,
} from "../../lib/website-api";

export const dynamic =
    "force-dynamic";

export default async function HomePage() {
    const [
        settings,
        menu,
        gallery,
        reviews,
    ] =
        await Promise.all([
            getRestaurantSettings()
                .catch(
                    () =>
                        DEFAULT_RESTAURANT_SETTINGS,
                ),

            getWebsiteMenu()
                .catch(
                    () =>
                        [],
                ),

            getGallery()
                .catch(
                    () =>
                        [],
                ),

            getReviews(
                3,
            ).catch(
                () =>
                    [],
            ),
        ]);

    const items =
        menu.flatMap(
            (
                category,
            ) =>
                category.items,
        );

    const featuredItems =
        items.slice(
            0,
            3,
        );

    const galleryPreview =
        gallery.slice(
            0,
            6,
        );

    const heroPhoto =
        resolveAssetUrl(
            items.find(
                (
                    item,
                ) =>
                    Boolean(
                        item.photo_url,
                    ),
            )
                ?.photo_url
            ??
            gallery.find(
                (
                    image,
                ) =>
                    Boolean(
                        image.image_url,
                    ),
            )
                ?.image_url
            ??
            null,
        );

    const phone =
        publicPhone(
            settings,
        );

    return (
        <main>
            <section
                className="site-hero"
            >
                <div
                    className="site-hero-background"
                >
                    {
                        heroPhoto
                            ? (
                                <img
                                    src={
                                        heroPhoto
                                    }
                                    alt=""
                                />
                            )
                            : null
                    }

                    <div
                        className="site-hero-overlay"
                    />
                </div>

                <div
                    className="site-container site-hero-content"
                >
                    <span
                        className="site-eyebrow light"
                    >
                        WELCOME TO
                    </span>

                    <h1>
                        {
                            settings
                                .restaurant_name
                        }
                    </h1>

                    <p>
                        Freshly prepared
                        favourites, warm
                        hospitality and a
                        dining experience
                        worth remembering.
                    </p>

                    <div
                        className="site-hero-actions"
                    >
                        <Link
                            href="/menu"
                            className="site-button gold"
                        >
                            Explore Our Menu
                        </Link>

                        <Link
                            href="/contact"
                            className="site-button ghost-light"
                        >
                            Visit Us
                        </Link>
                    </div>

                    <div
                        className="site-hero-info"
                    >
                        {
                            settings.address
                                ? (
                                    <div>
                                        <small>
                                            LOCATION
                                        </small>

                                        <strong>
                                            {
                                                settings
                                                    .address
                                            }
                                        </strong>
                                    </div>
                                )
                                : null
                        }

                        {
                            phone
                                ? (
                                    <div>
                                        <small>
                                            CONTACT
                                        </small>

                                        <a
                                            href={`tel:${phone}`}
                                        >
                                            {phone}
                                        </a>
                                    </div>
                                )
                                : null
                        }
                    </div>
                </div>
            </section>

            <section
                className="site-section"
            >
                <div
                    className="site-container site-intro-grid"
                >
                    <div>
                        <span
                            className="site-eyebrow"
                        >
                            OUR RESTAURANT
                        </span>

                        <h2
                            className="site-display-heading"
                        >
                            Good food,
                            prepared with care.
                        </h2>
                    </div>

                    <div
                        className="site-intro-copy"
                    >
                        <p>
                            At{" "}
                            <strong>
                                {
                                    settings
                                        .restaurant_name
                                }
                            </strong>
                            , every meal is
                            prepared to bring
                            together flavour,
                            freshness and
                            genuine hospitality.
                        </p>

                        <p>
                            Whether you are
                            joining us for a
                            relaxed meal,
                            catching up with
                            friends or sharing
                            a special occasion,
                            we want every visit
                            to feel welcoming.
                        </p>

                        <Link
                            href="/about"
                            className="site-text-link"
                        >
                            Discover our story →
                        </Link>
                    </div>
                </div>
            </section>

            <section
                className="site-section site-section-soft"
            >
                <div
                    className="site-container"
                >
                    <div
                        className="site-section-heading"
                    >
                        <div>
                            <span
                                className="site-eyebrow"
                            >
                                FROM OUR KITCHEN
                            </span>

                            <h2>
                                A taste of our menu
                            </h2>
                        </div>

                        <Link
                            href="/menu"
                            className="site-text-link"
                        >
                            View full menu →
                        </Link>
                    </div>

                    {
                        featuredItems.length
                            > 0
                            ? (
                                <div
                                    className="site-menu-grid"
                                >
                                    {
                                        featuredItems.map(
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
                                                        settings.currency
                                                    }
                                                />
                                            ),
                                        )
                                    }
                                </div>
                            )
                            : (
                                <div
                                    className="site-empty-state"
                                >
                                    Menu items will
                                    appear here once
                                    they are available.
                                </div>
                            )
                    }
                </div>
            </section>

            <section
                className="site-section site-dark-section"
            >
                <div
                    className="site-container site-hours-section"
                >
                    <div
                        className="site-hours-copy"
                    >
                        <span
                            className="site-eyebrow light"
                        >
                            PLAN YOUR VISIT
                        </span>

                        <h2>
                            Opening Hours
                        </h2>

                        <p>
                            Join us for a freshly
                            prepared meal and
                            relaxed dining
                            experience.
                        </p>

                        <Link
                            href="/contact"
                            className="site-button gold"
                        >
                            Find Us
                        </Link>
                    </div>

                    <div
                        className="site-hours-card"
                    >
                        <OpeningHours
                            hours={
                                settings
                                    .opening_hours
                            }
                            timezone={
                                settings
                                    .timezone
                            }
                        />
                    </div>
                </div>
            </section>

            {
                galleryPreview.length
                    > 0
                    ? (
                        <section
                            className="site-section"
                        >
                            <div
                                className="site-container"
                            >
                                <div
                                    className="site-section-heading"
                                >
                                    <div>
                                        <span
                                            className="site-eyebrow"
                                        >
                                            GALLERY
                                        </span>

                                        <h2>
                                            Moments from
                                            our restaurant
                                        </h2>
                                    </div>

                                    <Link
                                        href="/gallery"
                                        className="site-text-link"
                                    >
                                        View gallery →
                                    </Link>
                                </div>

                                <div
                                    className="site-gallery-grid preview"
                                >
                                    {
                                        galleryPreview.map(
                                            (
                                                image,
                                            ) => {
                                                const url =
                                                    resolveAssetUrl(
                                                        image
                                                            .image_url,
                                                    );

                                                return (
                                                    <article
                                                        key={
                                                            image.id
                                                        }
                                                    >
                                                        {
                                                            url
                                                                ? (
                                                                    <img
                                                                        src={
                                                                            url
                                                                        }
                                                                        alt={
                                                                            image
                                                                                .alt_text
                                                                            ||
                                                                            image.title
                                                                            ||
                                                                            "Restaurant gallery"
                                                                        }
                                                                    />
                                                                )
                                                                : null
                                                        }
                                                    </article>
                                                );
                                            },
                                        )
                                    }
                                </div>
                            </div>
                        </section>
                    )
                    : null
            }

            <section
                className="site-section site-section-soft"
            >
                <div
                    className="site-container"
                >
                    <div
                        className="site-section-heading centered"
                    >
                        <div>
                            <span
                                className="site-eyebrow"
                            >
                                GUEST EXPERIENCES
                            </span>

                            <h2>
                                What our guests say
                            </h2>
                        </div>
                    </div>

                    {
                        reviews.length
                            > 0
                            ? (
                                <div
                                    className="site-review-grid"
                                >
                                    {
                                        reviews.map(
                                            (
                                                review,
                                            ) => (
                                                <article
                                                    key={
                                                        review.id
                                                    }
                                                    className="site-review-card"
                                                >
                                                    <div
                                                        className="site-stars"
                                                    >
                                                        {
                                                            "★".repeat(
                                                                Math.max(
                                                                    1,
                                                                    Math.min(
                                                                        review
                                                                            .rating,
                                                                        5,
                                                                    ),
                                                                ),
                                                            )
                                                        }
                                                    </div>

                                                    <blockquote>
                                                        “
                                                        {
                                                            review.review
                                                        }
                                                        ”
                                                    </blockquote>

                                                    <strong>
                                                        {
                                                            review
                                                                .customer_name
                                                        }
                                                    </strong>
                                                </article>
                                            ),
                                        )
                                    }
                                </div>
                            )
                            : (
                                <div
                                    className="site-empty-state"
                                >
                                    Guest reviews will
                                    appear here after
                                    they are approved.
                                </div>
                            )
                    }

                    <div
                        className="site-center-action"
                    >
                        <Link
                            href="/reviews"
                            className="site-button outline"
                        >
                            Read & Leave a Review
                        </Link>
                    </div>
                </div>
            </section>

            <section
                className="site-cta-section"
            >
                <div
                    className="site-container site-cta-inner"
                >
                    <div>
                        <span
                            className="site-eyebrow light"
                        >
                            COME DINE WITH US
                        </span>

                        <h2>
                            We look forward
                            to welcoming you.
                        </h2>
                    </div>

                    <div
                        className="site-cta-actions"
                    >
                        <Link
                            href="/menu"
                            className="site-button gold"
                        >
                            View Menu
                        </Link>

                        <Link
                            href="/contact"
                            className="site-button ghost-light"
                        >
                            Contact Us
                        </Link>
                    </div>
                </div>
            </section>
        </main>
    );
}