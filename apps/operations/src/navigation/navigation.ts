import type { AuthUser } from "../types/auth";

export type NavigationIcon =
  | "dashboard"
  | "tables"
  | "orders"
  | "menu"
  | "inventory"
  | "ingredients"
  | "recipes"
  | "suppliers"
  | "purchases"
  | "payments"
  | "wastage"
  | "adjustments"
  | "expenses"
  | "business-day"
  | "reports"
  | "users"
  | "settings"
  | "website"
  | "audit";

export interface NavigationItem {
  label: string;

  path: string;

  icon: NavigationIcon;

  permission?: string;

  anyPermissions?: string[];
}

export interface NavigationSection {
  title: string;

  items: NavigationItem[];
}

/*
|--------------------------------------------------------------------------
| Navigation Definition
|--------------------------------------------------------------------------
|
| This is deliberately permission-based.
|
| Laravel remains the final authorization authority.
|--------------------------------------------------------------------------
*/

export const operationsNavigation: NavigationSection[] = [
  {
    title: "Overview",

    items: [
      {
        label: "Dashboard",

        path: "/dashboard",

        icon: "dashboard",

        permission: "dashboard.view",
      },
    ],
  },

  {
    title: "Restaurant",

    items: [
      {
        label: "Tables",

        path: "/tables",

        icon: "tables",

        permission: "tables.view",
      },

      {
        label: "Orders",

        path: "/orders",

        icon: "orders",

        permission: "orders.view",
      },

      {
        label: "Menu",

        path: "/menu",

        icon: "menu",

        permission: "menu.view",
      },
    ],
  },

  {
    title: "Inventory",

    items: [
      {
        label: "Stock",

        path: "/inventory",

        icon: "inventory",

        permission: "inventory.view",
      },

      {
        label: "Ingredients",

        path: "/ingredients",

        icon: "ingredients",

        permission: "inventory.view",
      },

      {
        label: "Stock Adjustments",

        path: "/stock-adjustments",

        icon: "adjustments",

        permission: "inventory.adjust",
      },

      {
        label: "Wastage",

        path: "/wastage",

        icon: "wastage",

        permission: "wastage.view",
      },
    ],
  },

  {
    title: "Recipes & Costing",

    items: [
      {
        label: "Recipes",

        path: "/recipes",

        icon: "recipes",

        permission: "recipes.view",
      },
    ],
  },

  {
    title: "Purchasing",

    items: [
      {
        label: "Suppliers",

        path: "/suppliers",

        icon: "suppliers",

        permission: "suppliers.view",
      },

      {
        label: "Purchases",

        path: "/purchases",

        icon: "purchases",

        permission: "purchases.view",
      },

      {
        label: "Supplier Payments",

        path: "/supplier-payments",

        icon: "payments",

        anyPermissions: ["purchases.pay", "purchases.view"],
      },
    ],
  },

  {
    title: "Finance",

    items: [
      {
        label: "Expenses",

        path: "/expenses",

        icon: "expenses",

        permission: "expenses.view",
      },

      {
        label: "Business Day",

        path: "/business-day",

        icon: "business-day",

        permission: "business_day.view",
      },
    ],
  },

  {
    title: "Reporting",

    items: [
      {
        label: "Reports",

        path: "/reports",

        icon: "reports",

        permission: "reports.view",
      },
    ],
  },

  {
    title: "Administration",

    items: [
      {
        label: "Users & Roles",

        path: "/users",

        icon: "users",

        anyPermissions: ["users.view", "roles.view"],
      },

      {
        label: "Restaurant Settings",

        path: "/restaurant-settings",

        icon: "settings",

        permission: "restaurant.manage",
      },

      {
        label: "Website & Reviews",

        path: "/website",

        icon: "website",

        anyPermissions: ["website.manage", "reviews.moderate"],
      },

      {
        label: "Audit Logs",

        path: "/audit-logs",

        icon: "audit",

        permission: "audit.view",
      },
    ],
  },
];

/*
|--------------------------------------------------------------------------
| Visibility
|--------------------------------------------------------------------------
*/

function canViewNavigationItem(
  user: AuthUser,

  item: NavigationItem
): boolean {
  if (item.permission) {
    return user.permissions.includes(item.permission);
  }

  if (item.anyPermissions && item.anyPermissions.length > 0) {
    return item.anyPermissions.some((permission) =>
      user.permissions.includes(permission)
    );
  }

  return true;
}

export function navigationForUser(user: AuthUser): NavigationSection[] {
  return operationsNavigation
    .map((section) => ({
      ...section,

      items: section.items.filter((item) => canViewNavigationItem(user, item)),
    }))
    .filter((section) => section.items.length > 0);
}

/*
|--------------------------------------------------------------------------
| Default Route
|--------------------------------------------------------------------------
*/

export function defaultRouteForUser(user: AuthUser): string {
  const navigation = navigationForUser(user);

  return navigation[0]?.items[0]?.path ?? "/access-denied";
}
