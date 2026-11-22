import type { CartLine } from '../../types';
import { cartItemQuantity, cartLineTotal, cartUnitPrice, posMoney } from './helpers';

interface CartPanelProps {
    cart: CartLine[];
    total: number;
    onChangeQuantity: (id: string, difference: number) => void;
    onRemove: (id: string) => void;
    onTakeaway: () => void;
}

export default function CartPanel({
    cart,
    total,
    onChangeQuantity,
    onRemove,
    onTakeaway,
}: CartPanelProps) {
    const quantity = cartItemQuantity(cart);

    return (
        <aside className="pos-feature-cart">
            <header className="pos-feature-cart-header">
                <div>
                    <span className="pos-feature-kicker">CURRENT CART</span>
                    <h2>Customer Order</h2>
                </div>
                <span className="pos-feature-cart-count">{cart.length}</span>
            </header>

            {cart.length === 0 ? (
                <div className="pos-feature-empty-cart">
                    <div className="pos-feature-empty-cart-icon">+</div>
                    <strong>Cart is Empty</strong>
                    <span>Select a menu item to start an order.</span>
                </div>
            ) : (
                <div className="pos-feature-cart-lines">
                    {cart.map((line) => (
                        <article key={line.id} className="pos-feature-cart-line">
                            <div className="pos-feature-cart-line-top">
                                <div className="pos-feature-cart-item-info">
                                    <strong>{line.item.name}</strong>
                                    {line.variant && <span>{line.variant.name}</span>}

                                    {line.addons.length > 0 && (
                                        <div className="pos-feature-cart-addons">
                                            {line.addons.map((selected) => (
                                                <span key={selected.addon.id}>
                                                    + {selected.addon.name}
                                                    {selected.quantity > 1 ? ` × ${selected.quantity}` : ''}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {line.notes && (
                                        <small className="pos-feature-cart-note">
                                            Note: {line.notes}
                                        </small>
                                    )}
                                </div>

                                <strong className="pos-feature-cart-price">
                                    {posMoney(cartLineTotal(line))}
                                </strong>
                            </div>

                            <div className="pos-feature-cart-line-bottom">
                                <QuantityControl
                                    quantity={line.quantity}
                                    onDecrease={() => onChangeQuantity(line.id, -1)}
                                    onIncrease={() => onChangeQuantity(line.id, 1)}
                                />

                                <span className="pos-feature-cart-each">
                                    {posMoney(cartUnitPrice(line))} each
                                </span>

                                <button type="button" className="pos-feature-remove" onClick={() => onRemove(line.id)}>
                                    Remove
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <footer className="pos-feature-cart-footer">
                <div className="pos-feature-cart-summary">
                    <div>
                        <span>Quantity</span>
                        <strong>{quantity}</strong>
                    </div>

                    <div>
                        <span>Grand Total</span>
                        <strong>{posMoney(total)}</strong>
                    </div>
                </div>

                {/* <div className="pos-feature-order-type-note">
                    <strong>Takeaway ordering available</strong>
                    <span>Cashier dine-in order creation will be connected only after its Laravel endpoint is verified.</span>
                </div> */}

                <button type="button" className="pos-feature-takeaway-button" disabled={cart.length === 0} onClick={onTakeaway}>
                    Continue as Takeaway
                </button>
            </footer>
        </aside>
    );
}

function QuantityControl({
    quantity,
    onDecrease,
    onIncrease,
}: {
    quantity: number;
    onDecrease: () => void;
    onIncrease: () => void;
}) {
    return (
        <div className="pos-feature-quantity">
            <button type="button" onClick={onDecrease}>
                −
            </button>
            <strong>{quantity}</strong>
            <button type="button" onClick={onIncrease}>
                +
            </button>
        </div>
    );
}