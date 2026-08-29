import type {
    Metadata,
} from "next";

import {
    getGallery,
    resolveAssetUrl,
} from "../../../lib/website-api";

export const metadata:
    Metadata = {
    title:
        "Gallery",

    description:
        "Explore moments, food and atmosphere from our restaurant.",
};

export const dynamic =
    "force-dynamic";

export default async function GalleryPage() {
    const gallery =
        await getGallery()
            .catch(
                () =>
                    [],
            );

    return (
        <main>
            <section
                className="site-page-hero gallery"
            >
                <div
                    className="site-container"
                >
                    <span
                        className="site-eyebrow light"
                    >
                        OUR GALLERY
                    </span>

                    <h1>
                        Food & Moments
                    </h1>

                    <p>
                        A glimpse of the food,
                        atmosphere and moments
                        shared with our guests.
                    </p>
                </div>
            </section>

            <section
                className="site-section"
            >
                <div
                    className="site-container"
                >
                    {
                        gallery.length
                            === 0
                            ? (
                                <div
                                    className="site-empty-state large"
                                >
                                    <strong>
                                        Gallery coming soon.
                                    </strong>

                                    <span>
                                        Restaurant photos
                                        will appear here
                                        once they are
                                        published.
                                    </span>
                                </div>
                            )
                            : (
                                <div
                                    className="site-gallery-grid"
                                >
                                    {
                                        gallery.map(
                                            (
                                                image,
                                            ) => {
                                                const url =
                                                    resolveAssetUrl(
                                                        image
                                                            .image_url,
                                                    );

                                                return (
                                                    <figure
                                                        key={
                                                            image.id
                                                        }
                                                        className="site-gallery-item"
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
                                                                            "Restaurant gallery image"
                                                                        }
                                                                    />
                                                                )
                                                                : (
                                                                    <div
                                                                        className="site-gallery-placeholder"
                                                                    />
                                                                )
                                                        }

                                                        {
                                                            image.title
                                                                ? (
                                                                    <figcaption>
                                                                        {
                                                                            image.title
                                                                        }
                                                                    </figcaption>
                                                                )
                                                                : null
                                                        }
                                                    </figure>
                                                );
                                            },
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