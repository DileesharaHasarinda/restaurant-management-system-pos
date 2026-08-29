"use client";

import {
    useState,
    type FormEvent,
} from "react";

interface ReviewResponse {
    success?: boolean;
    message?: string;

    data?: {
        id?: number;
        status?: string;
    };
}

export default function ReviewForm() {
    const [
        name,
        setName,
    ] =
        useState(
            "",
        );

    const [
        email,
        setEmail,
    ] =
        useState(
            "",
        );

    const [
        rating,
        setRating,
    ] =
        useState(
            5,
        );

    const [
        review,
        setReview,
    ] =
        useState(
            "",
        );

    const [
        submitting,
        setSubmitting,
    ] =
        useState(
            false,
        );

    const [
        message,
        setMessage,
    ] =
        useState<string | null>(
            null,
        );

    const [
        error,
        setError,
    ] =
        useState<string | null>(
            null,
        );

    async function submit(
        event:
            FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        setSubmitting(
            true,
        );

        setMessage(
            null,
        );

        setError(
            null,
        );

        try {
            const response =
                await fetch(
                    "/api/public/reviews",
                    {
                        method:
                            "POST",

                        headers: {
                            Accept:
                                "application/json",

                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify({
                                customer_name:
                                    name.trim(),

                                customer_email:
                                    email.trim()
                                    ||
                                    null,

                                rating,

                                review:
                                    review.trim(),
                            }),
                    },
                );

            const body: ReviewResponse =
                await response.json();

            if (
                !response.ok
                ||
                body.success
                === false
            ) {
                throw new Error(
                    body.message
                    ||
                    "Your review could not be submitted.",
                );
            }

            setMessage(
                body.message
                ||
                "Thank you. Your review is awaiting approval.",
            );

            setName(
                "",
            );

            setEmail(
                "",
            );

            setRating(
                5,
            );

            setReview(
                "",
            );
        } catch (
        exception
        ) {
            setError(
                exception
                    instanceof Error
                    ? exception.message
                    : "Your review could not be submitted.",
            );
        } finally {
            setSubmitting(
                false,
            );
        }
    }

    return (
        <form
            className="site-review-form"
            onSubmit={
                submit
            }
        >
            <div
                className="site-form-grid"
            >
                <label>
                    <span>
                        Your Name *
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
                                event,
                            ) =>
                                setName(
                                    event
                                        .target
                                        .value,
                                )
                        }
                    />
                </label>

                <label>
                    <span>
                        Email
                    </span>

                    <input
                        type="email"
                        maxLength={
                            190
                        }
                        value={
                            email
                        }
                        onChange={
                            (
                                event,
                            ) =>
                                setEmail(
                                    event
                                        .target
                                        .value,
                                )
                        }
                    />
                </label>
            </div>

            <label>
                <span>
                    Rating *
                </span>

                <select
                    value={
                        rating
                    }
                    onChange={
                        (
                            event,
                        ) =>
                            setRating(
                                Number(
                                    event
                                        .target
                                        .value,
                                ),
                            )
                    }
                >
                    <option value={5}>
                        ★★★★★ — Excellent
                    </option>

                    <option value={4}>
                        ★★★★☆ — Very Good
                    </option>

                    <option value={3}>
                        ★★★☆☆ — Good
                    </option>

                    <option value={2}>
                        ★★☆☆☆ — Fair
                    </option>

                    <option value={1}>
                        ★☆☆☆☆ — Poor
                    </option>
                </select>
            </label>

            <label>
                <span>
                    Your Review *
                </span>

                <textarea
                    required
                    minLength={
                        5
                    }
                    maxLength={
                        2000
                    }
                    rows={
                        6
                    }
                    value={
                        review
                    }
                    onChange={
                        (
                            event,
                        ) =>
                            setReview(
                                event
                                    .target
                                    .value,
                            )
                    }
                    placeholder="Tell us about your dining experience..."
                />
            </label>

            <p
                className="site-form-note"
            >
                Reviews are published
                after moderation.
            </p>

            {
                error
                    ? (
                        <div
                            className="site-form-message error"
                        >
                            {error}
                        </div>
                    )
                    : null
            }

            {
                message
                    ? (
                        <div
                            className="site-form-message success"
                        >
                            {message}
                        </div>
                    )
                    : null
            }

            <button
                type="submit"
                className="site-button primary"
                disabled={
                    submitting
                }
            >
                {
                    submitting
                        ? "Submitting..."
                        : "Submit Review"
                }
            </button>
        </form>
    );
}