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
    PurchaseIngredientOption,
    PurchaseLinePayload,
    PurchasePayload,
    PurchaseUnitOption,
} from "./types";

import type {
    Supplier,
} from "../suppliers/types";

interface PurchaseFormModalProps {
    purchase: Purchase | null;
    suppliers: Supplier[];
    ingredients: PurchaseIngredientOption[];
    units: PurchaseUnitOption[];
    onClose: () => void;
    onSubmit: (
        payload: PurchasePayload,
    ) => Promise<void>;
}

interface EditableLine {
    key: number;
    ingredientId: number;
    unitId: number;
    quantity: string;
    unitCost: string;
}

interface SearchableOption {
    id: number;
    label: string;
    sublabel?: string;
    disabled?: boolean;
}

let nextLineKey = 1;

function newLine(): EditableLine {
    return {
        key: nextLineKey++,
        ingredientId: 0,
        unitId: 0,
        quantity: "1",
        unitCost: "0",
    };
}

function lineFromPurchaseItem(
    item: Purchase["items"][number],
): EditableLine {
    return {
        key: nextLineKey++,
        ingredientId: item.ingredient?.id ?? 0,
        unitId: item.purchase_unit?.id ?? 0,
        quantity: String(item.quantity),
        unitCost: String(item.unit_cost),
    };
}

function nullableText(value: string): string | null {
    const clean = value.trim();
    return clean ? clean : null;
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

function errorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "The purchase could not be saved.";
}

function rootUnitId(
    unit: PurchaseUnitOption,
    units: PurchaseUnitOption[],
): number {
    let current = unit;

    const visited = new Set<number>();

    while (current.base_unit_id !== null) {
        if (visited.has(current.id)) {
            break;
        }

        visited.add(current.id);

        const parent = units.find(
            (candidate) =>
                candidate.id === current.base_unit_id,
        );

        if (!parent) {
            return current.base_unit_id;
        }

        current = parent;
    }

    return current.id;
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
| Inline modal scroll-fix (safety net)
|--------------------------------------------------------------------------
*/

const MODAL_SCROLL_FIX_CSS = `
.purchases-editor-modal {
    display: flex !important;
    flex-direction: column !important;
    max-height: calc(100vh - 48px) !important;
    max-height: calc(100dvh - 48px) !important;
    min-height: 0 !important;
    overflow: hidden !important;
}

.purchases-editor-modal .purchases-modal-header {
    flex: 0 0 auto !important;
}

.purchases-editor-modal .purchases-modal-body {
    display: flex !important;
    flex-direction: column !important;
    gap: 20px !important;
    flex: 1 1 0% !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
    overscroll-behavior: contain !important;
    -webkit-overflow-scrolling: touch;
}

.purchases-editor-modal .purchases-modal-body > * {
    flex: 0 0 auto !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
}

.purchases-editor-modal .purchases-items-section {
    overflow: visible !important;
    max-height: none !important;
}

.purchases-editor-modal .purchases-editor-table-wrap {
    width: 100% !important;
    max-height: none !important;
    min-height: 0 !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
}

.purchases-editor-modal .purchases-editor-table {
    width: 100% !important;
    border-collapse: collapse !important;
}

.purchases-editor-modal .purchases-editor-table th,
.purchases-editor-modal .purchases-editor-table thead,
.purchases-editor-modal .purchases-editor-table thead tr,
.purchases-editor-modal .purchases-editor-table tbody tr {
    position: static !important;
}

.purchases-editor-modal .purchases-modal-actions {
    position: sticky !important;
    bottom: 0 !important;
    z-index: 20 !important;
    background: #f8fafc !important;
    margin-top: 20px !important;
    padding-top: 16px !important;
    padding-bottom: 6px !important;
    box-shadow: 0 -14px 22px rgba(248, 250, 252, 0.98) !important;
}

@media (max-height: 760px) {
    .purchases-editor-modal {
        max-height: calc(100vh - 24px) !important;
        max-height: calc(100dvh - 24px) !important;
    }
}
`;

/*
|--------------------------------------------------------------------------
| Searchable Select
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
                className="purchases-searchable-trigger"
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
                            ? "purchases-searchable-value"
                            : "purchases-searchable-placeholder"
                    }
                    title={selected?.label}
                >
                    {selected ? selected.label : placeholder}
                </span>

                <span
                    className="purchases-searchable-caret"
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
                        className="purchases-searchable-panel"
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
                            className="purchases-searchable-input"
                            value={search}
                            placeholder="Search..."
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                            onKeyDown={handleSearchKeyDown}
                        />

                        <div className="purchases-searchable-list">
                            {filtered.length === 0 ? (
                                <div className="purchases-searchable-empty">
                                    {emptyMessage}
                                </div>
                            ) : (
                                filtered.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={
                                            "purchases-searchable-option" +
                                            (option.id === value
                                                ? " purchases-searchable-option-active"
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
                                        <span className="purchases-searchable-option-label">
                                            {option.label}
                                        </span>

                                        {option.sublabel && (
                                            <span className="purchases-searchable-option-sublabel">
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

export default function PurchaseFormModal({
    purchase,
    suppliers,
    ingredients,
    units,
    onClose,
    onSubmit,
}: PurchaseFormModalProps) {
    const isEditing = purchase !== null;

    const [supplierId, setSupplierId] = useState(
        purchase?.supplier?.id ??
        suppliers[0]?.id ??
        0,
    );

    const [purchaseDate, setPurchaseDate] = useState(
        purchase?.purchase_date ?? todayInputValue(),
    );

    const [supplierInvoice, setSupplierInvoice] = useState(
        purchase?.supplier_invoice_number ?? "",
    );

    const [notes, setNotes] = useState(
        purchase?.notes ?? "",
    );

    const [lines, setLines] = useState<EditableLine[]>(
        purchase && purchase.items.length > 0
            ? purchase.items.map(lineFromPurchaseItem)
            : [newLine()],
    );

    const pendingScrollLineKeyRef = useRef<number | null>(
        null,
    );

    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const supplierOptions = useMemo<SearchableOption[]>(
        () =>
            suppliers.map((supplier) => ({
                id: supplier.id,
                label: `${supplier.supplier_code} — ${supplier.name}`,
                sublabel:
                    supplier.phone ??
                    supplier.email ??
                    undefined,
            })),
        [suppliers],
    );

    const estimatedTotal = useMemo(
        () =>
            lines.reduce((total, line) => {
                const quantity = Number(line.quantity);
                const unitCost = Number(line.unitCost);

                if (
                    !Number.isFinite(quantity) ||
                    !Number.isFinite(unitCost)
                ) {
                    return total;
                }

                return total + quantity * unitCost;
            }, 0),
        [lines],
    );

    const updateLine = (
        key: number,
        updates: Partial<EditableLine>,
    ) => {
        setLines((current) =>
            current.map((line) =>
                line.key === key
                    ? { ...line, ...updates }
                    : line,
            ),
        );
    };

    const ingredientChanged = (
        line: EditableLine,
        ingredientId: number,
    ) => {
        const ingredient = ingredients.find(
            (item) => item.id === ingredientId,
        );

        updateLine(line.key, {
            ingredientId,
            unitId: ingredient?.base_unit?.id ?? 0,
        });
    };

    const compatibleUnits = (ingredientId: number) => {
        const ingredient = ingredients.find(
            (candidate) => candidate.id === ingredientId,
        );

        const rootId = ingredient?.base_unit?.id;

        if (!rootId) {
            return [];
        }

        return units.filter(
            (unit) =>
                rootUnitId(unit, units) === rootId,
        );
    };

    const addLine = () => {
        if (lines.length >= 200) {
            setError(
                "A purchase cannot contain more than 200 items.",
            );

            return;
        }

        const line = newLine();

        pendingScrollLineKeyRef.current = line.key;

        setLines((current) => [...current, line]);
    };

    useEffect(() => {
        const key = pendingScrollLineKeyRef.current;

        if (key === null) {
            return;
        }

        const frameId = window.requestAnimationFrame(() => {
            const row = document.querySelector<HTMLElement>(
                `[data-purchase-line-key="${key}"]`,
            );

            if (!row) {
                return;
            }

            row.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "nearest",
            });

            pendingScrollLineKeyRef.current = null;
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [lines]);

    const removeLine = (key: number) => {
        if (lines.length <= 1) {
            return;
        }

        setLines((current) =>
            current.filter((line) => line.key !== key),
        );
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        if (busy) {
            return;
        }

        setError("");

        if (supplierId <= 0) {
            setError("Select a supplier.");
            return;
        }

        if (!purchaseDate) {
            setError("Purchase date is required.");
            return;
        }

        if (supplierInvoice.length > 100) {
            setError(
                "Supplier invoice number cannot exceed 100 characters.",
            );

            return;
        }

        if (notes.length > 2000) {
            setError(
                "Notes cannot exceed 2000 characters.",
            );

            return;
        }

        if (lines.length === 0) {
            setError("Add at least one purchase item.");
            return;
        }

        const ingredientIds = lines.map(
            (line) => line.ingredientId,
        );

        if (ingredientIds.some((id) => id <= 0)) {
            setError(
                "Select an ingredient for every line.",
            );

            return;
        }

        if (
            new Set(ingredientIds).size !==
            ingredientIds.length
        ) {
            setError(
                "The same ingredient cannot appear more than once in a purchase.",
            );

            return;
        }

        const payloadLines: PurchaseLinePayload[] = [];

        for (const line of lines) {
            if (line.unitId <= 0) {
                setError(
                    "Select a purchase unit for every item.",
                );

                return;
            }

            const quantity = Number(line.quantity);
            const unitCost = Number(line.unitCost);

            if (
                !Number.isFinite(quantity) ||
                quantity <= 0
            ) {
                setError(
                    "Every quantity must be greater than zero.",
                );

                return;
            }

            if (
                !Number.isFinite(unitCost) ||
                unitCost < 0
            ) {
                setError("Unit cost cannot be negative.");
                return;
            }

            payloadLines.push({
                ingredient_id: line.ingredientId,
                unit_id: line.unitId,
                quantity,
                unit_cost: unitCost,
            });
        }

        setBusy(true);

        try {
            await onSubmit({
                supplier_id: supplierId,
                purchase_date: purchaseDate,
                supplier_invoice_number:
                    nullableText(supplierInvoice),
                notes: nullableText(notes),
                items: payloadLines,
            });
        } catch (caught) {
            setError(errorMessage(caught));
            setBusy(false);
        }
    };

    return (
        <div className="purchases-modal-backdrop">
            <style
                dangerouslySetInnerHTML={{
                    __html: MODAL_SCROLL_FIX_CSS,
                }}
            />

            <div
                className="purchases-modal purchases-editor-modal"
                role="dialog"
                aria-modal="true"
                aria-label={
                    isEditing
                        ? `Edit purchase ${purchase.purchase_number}`
                        : "New purchase"
                }
            >
                <div className="purchases-modal-header">
                    <div>
                        <div className="purchases-eyebrow">
                            Purchasing
                        </div>

                        <h2>
                            {isEditing
                                ? `Edit ${purchase.purchase_number}`
                                : "New Purchase"}
                        </h2>

                        <p>
                            Save supplier purchases as drafts
                            before receiving inventory.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="purchases-icon-button"
                        onClick={onClose}
                        disabled={busy}
                        aria-label="Close purchase form"
                    >
                        ×
                    </button>
                </div>

                <form
                    className="purchases-modal-body"
                    onSubmit={submit}
                >
                    {error && (
                        <div
                            className="purchases-alert purchases-alert-error"
                            role="alert"
                        >
                            {error}
                        </div>
                    )}

                    <div className="purchases-alert purchases-alert-info">
                        Saving or editing a draft does not
                        change inventory. Stock and supplier
                        liability are updated only when the
                        purchase is completed.
                    </div>

                    <section className="purchases-form-grid">
                        <div className="purchases-field">
                            <span>Supplier *</span>

                            <SearchableSelect
                                value={supplierId}
                                options={supplierOptions}
                                placeholder="Select supplier"
                                disabled={busy}
                                onChange={setSupplierId}
                                emptyMessage="No suppliers match your search"
                                ariaLabel="Select supplier"
                            />
                        </div>

                        <label className="purchases-field">
                            <span>Purchase Date *</span>

                            <input
                                type="date"
                                value={purchaseDate}
                                disabled={busy}
                                onChange={(event) =>
                                    setPurchaseDate(
                                        event.target.value,
                                    )
                                }
                            />
                        </label>

                        <label className="purchases-field purchases-field-full">
                            <span>
                                Supplier Invoice Number
                            </span>

                            <input
                                type="text"
                                value={supplierInvoice}
                                maxLength={100}
                                disabled={busy}
                                placeholder="Optional supplier invoice/reference"
                                onChange={(event) =>
                                    setSupplierInvoice(
                                        event.target.value,
                                    )
                                }
                            />
                        </label>
                    </section>

                    <section className="purchases-items-section">
                        <div className="purchases-section-heading">
                            <div>
                                <h3>Purchase Items</h3>

                                <p>
                                    Cost is entered per
                                    selected purchase unit.
                                    {lines.length > 0
                                        ? ` ${lines.length} item${lines.length === 1
                                            ? ""
                                            : "s"
                                        } added.`
                                        : ""}
                                </p>
                            </div>
                        </div>

                        <div className="purchases-editor-table-wrap">
                            <table className="purchases-editor-table">
                                <thead>
                                    <tr>
                                        <th>Ingredient</th>
                                        <th>Unit</th>
                                        <th>Quantity</th>
                                        <th>Unit Cost</th>
                                        <th>Line Total</th>
                                        <th />
                                    </tr>
                                </thead>

                                <tbody>
                                    {lines.map((line) => {
                                        const usedIds = new Set(
                                            lines
                                                .filter(
                                                    (other) =>
                                                        other.key !==
                                                        line.key,
                                                )
                                                .map(
                                                    (other) =>
                                                        other.ingredientId,
                                                ),
                                        );

                                        const ingredientOptions: SearchableOption[] =
                                            ingredients.map(
                                                (ingredient) => {
                                                    const isUsed =
                                                        usedIds.has(
                                                            ingredient.id,
                                                        );

                                                    const isCurrent =
                                                        ingredient.id ===
                                                        line.ingredientId;

                                                    return {
                                                        id: ingredient.id,
                                                        label:
                                                            ingredient.name,
                                                        sublabel:
                                                            ingredient
                                                                .base_unit
                                                                ?.name ??
                                                            undefined,
                                                        disabled:
                                                            isUsed &&
                                                            !isCurrent,
                                                    };
                                                },
                                            );

                                        const lineUnits =
                                            compatibleUnits(
                                                line.ingredientId,
                                            );

                                        const quantity = Number(
                                            line.quantity,
                                        );
                                        const unitCost = Number(
                                            line.unitCost,
                                        );

                                        const lineTotal =
                                            Number.isFinite(quantity) &&
                                                Number.isFinite(unitCost)
                                                ? quantity * unitCost
                                                : 0;

                                        return (
                                            <tr
                                                key={line.key}
                                                data-purchase-line-key={
                                                    line.key
                                                }
                                            >
                                                <td>
                                                    <SearchableSelect
                                                        value={
                                                            line.ingredientId
                                                        }
                                                        options={
                                                            ingredientOptions
                                                        }
                                                        placeholder="Select ingredient"
                                                        disabled={busy}
                                                        onChange={(id) =>
                                                            ingredientChanged(
                                                                line,
                                                                id,
                                                            )
                                                        }
                                                        emptyMessage="No ingredients match your search"
                                                        ariaLabel="Select ingredient"
                                                    />
                                                </td>

                                                <td>
                                                    <select
                                                        value={
                                                            line.unitId
                                                        }
                                                        disabled={
                                                            busy ||
                                                            line.ingredientId <=
                                                            0
                                                        }
                                                        onChange={(event) =>
                                                            updateLine(
                                                                line.key,
                                                                {
                                                                    unitId:
                                                                        Number(
                                                                            event
                                                                                .target
                                                                                .value,
                                                                        ),
                                                                },
                                                            )
                                                        }
                                                    >
                                                        <option value={0}>
                                                            Select unit
                                                        </option>

                                                        {lineUnits.map(
                                                            (unit) => (
                                                                <option
                                                                    key={
                                                                        unit.id
                                                                    }
                                                                    value={
                                                                        unit.id
                                                                    }
                                                                >
                                                                    {
                                                                        unit.name
                                                                    }{" "}
                                                                    (
                                                                    {
                                                                        unit.symbol
                                                                    }
                                                                    )
                                                                </option>
                                                            ),
                                                        )}
                                                    </select>
                                                </td>

                                                <td>
                                                    <input
                                                        type="number"
                                                        min="0.0001"
                                                        step="0.0001"
                                                        value={
                                                            line.quantity
                                                        }
                                                        disabled={busy}
                                                        onChange={(event) =>
                                                            updateLine(
                                                                line.key,
                                                                {
                                                                    quantity:
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
                                                        type="number"
                                                        min="0"
                                                        step="0.0001"
                                                        value={
                                                            line.unitCost
                                                        }
                                                        disabled={busy}
                                                        onChange={(event) =>
                                                            updateLine(
                                                                line.key,
                                                                {
                                                                    unitCost:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                },
                                                            )
                                                        }
                                                    />
                                                </td>

                                                <td className="purchases-money-cell">
                                                    {money.format(
                                                        lineTotal,
                                                    )}
                                                </td>

                                                <td>
                                                    <button
                                                        type="button"
                                                        className="purchases-remove-button"
                                                        disabled={
                                                            busy ||
                                                            lines.length <=
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
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/*
                         * ────────────────────────────────────
                         * Add Item row — lives BELOW the table
                         * so it moves down as items are added.
                         * ────────────────────────────────────
                         */}
                        <button
                            type="button"
                            className="purchases-add-item-row"
                            onClick={addLine}
                            disabled={
                                busy ||
                                lines.length >= 200
                            }
                            aria-label="Add another purchase item"
                        >
                            <span
                                className="purchases-add-item-icon"
                                aria-hidden="true"
                            >
                                +
                            </span>
                            Add Item
                        </button>

                        <div className="purchases-estimated-total">
                            <span>Draft Total</span>

                            <strong>
                                {money.format(estimatedTotal)}
                            </strong>

                            <small>
                                Laravel recalculates and stores
                                the authoritative total when the
                                draft is saved.
                            </small>
                        </div>
                    </section>

                    <label className="purchases-field">
                        <span>Notes</span>

                        <textarea
                            value={notes}
                            rows={4}
                            maxLength={2000}
                            disabled={busy}
                            placeholder="Optional internal purchasing notes..."
                            onChange={(event) =>
                                setNotes(event.target.value)
                            }
                        />

                        <small>{notes.length}/2000</small>
                    </label>

                    <div className="purchases-modal-actions">
                        <button
                            type="button"
                            className="purchases-button purchases-button-secondary"
                            disabled={busy}
                            onClick={onClose}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="purchases-button purchases-button-primary"
                            disabled={busy}
                        >
                            {busy
                                ? "Saving..."
                                : isEditing
                                    ? "Save Draft Changes"
                                    : "Create Draft"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}