import type {
    Metadata,
} from "next";

import Link
    from "next/link";

import {
    DEFAULT_RESTAURANT_SETTINGS,
    getRestaurantSettings,
} from "../../../lib/website-api";

export const metadata:
    Metadata = {
    title:
        "About",

    description:
        "Learn more about our restaurant, food and hospitality.",
};

export const dynamic =
    "force-dynamic";

export default async function AboutPage() {
    const settings =
        await getRestaurantSettings()
            .catch(
                () =>
                    DEFAULT_RESTAURANT_SETTINGS,
            );

    return (
        <main>
            <section
                className="site-page-hero"
            >
                <div
                    className="site-container"
                >
                    <span
                        className="site-eyebrow light"
                    >
                        OUR STORY
                    </span>

                    <h1>
                        About{" "}
                        {
                            settings
                                .restaurant_name
                        }
                    </h1>

                    <p>
                        Food, hospitality
                        and memorable moments
                        shared around the table.
                    </p>
                </div>
            </section>

            <section
                className="site-section"
            >
                <div
                    className="site-container site-about-grid"
                >
                    <div
                        className="site-about-feature"
                    >
                        <span>
                            Fresh
                        </span>

                        <h2>
                            Made for
                            enjoyable dining.
                        </h2>
                    </div>

                    <div
                        className="site-about-copy"
                    >
                        <span
                            className="site-eyebrow"
                        >
                            WHO WE ARE
                        </span>

                        <h2>
                            Welcome to{" "}
                            {
                                settings
                                    .restaurant_name
                            }
                        </h2>

                        <p>
                            Our restaurant is
                            built around a simple
                            idea: serve satisfying
                            food in a comfortable,
                            welcoming environment.
                        </p>

                        <p>
                            Our menu brings
                            together familiar
                            favourites and freshly
                            prepared dishes,
                            supported by attentive
                            service and genuine
                            hospitality.
                        </p>

                        <p>
                            From casual meals to
                            celebrations with
                            family and friends,
                            we aim to make every
                            visit relaxed and
                            memorable.
                        </p>

                        <Link
                            href="/menu"
                            className="site-button primary"
                        >
                            Explore Our Menu
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
                        className="site-values-grid"
                    >
                        <article>
                            <span>
                                01
                            </span>

                            <h3>
                                Freshly Prepared
                            </h3>

                            <p>
                                Dishes prepared with
                                attention to flavour,
                                consistency and
                                presentation.
                            </p>
                        </article>

                        <article>
                            <span>
                                02
                            </span>

                            <h3>
                                Warm Hospitality
                            </h3>

                            <p>
                                A relaxed environment
                                where every guest
                                should feel welcome.
                            </p>
                        </article>

                        <article>
                            <span>
                                03
                            </span>

                            <h3>
                                Memorable Moments
                            </h3>

                            <p>
                                A place for everyday
                                meals, family time
                                and special occasions.
                            </p>
                        </article>
                    </div>
                </div>
            </section>
        </main>
    );
}