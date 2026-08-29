import type {
    Metadata,
} from "next";

import ReviewForm
    from "../../../components/site/ReviewForm";

import {
    getReviews,
} from "../../../lib/website-api";

export const metadata:
    Metadata = {
    title:
        "Reviews",

    description:
        "Read approved guest reviews and share your restaurant experience.",
};

export const dynamic =
    "force-dynamic";

export default async function ReviewsPage() {
    const reviews =
        await getReviews(
            100,
        ).catch(
            () =>
                [],
        );

    return (
        <main>
            <section
                className="site-page-hero reviews"
            >
                <div
                    className="site-container"
                >
                    <span
                        className="site-eyebrow light"
                    >
                        GUEST EXPERIENCES
                    </span>

                    <h1>
                        Reviews
                    </h1>

                    <p>
                        Read what our guests
                        have shared or tell us
                        about your own visit.
                    </p>
                </div>
            </section>

            <section
                className="site-section"
            >
                <div
                    className="site-container site-reviews-layout"
                >
                    <div>
                        <span
                            className="site-eyebrow"
                        >
                            APPROVED REVIEWS
                        </span>

                        <h2
                            className="site-display-heading smaller"
                        >
                            What our guests say
                        </h2>

                        {
                            reviews.length
                                === 0
                                ? (
                                    <div
                                        className="site-empty-state"
                                    >
                                        No approved
                                        reviews are
                                        available yet.
                                    </div>
                                )
                                : (
                                    <div
                                        className="site-review-list"
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

                                                        {
                                                            review
                                                                .is_featured
                                                                ? (
                                                                    <small>
                                                                        Featured Review
                                                                    </small>
                                                                )
                                                                : null
                                                        }
                                                    </article>
                                                ),
                                            )
                                        }
                                    </div>
                                )
                        }
                    </div>

                    <aside
                        className="site-review-form-card"
                    >
                        <span
                            className="site-eyebrow"
                        >
                            SHARE YOUR EXPERIENCE
                        </span>

                        <h2>
                            Leave a Review
                        </h2>

                        <p>
                            We appreciate your
                            feedback. Submitted
                            reviews are checked
                            before publication.
                        </p>

                        <ReviewForm />
                    </aside>
                </div>
            </section>
        </main>
    );
}