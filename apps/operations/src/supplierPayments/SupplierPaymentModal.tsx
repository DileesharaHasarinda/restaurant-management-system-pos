import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type FormEvent,
    type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import {
    createPortal,
} from "react-dom";

import type {
    Purchase,
} from "../purchases/types";

import type {
    SupplierPaymentLinePayload,
    SupplierPaymentMethod,
    SupplierPaymentPayload,
} from "./types";

interface SupplierPaymentModalProps {
    purchases: Purchase[];
    allowCash: boolean;
    onClose: () => void;
    onSubmit: (
        purchaseId: number,
        payload: SupplierPaymentPayload,
    ) => Promise<void>;
}

interface EditablePaymentLine {
    key: number;
    paymentMethod: SupplierPaymentMethod;
    amount: string;
    reference: string;
    notes: string;
}

interface SearchableOption {
    id: number;
    label: string;
    sublabel?: string;
    disabled?: boolean;
}

const PAYMENT_METHODS: Array<{
    value: SupplierPaymentMethod;
    label: string;
}> = [
        { value: "CASH", label: "Cash" },
        { value: "CARD", label: "Card" },
        { value: "BANK_TRANSFER", label: "Bank Transfer" },
        { value: "CHEQUE", label: "Cheque" },
        { value: "OTHER", label: "Other" },
    ];

let nextLineKey = 1;

function createLine(): EditablePaymentLine {
    return {
        key: nextLineKey++,
        paymentMethod: "BANK_TRANSFER",
        amount: "",
        reference: "",
        notes: "",
    };
}

function toSupplierPaymentMethod(
    value: string,
): SupplierPaymentMethod {
    switch (value) {
        case "CASH":
            return "CASH";
        case "CARD":
            return "CARD";
        case "BANK_TRANSFER":
            return "BANK_TRANSFER";
        case "CHEQUE":
            return "CHEQUE";
        case "OTHER":
            return "OTHER";
        default:
            return "OTHER";
    }
}

function nullableText(value: string): string | null {
    const cleaned = value.trim();
    return cleaned ? cleaned : null;
}

function todayInputValue(): string {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(
        2,
        "0",
    );
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function generateUuid(): string {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
        /[xy]/g,
        (character) => {
            const random = Math.floor(Math.random() * 16);
            const value =
                character === "x"
                    ? random
                    : (random & 0x3) | 0x8;

            return value.toString(16);
        },
    );
}

function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "The supplier payment could not be recorded.";
}

const money =
    new Intl.NumberFormat(
        "en-LK",
        {
            style: "currency",
            currency: "LKR",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        },
    );

/*
|--------------------------------------------------------------------------
| Searchable Select
|--------------------------------------------------------------------------
|
| Lightweight combobox with a floating search panel.
|
| - Filters options as you type
| - Enter selects the first enabled match
| - Escape closes the panel
| - Click outside closes the panel
| - Scroll/resize closes the panel
| - Renders into document.body to avoid overflow clipping
|--------------------------------------------------------------------------
*/

interface SearchableSelectProps {
    value: number;
    options: SearchableOption[];
    placeholder: string;
    disabled?: boolean;
    onChange: (id: number) => void;
    emptyMessage?: string;
    ariaLabel?: string;
}

function SearchableSelect({
    value,
    options,
    placeholder,
    disabled = false,
    onChange,
    emptyMessage = "No matches found",
    ariaLabel,
}: SearchableSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [position, setPosition] = useState<{
        top: number;
        left: number;
        width: number;
    } | null>(null);

    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const panelRef = useRef<HTMLDivElement | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const selected = useMemo(
        () => options.find((option) => option.id === value),
        [options, value],
    );

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();

        if (!query) {
            return options;
        }

        return options.filter((option) => {
            if (option.label.toLowerCase().includes(query)) {
                return true;
            }

            if (
                option.sublabel &&
                option.sublabel.toLowerCase().includes(query)
            ) {
                return true;
            }

            return false;
        });
    }, [options, search]);

    const closePanel = useCallback(() => {
        setOpen(false);
        setSearch("");
    }, []);

    const updatePosition = useCallback(() => {
        const trigger = triggerRef.current;

        if (!trigger) {
            return;
        }

        const rect = trigger.getBoundingClientRect();

        setPosition({
            top: rect.bottom + 6,
            left: rect.left,
            width: rect.width,
        });
    }, []);

    useEffect(() => {
        if (!open) {
            return;
        }

        updatePosition();

        const handleScroll = () => {
            closePanel();
        };

        const handleResize = () => {
            updatePosition();
        };

        window.addEventListener("scroll", handleScroll, true);
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener(
                "scroll",
                handleScroll,
                true,
            );
            window.removeEventListener("resize", handleResize);
        };
    }, [open, updatePosition, closePanel]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const handleMouseDown = (event: MouseEvent) => {
            const target = event.target as Node;

            if (
                panelRef.current?.contains(target) ||
                triggerRef.current?.contains(target)
            ) {
                return;
            }

            closePanel();
        };

        document.addEventListener(
            "mousedown",
            handleMouseDown,
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleMouseDown,
            );
        };
    }, [open, closePanel]);

    useEffect(() => {
        if (!open) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            inputRef.current?.focus();
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [open]);

    const selectOption = useCallback(
        (option: SearchableOption) => {
            if (option.disabled) {
                return;
            }

            onChange(option.id);
            closePanel();
        },
        [onChange, closePanel],
    );

    const handleSearchKeyDown = (
        event: ReactKeyboardEvent<HTMLInputElement>,
    ) => {
        if (event.key === "Enter") {
            event.preventDefault();

            const firstEnabled = filtered.find(
                (option) => !option.disabled,
            );

            if (firstEnabled) {
                selectOption(firstEnabled);
            }

            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            closePanel();
        }
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className="supplier-payments-searchable-trigger"
                disabled={disabled}
                onClick={() => {
                    if (open) {
                        closePanel();
                        return;
                    }

                    updatePosition();
                    setOpen(true);
                }}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={ariaLabel}
            >
                <span
                    className={
                        selected
                            ? "supplier-payments-searchable-value"
                            : "supplier-payments-searchable-placeholder"
                    }
                    title={selected?.label}
                >
                    {selected ? selected.label : placeholder}
                </span>

                <span
                    className="supplier-payments-searchable-caret"
                    aria-hidden="true"
                >
                    ▾
                </span>
            </button>

            {open &&
                position &&
                createPortal(
                    <div
                        ref={panelRef}
                        className="supplier-payments-searchable-panel"
                        style={{
                            position: "fixed",
                            top: position.top,
                            left: position.left,
                            minWidth: position.width,
                        }}
                        role="listbox"
                    >
                        <input
                            ref={inputRef}
                            type="text"
                            className="supplier-payments-searchable-input"
                            value={search}
                            placeholder="Search purchase or supplier..."
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            onKeyDown={handleSearchKeyDown}
                        />

                        <div className="supplier-payments-searchable-list">
                            {filtered.length === 0 ? (
                                <div className="supplier-payments-searchable-empty">
                                    {emptyMessage}
                                </div>
                            ) : (
                                filtered.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={
                                            "supplier-payments-searchable-option" +
                                            (option.id === value
                                                ? " supplier-payments-searchable-option-active"
                                                : "")
                                        }
                                        disabled={option.disabled}
                                        onClick={() =>
                                            selectOption(option)
                                        }
                                        role="option"
                                        aria-selected={
                                            option.id === value
                                        }
                                    >
                                        <span className="supplier-payments-searchable-option-label">
                                            {option.label}
                                        </span>

                                        {option.sublabel && (
                                            <span className="supplier-payments-searchable-option-sublabel">
                                                {option.sublabel}
                                            </span>
                                        )}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>,
                    document.body,
                )}
        </>
    );
}

export default function SupplierPaymentModal({
    purchases,
    onClose,
    onSubmit,
}: SupplierPaymentModalProps) {
    const [purchaseId, setPurchaseId] = useState(0);
    const [paymentDate, setPaymentDate] = useState(
        todayInputValue(),
    );
    const [notes, setNotes] = useState("");
    const [paymentLines, setPaymentLines] = useState<
        EditablePaymentLine[]
    >([createLine()]);

    const [idempotencyKey] = useState(() => generateUuid());

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    /*
    |--------------------------------------------------------------------------
    | Outstanding purchase options
    |--------------------------------------------------------------------------
    |
    | Label   → Purchase number — Supplier name
    | Sublabel → Due amount (formatted)
    |
    | Search matches against the label (purchase number + supplier name).
    |--------------------------------------------------------------------------
    */

    const purchaseOptions = useMemo<SearchableOption[]>(
        () =>
            purchases.map((purchase) => ({
                id: purchase.id,
                label: `${purchase.purchase_number} — ${purchase.supplier?.name ?? "Unknown Supplier"
                    }`,
                sublabel: `Due ${money.format(
                    purchase.balance_due,
                )}`,
            })),
        [purchases],
    );

    const availablePaymentMethods = PAYMENT_METHODS;

    const selectedPurchase = useMemo(
        () =>
            purchases.find(
                (purchase) => purchase.id === purchaseId,
            ) ?? null,
        [purchases, purchaseId],
    );

    const paymentTotal = useMemo(
        () =>
            paymentLines.reduce((total, payment) => {
                const amount = Number(payment.amount);

                if (!Number.isFinite(amount)) {
                    return total;
                }

                return total + amount;
            }, 0),
        [paymentLines],
    );

    const cashAmount = useMemo(
        () =>
            paymentLines.reduce((total, payment) => {
                if (payment.paymentMethod !== "CASH") {
                    return total;
                }

                const amount = Number(payment.amount);

                if (!Number.isFinite(amount)) {
                    return total;
                }

                return total + amount;
            }, 0),
        [paymentLines],
    );

    const remainingAfterPayment = selectedPurchase
        ? Math.max(
            0,
            selectedPurchase.balance_due - paymentTotal,
        )
        : 0;

    const updateLine = (
        key: number,
        updates: Partial<EditablePaymentLine>,
    ) => {
        setPaymentLines((current) =>
            current.map((line) =>
                line.key === key
                    ? { ...line, ...updates }
                    : line,
            ),
        );
    };

    const addLine = () => {
        if (paymentLines.length >= 10) {
            setError(
                "A payment batch cannot contain more than 10 payment methods.",
            );

            return;
        }

        setPaymentLines((current) => [
            ...current,
            createLine(),
        ]);
    };

    const removeLine = (key: number) => {
        if (paymentLines.length <= 1) {
            return;
        }

        setPaymentLines((current) =>
            current.filter((line) => line.key !== key),
        );
    };

    const payFullRemaining = () => {
        if (!selectedPurchase) {
            return;
        }

        setPaymentLines((current) =>
            current.map((line, index) =>
                index === 0
                    ? {
                        ...line,
                        amount: String(
                            selectedPurchase.balance_due,
                        ),
                    }
                    : {
                        ...line,
                        amount: "",
                    },
            ),
        );
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        if (busy) {
            return;
        }

        setError("");

        if (!selectedPurchase) {
            setError("Select an outstanding purchase.");
            return;
        }

        if (selectedPurchase.status !== "COMPLETED") {
            setError(
                "Supplier payments can only be recorded against completed purchases.",
            );

            return;
        }

        if (selectedPurchase.balance_due <= 0) {
            setError("This purchase is already fully paid.");
            return;
        }

        if (!paymentDate) {
            setError("Payment date is required.");
            return;
        }

        if (notes.length > 2000) {
            setError(
                "Payment notes cannot exceed 2000 characters.",
            );

            return;
        }

        const payloadLines: SupplierPaymentLinePayload[] = [];

        for (const line of paymentLines) {
            const amountText = line.amount.trim();

            if (!/^\d+(\.\d{1,2})?$/.test(amountText)) {
                setError(
                    "Every payment amount must contain no more than two decimal places.",
                );

                return;
            }

            const amount = Number(amountText);

            if (!Number.isFinite(amount) || amount <= 0) {
                setError(
                    "Every payment amount must be greater than zero.",
                );

                return;
            }

            if (
                line.paymentMethod === "CHEQUE" &&
                !line.reference.trim()
            ) {
                setError(
                    "A cheque number/reference is required for cheque payments.",
                );

                return;
            }

            payloadLines.push({
                payment_method: line.paymentMethod,
                amount,
                reference: nullableText(line.reference),
                notes: nullableText(line.notes),
            });
        }

        const total = payloadLines.reduce(
            (current, line) => current + line.amount,
            0,
        );

        if (total > selectedPurchase.balance_due + 0.001) {
            setError(
                `Payment total ${money.format(
                    total,
                )} exceeds the outstanding balance ${money.format(
                    selectedPurchase.balance_due,
                )}.`,
            );

            return;
        }

        setBusy(true);

        try {
            await onSubmit(selectedPurchase.id, {
                idempotency_key: idempotencyKey,
                payment_date: paymentDate,
                notes: nullableText(notes),
                payments: payloadLines,
            });
        } catch (caught) {
            setError(errorMessage(caught));
            setBusy(false);
        }
    };

    return (
        <div className="supplier-payments-modal-backdrop">
            <div
                className="supplier-payments-modal supplier-payments-editor-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Record supplier payment"
            >
                <div className="supplier-payments-modal-header">
                    <div>
                        <div className="supplier-payments-eyebrow">
                            Accounts Payable
                        </div>

                        <h2>Record Supplier Payment</h2>

                        <p>
                            Record a partial, full or split
                            payment against a completed
                            purchase.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="supplier-payments-icon-button"
                        disabled={busy}
                        onClick={onClose}
                        aria-label="Close payment form"
                    >
                        ×
                    </button>
                </div>

                <form
                    className="supplier-payments-modal-body"
                    onSubmit={submit}
                >
                    {error && (
                        <div
                            className="supplier-payments-alert supplier-payments-alert-error"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    {/* {!allowCash && (
                        <div className="supplier-payments-alert supplier-payments-alert-info">
                            <strong>
                                Cash payment availability
                            </strong>

                            <br />

                            Cash is available as a payment method.
                            The backend remains responsible for
                            validating whether the signed-in user
                            has the required active cashier shift.
                        </div>
                    )} */}

                    <section className="supplier-payments-form-grid">
                        <div className="supplier-payments-field supplier-payments-field-full">
                            <span>Outstanding Purchase *</span>

                            <SearchableSelect
                                value={purchaseId}
                                options={purchaseOptions}
                                placeholder={
                                    purchases.length === 0
                                        ? "No outstanding purchases"
                                        : "Select purchase"
                                }
                                disabled={
                                    busy ||
                                    purchases.length === 0
                                }
                                onChange={setPurchaseId}
                                emptyMessage="No purchases match your search"
                                ariaLabel="Select outstanding purchase"
                            />
                        </div>

                        <label className="supplier-payments-field">
                            <span>Payment Date *</span>

                            <input
                                type="date"
                                value={paymentDate}
                                disabled={busy}
                                onChange={(event) =>
                                    setPaymentDate(
                                        event.target.value,
                                    )
                                }
                            />
                        </label>
                    </section>

                    {selectedPurchase && (
                        <section className="supplier-payments-purchase-summary">
                            <article>
                                <span>Supplier</span>
                                <strong>
                                    {selectedPurchase.supplier
                                        ?.name ?? "—"}
                                </strong>
                            </article>

                            <article>
                                <span>Purchase Total</span>
                                <strong>
                                    {money.format(
                                        selectedPurchase.grand_total,
                                    )}
                                </strong>
                            </article>

                            <article>
                                <span>Already Paid</span>
                                <strong>
                                    {money.format(
                                        selectedPurchase.paid_amount,
                                    )}
                                </strong>
                            </article>

                            <article>
                                <span>Outstanding</span>
                                <strong className="supplier-payments-danger-money">
                                    {money.format(
                                        selectedPurchase.balance_due,
                                    )}
                                </strong>
                            </article>
                        </section>
                    )}

                    <section className="supplier-payments-methods-section">
                        <div className="supplier-payments-section-heading">
                            <div>
                                <h3>Payment Methods</h3>

                                <p>
                                    Up to 10 methods can be
                                    combined in one payment.
                                    {paymentLines.length > 0
                                        ? ` ${paymentLines.length
                                        } method${paymentLines.length ===
                                            1
                                            ? ""
                                            : "s"
                                        } added.`
                                        : ""}
                                </p>
                            </div>

                            {selectedPurchase && (
                                <button
                                    type="button"
                                    className="supplier-payments-button supplier-payments-button-secondary"
                                    disabled={busy}
                                    onClick={payFullRemaining}
                                >
                                    Use Full Balance
                                </button>
                            )}
                        </div>

                        <div className="supplier-payments-table-wrap">
                            <table className="supplier-payments-editor-table">
                                <thead>
                                    <tr>
                                        <th>Method</th>
                                        <th>Amount</th>
                                        <th>Reference</th>
                                        <th>Notes</th>
                                        <th />
                                    </tr>
                                </thead>

                                <tbody>
                                    {paymentLines.map((line) => (
                                        <tr key={line.key}>
                                            <td>
                                                <select
                                                    value={
                                                        line.paymentMethod
                                                    }
                                                    disabled={
                                                        busy
                                                    }
                                                    onChange={(
                                                        event,
                                                    ) =>
                                                        updateLine(
                                                            line.key,
                                                            {
                                                                paymentMethod:
                                                                    toSupplierPaymentMethod(
                                                                        event
                                                                            .target
                                                                            .value,
                                                                    ),
                                                            },
                                                        )
                                                    }
                                                >
                                                    {availablePaymentMethods.map(
                                                        (
                                                            method,
                                                        ) => (
                                                            <option
                                                                key={
                                                                    method.value
                                                                }
                                                                value={
                                                                    method.value
                                                                }
                                                            >
                                                                {
                                                                    method.label
                                                                }
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            </td>

                                            <td>
                                                <input
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    value={
                                                        line.amount
                                                    }
                                                    disabled={
                                                        busy
                                                    }
                                                    placeholder="0.00"
                                                    onChange={(
                                                        event,
                                                    ) =>
                                                        updateLine(
                                                            line.key,
                                                            {
                                                                amount:
                                                                    event
                                                                        .target
                                                                        .value,
                                                            },
                                                        )
                                                    }
                                                />
                                            </td>

                                            <td>
                                                <input
                                                    type="text"
                                                    maxLength={190}
                                                    value={
                                                        line.reference
                                                    }
                                                    disabled={
                                                        busy
                                                    }
                                                    placeholder={
                                                        line.paymentMethod ===
                                                            "CHEQUE"
                                                            ? "Cheque number *"
                                                            : "Optional reference"
                                                    }
                                                    onChange={(
                                                        event,
                                                    ) =>
                                                        updateLine(
                                                            line.key,
                                                            {
                                                                reference:
                                                                    event
                                                                        .target
                                                                        .value,
                                                            },
                                                        )
                                                    }
                                                />
                                            </td>

                                            <td>
                                                <input
                                                    type="text"
                                                    maxLength={500}
                                                    value={
                                                        line.notes
                                                    }
                                                    disabled={
                                                        busy
                                                    }
                                                    placeholder="Optional"
                                                    onChange={(
                                                        event,
                                                    ) =>
                                                        updateLine(
                                                            line.key,
                                                            {
                                                                notes:
                                                                    event
                                                                        .target
                                                                        .value,
                                                            },
                                                        )
                                                    }
                                                />
                                            </td>

                                            <td>
                                                <button
                                                    type="button"
                                                    className="supplier-payments-remove-button"
                                                    disabled={
                                                        busy ||
                                                        paymentLines.length <=
                                                        1
                                                    }
                                                    onClick={() =>
                                                        removeLine(
                                                            line.key,
                                                        )
                                                    }
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button
                            type="button"
                            className="supplier-payments-add-method-row"
                            onClick={addLine}
                            disabled={
                                busy ||
                                paymentLines.length >= 10
                            }
                            aria-label="Add another payment method"
                        >
                            <span
                                className="supplier-payments-add-method-icon"
                                aria-hidden="true"
                            >
                                +
                            </span>
                            Add Method
                        </button>
                    </section>

                    {cashAmount > 0 && (
                        <div className="supplier-payments-alert supplier-payments-alert-warning">
                            <strong>
                                Cash payment:{" "}
                                {money.format(cashAmount)}
                            </strong>

                            <br />

                            This amount will be deducted from
                            your currently open cashier
                            drawer.
                        </div>
                    )}

                    <section className="supplier-payments-total-summary">
                        <article>
                            <span>Payment Total</span>
                            <strong>
                                {money.format(paymentTotal)}
                            </strong>
                        </article>

                        <article>
                            <span>Cash Portion</span>
                            <strong>
                                {money.format(cashAmount)}
                            </strong>
                        </article>

                        <article>
                            <span>
                                Remaining After Payment
                            </span>
                            <strong>
                                {selectedPurchase
                                    ? money.format(
                                        remainingAfterPayment,
                                    )
                                    : "—"}
                            </strong>
                        </article>
                    </section>

                    <label className="supplier-payments-field">
                        <span>Batch Notes</span>

                        <textarea
                            rows={4}
                            maxLength={2000}
                            value={notes}
                            disabled={busy}
                            placeholder="Optional payment notes..."
                            onChange={(event) =>
                                setNotes(event.target.value)
                            }
                        />

                        <small>{notes.length}/2000</small>
                    </label>

                    <div className="supplier-payments-modal-actions">
                        <button
                            type="button"
                            className="supplier-payments-button supplier-payments-button-secondary"
                            disabled={busy}
                            onClick={onClose}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="supplier-payments-button supplier-payments-button-primary"
                            disabled={
                                busy ||
                                purchases.length === 0
                            }
                        >
                            {busy
                                ? "Recording..."
                                : "Record Payment"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}