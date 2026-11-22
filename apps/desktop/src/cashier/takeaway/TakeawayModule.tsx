import { useMemo, useState } from 'react';
import type { CartLine } from '../../types';
import type { TakeawaySubmissionData } from './types';
import './TakeawayModule.css';

interface TakeawayModuleProps {
    cart: CartLine[];
    total: number;
    onChangeQuantity: (id: string, difference: number) => void;
    onRemove: (id: string) => void;
    onBackToProducts: () => void;
    onSubmit: (data: TakeawaySubmissionData) => Promise<boolean>;
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

const makeUuid = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes).map((value) => value.toString(16).padStart(2, '0'));

    return [
        hex.slice(0, 4).join(''),
        hex.slice(4, 6).join(''),
        hex.slice(6, 8).join(''),
        hex.slice(8, 10).join(''),
        hex.slice(10, 16).join(''),
    ].join('-');
};

const money = (value: number | string | null | undefined): string => {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount)) return 'Rs. 0.00';

    return `Rs. ${amount.toLocaleString('en-LK', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const cartUnitPrice = (line: CartLine): number => {
    const base = line.variant ? Number(line.variant.price) : Number(line.item.price);
    const addonTotal = line.addons.reduce(
        (total, selection) => total + Number(selection.addon.price) * selection.quantity,
        0
    );

    return base + addonTotal;
};

const cartLineTotal = (line: CartLine): number => cartUnitPrice(line) * line.quantity;

/*
|--------------------------------------------------------------------------
| Component
|--------------------------------------------------------------------------
*/

export default function TakeawayModule({
    cart,
    total,
    onChangeQuantity,
    onRemove,
    onBackToProducts,
    onSubmit,
}: TakeawayModuleProps) {
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [pickupNotes, setPickupNotes] = useState('');
    const [clientOrderId, setClientOrderId] = useState(() => makeUuid());
    const [submitting, setSubmitting] = useState(false);
    const [localError, setLocalError] = useState('');

    const itemQuantity = useMemo(
        () => cart.reduce((quantity, line) => quantity + Number(line.quantity), 0),
        [cart]
    );

    const submitTakeaway = async (): Promise<void> => {
        if (submitting) return;

        if (cart.length === 0) {
            setLocalError('Add at least one product before creating the takeaway order.');
            return;
        }

        setSubmitting(true);
        setLocalError('');

        try {
            const success = await onSubmit({
                clientOrderId,
                customerName: customerName.trim() || null,
                customerPhone: customerPhone.trim() || null,
                pickupNotes: pickupNotes.trim() || null,
            });

            if (!success) return;

            setClientOrderId(makeUuid());
            setCustomerName('');
            setCustomerPhone('');
            setPickupNotes('');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="takeaway-module-page">
            <header className="takeaway-module-header">
                <div>
                    <span className="takeaway-module-eyebrow">CASHIER ORDER</span>
                    <h1>Takeaway</h1>
                    <p>
                        Create a walk-in or phone takeaway order without assigning a restaurant table.
                    </p>
                </div>

                <div className="takeaway-module-status">
                    <span />
                    TAKEAWAY
                </div>
            </header>

            {localError && (
                <div className="takeaway-module-alert">
                    <span>{localError}</span>
                    <button type="button" onClick={() => setLocalError('')}>
                        ×
                    </button>
                </div>
            )}

            <section className="takeaway-module-summary-grid">
                <SummaryCard label="Order Lines" value={String(cart.length)} />
                <SummaryCard label="Item Quantity" value={String(itemQuantity)} />
                <SummaryCard label="Order Type" value="TAKEAWAY" />
                <SummaryCard label="Grand Total" value={money(total)} primary />
            </section>

            <div className="takeaway-module-layout">
                <section className="takeaway-module-card">
                    <div className="takeaway-module-card-header">
                        <div>
                            <span className="takeaway-module-card-kicker">CUSTOMER</span>
                            <h2>Customer Details</h2>
                            <p>Customer information is optional for takeaway orders.</p>
                        </div>
                        <div className="takeaway-module-customer-icon">CU</div>
                    </div>

                    <div className="takeaway-module-form-grid">
                        <label className="takeaway-module-field">
                            <span>Customer Name</span>
                            <input
                                value={customerName}
                                disabled={submitting}
                                placeholder="Optional customer name"
                                onChange={(event) => setCustomerName(event.target.value)}
                            />
                        </label>

                        <label className="takeaway-module-field">
                            <span>Phone Number</span>
                            <input
                                inputMode="tel"
                                value={customerPhone}
                                disabled={submitting}
                                placeholder="Optional phone number"
                                onChange={(event) => setCustomerPhone(event.target.value)}
                            />
                        </label>

                        <label className="takeaway-module-field takeaway-module-wide">
                            <span>Pickup Notes</span>
                            <textarea
                                rows={4}
                                value={pickupNotes}
                                disabled={submitting}
                                placeholder="Example: Customer will collect at 7:30 PM"
                                onChange={(event) => setPickupNotes(event.target.value)}
                            />
                        </label>
                    </div>

                    {/* <div className="takeaway-module-info">
                        <div className="takeaway-module-info-icon">i</div>
                        <div>
                            <strong>Customer details are optional</strong>
                            <span>
                                Takeaway orders do not create a table session and receive their own pickup
                                token from the server.
                            </span>
                        </div>
                    </div> */}

                    <button
                        type="button"
                        className="takeaway-module-add-products"
                        disabled={submitting}
                        onClick={onBackToProducts}
                    >
                        + Add More Products
                    </button>
                </section>

                <section className="takeaway-module-card takeaway-module-cart-card">
                    <div className="takeaway-module-card-header">
                        <div>
                            <span className="takeaway-module-card-kicker">ORDER</span>
                            <h2>Takeaway Cart</h2>
                        </div>
                        <span className="takeaway-module-cart-count">{cart.length}</span>
                    </div>

                    {cart.length === 0 ? (
                        <div className="takeaway-module-empty-cart">
                            <div>+</div>
                            <strong>Cart is Empty</strong>
                            <span>Add menu products before creating the takeaway.</span>
                            <button type="button" disabled={submitting} onClick={onBackToProducts}>
                                Browse Products
                            </button>
                        </div>
                    ) : (
                        <div className="takeaway-module-cart-lines">
                            {cart.map((line) => (
                                <article className="takeaway-module-cart-line" key={line.id}>
                                    <div className="takeaway-module-cart-line-top">
                                        <div className="takeaway-module-cart-title">
                                            <strong>{line.item.name}</strong>
                                            {line.variant && <span>{line.variant.name}</span>}

                                            {line.addons.length > 0 && (
                                                <div className="takeaway-module-addons">
                                                    {line.addons.map((selected) => (
                                                        <span key={selected.addon.id}>
                                                            + {selected.addon.name}
                                                            {selected.quantity > 1 ? ` × ${selected.quantity}` : ''}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {line.notes && (
                                                <small className="takeaway-module-item-note">
                                                    Note: {line.notes}
                                                </small>
                                            )}
                                        </div>

                                        <strong className="takeaway-module-line-price">
                                            {money(cartLineTotal(line))}
                                        </strong>
                                    </div>

                                    <div className="takeaway-module-cart-line-bottom">
                                        <TakeawayQuantityControl
                                            quantity={line.quantity}
                                            disabled={submitting}
                                            onDecrease={() => onChangeQuantity(line.id, -1)}
                                            onIncrease={() => onChangeQuantity(line.id, 1)}
                                        />

                                        <span className="takeaway-module-unit-price">
                                            {money(cartUnitPrice(line))} each
                                        </span>

                                        <button
                                            type="button"
                                            className="takeaway-module-remove"
                                            disabled={submitting}
                                            onClick={() => onRemove(line.id)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}

                    <div className="takeaway-module-total-box">
                        <div>
                            <span>Items</span>
                            <strong>{itemQuantity}</strong>
                        </div>
                        <div>
                            <span>Grand Total</span>
                            <strong>{money(total)}</strong>
                        </div>
                    </div>

                    <button
                        type="button"
                        className="takeaway-module-submit"
                        disabled={submitting || cart.length === 0}
                        onClick={() => {
                            void submitTakeaway();
                        }}
                    >
                        {submitting ? 'Creating Takeaway...' : `Create Takeaway • ${money(total)}`}
                    </button>

                    <div className="takeaway-module-safe-note">
                        Duplicate network retries are protected by the takeaway request idempotency key.
                    </div>
                </section>
            </div>
        </div>
    );
}

function SummaryCard({ label, value, primary = false }: { label: string; value: string; primary?: boolean }) {
    return (
        <div className={primary ? 'takeaway-module-summary-card primary' : 'takeaway-module-summary-card'}>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function TakeawayQuantityControl({
    quantity,
    disabled,
    onDecrease,
    onIncrease,
}: {
    quantity: number;
    disabled: boolean;
    onDecrease: () => void;
    onIncrease: () => void;
}) {
    return (
        <div className="takeaway-module-quantity">
            <button type="button" disabled={disabled} onClick={onDecrease}>
                −
            </button>
            <strong>{quantity}</strong>
            <button type="button" disabled={disabled} onClick={onIncrease}>
                +
            </button>
        </div>
    );
}