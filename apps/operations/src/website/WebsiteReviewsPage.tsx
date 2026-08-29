import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ChangeEvent,
    type FormEvent,
} from "react";

import {
    useStaffRealtimeRefresh,
} from '../realtime/realtimeBus';

import {
    useAuth,
} from "../auth/useAuth";

import {
    approveReview,
    deleteReview,
    getGalleryImages,
    getReviews,
    rejectReview,
    updateGalleryImage,
    updateGalleryState,
    updateReviewVisibility,
    uploadGalleryImage,
} from "./websiteService";

import type {
    GalleryImage,
    Pagination,
    Review,
    ReviewStatus,
    ReviewVisibility,
} from "./types";

import "./WebsiteReviewsPage.css";

type PageTab =
    | "reviews"
    | "gallery";

const EMPTY_PAGINATION:
    Pagination = {
    current_page: 1,
    per_page: 20,
    total: 0,
    last_page: 1,
};

function errorMessage(
    error: unknown,
): string {
    if (
        error instanceof Error
        &&
        error.message
    ) {
        return error.message;
    }

    return "The operation could not be completed.";
}

function formatDateTime(
    value:
        string
        | null,
): string {
    if (
        !value
    ) {
        return "—";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime(),
        )
    ) {
        return value;
    }

    return new Intl.DateTimeFormat(
        "en-LK",
        {
            dateStyle:
                "medium",

            timeStyle:
                "short",

            timeZone:
                "Asia/Colombo",
        },
    ).format(date);
}

function statusLabel(
    status: ReviewStatus,
): string {
    switch (status) {
        case "APPROVED":
            return "Approved";

        case "REJECTED":
            return "Rejected";

        default:
            return "Pending";
    }
}

function stars(
    rating: number,
): string {
    const safe =
        Math.max(
            1,
            Math.min(
                rating,
                5,
            ),
        );

    return (
        "★".repeat(safe)
        +
        "☆".repeat(
            5 - safe,
        )
    );
}

export default function WebsiteReviewsPage() {
    const {
        hasPermission,
    } =
        useAuth();

    const canModerateReviews =
        hasPermission(
            "reviews.moderate",
        );

    const canManageGallery =
        hasPermission(
            "website.manage",
        );

    const availableTabs =
        useMemo<PageTab[]>(
            () => {
                const tabs:
                    PageTab[] = [];

                if (
                    canModerateReviews
                ) {
                    tabs.push(
                        "reviews",
                    );
                }

                if (
                    canManageGallery
                ) {
                    tabs.push(
                        "gallery",
                    );
                }

                return tabs;
            },
            [
                canManageGallery,
                canModerateReviews,
            ],
        );

    const [
        selectedTab,
        setSelectedTab,
    ] =
        useState<PageTab>(
            availableTabs[0]
            ??
            "reviews",
        );

    const activeTab =
        availableTabs.includes(
            selectedTab,
        )
            ? selectedTab
            : (
                availableTabs[0]
                ??
                "reviews"
            );

    /*
    |--------------------------------------------------------------------------
    | Alerts
    |--------------------------------------------------------------------------
    */

    const [
        success,
        setSuccess,
    ] =
        useState("");

    const [
        error,
        setError,
    ] =
        useState("");

    function clearMessages():
        void {
        setSuccess("");
        setError("");
    }

    /*
    |--------------------------------------------------------------------------
    | Reviews
    |--------------------------------------------------------------------------
    */

    const [
        reviews,
        setReviews,
    ] =
        useState<Review[]>(
            [],
        );

    const [
        reviewLoading,
        setReviewLoading,
    ] =
        useState(false);

    const [
        reviewActionId,
        setReviewActionId,
    ] =
        useState<number | null>(
            null,
        );

    const [
        pagination,
        setPagination,
    ] =
        useState(
            EMPTY_PAGINATION,
        );

    const [
        page,
        setPage,
    ] =
        useState(1);

    const [
        searchDraft,
        setSearchDraft,
    ] =
        useState("");

    const [
        search,
        setSearch,
    ] =
        useState("");

    const [
        status,
        setStatus,
    ] =
        useState<
            ReviewStatus | ""
        >("");

    const [
        rating,
        setRating,
    ] =
        useState<
            number | null
        >(null);

    const [
        visibility,
        setVisibility,
    ] =
        useState<
            ReviewVisibility
        >("");

    /*
    |--------------------------------------------------------------------------
    | Review Request Sequencing
    |--------------------------------------------------------------------------
    |
    | Filter changes and realtime invalidations can overlap. The sequence keeps
    | an older REST response from replacing a newer review result.
    |--------------------------------------------------------------------------
    */

    const reviewRequestRef =
        useRef(0);

    const loadReviews =
        useCallback(
            async (
                silent = false,
            ): Promise<void> => {
                if (
                    !canModerateReviews
                ) {
                    return;
                }

                const requestVersion =
                    reviewRequestRef.current
                    +
                    1;

                reviewRequestRef.current =
                    requestVersion;

                if (
                    !silent
                ) {
                    setReviewLoading(
                        true,
                    );
                }

                try {
                    const result =
                        await getReviews({
                            search,
                            status,
                            rating,
                            visibility,
                            page,
                            perPage: 20,
                        });

                    if (
                        requestVersion
                        !==
                        reviewRequestRef.current
                    ) {
                        return;
                    }

                    setReviews(
                        result.reviews,
                    );

                    setPagination(
                        result.pagination,
                    );
                } catch (
                exception
                ) {
                    if (
                        requestVersion
                        !==
                        reviewRequestRef.current
                    ) {
                        return;
                    }

                    if (
                        silent
                    ) {
                        console.error(
                            "Unable to reconcile realtime review data.",
                            exception,
                        );

                        return;
                    }

                    setError(
                        errorMessage(
                            exception,
                        ),
                    );
                } finally {
                    if (
                        requestVersion
                        ===
                        reviewRequestRef.current
                    ) {
                        setReviewLoading(
                            false,
                        );
                    }
                }
            },
            [
                canModerateReviews,
                page,
                rating,
                search,
                status,
                visibility,
            ],
        );

    useEffect(
        () => {
            if (
                !canModerateReviews
            ) {
                return;
            }

            const frame =
                window.requestAnimationFrame(
                    () => {
                        void loadReviews();
                    },
                );

            return () => {
                window.cancelAnimationFrame(
                    frame,
                );
            };
        },
        [
            canModerateReviews,
            loadReviews,
        ],
    );

    function submitSearch(
        event:
            FormEvent<HTMLFormElement>,
    ): void {
        event.preventDefault();

        clearMessages();

        setPage(1);

        setSearch(
            searchDraft.trim(),
        );
    }

    function changeStatus(
        event:
            ChangeEvent<HTMLSelectElement>,
    ): void {
        const value =
            event.target.value;

        setPage(1);

        if (
            value
            === "PENDING"
            ||
            value
            === "APPROVED"
            ||
            value
            === "REJECTED"
        ) {
            setStatus(value);
        } else {
            setStatus("");
        }
    }

    function changeRating(
        event:
            ChangeEvent<HTMLSelectElement>,
    ): void {
        const value =
            event.target.value;

        setPage(1);

        if (
            value === ""
        ) {
            setRating(null);
            return;
        }

        setRating(
            Number(value),
        );
    }

    function changeVisibility(
        event:
            ChangeEvent<HTMLSelectElement>,
    ): void {
        const value =
            event.target.value;

        setPage(1);

        if (
            value
            === "VISIBLE"
            ||
            value
            === "HIDDEN"
        ) {
            setVisibility(value);
        } else {
            setVisibility("");
        }
    }

    async function moderate(
        review:
            Review,
        action:
            "approve"
            | "reject"
            | "show"
            | "hide",
    ): Promise<void> {
        clearMessages();

        setReviewActionId(
            review.id,
        );

        try {
            if (
                action === "approve"
            ) {
                await approveReview(
                    review.id,
                );

                setSuccess(
                    "Review approved successfully.",
                );
            }

            if (
                action === "reject"
            ) {
                await rejectReview(
                    review.id,
                );

                setSuccess(
                    "Review rejected successfully.",
                );
            }

            if (
                action === "show"
            ) {
                await updateReviewVisibility(
                    review.id,
                    true,
                );

                setSuccess(
                    "Review is now visible publicly.",
                );
            }

            if (
                action === "hide"
            ) {
                await updateReviewVisibility(
                    review.id,
                    false,
                );

                setSuccess(
                    "Review hidden from the public website.",
                );
            }

            await loadReviews();
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setReviewActionId(
                null,
            );
        }
    }

    async function removeReview(
        review: Review,
    ): Promise<void> {
        const confirmed =
            window.confirm(
                `Delete the review from ${review.customer_name}? This cannot be undone.`,
            );

        if (
            !confirmed
        ) {
            return;
        }

        clearMessages();

        setReviewActionId(
            review.id,
        );

        try {
            await deleteReview(
                review.id,
            );

            setSuccess(
                "Review deleted successfully.",
            );

            if (
                reviews.length === 1
                &&
                page > 1
            ) {
                setPage(
                    page - 1,
                );
            } else {
                await loadReviews();
            }
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setReviewActionId(
                null,
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Gallery
    |--------------------------------------------------------------------------
    */

    const [
        gallery,
        setGallery,
    ] =
        useState<
            GalleryImage[]
        >([]);

    const [
        galleryLoading,
        setGalleryLoading,
    ] =
        useState(false);

    const [
        galleryActionId,
        setGalleryActionId,
    ] =
        useState<number | null>(
            null,
        );

    const [
        uploadOpen,
        setUploadOpen,
    ] =
        useState(false);

    const [
        uploadFile,
        setUploadFile,
    ] =
        useState<File | null>(
            null,
        );

    const [
        uploadCaption,
        setUploadCaption,
    ] =
        useState("");

    const [
        uploadAltText,
        setUploadAltText,
    ] =
        useState("");

    const [
        uploadSortOrder,
        setUploadSortOrder,
    ] =
        useState(0);

    const [
        uploadActive,
        setUploadActive,
    ] =
        useState(true);

    const [
        uploading,
        setUploading,
    ] =
        useState(false);

    const [
        editingImage,
        setEditingImage,
    ] =
        useState<
            GalleryImage | null
        >(null);

    const [
        editCaption,
        setEditCaption,
    ] =
        useState("");

    const [
        editAltText,
        setEditAltText,
    ] =
        useState("");

    const [
        editSortOrder,
        setEditSortOrder,
    ] =
        useState(0);

    const [
        savingImage,
        setSavingImage,
    ] =
        useState(false);

    /*
    |--------------------------------------------------------------------------
    | Gallery Request Sequencing
    |--------------------------------------------------------------------------
    |
    | Realtime events can arrive while an explicit gallery reload is still in
    | flight. Only the newest authoritative REST response may replace the grid.
    |--------------------------------------------------------------------------
    */

    const galleryRequestRef =
        useRef(0);

    const loadGallery =
        useCallback(
            async (
                silent = false,
            ): Promise<void> => {
                if (
                    !canManageGallery
                ) {
                    return;
                }

                const requestVersion =
                    galleryRequestRef.current
                    +
                    1;

                galleryRequestRef.current =
                    requestVersion;

                if (
                    !silent
                ) {
                    setGalleryLoading(
                        true,
                    );
                }

                try {
                    const images =
                        await getGalleryImages();

                    if (
                        requestVersion
                        !==
                        galleryRequestRef.current
                    ) {
                        return;
                    }

                    setGallery(
                        images,
                    );
                } catch (
                exception
                ) {
                    if (
                        requestVersion
                        !==
                        galleryRequestRef.current
                    ) {
                        return;
                    }

                    if (
                        silent
                    ) {
                        console.error(
                            "Unable to reconcile realtime gallery data.",
                            exception,
                        );

                        return;
                    }

                    setError(
                        errorMessage(
                            exception,
                        ),
                    );
                } finally {
                    if (
                        requestVersion
                        ===
                        galleryRequestRef.current
                    ) {
                        setGalleryLoading(
                            false,
                        );
                    }
                }
            },
            [
                canManageGallery,
            ],
        );

    useEffect(
        () => {
            if (
                !canManageGallery
            ) {
                return;
            }

            const frame =
                window.requestAnimationFrame(
                    () => {
                        void loadGallery();
                    },
                );

            return () => {
                window.cancelAnimationFrame(
                    frame,
                );
            };
        },
        [
            canManageGallery,
            loadGallery,
        ],
    );

    function closeUpload():
        void {
        if (
            uploading
        ) {
            return;
        }

        setUploadOpen(
            false,
        );

        setUploadFile(
            null,
        );

        setUploadCaption(
            "",
        );

        setUploadAltText(
            "",
        );

        setUploadSortOrder(
            0,
        );

        setUploadActive(
            true,
        );
    }

    async function submitUpload(
        event:
            FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        if (
            !uploadFile
        ) {
            setError(
                "Select an image to upload.",
            );

            return;
        }

        clearMessages();

        setUploading(
            true,
        );

        try {
            await uploadGalleryImage({
                image:
                    uploadFile,

                caption:
                    uploadCaption,

                altText:
                    uploadAltText,

                sortOrder:
                    uploadSortOrder,

                isActive:
                    uploadActive,
            });

            setSuccess(
                "Gallery image uploaded successfully.",
            );

            setUploadOpen(
                false,
            );

            setUploadFile(
                null,
            );

            setUploadCaption(
                "",
            );

            setUploadAltText(
                "",
            );

            setUploadSortOrder(
                0,
            );

            setUploadActive(
                true,
            );

            await loadGallery();
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setUploading(
                false,
            );
        }
    }

    function openEdit(
        image:
            GalleryImage,
    ): void {
        clearMessages();

        setEditingImage(
            image,
        );

        setEditCaption(
            image.caption
            ??
            "",
        );

        setEditAltText(
            image.alt_text
            ??
            "",
        );

        setEditSortOrder(
            image.sort_order,
        );
    }

    function closeEdit():
        void {
        if (
            savingImage
        ) {
            return;
        }

        setEditingImage(
            null,
        );
    }

    async function submitEdit(
        event:
            FormEvent<HTMLFormElement>,
    ): Promise<void> {
        event.preventDefault();

        if (
            !editingImage
        ) {
            return;
        }

        clearMessages();

        setSavingImage(
            true,
        );

        try {
            await updateGalleryImage(
                editingImage.id,
                {
                    caption:
                        editCaption.trim()
                        ||
                        null,

                    alt_text:
                        editAltText.trim()
                        ||
                        null,

                    sort_order:
                        editSortOrder,
                },
            );

            setSuccess(
                "Gallery details updated successfully.",
            );

            setEditingImage(
                null,
            );

            await loadGallery();
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setSavingImage(
                false,
            );
        }
    }

    async function changeGalleryState(
        image:
            GalleryImage,
    ): Promise<void> {
        clearMessages();

        setGalleryActionId(
            image.id,
        );

        try {
            await updateGalleryState(
                image.id,
                !image.is_active,
            );

            setSuccess(
                image.is_active
                    ? "Gallery image disabled successfully."
                    : "Gallery image enabled successfully.",
            );

            await loadGallery();
        } catch (
        exception
        ) {
            setError(
                errorMessage(
                    exception,
                ),
            );
        } finally {
            setGalleryActionId(
                null,
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Realtime Reconciliation
    |--------------------------------------------------------------------------
    |
    | Review and gallery writes are published by Laravel under the private
    | `website` staff realtime domain. Reverb is only an invalidation signal;
    | this page always re-queries the authoritative REST API.
    |
    | Realtime refreshes are silent:
    |
    | - no review loading placeholder flash
    | - no gallery loading placeholder flash
    | - no browser reload
    | - current review filters/page remain selected
    | - upload form input is preserved
    | - gallery edit form input is preserved
    |
    | The edit/upload modals are deliberately not remounted or populated from
    | refreshed list data. This prevents remote updates from destroying local
    | unsaved caption, alt text, sort order, file, or publish-state input.
    |--------------------------------------------------------------------------
    */

    useStaffRealtimeRefresh(
        [
            "website",
        ],
        async () => {
            const jobs:
                Array<
                    Promise<void>
                > =
                [];

            if (
                canModerateReviews
            ) {
                jobs.push(
                    loadReviews(
                        true,
                    ),
                );
            }

            if (
                canManageGallery
            ) {
                jobs.push(
                    loadGallery(
                        true,
                    ),
                );
            }

            await Promise.all(
                jobs,
            );
        },
    );

    /*
    |--------------------------------------------------------------------------
    | Metrics
    |--------------------------------------------------------------------------
    */

    const pendingOnPage =
        reviews.filter(
            (
                review,
            ) =>
                review.status
                === "PENDING",
        ).length;

    const approvedOnPage =
        reviews.filter(
            (
                review,
            ) =>
                review.status
                === "APPROVED",
        ).length;

    const visibleGalleryCount =
        gallery.filter(
            (
                image,
            ) =>
                image.is_active,
        ).length;

    if (
        availableTabs.length
        === 0
    ) {
        return (
            <section
                id="website-management-page"
            >
                <div
                    className="wm-empty-access"
                >
                    <h1>
                        Website & Reviews
                    </h1>

                    <p>
                        You do not have
                        permission to manage
                        website content.
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section
            id="website-management-page"
        >
            <header
                className="wm-page-header"
            >
                <div>
                    <span
                        className="wm-eyebrow"
                    >
                        PUBLIC WEBSITE
                    </span>

                    <h1>
                        Website & Reviews
                    </h1>

                    <p>
                        Moderate customer
                        feedback and manage
                        the public restaurant
                        gallery.
                    </p>
                </div>

                {
                    activeTab
                        === "gallery"
                        &&
                        canManageGallery
                        ? (
                            <button
                                type="button"
                                className="wm-button wm-primary"
                                onClick={
                                    () => {
                                        clearMessages();

                                        setUploadOpen(
                                            true,
                                        );
                                    }
                                }
                            >
                                + Upload Image
                            </button>
                        )
                        : null
                }
            </header>

            {
                success
                    ? (
                        <div
                            className="wm-alert wm-success"
                        >
                            {success}
                        </div>
                    )
                    : null
            }

            {
                error
                    ? (
                        <div
                            className="wm-alert wm-error"
                        >
                            {error}
                        </div>
                    )
                    : null
            }

            <div
                className="wm-tabs"
            >
                {
                    canModerateReviews
                        ? (
                            <button
                                type="button"
                                className={
                                    activeTab
                                        === "reviews"
                                        ? "active"
                                        : ""
                                }
                                onClick={
                                    () =>
                                        setSelectedTab(
                                            "reviews",
                                        )
                                }
                            >
                                Reviews
                            </button>
                        )
                        : null
                }

                {
                    canManageGallery
                        ? (
                            <button
                                type="button"
                                className={
                                    activeTab
                                        === "gallery"
                                        ? "active"
                                        : ""
                                }
                                onClick={
                                    () =>
                                        setSelectedTab(
                                            "gallery",
                                        )
                                }
                            >
                                Gallery
                            </button>
                        )
                        : null
                }
            </div>

            {
                activeTab
                    === "reviews"
                    &&
                    canModerateReviews
                    ? (
                        <>
                            <div
                                className="wm-metrics"
                            >
                                <article>
                                    <span>
                                        Matching Reviews
                                    </span>

                                    <strong>
                                        {
                                            pagination
                                                .total
                                        }
                                    </strong>
                                </article>

                                <article>
                                    <span>
                                        Pending on Page
                                    </span>

                                    <strong
                                        className="warning"
                                    >
                                        {
                                            pendingOnPage
                                        }
                                    </strong>
                                </article>

                                <article>
                                    <span>
                                        Approved on Page
                                    </span>

                                    <strong
                                        className="success"
                                    >
                                        {
                                            approvedOnPage
                                        }
                                    </strong>
                                </article>

                                <article>
                                    <span>
                                        Current Page
                                    </span>

                                    <strong>
                                        {
                                            pagination
                                                .current_page
                                        }
                                        /
                                        {
                                            pagination
                                                .last_page
                                        }
                                    </strong>
                                </article>
                            </div>

                            <form
                                className="wm-review-filters"
                                onSubmit={
                                    submitSearch
                                }
                            >
                                <div
                                    className="wm-search-box"
                                >
                                    <input
                                        type="search"
                                        value={
                                            searchDraft
                                        }
                                        onChange={
                                            (
                                                event,
                                            ) =>
                                                setSearchDraft(
                                                    event
                                                        .target
                                                        .value,
                                                )
                                        }
                                        placeholder="Search customer or review..."
                                    />

                                    <button
                                        type="submit"
                                        className="wm-button wm-primary"
                                    >
                                        Search
                                    </button>
                                </div>

                                <select
                                    value={
                                        status
                                    }
                                    onChange={
                                        changeStatus
                                    }
                                >
                                    <option value="">
                                        All Statuses
                                    </option>

                                    <option value="PENDING">
                                        Pending
                                    </option>

                                    <option value="APPROVED">
                                        Approved
                                    </option>

                                    <option value="REJECTED">
                                        Rejected
                                    </option>
                                </select>

                                <select
                                    value={
                                        rating
                                        ??
                                        ""
                                    }
                                    onChange={
                                        changeRating
                                    }
                                >
                                    <option value="">
                                        All Ratings
                                    </option>

                                    <option value="5">
                                        5 Stars
                                    </option>

                                    <option value="4">
                                        4 Stars
                                    </option>

                                    <option value="3">
                                        3 Stars
                                    </option>

                                    <option value="2">
                                        2 Stars
                                    </option>

                                    <option value="1">
                                        1 Star
                                    </option>
                                </select>

                                <select
                                    value={
                                        visibility
                                    }
                                    onChange={
                                        changeVisibility
                                    }
                                >
                                    <option value="">
                                        All Visibility
                                    </option>

                                    <option value="VISIBLE">
                                        Visible
                                    </option>

                                    <option value="HIDDEN">
                                        Hidden
                                    </option>
                                </select>
                            </form>

                            <div
                                className="wm-review-list"
                            >
                                {
                                    reviewLoading
                                        ? (
                                            <div
                                                className="wm-state"
                                            >
                                                Loading reviews...
                                            </div>
                                        )
                                        : null
                                }

                                {
                                    !reviewLoading
                                        &&
                                        reviews.length
                                        === 0
                                        ? (
                                            <div
                                                className="wm-state"
                                            >
                                                No reviews matched
                                                the current filters.
                                            </div>
                                        )
                                        : null
                                }

                                {
                                    !reviewLoading
                                        ? (
                                            reviews.map(
                                                (
                                                    review,
                                                ) => {
                                                    const busy =
                                                        reviewActionId
                                                        ===
                                                        review.id;

                                                    return (
                                                        <article
                                                            key={
                                                                review.id
                                                            }
                                                            className="wm-review-card"
                                                        >
                                                            <div
                                                                className="wm-review-top"
                                                            >
                                                                <div>
                                                                    <h3>
                                                                        {
                                                                            review
                                                                                .customer_name
                                                                        }
                                                                    </h3>

                                                                    <div
                                                                        className="wm-stars"
                                                                        aria-label={`${review.rating} out of 5 stars`}
                                                                    >
                                                                        {
                                                                            stars(
                                                                                review.rating,
                                                                            )
                                                                        }
                                                                    </div>
                                                                </div>

                                                                <div
                                                                    className="wm-badges"
                                                                >
                                                                    <span
                                                                        className={`wm-status ${review.status.toLowerCase()}`}
                                                                    >
                                                                        {
                                                                            statusLabel(
                                                                                review.status,
                                                                            )
                                                                        }
                                                                    </span>

                                                                    {
                                                                        review.status
                                                                            === "APPROVED"
                                                                            ? (
                                                                                <span
                                                                                    className={
                                                                                        review
                                                                                            .is_visible
                                                                                            ? "wm-visibility visible"
                                                                                            : "wm-visibility hidden"
                                                                                    }
                                                                                >
                                                                                    {
                                                                                        review
                                                                                            .is_visible
                                                                                            ? "Public"
                                                                                            : "Hidden"
                                                                                    }
                                                                                </span>
                                                                            )
                                                                            : null
                                                                    }
                                                                </div>
                                                            </div>

                                                            <p
                                                                className="wm-review-text"
                                                            >
                                                                {
                                                                    review.review
                                                                }
                                                            </p>

                                                            <div
                                                                className="wm-review-meta"
                                                            >
                                                                <span>
                                                                    Submitted{" "}
                                                                    {
                                                                        formatDateTime(
                                                                            review
                                                                                .created_at,
                                                                        )
                                                                    }
                                                                </span>

                                                                {
                                                                    review.reviewed_by
                                                                        ? (
                                                                            <span>
                                                                                Moderated by{" "}
                                                                                {
                                                                                    review
                                                                                        .reviewed_by
                                                                                        .name
                                                                                }
                                                                            </span>
                                                                        )
                                                                        : null
                                                                }
                                                            </div>

                                                            <div
                                                                className="wm-review-actions"
                                                            >
                                                                {
                                                                    review.status
                                                                        !== "APPROVED"
                                                                        ? (
                                                                            <button
                                                                                type="button"
                                                                                className="wm-button wm-approve"
                                                                                disabled={
                                                                                    busy
                                                                                }
                                                                                onClick={
                                                                                    () =>
                                                                                        void moderate(
                                                                                            review,
                                                                                            "approve",
                                                                                        )
                                                                                }
                                                                            >
                                                                                Approve
                                                                            </button>
                                                                        )
                                                                        : null
                                                                }

                                                                {
                                                                    review.status
                                                                        !== "REJECTED"
                                                                        ? (
                                                                            <button
                                                                                type="button"
                                                                                className="wm-button wm-reject"
                                                                                disabled={
                                                                                    busy
                                                                                }
                                                                                onClick={
                                                                                    () =>
                                                                                        void moderate(
                                                                                            review,
                                                                                            "reject",
                                                                                        )
                                                                                }
                                                                            >
                                                                                Reject
                                                                            </button>
                                                                        )
                                                                        : null
                                                                }

                                                                {
                                                                    review.status
                                                                        === "APPROVED"
                                                                        ? (
                                                                            <button
                                                                                type="button"
                                                                                className="wm-button wm-secondary"
                                                                                disabled={
                                                                                    busy
                                                                                }
                                                                                onClick={
                                                                                    () =>
                                                                                        void moderate(
                                                                                            review,
                                                                                            review
                                                                                                .is_visible
                                                                                                ? "hide"
                                                                                                : "show",
                                                                                        )
                                                                                }
                                                                            >
                                                                                {
                                                                                    review
                                                                                        .is_visible
                                                                                        ? "Hide"
                                                                                        : "Show"
                                                                                }
                                                                            </button>
                                                                        )
                                                                        : null
                                                                }

                                                                <button
                                                                    type="button"
                                                                    className="wm-button wm-delete"
                                                                    disabled={
                                                                        busy
                                                                    }
                                                                    onClick={
                                                                        () =>
                                                                            void removeReview(
                                                                                review,
                                                                            )
                                                                    }
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </article>
                                                    );
                                                },
                                            )
                                        )
                                        : null
                                }
                            </div>

                            <div
                                className="wm-pagination"
                            >
                                <button
                                    type="button"
                                    className="wm-button wm-secondary"
                                    disabled={
                                        reviewLoading
                                        ||
                                        page <= 1
                                    }
                                    onClick={
                                        () =>
                                            setPage(
                                                Math.max(
                                                    1,
                                                    page - 1,
                                                ),
                                            )
                                    }
                                >
                                    Previous
                                </button>

                                <span>
                                    Page{" "}
                                    {
                                        pagination
                                            .current_page
                                    }{" "}
                                    of{" "}
                                    {
                                        Math.max(
                                            pagination
                                                .last_page,
                                            1,
                                        )
                                    }
                                </span>

                                <button
                                    type="button"
                                    className="wm-button wm-secondary"
                                    disabled={
                                        reviewLoading
                                        ||
                                        page
                                        >=
                                        pagination
                                            .last_page
                                    }
                                    onClick={
                                        () =>
                                            setPage(
                                                page + 1,
                                            )
                                    }
                                >
                                    Next
                                </button>
                            </div>
                        </>
                    )
                    : null
            }

            {
                activeTab
                    === "gallery"
                    &&
                    canManageGallery
                    ? (
                        <>
                            <div
                                className="wm-metrics"
                            >
                                <article>
                                    <span>
                                        Gallery Images
                                    </span>

                                    <strong>
                                        {
                                            gallery.length
                                        }
                                    </strong>
                                </article>

                                <article>
                                    <span>
                                        Enabled
                                    </span>

                                    <strong
                                        className="success"
                                    >
                                        {
                                            visibleGalleryCount
                                        }
                                    </strong>
                                </article>

                                <article>
                                    <span>
                                        Disabled
                                    </span>

                                    <strong>
                                        {
                                            gallery.length
                                            -
                                            visibleGalleryCount
                                        }
                                    </strong>
                                </article>
                            </div>

                            {
                                galleryLoading
                                    ? (
                                        <div
                                            className="wm-state"
                                        >
                                            Loading gallery...
                                        </div>
                                    )
                                    : null
                            }

                            {
                                !galleryLoading
                                    &&
                                    gallery.length
                                    === 0
                                    ? (
                                        <div
                                            className="wm-gallery-empty"
                                        >
                                            <strong>
                                                No gallery
                                                images yet
                                            </strong>

                                            <p>
                                                Upload the first
                                                restaurant image
                                                to publish it on
                                                the public gallery.
                                            </p>

                                            <button
                                                type="button"
                                                className="wm-button wm-primary"
                                                onClick={
                                                    () =>
                                                        setUploadOpen(
                                                            true,
                                                        )
                                                }
                                            >
                                                Upload Image
                                            </button>
                                        </div>
                                    )
                                    : null
                            }

                            {
                                !galleryLoading
                                    &&
                                    gallery.length
                                    > 0
                                    ? (
                                        <div
                                            className="wm-gallery-grid"
                                        >
                                            {
                                                gallery.map(
                                                    (
                                                        image,
                                                    ) => {
                                                        const busy =
                                                            galleryActionId
                                                            ===
                                                            image.id;

                                                        return (
                                                            <article
                                                                key={
                                                                    image.id
                                                                }
                                                                className={
                                                                    image
                                                                        .is_active
                                                                        ? "wm-gallery-card"
                                                                        : "wm-gallery-card disabled"
                                                                }
                                                            >
                                                                <div
                                                                    className="wm-gallery-image"
                                                                >
                                                                    {
                                                                        image.image_url
                                                                            ? (
                                                                                <img
                                                                                    src={
                                                                                        image
                                                                                            .image_url
                                                                                    }
                                                                                    alt={
                                                                                        image
                                                                                            .alt_text
                                                                                        ||
                                                                                        image
                                                                                            .caption
                                                                                        ||
                                                                                        "Gallery image"
                                                                                    }
                                                                                />
                                                                            )
                                                                            : (
                                                                                <div
                                                                                    className="wm-image-placeholder"
                                                                                >
                                                                                    No Image
                                                                                </div>
                                                                            )
                                                                    }

                                                                    <span
                                                                        className={
                                                                            image
                                                                                .is_active
                                                                                ? "wm-gallery-state enabled"
                                                                                : "wm-gallery-state disabled"
                                                                        }
                                                                    >
                                                                        {
                                                                            image
                                                                                .is_active
                                                                                ? "Enabled"
                                                                                : "Disabled"
                                                                        }
                                                                    </span>
                                                                </div>

                                                                <div
                                                                    className="wm-gallery-content"
                                                                >
                                                                    <h3>
                                                                        {
                                                                            image.caption
                                                                            ||
                                                                            "Untitled Image"
                                                                        }
                                                                    </h3>

                                                                    <p>
                                                                        {
                                                                            image.alt_text
                                                                            ||
                                                                            "No alternative text."
                                                                        }
                                                                    </p>

                                                                    <div
                                                                        className="wm-gallery-meta"
                                                                    >
                                                                        <span>
                                                                            Sort Order
                                                                        </span>

                                                                        <strong>
                                                                            {
                                                                                image
                                                                                    .sort_order
                                                                            }
                                                                        </strong>
                                                                    </div>

                                                                    <div
                                                                        className="wm-gallery-actions"
                                                                    >
                                                                        <button
                                                                            type="button"
                                                                            className="wm-button wm-secondary"
                                                                            onClick={
                                                                                () =>
                                                                                    openEdit(
                                                                                        image,
                                                                                    )
                                                                            }
                                                                        >
                                                                            Edit
                                                                        </button>

                                                                        <button
                                                                            type="button"
                                                                            className={
                                                                                image
                                                                                    .is_active
                                                                                    ? "wm-button wm-disable"
                                                                                    : "wm-button wm-approve"
                                                                            }
                                                                            disabled={
                                                                                busy
                                                                            }
                                                                            onClick={
                                                                                () =>
                                                                                    void changeGalleryState(
                                                                                        image,
                                                                                    )
                                                                            }
                                                                        >
                                                                            {
                                                                                image
                                                                                    .is_active
                                                                                    ? "Disable"
                                                                                    : "Enable"
                                                                            }
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </article>
                                                        );
                                                    },
                                                )
                                            }
                                        </div>
                                    )
                                    : null
                            }
                        </>
                    )
                    : null
            }

            {
                uploadOpen
                    ? (
                        <div
                            className="wm-modal-backdrop"
                            role="presentation"
                            onMouseDown={
                                (
                                    event,
                                ) => {
                                    if (
                                        event.target
                                        ===
                                        event.currentTarget
                                    ) {
                                        closeUpload();
                                    }
                                }
                            }
                        >
                            <div
                                className="wm-modal"
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="wm-upload-title"
                            >
                                <header>
                                    <div>
                                        <span
                                            className="wm-eyebrow"
                                        >
                                            GALLERY
                                        </span>

                                        <h2
                                            id="wm-upload-title"
                                        >
                                            Upload Image
                                        </h2>
                                    </div>

                                    <button
                                        type="button"
                                        className="wm-modal-close"
                                        onClick={
                                            closeUpload
                                        }
                                    >
                                        ×
                                    </button>
                                </header>

                                <form
                                    onSubmit={
                                        submitUpload
                                    }
                                    className="wm-form"
                                >
                                    <label>
                                        <span>
                                            Image *
                                        </span>

                                        <input
                                            type="file"
                                            required
                                            accept="image/jpeg,image/png,image/webp"
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    setUploadFile(
                                                        event
                                                            .target
                                                            .files
                                                        ?.[0]
                                                        ??
                                                        null,
                                                    )
                                            }
                                        />

                                        <small>
                                            JPG, PNG or
                                            WebP. Maximum
                                            5 MB.
                                        </small>
                                    </label>

                                    <label>
                                        <span>
                                            Caption
                                        </span>

                                        <input
                                            type="text"
                                            maxLength={
                                                190
                                            }
                                            value={
                                                uploadCaption
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    setUploadCaption(
                                                        event
                                                            .target
                                                            .value,
                                                    )
                                            }
                                            placeholder="e.g. Ocean-view dining area"
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            Alternative Text
                                        </span>

                                        <input
                                            type="text"
                                            maxLength={
                                                255
                                            }
                                            value={
                                                uploadAltText
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    setUploadAltText(
                                                        event
                                                            .target
                                                            .value,
                                                    )
                                            }
                                            placeholder="Describe the image for accessibility"
                                        />
                                    </label>

                                    <div
                                        className="wm-form-grid"
                                    >
                                        <label>
                                            <span>
                                                Sort Order
                                            </span>

                                            <input
                                                type="number"
                                                min={
                                                    0
                                                }
                                                max={
                                                    100000
                                                }
                                                value={
                                                    uploadSortOrder
                                                }
                                                onChange={
                                                    (
                                                        event,
                                                    ) =>
                                                        setUploadSortOrder(
                                                            Math.max(
                                                                0,
                                                                Number(
                                                                    event
                                                                        .target
                                                                        .value,
                                                                )
                                                                ||
                                                                0,
                                                            ),
                                                        )
                                                }
                                            />
                                        </label>

                                        <label
                                            className="wm-toggle-field"
                                        >
                                            <span>
                                                Publish State
                                            </span>

                                            <label
                                                className="wm-switch-row"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        uploadActive
                                                    }
                                                    onChange={
                                                        (
                                                            event,
                                                        ) =>
                                                            setUploadActive(
                                                                event
                                                                    .target
                                                                    .checked,
                                                            )
                                                    }
                                                />

                                                <strong>
                                                    {
                                                        uploadActive
                                                            ? "Enabled"
                                                            : "Disabled"
                                                    }
                                                </strong>
                                            </label>
                                        </label>
                                    </div>

                                    <footer
                                        className="wm-modal-actions"
                                    >
                                        <button
                                            type="button"
                                            className="wm-button wm-secondary"
                                            disabled={
                                                uploading
                                            }
                                            onClick={
                                                closeUpload
                                            }
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="submit"
                                            className="wm-button wm-primary"
                                            disabled={
                                                uploading
                                            }
                                        >
                                            {
                                                uploading
                                                    ? "Uploading..."
                                                    : "Upload Image"
                                            }
                                        </button>
                                    </footer>
                                </form>
                            </div>
                        </div>
                    )
                    : null
            }

            {
                editingImage
                    ? (
                        <div
                            className="wm-modal-backdrop"
                            role="presentation"
                            onMouseDown={
                                (
                                    event,
                                ) => {
                                    if (
                                        event.target
                                        ===
                                        event.currentTarget
                                    ) {
                                        closeEdit();
                                    }
                                }
                            }
                        >
                            <div
                                className="wm-modal"
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="wm-edit-title"
                            >
                                <header>
                                    <div>
                                        <span
                                            className="wm-eyebrow"
                                        >
                                            GALLERY
                                        </span>

                                        <h2
                                            id="wm-edit-title"
                                        >
                                            Edit Gallery Image
                                        </h2>
                                    </div>

                                    <button
                                        type="button"
                                        className="wm-modal-close"
                                        onClick={
                                            closeEdit
                                        }
                                    >
                                        ×
                                    </button>
                                </header>

                                <form
                                    onSubmit={
                                        submitEdit
                                    }
                                    className="wm-form"
                                >
                                    {
                                        editingImage
                                            .image_url
                                            ? (
                                                <img
                                                    className="wm-edit-preview"
                                                    src={
                                                        editingImage
                                                            .image_url
                                                    }
                                                    alt=""
                                                />
                                            )
                                            : null
                                    }

                                    <label>
                                        <span>
                                            Caption
                                        </span>

                                        <input
                                            type="text"
                                            maxLength={
                                                190
                                            }
                                            value={
                                                editCaption
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    setEditCaption(
                                                        event
                                                            .target
                                                            .value,
                                                    )
                                            }
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            Alternative Text
                                        </span>

                                        <input
                                            type="text"
                                            maxLength={
                                                255
                                            }
                                            value={
                                                editAltText
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    setEditAltText(
                                                        event
                                                            .target
                                                            .value,
                                                    )
                                            }
                                        />
                                    </label>

                                    <label>
                                        <span>
                                            Sort Order
                                        </span>

                                        <input
                                            type="number"
                                            required
                                            min={
                                                0
                                            }
                                            max={
                                                100000
                                            }
                                            value={
                                                editSortOrder
                                            }
                                            onChange={
                                                (
                                                    event,
                                                ) =>
                                                    setEditSortOrder(
                                                        Math.max(
                                                            0,
                                                            Number(
                                                                event
                                                                    .target
                                                                    .value,
                                                            )
                                                            ||
                                                            0,
                                                        ),
                                                    )
                                            }
                                        />
                                    </label>

                                    <footer
                                        className="wm-modal-actions"
                                    >
                                        <button
                                            type="button"
                                            className="wm-button wm-secondary"
                                            disabled={
                                                savingImage
                                            }
                                            onClick={
                                                closeEdit
                                            }
                                        >
                                            Cancel
                                        </button>

                                        <button
                                            type="submit"
                                            className="wm-button wm-primary"
                                            disabled={
                                                savingImage
                                            }
                                        >
                                            {
                                                savingImage
                                                    ? "Saving..."
                                                    : "Save Changes"
                                            }
                                        </button>
                                    </footer>
                                </form>
                            </div>
                        </div>
                    )
                    : null
            }
        </section>
    );
}