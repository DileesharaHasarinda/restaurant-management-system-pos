import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type {
  FormEvent,
} from 'react';

import {
  ApiError,
  appendWaiterOrder,
  createWaiterOrder,
  getMenu,
  getWaiterTable,
  getWaiterTables,
  login,
  logout,
  me,
  requestTableBill,
} from './api';

import type {
  AuthUser,
  CartAddon,
  CartLine,
  MenuAddon,
  MenuCategory,
  MenuItem,
  MenuVariant,
  OrderItemsPayload,
  WaiterOrder,
  WaiterTable,
  WaiterTableDetail,
} from './types';

const TOKEN_KEY =
  'restaurant-operations-token';

const USER_KEY =
  'restaurant-operations-user';

function money(
  value: number,
): string {
  return `Rs. ${value.toLocaleString(
    'en-LK',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}`;
}

function errorMessage(
  error: unknown,
): string {
  if (
    error instanceof ApiError
  ) {
    return error.message;
  }

  if (
    error instanceof Error
  ) {
    return error.message;
  }

  return 'Something went wrong.';
}

function submissionKey(
  value: string,
): string {
  return `waiter-submission:${value}`;
}

function getSubmissionId(
  key: string,
  signature: string,
): string {
  const storageKey =
    submissionKey(key);

  const stored =
    window.sessionStorage.getItem(
      storageKey,
    );

  if (stored) {
    try {
      const parsed =
        JSON.parse(
          stored,
        ) as {
          id: string;
          signature: string;
        };

      if (
        parsed.id
        && parsed.signature
        === signature
      ) {
        return parsed.id;
      }
    } catch {
      window.sessionStorage
        .removeItem(
          storageKey,
        );
    }
  }

  const id =
    crypto.randomUUID();

  window.sessionStorage
    .setItem(
      storageKey,
      JSON.stringify({
        id,
        signature,
      }),
    );

  return id;
}

export default function App() {
  const [
    token,
    setToken,
  ] = useState<string | null>(
    () =>
      window.localStorage
        .getItem(
          TOKEN_KEY,
        ),
  );

  const [
    user,
    setUser,
  ] = useState<AuthUser | null>(
    () => {
      const stored =
        window.localStorage
          .getItem(
            USER_KEY,
          );

      if (!stored) {
        return null;
      }

      try {
        return JSON.parse(
          stored,
        ) as AuthUser;
      } catch {
        window.localStorage
          .removeItem(
            USER_KEY,
          );

        return null;
      }
    },
  );

  const [
    checkingAuth,
    setCheckingAuth,
  ] = useState(
    () =>
      Boolean(token),
  );

  useEffect(
    () => {
      if (!token) {
        return;
      }

      let active =
        true;

      void me(
        token,
      )
        .then(
          (
            currentUser,
          ) => {
            if (!active) {
              return;
            }

            setUser(
              currentUser,
            );

            window.localStorage
              .setItem(
                USER_KEY,
                JSON.stringify(
                  currentUser,
                ),
              );
          },
        )
        .catch(
          () => {
            if (!active) {
              return;
            }

            window.localStorage
              .removeItem(
                TOKEN_KEY,
              );

            window.localStorage
              .removeItem(
                USER_KEY,
              );

            setToken(
              null,
            );

            setUser(
              null,
            );
          },
        )
        .finally(
          () => {
            if (!active) {
              return;
            }

            setCheckingAuth(
              false,
            );
          },
        );

      return () => {
        active =
          false;
      };
    },
    [
      token,
    ],
  );

  function handleAuthenticated(
    newToken: string,
    newUser: AuthUser,
  ): void {
    window.localStorage
      .setItem(
        TOKEN_KEY,
        newToken,
      );

    window.localStorage
      .setItem(
        USER_KEY,
        JSON.stringify(
          newUser,
        ),
      );

    setToken(
      newToken,
    );

    setUser(
      newUser,
    );

    setCheckingAuth(
      false,
    );
  }

  async function handleLogout(): Promise<void> {
    if (token) {
      try {
        await logout(
          token,
        );
      } catch {
        /*
         * Local logout should still work
         * if the API cannot be reached.
         */
      }
    }

    window.localStorage
      .removeItem(
        TOKEN_KEY,
      );

    window.localStorage
      .removeItem(
        USER_KEY,
      );

    setToken(
      null,
    );

    setUser(
      null,
    );

    setCheckingAuth(
      false,
    );
  }

  if (checkingAuth) {
    return (
      <div className="app-loading">
        <div className="loader" />

        <strong>
          Loading operations...
        </strong>
      </div>
    );
  }

  if (
    !token
    || !user
  ) {
    return (
      <LoginPage
        onAuthenticated={
          handleAuthenticated
        }
      />
    );
  }

  return (
    <WaiterApplication
      token={token}
      user={user}
      onLogout={
        handleLogout
      }
    />
  );
}

function LoginPage(
  {
    onAuthenticated,
  }: {
    onAuthenticated:
    (
      token: string,
      user: AuthUser,
    ) => void;
  },
) {
  const [
    loginValue,
    setLoginValue,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(
      true,
    );

    setError(
      null,
    );

    try {
      const result =
        await login(
          loginValue,
          password,
        );

      onAuthenticated(
        result.token,
        result.user,
      );
    } catch (
    submitError
    ) {
      setError(
        errorMessage(
          submitError,
        ),
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="logo-mark">
            R
          </div>

          <div>
            <span>
              RESTAURANT
            </span>

            <strong>
              Operations
            </strong>
          </div>
        </div>

        <div className="login-heading">
          <span className="eyebrow">
            WAITER ACCESS
          </span>

          <h1>
            Welcome back
          </h1>

          <p>
            Sign in to manage tables
            and customer orders.
          </p>
        </div>

        <form
          className="login-form"
          onSubmit={
            (
              event,
            ) => {
              void submit(
                event,
              );
            }
          }
        >
          <label>
            <span>
              Username or Email
            </span>

            <input
              autoComplete="username"
              value={
                loginValue
              }
              onChange={
                (
                  event,
                ) => {
                  setLoginValue(
                    event.target.value,
                  );
                }
              }
              placeholder="Enter username"
              required
            />
          </label>

          <label>
            <span>
              Password
            </span>

            <div className="password-field">
              <input
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                autoComplete="current-password"
                value={
                  password
                }
                onChange={
                  (
                    event,
                  ) => {
                    setPassword(
                      event.target.value,
                    );
                  }
                }
                placeholder="Enter password"
                required
              />

              <button
                type="button"
                onClick={
                  () => {
                    setShowPassword(
                      (
                        current,
                      ) =>
                        !current,
                    );
                  }
                }
              >
                {
                  showPassword
                    ? 'Hide'
                    : 'View'
                }
              </button>
            </div>
          </label>

          {
            error
              ? (
                <div className="form-error">
                  {error}
                </div>
              )
              : null
          }

          <button
            type="submit"
            className="login-button"
            disabled={
              submitting
            }
          >
            {
              submitting
                ? 'Signing In...'
                : 'Sign In'
            }
          </button>
        </form>
      </section>
    </main>
  );
}

function WaiterApplication(
  {
    token,
    user,
    onLogout,
  }: {
    token: string;
    user: AuthUser;
    onLogout: () => Promise<void>;
  },
) {
  const [
    tables,
    setTables,
  ] = useState<WaiterTable[]>(
    [],
  );

  const [
    tablesLoading,
    setTablesLoading,
  ] = useState(true);

  const [
    tableSearch,
    setTableSearch,
  ] = useState('');

  const [
    selectedTable,
    setSelectedTable,
  ] = useState<WaiterTableDetail | null>(
    null,
  );

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const [
    menu,
    setMenu,
  ] = useState<MenuCategory[]>(
    [],
  );

  const [
    menuSearch,
    setMenuSearch,
  ] = useState('');

  const [
    categoryId,
    setCategoryId,
  ] = useState<number | 'all'>(
    'all',
  );

  const [
    cart,
    setCart,
  ] = useState<CartLine[]>(
    [],
  );

  const [
    selectedItem,
    setSelectedItem,
  ] = useState<MenuItem | null>(
    null,
  );

  const [
    variantId,
    setVariantId,
  ] = useState<number | null>(
    null,
  );

  const [
    addonQuantities,
    setAddonQuantities,
  ] = useState<Record<number, number>>(
    {},
  );

  const [
    itemQuantity,
    setItemQuantity,
  ] = useState(1);

  const [
    itemNotes,
    setItemNotes,
  ] = useState('');

  const [
    cartOpen,
    setCartOpen,
  ] = useState(false);

  const [
    ordersOpen,
    setOrdersOpen,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    requestingBill,
    setRequestingBill,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  const [
    notice,
    setNotice,
  ] = useState<string | null>(
    null,
  );

  async function loadTables(): Promise<void> {
    setTablesLoading(
      true,
    );

    try {
      const result =
        await getWaiterTables(
          token,
        );

      setTables(
        result,
      );
    } catch (
    loadError
    ) {
      setError(
        errorMessage(
          loadError,
        ),
      );
    } finally {
      setTablesLoading(
        false,
      );
    }
  }

  useEffect(
    () => {
      let active =
        true;

      void Promise.all([
        getWaiterTables(
          token,
        ),

        getMenu(),
      ])
        .then(
          ([
            tableResult,
            menuResult,
          ]) => {
            if (!active) {
              return;
            }

            setTables(
              tableResult,
            );

            setMenu(
              menuResult,
            );
          },
        )
        .catch(
          (
            loadError,
          ) => {
            if (!active) {
              return;
            }

            setError(
              errorMessage(
                loadError,
              ),
            );
          },
        )
        .finally(
          () => {
            if (!active) {
              return;
            }

            setTablesLoading(
              false,
            );
          },
        );

      return () => {
        active =
          false;
      };
    },
    [
      token,
    ],
  );

  async function openTable(
    tableId: number,
  ): Promise<void> {
    setDetailLoading(
      true,
    );

    setError(
      null,
    );

    setNotice(
      null,
    );

    setCart(
      [],
    );

    setCartOpen(
      false,
    );

    setOrdersOpen(
      false,
    );

    try {
      const result =
        await getWaiterTable(
          token,
          tableId,
        );

      setSelectedTable(
        result,
      );
    } catch (
    loadError
    ) {
      setError(
        errorMessage(
          loadError,
        ),
      );
    } finally {
      setDetailLoading(
        false,
      );
    }
  }

  async function refreshSelectedTable(): Promise<void> {
    if (!selectedTable) {
      return;
    }

    const result =
      await getWaiterTable(
        token,
        selectedTable.table.id,
      );

    setSelectedTable(
      result,
    );
  }

  const filteredTables =
    useMemo(
      () => {
        const search =
          tableSearch
            .trim()
            .toLowerCase();

        if (!search) {
          return tables;
        }

        return tables.filter(
          (
            table,
          ) => {
            const tableNumber =
              String(
                table.table_number,
              );

            return (
              table.name
                .toLowerCase()
                .includes(
                  search,
                )
              ||
              table.code
                .toLowerCase()
                .includes(
                  search,
                )
              ||
              (
                table.area
                ?? ''
              )
                .toLowerCase()
                .includes(
                  search,
                )
              ||
              tableNumber.includes(
                search,
              )
            );
          },
        );
      },
      [
        tableSearch,
        tables,
      ],
    );

  const filteredMenu =
    useMemo(
      () => {
        const search =
          menuSearch
            .trim()
            .toLowerCase();

        return menu
          .filter(
            (
              category,
            ) =>
              categoryId === 'all'
              ||
              category.id === categoryId,
          )
          .map(
            (
              category,
            ) => ({
              ...category,

              items:
                category.items
                  .filter(
                    (
                      item,
                    ) =>
                      !search
                      ||
                      item.name
                        .toLowerCase()
                        .includes(
                          search,
                        )
                      ||
                      (
                        item.description
                        ?? ''
                      )
                        .toLowerCase()
                        .includes(
                          search,
                        ),
                  ),
            }),
          )
          .filter(
            (
              category,
            ) =>
              category.items.length > 0,
          );
      },
      [
        categoryId,
        menu,
        menuSearch,
      ],
    );

  const activeWaiterOrder =
    useMemo<WaiterOrder | null>(
      () => {
        if (!selectedTable) {
          return null;
        }

        const active =
          [...selectedTable.orders]
            .reverse()
            .find(
              (
                order,
              ) =>
                order.order_source
                === 'WAITER'
                &&
                order.can_add_items,
            );

        return active ?? null;
      },
      [
        selectedTable,
      ],
    );

  const selectedVariant =
    useMemo<MenuVariant | null>(
      () => {
        if (
          !selectedItem
          || variantId === null
        ) {
          return null;
        }

        const variant =
          selectedItem.variants
            .find(
              (
                currentVariant,
              ) =>
                currentVariant.id
                === variantId,
            );

        return variant ?? null;
      },
      [
        selectedItem,
        variantId,
      ],
    );

  const configurationUnitPrice =
    selectedVariant?.price
    ?? selectedItem?.price
    ?? 0;

  const configurationAddonPrice =
    selectedItem
      ?.addons
      .reduce(
        (
          total,
          addon,
        ) => {
          const quantity =
            addonQuantities[
            addon.id
            ]
            ?? 0;

          return total
            + addon.price
            * quantity;
        },
        0,
      )
    ?? 0;

  const configurationTotal =
    (
      configurationUnitPrice
      +
      configurationAddonPrice
    )
    *
    itemQuantity;

  const cartTotal =
    useMemo(
      () =>
        cart.reduce(
          (
            total,
            line,
          ) =>
            total
            +
            line.display_total,
          0,
        ),
      [
        cart,
      ],
    );

  const cartCount =
    useMemo(
      () =>
        cart.reduce(
          (
            total,
            line,
          ) =>
            total
            +
            line.quantity,
          0,
        ),
      [
        cart,
      ],
    );

  function configureItem(
    item: MenuItem,
  ): void {
    const defaultVariant =
      item.variants
        .find(
          (
            variant,
          ) =>
            variant.is_default,
        )
      ??
      item.variants[0]
      ??
      null;

    setSelectedItem(
      item,
    );

    setVariantId(
      defaultVariant?.id
      ?? null,
    );

    setAddonQuantities(
      {},
    );

    setItemQuantity(
      1,
    );

    setItemNotes(
      '',
    );

    setError(
      null,
    );
  }

  function closeConfiguration(): void {
    setSelectedItem(
      null,
    );

    setVariantId(
      null,
    );

    setAddonQuantities(
      {},
    );

    setItemQuantity(
      1,
    );

    setItemNotes(
      '',
    );
  }

  function toggleAddon(
    addon: MenuAddon,
  ): void {
    setAddonQuantities(
      (
        current,
      ) => {
        const next = {
          ...current,
        };

        if (
          (
            next[
            addon.id
            ]
            ?? 0
          ) > 0
        ) {
          delete next[
            addon.id
          ];
        } else {
          next[
            addon.id
          ] = 1;
        }

        return next;
      },
    );
  }

  function changeAddonQuantity(
    addonId: number,
    amount: number,
  ): void {
    setAddonQuantities(
      (
        current,
      ) => {
        const currentQuantity =
          current[
          addonId
          ]
          ?? 0;

        const quantity =
          Math.max(
            0,
            Math.min(
              10,
              currentQuantity
              + amount,
            ),
          );

        const next = {
          ...current,
        };

        if (quantity <= 0) {
          delete next[
            addonId
          ];
        } else {
          next[
            addonId
          ] = quantity;
        }

        return next;
      },
    );
  }

  function addConfiguredItem(): void {
    if (!selectedItem) {
      return;
    }

    if (
      selectedItem.has_variants
      && !selectedVariant
    ) {
      setError(
        'Select a variant before adding this item.',
      );

      return;
    }

    const addons: CartAddon[] =
      selectedItem.addons
        .filter(
          (
            addon,
          ) =>
            (
              addonQuantities[
              addon.id
              ]
              ?? 0
            ) > 0,
        )
        .map(
          (
            addon,
          ) => ({
            addon_id:
              addon.id,

            name:
              addon.name,

            quantity:
              addonQuantities[
              addon.id
              ]
              ?? 0,

            price:
              addon.price,
          }),
        );

    const newLine: CartLine = {
      local_id:
        crypto.randomUUID(),

      menu_item_id:
        selectedItem.id,

      name:
        selectedItem.name,

      variant_id:
        selectedVariant?.id
        ?? null,

      variant_name:
        selectedVariant?.name
        ?? null,

      quantity:
        itemQuantity,

      unit_price:
        configurationUnitPrice,

      addons,

      special_notes:
        itemNotes.trim(),

      display_total:
        configurationTotal,
    };

    setCart(
      (
        current,
      ) => [
          ...current,
          newLine,
        ],
    );

    closeConfiguration();
  }

  function removeCartLine(
    localId: string,
  ): void {
    setCart(
      (
        current,
      ) =>
        current.filter(
          (
            line,
          ) =>
            line.local_id
            !== localId,
        ),
    );
  }

  function payloadFromCart(): OrderItemsPayload {
    return {
      items:
        cart.map(
          (
            line,
          ) => ({
            menu_item_id:
              line.menu_item_id,

            variant_id:
              line.variant_id,

            quantity:
              line.quantity,

            special_notes:
              line.special_notes
                ? line.special_notes
                : null,

            addons:
              line.addons.map(
                (
                  addon,
                ) => ({
                  addon_id:
                    addon.addon_id,

                  quantity:
                    addon.quantity,
                }),
              ),
          }),
        ),
    };
  }

  async function submitCart(): Promise<void> {
    if (
      !selectedTable
      || cart.length === 0
      || submitting
    ) {
      return;
    }

    setSubmitting(
      true,
    );

    setError(
      null,
    );

    setNotice(
      null,
    );

    const payload =
      payloadFromCart();

    const signature =
      JSON.stringify(
        payload,
      );

    try {
      if (activeWaiterOrder) {
        const key =
          `additional-${activeWaiterOrder.id}`;

        const submissionId =
          getSubmissionId(
            key,
            signature,
          );

        await appendWaiterOrder(
          token,
          activeWaiterOrder.id,
          submissionId,
          payload,
        );

        window.sessionStorage
          .removeItem(
            submissionKey(
              key,
            ),
          );

        setNotice(
          'Additional items added to the existing order.',
        );
      } else {
        const key =
          `first-${selectedTable.table.id}`;

        const clientOrderId =
          getSubmissionId(
            key,
            signature,
          );

        await createWaiterOrder(
          token,
          selectedTable.table.id,
          clientOrderId,
          payload,
        );

        window.sessionStorage
          .removeItem(
            submissionKey(
              key,
            ),
          );

        setNotice(
          'Order created successfully.',
        );
      }

      setCart(
        [],
      );

      setCartOpen(
        false,
      );

      await Promise.all([
        refreshSelectedTable(),
        loadTables(),
      ]);

      setOrdersOpen(
        true,
      );
    } catch (
    submitError
    ) {
      setError(
        errorMessage(
          submitError,
        ),
      );
    } finally {
      setSubmitting(
        false,
      );
    }
  }

  async function handleRequestBill(): Promise<void> {
    if (
      !selectedTable
      || requestingBill
    ) {
      return;
    }

    setRequestingBill(
      true,
    );

    setError(
      null,
    );

    setNotice(
      null,
    );

    try {
      await requestTableBill(
        token,
        selectedTable.table.id,
      );

      setNotice(
        'Bill requested successfully.',
      );

      await Promise.all([
        refreshSelectedTable(),
        loadTables(),
      ]);
    } catch (
    requestError
    ) {
      setError(
        errorMessage(
          requestError,
        ),
      );
    } finally {
      setRequestingBill(
        false,
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Table List
  |--------------------------------------------------------------------------
  */

  if (!selectedTable) {
    return (
      <main className="waiter-page">
        <header className="app-header">
          <div>
            <span className="header-eyebrow">
              WAITER OPERATIONS
            </span>

            <h1>
              Tables
            </h1>
          </div>

          <div className="header-user">
            <div>
              <strong>
                {user.name}
              </strong>

              <span>
                {
                  user.role?.name
                  ?? user.role?.code
                  ?? 'Staff'
                }
              </span>
            </div>

            <button
              type="button"
              onClick={
                () => {
                  void onLogout();
                }
              }
            >
              Logout
            </button>
          </div>
        </header>

        <section className="table-toolbar">
          <div className="search-field">
            <span>
              ⌕
            </span>

            <input
              type="search"
              value={
                tableSearch
              }
              onChange={
                (
                  event,
                ) => {
                  setTableSearch(
                    event.target.value,
                  );
                }
              }
              placeholder="Search tables..."
            />
          </div>

          <button
            type="button"
            className="refresh-button"
            onClick={
              () => {
                void loadTables();
              }
            }
          >
            Refresh
          </button>
        </section>

        {
          error
            ? (
              <Notice
                type="error"
                message={
                  error
                }
                onClose={
                  () => {
                    setError(
                      null,
                    );
                  }
                }
              />
            )
            : null
        }

        <section className="table-content">
          {
            tablesLoading
              ? (
                <div className="loading-block">
                  Loading tables...
                </div>
              )
              : filteredTables.length === 0
                ? (
                  <div className="loading-block">
                    No tables found.
                  </div>
                )
                : (
                  <div className="tables-grid">
                    {
                      filteredTables.map(
                        (
                          table,
                        ) => {
                          const session =
                            table.current_session;

                          const billRequested =
                            session
                              ?.bill_requested
                            ?? false;

                          const statusClass =
                            billRequested
                              ? 'bill-requested'
                              : table.status
                                .toLowerCase();

                          return (
                            <button
                              type="button"
                              key={
                                table.id
                              }
                              className={
                                `table-card ${statusClass}`
                              }
                              onClick={
                                () => {
                                  void openTable(
                                    table.id,
                                  );
                                }
                              }
                            >
                              <div className="table-card-top">
                                <span>
                                  TABLE
                                </span>

                                <strong>
                                  {
                                    table.table_number
                                  }
                                </strong>
                              </div>

                              <h2>
                                {table.name}
                              </h2>

                              {
                                table.area
                                  ? (
                                    <p>
                                      {
                                        table.area
                                      }
                                    </p>
                                  )
                                  : null
                              }

                              <div className="table-card-status">
                                {
                                  billRequested
                                    ? 'BILL REQUESTED'
                                    : table.status
                                }
                              </div>

                              {
                                session
                                  ? (
                                    <div className="table-card-total">
                                      <span>
                                        Current Total
                                      </span>

                                      <strong>
                                        {
                                          money(
                                            session.current_total,
                                          )
                                        }
                                      </strong>
                                    </div>
                                  )
                                  : (
                                    <div className="table-card-total">
                                      <span>
                                        Capacity
                                      </span>

                                      <strong>
                                        {
                                          table.capacity
                                        } Guests
                                      </strong>
                                    </div>
                                  )
                              }
                            </button>
                          );
                        },
                      )
                    }
                  </div>
                )
          }
        </section>

        {
          detailLoading
            ? (
              <div className="fullscreen-loader">
                Loading table...
              </div>
            )
            : null
        }
      </main>
    );
  }

  const currentSession =
    selectedTable
      .table
      .current_session;

  return (
    <main className="waiter-page">
      <header className="table-header">
        <button
          type="button"
          className="back-button"
          onClick={
            () => {
              setSelectedTable(
                null,
              );

              setCart(
                [],
              );

              setCartOpen(
                false,
              );

              setOrdersOpen(
                false,
              );

              setMenuSearch(
                '',
              );

              setCategoryId(
                'all',
              );

              setError(
                null,
              );

              setNotice(
                null,
              );

              void loadTables();
            }
          }
        >
          ←
        </button>

        <div className="table-header-title">
          <span>
            TABLE {
              selectedTable
                .table
                .table_number
            }
          </span>

          <h1>
            {
              selectedTable
                .table
                .name
            }
          </h1>
        </div>

        <div className="table-running-total">
          <span>
            Total
          </span>

          <strong>
            {
              money(
                currentSession
                  ?.current_total
                ?? 0,
              )
            }
          </strong>
        </div>
      </header>

      {
        currentSession
          ?.bill_requested
          ? (
            <div className="bill-banner">
              <strong>
                Bill Requested
              </strong>

              <span>
                Cashier will be notified
                to prepare the bill.
              </span>
            </div>
          )
          : null
      }

      {
        error
          ? (
            <Notice
              type="error"
              message={
                error
              }
              onClose={
                () => {
                  setError(
                    null,
                  );
                }
              }
            />
          )
          : null
      }

      {
        notice
          ? (
            <Notice
              type="success"
              message={
                notice
              }
              onClose={
                () => {
                  setNotice(
                    null,
                  );
                }
              }
            />
          )
          : null
      }

      <section className="table-actions">
        <button
          type="button"
          onClick={
            () => {
              setOrdersOpen(
                true,
              );
            }
          }
        >
          <span>
            View Table Orders
          </span>

          <strong>
            {
              selectedTable
                .orders
                .length
            }
          </strong>
        </button>

        <button
          type="button"
          className="bill-button"
          disabled={
            selectedTable.orders.length
            === 0
            ||
            Boolean(
              currentSession
                ?.bill_requested,
            )
            ||
            requestingBill
          }
          onClick={
            () => {
              void handleRequestBill();
            }
          }
        >
          {
            currentSession
              ?.bill_requested
              ? 'Bill Requested'
              : requestingBill
                ? 'Requesting...'
                : 'Request Bill'
          }
        </button>
      </section>

      <section className="menu-toolbar">
        <div className="search-field">
          <span>
            ⌕
          </span>

          <input
            type="search"
            value={
              menuSearch
            }
            onChange={
              (
                event,
              ) => {
                setMenuSearch(
                  event.target.value,
                );
              }
            }
            placeholder="Search food or drinks..."
          />
        </div>

        <div className="category-strip">
          <button
            type="button"
            className={
              categoryId === 'all'
                ? 'active'
                : ''
            }
            onClick={
              () => {
                setCategoryId(
                  'all',
                );
              }
            }
          >
            All
          </button>

          {
            menu.map(
              (
                category,
              ) => (
                <button
                  type="button"
                  key={
                    category.id
                  }
                  className={
                    categoryId
                      === category.id
                      ? 'active'
                      : ''
                  }
                  onClick={
                    () => {
                      setCategoryId(
                        category.id,
                      );
                    }
                  }
                >
                  {
                    category.name
                  }
                </button>
              ),
            )
          }
        </div>
      </section>

      <section className="menu-sections">
        {
          filteredMenu.length === 0
            ? (
              <div className="loading-block">
                No menu items found.
              </div>
            )
            : filteredMenu.map(
              (
                category,
              ) => (
                <section
                  key={
                    category.id
                  }
                  className="menu-category"
                >
                  <div className="category-heading">
                    <h2>
                      {
                        category.name
                      }
                    </h2>

                    <span>
                      {
                        category.items.length
                      } items
                    </span>
                  </div>

                  <div className="menu-grid">
                    {
                      category.items.map(
                        (
                          item,
                        ) => (
                          <article
                            key={
                              item.id
                            }
                            className="menu-item"
                          >
                            <div className="menu-item-image">
                              {
                                item.photo_url
                                  ? (
                                    <img
                                      src={
                                        item.photo_url
                                      }
                                      alt={
                                        item.name
                                      }
                                    />
                                  )
                                  : (
                                    <div>
                                      🍽
                                    </div>
                                  )
                              }
                            </div>

                            <div className="menu-item-info">
                              <div>
                                <h3>
                                  {
                                    item.name
                                  }
                                </h3>

                                {
                                  item.description
                                    ? (
                                      <p>
                                        {
                                          item.description
                                        }
                                      </p>
                                    )
                                    : null
                                }
                              </div>

                              <div className="menu-item-bottom">
                                <strong>
                                  {
                                    item.has_variants
                                      &&
                                      item.variants.length
                                      > 0
                                      ? `From ${money(
                                        Math.min(
                                          ...item.variants
                                            .map(
                                              (
                                                variant,
                                              ) =>
                                                variant.price,
                                            ),
                                        ),
                                      )}`
                                      : money(
                                        item.price,
                                      )
                                  }
                                </strong>

                                <button
                                  type="button"
                                  onClick={
                                    () => {
                                      configureItem(
                                        item,
                                      );
                                    }
                                  }
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </article>
                        ),
                      )
                    }
                  </div>
                </section>
              ),
            )
        }
      </section>

      {
        cart.length > 0
          ? (
            <div className="floating-cart">
              <button
                type="button"
                onClick={
                  () => {
                    setCartOpen(
                      true,
                    );
                  }
                }
              >
                <span className="cart-badge">
                  {
                    cartCount
                  }
                </span>

                <span>
                  View Cart
                </span>

                <strong>
                  {
                    money(
                      cartTotal,
                    )
                  }
                </strong>
              </button>
            </div>
          )
          : null
      }

      {
        selectedItem
          ? (
            <div className="modal-backdrop">
              <section className="item-modal">
                <ModalHandle />

                <header className="modal-heading">
                  <div>
                    <span>
                      CUSTOMIZE
                    </span>

                    <h2>
                      {
                        selectedItem.name
                      }
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={
                      closeConfiguration
                    }
                  >
                    ×
                  </button>
                </header>

                <div className="modal-scroll">
                  {
                    selectedItem.has_variants
                      ? (
                        <section className="option-section">
                          <div className="option-heading">
                            <h3>
                              Variant
                            </h3>

                            <span>
                              Required
                            </span>
                          </div>

                          <div className="option-list">
                            {
                              selectedItem.variants.map(
                                (
                                  variant,
                                ) => (
                                  <label
                                    key={
                                      variant.id
                                    }
                                    className={
                                      variantId
                                        === variant.id
                                        ? 'option-row selected'
                                        : 'option-row'
                                    }
                                  >
                                    <input
                                      type="radio"
                                      name="menu-variant"
                                      checked={
                                        variantId
                                        === variant.id
                                      }
                                      onChange={
                                        () => {
                                          setVariantId(
                                            variant.id,
                                          );
                                        }
                                      }
                                    />

                                    <span>
                                      {
                                        variant.name
                                      }
                                    </span>

                                    <strong>
                                      {
                                        money(
                                          variant.price,
                                        )
                                      }
                                    </strong>
                                  </label>
                                ),
                              )
                            }
                          </div>
                        </section>
                      )
                      : null
                  }

                  {
                    selectedItem.addons.length
                      > 0
                      ? (
                        <section className="option-section">
                          <div className="option-heading">
                            <h3>
                              Add-ons
                            </h3>

                            <span>
                              Optional
                            </span>
                          </div>

                          <div className="addon-list">
                            {
                              selectedItem.addons.map(
                                (
                                  addon,
                                ) => {
                                  const quantity =
                                    addonQuantities[
                                    addon.id
                                    ]
                                    ?? 0;

                                  return (
                                    <div
                                      key={
                                        addon.id
                                      }
                                      className={
                                        quantity > 0
                                          ? 'addon-row selected'
                                          : 'addon-row'
                                      }
                                    >
                                      <button
                                        type="button"
                                        className="addon-name-button"
                                        onClick={
                                          () => {
                                            toggleAddon(
                                              addon,
                                            );
                                          }
                                        }
                                      >
                                        <span className="check">
                                          {
                                            quantity > 0
                                              ? '✓'
                                              : ''
                                          }
                                        </span>

                                        <div>
                                          <strong>
                                            {
                                              addon.name
                                            }
                                          </strong>

                                          <small>
                                            + {
                                              money(
                                                addon.price,
                                              )
                                            }
                                          </small>
                                        </div>
                                      </button>

                                      {
                                        quantity > 0
                                          ? (
                                            <div className="mini-stepper">
                                              <button
                                                type="button"
                                                onClick={
                                                  () => {
                                                    changeAddonQuantity(
                                                      addon.id,
                                                      -1,
                                                    );
                                                  }
                                                }
                                              >
                                                −
                                              </button>

                                              <span>
                                                {
                                                  quantity
                                                }
                                              </span>

                                              <button
                                                type="button"
                                                onClick={
                                                  () => {
                                                    changeAddonQuantity(
                                                      addon.id,
                                                      1,
                                                    );
                                                  }
                                                }
                                              >
                                                +
                                              </button>
                                            </div>
                                          )
                                          : null
                                      }
                                    </div>
                                  );
                                },
                              )
                            }
                          </div>
                        </section>
                      )
                      : null
                  }

                  <section className="option-section">
                    <div className="option-heading">
                      <h3>
                        Notes
                      </h3>

                      <span>
                        Optional
                      </span>
                    </div>

                    <textarea
                      value={
                        itemNotes
                      }
                      onChange={
                        (
                          event,
                        ) => {
                          setItemNotes(
                            event.target.value,
                          );
                        }
                      }
                      placeholder="No onion, less spicy..."
                      maxLength={
                        1000
                      }
                    />
                  </section>
                </div>

                <footer className="item-modal-footer">
                  <div className="quantity-stepper">
                    <button
                      type="button"
                      onClick={
                        () => {
                          setItemQuantity(
                            (
                              current,
                            ) =>
                              Math.max(
                                1,
                                current - 1,
                              ),
                          );
                        }
                      }
                    >
                      −
                    </button>

                    <strong>
                      {
                        itemQuantity
                      }
                    </strong>

                    <button
                      type="button"
                      onClick={
                        () => {
                          setItemQuantity(
                            (
                              current,
                            ) =>
                              Math.min(
                                20,
                                current + 1,
                              ),
                          );
                        }
                      }
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    className="primary-action"
                    onClick={
                      addConfiguredItem
                    }
                  >
                    <span>
                      Add to Cart
                    </span>

                    <strong>
                      {
                        money(
                          configurationTotal,
                        )
                      }
                    </strong>
                  </button>
                </footer>
              </section>
            </div>
          )
          : null
      }

      {
        cartOpen
          ? (
            <div className="modal-backdrop">
              <section className="cart-sheet">
                <ModalHandle />

                <header className="modal-heading">
                  <div>
                    <span>
                      {
                        activeWaiterOrder
                          ? 'ADDITIONAL ORDER'
                          : 'NEW ORDER'
                      }
                    </span>

                    <h2>
                      Order Cart
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={
                      () => {
                        setCartOpen(
                          false,
                        );
                      }
                    }
                  >
                    ×
                  </button>
                </header>

                <div className="modal-scroll cart-lines">
                  {
                    cart.length === 0
                      ? (
                        <div className="empty-orders">
                          Your cart is empty.
                        </div>
                      )
                      : cart.map(
                        (
                          line,
                        ) => (
                          <article
                            key={
                              line.local_id
                            }
                            className="cart-line"
                          >
                            <div className="cart-line-top">
                              <div>
                                <strong>
                                  {
                                    line.quantity
                                  } × {
                                    line.name
                                  }
                                </strong>

                                {
                                  line.variant_name
                                    ? (
                                      <span>
                                        {
                                          line.variant_name
                                        }
                                      </span>
                                    )
                                    : null
                                }
                              </div>

                              <strong>
                                {
                                  money(
                                    line.display_total,
                                  )
                                }
                              </strong>
                            </div>

                            {
                              line.addons.length
                                > 0
                                ? (
                                  <div className="cart-line-addons">
                                    {
                                      line.addons.map(
                                        (
                                          addon,
                                        ) => (
                                          <span
                                            key={
                                              addon.addon_id
                                            }
                                          >
                                            + {
                                              addon.name
                                            }

                                            {
                                              addon.quantity > 1
                                                ? ` ×${addon.quantity}`
                                                : ''
                                            }
                                          </span>
                                        ),
                                      )
                                    }
                                  </div>
                                )
                                : null
                            }

                            {
                              line.special_notes
                                ? (
                                  <p>
                                    {
                                      line.special_notes
                                    }
                                  </p>
                                )
                                : null
                            }

                            <button
                              type="button"
                              className="remove-line"
                              onClick={
                                () => {
                                  removeCartLine(
                                    line.local_id,
                                  );
                                }
                              }
                            >
                              Remove
                            </button>
                          </article>
                        ),
                      )
                  }
                </div>

                <footer className="checkout-footer">
                  <div className="checkout-total">
                    <span>
                      New Items Total
                    </span>

                    <strong>
                      {
                        money(
                          cartTotal,
                        )
                      }
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="primary-action submit-order"
                    disabled={
                      submitting
                      || cart.length === 0
                    }
                    onClick={
                      () => {
                        void submitCart();
                      }
                    }
                  >
                    {
                      submitting
                        ? 'Saving Order...'
                        : activeWaiterOrder
                          ? 'Submit Additional Items'
                          : 'Create Order'
                    }
                  </button>
                </footer>
              </section>
            </div>
          )
          : null
      }

      {
        ordersOpen
          ? (
            <div className="modal-backdrop">
              <section className="orders-sheet">
                <ModalHandle />

                <header className="modal-heading">
                  <div>
                    <span>
                      TABLE {
                        selectedTable
                          .table
                          .table_number
                      }
                    </span>

                    <h2>
                      Table Orders
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={
                      () => {
                        setOrdersOpen(
                          false,
                        );
                      }
                    }
                  >
                    ×
                  </button>
                </header>

                <div className="modal-scroll">
                  {
                    selectedTable.orders.length
                      === 0
                      ? (
                        <div className="empty-orders">
                          No orders have been
                          created for this table.
                        </div>
                      )
                      : selectedTable.orders.map(
                        (
                          order,
                        ) => (
                          <article
                            key={
                              order.id
                            }
                            className="order-card"
                          >
                            <div className="order-card-header">
                              <div>
                                <strong>
                                  {
                                    order.order_number
                                  }
                                </strong>

                                <span>
                                  {
                                    order.order_source
                                      === 'QR_CUSTOMER'
                                      ? 'Customer QR'
                                      : order.order_source
                                        === 'WAITER'
                                        ? 'Waiter'
                                        : order.order_source
                                  }
                                </span>
                              </div>

                              <div>
                                <span className="order-status">
                                  {
                                    order.status
                                  }
                                </span>

                                <strong>
                                  {
                                    money(
                                      order.grand_total,
                                    )
                                  }
                                </strong>
                              </div>
                            </div>

                            <div className="ordered-items">
                              {
                                order.items.map(
                                  (
                                    item,
                                  ) => (
                                    <div
                                      key={
                                        item.id
                                      }
                                      className="ordered-item"
                                    >
                                      <div>
                                        <strong>
                                          {
                                            item.quantity
                                          } × {
                                            item.name
                                          }
                                        </strong>

                                        {
                                          item.variant
                                            ? (
                                              <span>
                                                {
                                                  item.variant
                                                }
                                              </span>
                                            )
                                            : null
                                        }

                                        {
                                          item.addons.length
                                            > 0
                                            ? (
                                              <small>
                                                {
                                                  item.addons
                                                    .map(
                                                      (
                                                        addon,
                                                      ) =>
                                                        `+ ${addon.name}${addon.quantity > 1
                                                          ? ` ×${addon.quantity}`
                                                          : ''
                                                        }`,
                                                    )
                                                    .join(
                                                      ', ',
                                                    )
                                                }
                                              </small>
                                            )
                                            : null
                                        }

                                        {
                                          item.special_notes
                                            ? (
                                              <small>
                                                Note: {
                                                  item.special_notes
                                                }
                                              </small>
                                            )
                                            : null
                                        }

                                        <small>
                                          {
                                            item.kitchen_status
                                              .replaceAll(
                                                '_',
                                                ' ',
                                              )
                                          }
                                        </small>
                                      </div>

                                      <strong>
                                        {
                                          money(
                                            item.line_total,
                                          )
                                        }
                                      </strong>
                                    </div>
                                  ),
                                )
                              }
                            </div>
                          </article>
                        ),
                      )
                  }
                </div>

                <footer className="orders-total">
                  <span>
                    Table Total
                  </span>

                  <strong>
                    {
                      money(
                        currentSession
                          ?.current_total
                        ?? 0,
                      )
                    }
                  </strong>
                </footer>
              </section>
            </div>
          )
          : null
      }

      {
        detailLoading
          ? (
            <div className="fullscreen-loader">
              Loading table...
            </div>
          )
          : null
      }
    </main>
  );
}

function ModalHandle() {
  return (
    <div className="modal-handle" />
  );
}

function Notice(
  {
    type,
    message,
    onClose,
  }: {
    type:
    'error'
    | 'success';

    message: string;

    onClose: () => void;
  },
) {
  useEffect(
    () => {
      const timer =
        window.setTimeout(
          () => {
            onClose();
          },
          4000,
        );

      return () => {
        window.clearTimeout(
          timer,
        );
      };
    },
    [
      message,
      onClose,
    ],
  );

  return (
    <div
      className={
        `notice ${type}`
      }
      role={
        type === 'error'
          ? 'alert'
          : 'status'
      }
    >
      <span>
        {
          type === 'success'
            ? '✓'
            : '!'
        }
      </span>

      <p>
        {message}
      </p>

      <button
        type="button"
        aria-label="Close notification"
        onClick={
          onClose
        }
      >
        ×
      </button>
    </div>
  );
}