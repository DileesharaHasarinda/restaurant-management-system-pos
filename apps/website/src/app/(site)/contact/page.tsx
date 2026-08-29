import type {
    Metadata,
} from "next";

import OpeningHours
    from "../../../components/site/OpeningHours";

import {
    DEFAULT_RESTAURANT_SETTINGS,
    getRestaurantSettings,
    publicEmail,
    publicPhone,
    whatsappUrl,
} from "../../../lib/website-api";

export const metadata:
    Metadata = {
    title:
        "Contact",

    description:
        "Contact the restaurant, view opening hours and find us on Google Maps.",
};

export const dynamic =
    "force-dynamic";

export default async function ContactPage() {
    const settings =
        await getRestaurantSettings()
            .catch(
                () =>
                    DEFAULT_RESTAURANT_SETTINGS,
            );

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

    const mapsUrl =
        settings
            .website_contact
            .google_maps_url;

    const mapEmbed =
        settings.address
            ? `https://www.google.com/maps?q=${encodeURIComponent(
                settings.address,
            )}&output=embed`
            : null;

    return (
        <main>
            <section
                className="site-page-hero contact"
            >
                <div
                    className="site-container"
                >
                    <span
                        className="site-eyebrow light"
                    >
                        GET IN TOUCH
                    </span>

                    <h1>
                        Contact & Visit
                    </h1>

                    <p>
                        Find our location,
                        opening hours and
                        contact information.
                    </p>
                </div>
            </section>

            <section
                className="site-section"
            >
                <div
                    className="site-container site-contact-grid"
                >
                    <div
                        className="site-contact-details"
                    >
                        <span
                            className="site-eyebrow"
                        >
                            VISIT US
                        </span>

                        <h2>
                            {
                                settings
                                    .restaurant_name
                            }
                        </h2>

                        {
                            settings.address
                                ? (
                                    <div
                                        className="site-contact-item"
                                    >
                                        <small>
                                            ADDRESS
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
                                    <div
                                        className="site-contact-item"
                                    >
                                        <small>
                                            PHONE
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

                        {
                            email
                                ? (
                                    <div
                                        className="site-contact-item"
                                    >
                                        <small>
                                            EMAIL
                                        </small>

                                        <a
                                            href={`mailto:${email}`}
                                        >
                                            {email}
                                        </a>
                                    </div>
                                )
                                : null
                        }

                        <div
                            className="site-contact-actions"
                        >
                            {
                                whatsapp
                                    ? (
                                        <a
                                            href={
                                                whatsapp
                                            }
                                            target="_blank"
                                            rel="noreferrer"
                                            className="site-button primary"
                                        >
                                            WhatsApp
                                        </a>
                                    )
                                    : null
                            }

                            {
                                mapsUrl
                                    ? (
                                        <a
                                            href={
                                                mapsUrl
                                            }
                                            target="_blank"
                                            rel="noreferrer"
                                            className="site-button outline"
                                        >
                                            Open Google Maps
                                        </a>
                                    )
                                    : null
                            }
                        </div>
                    </div>

                    <div
                        className="site-contact-hours"
                    >
                        <span
                            className="site-eyebrow"
                        >
                            OPENING HOURS
                        </span>

                        <h2>
                            When to visit
                        </h2>

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

            <section
                className="site-map-section"
            >
                {
                    mapEmbed
                        ? (
                            <iframe
                                src={
                                    mapEmbed
                                }
                                title={`${settings.restaurant_name} location`}
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                allowFullScreen
                            />
                        )
                        : (
                            <div
                                className="site-map-placeholder"
                            >
                                <strong>
                                    Google Maps
                                </strong>

                                <span>
                                    Add the restaurant
                                    address in Restaurant
                                    Settings to display
                                    the map.
                                </span>
                            </div>
                        )
                }
            </section>
        </main>
    );
}