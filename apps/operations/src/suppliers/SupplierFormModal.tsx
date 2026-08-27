import {
    useState,
    type FormEvent,
} from "react";

import type {
    Supplier,
    SupplierEditorSubmission,
} from "./types";

interface SupplierFormModalProps {
    supplier: Supplier | null;

    onClose: () => void;

    onSubmit: (
        submission: SupplierEditorSubmission
    ) => Promise<void>;
}

function nullableText(
    value: string
): string | null {
    const trimmed =
        value.trim();

    return trimmed
        ? trimmed
        : null;
}

function errorMessage(
    error: unknown
): string {
    if (
        error instanceof Error
        && error.message
    ) {
        return error.message;
    }

    return "The supplier could not be saved.";
}

const money =
    new Intl.NumberFormat(
        "en-LK",
        {
            style:
                "currency",

            currency:
                "LKR",

            minimumFractionDigits:
                2,

            maximumFractionDigits:
                2,
        }
    );

export default function SupplierFormModal({
    supplier,
    onClose,
    onSubmit,
}: SupplierFormModalProps) {
    const isEditing =
        supplier !== null;

    const [
        name,
        setName,
    ] =
        useState(
            supplier?.name
            ?? ""
        );

    const [
        phone,
        setPhone,
    ] =
        useState(
            supplier?.phone
            ?? ""
        );

    const [
        email,
        setEmail,
    ] =
        useState(
            supplier?.email
            ?? ""
        );

    const [
        address,
        setAddress,
    ] =
        useState(
            supplier?.address
            ?? ""
        );

    const [
        notes,
        setNotes,
    ] =
        useState(
            supplier?.notes
            ?? ""
        );

    const [
        isActive,
        setIsActive,
    ] =
        useState(
            supplier?.is_active
            ?? true
        );

    const [
        busy,
        setBusy,
    ] =
        useState(
            false
        );

    const [
        error,
        setError,
    ] =
        useState(
            ""
        );

    const submit =
        async (
            event: FormEvent
        ) => {
            event.preventDefault();

            if (
                busy
            ) {
                return;
            }

            setError(
                ""
            );

            const cleanName =
                name.trim();

            if (
                !cleanName
            ) {
                setError(
                    "Supplier name is required."
                );

                return;
            }

            if (
                cleanName.length
                > 190
            ) {
                setError(
                    "Supplier name cannot exceed 190 characters."
                );

                return;
            }

            const cleanPhone =
                nullableText(
                    phone
                );

            if (
                cleanPhone
                && cleanPhone.length
                > 50
            ) {
                setError(
                    "Phone number cannot exceed 50 characters."
                );

                return;
            }

            const cleanEmail =
                nullableText(
                    email
                );

            if (
                cleanEmail
                && cleanEmail.length
                > 190
            ) {
                setError(
                    "Email cannot exceed 190 characters."
                );

                return;
            }

            if (
                address.length
                > 1000
            ) {
                setError(
                    "Address cannot exceed 1000 characters."
                );

                return;
            }

            if (
                notes.length
                > 2000
            ) {
                setError(
                    "Notes cannot exceed 2000 characters."
                );

                return;
            }

            setBusy(
                true
            );

            try {
                await onSubmit({
                    name:
                        cleanName,

                    phone:
                        cleanPhone,

                    email:
                        cleanEmail,

                    address:
                        nullableText(
                            address
                        ),

                    notes:
                        nullableText(
                            notes
                        ),

                    is_active:
                        isActive,
                });
            } catch (
            caught
            ) {
                setError(
                    errorMessage(
                        caught
                    )
                );

                setBusy(
                    false
                );
            }
        };

    return (
        <div
            className="suppliers-modal-backdrop"
            role="presentation"
        >
            <div
                className="suppliers-modal"
                role="dialog"
                aria-modal="true"
                aria-label={
                    isEditing
                        ? `Edit supplier ${supplier.name}`
                        : "Create supplier"
                }
            >
                <div className="suppliers-modal-header">
                    <div>
                        <div className="suppliers-modal-eyebrow">
                            Supplier Master
                        </div>

                        <h2>
                            {
                                isEditing
                                    ? "Edit Supplier"
                                    : "Add Supplier"
                            }
                        </h2>

                        <p>
                            {
                                isEditing
                                    ? "Update supplier contact and business information."
                                    : "Create a supplier for purchasing and supplier payment workflows."
                            }
                        </p>
                    </div>

                    <button
                        type="button"
                        className="suppliers-icon-button"
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Close supplier form"
                    >
                        ×
                    </button>
                </div>

                <form
                    className="suppliers-modal-body"
                    onSubmit={submit}
                >
                    {
                        error
                        && (
                            <div className="suppliers-alert suppliers-alert-error">
                                {error}
                            </div>
                        )
                    }

                    {
                        isEditing
                        && (
                            <section className="suppliers-readonly-grid">
                                <article>
                                    <span>
                                        Supplier Code
                                    </span>

                                    <strong>
                                        {
                                            supplier.supplier_code
                                        }
                                    </strong>
                                </article>

                                <article>
                                    <span>
                                        Outstanding Balance
                                    </span>

                                    <strong>
                                        {
                                            money.format(
                                                supplier.current_balance
                                            )
                                        }
                                    </strong>
                                </article>
                            </section>
                        )
                    }

                    <div className="suppliers-form-grid">
                        <label className="suppliers-field suppliers-field-full">
                            <span>
                                Supplier Name *
                            </span>

                            <input
                                type="text"
                                value={name}
                                maxLength={190}
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setName(
                                            event.target.value
                                        )
                                }
                                placeholder="Enter supplier name"
                                disabled={busy}
                                autoFocus
                            />
                        </label>

                        <label className="suppliers-field">
                            <span>
                                Phone
                            </span>

                            <input
                                type="text"
                                value={phone}
                                maxLength={50}
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setPhone(
                                            event.target.value
                                        )
                                }
                                placeholder="+94..."
                                disabled={busy}
                            />
                        </label>

                        <label className="suppliers-field">
                            <span>
                                Email
                            </span>

                            <input
                                type="email"
                                value={email}
                                maxLength={190}
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setEmail(
                                            event.target.value
                                        )
                                }
                                placeholder="supplier@example.com"
                                disabled={busy}
                            />
                        </label>

                        <label className="suppliers-field suppliers-field-full">
                            <span>
                                Address
                            </span>

                            <textarea
                                value={address}
                                maxLength={1000}
                                rows={3}
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setAddress(
                                            event.target.value
                                        )
                                }
                                placeholder="Supplier address"
                                disabled={busy}
                            />
                        </label>

                        <label className="suppliers-field suppliers-field-full">
                            <span>
                                Notes
                            </span>

                            <textarea
                                value={notes}
                                maxLength={2000}
                                rows={4}
                                onChange={
                                    (
                                        event
                                    ) =>
                                        setNotes(
                                            event.target.value
                                        )
                                }
                                placeholder="Internal purchasing notes..."
                                disabled={busy}
                            />

                            <small>
                                {
                                    notes.length
                                }
                                /2000
                            </small>
                        </label>
                    </div>

                    {
                        !isEditing
                        && (
                            <label className="suppliers-toggle-card">
                                <div>
                                    <strong>
                                        Active Supplier
                                    </strong>

                                    <span>
                                        Active suppliers can be used in normal purchasing workflows.
                                    </span>
                                </div>

                                <input
                                    type="checkbox"
                                    checked={isActive}
                                    onChange={
                                        (
                                            event
                                        ) =>
                                            setIsActive(
                                                event.target.checked
                                            )
                                    }
                                    disabled={busy}
                                />
                            </label>
                        )
                    }

                    {
                        isEditing
                        && (
                            <div className="suppliers-alert suppliers-alert-info">
                                Supplier status is managed separately so activation and
                                deactivation remain explicitly auditable.
                            </div>
                        )
                    }

                    <div className="suppliers-modal-actions">
                        <button
                            type="button"
                            className="suppliers-button suppliers-button-secondary"
                            onClick={onClose}
                            disabled={busy}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="suppliers-button suppliers-button-primary"
                            disabled={busy}
                        >
                            {
                                busy
                                    ? "Saving..."
                                    : isEditing
                                        ? "Save Changes"
                                        : "Create Supplier"
                            }
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}