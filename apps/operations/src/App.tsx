import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import {
  AuthProvider,
} from './auth/AuthContext';

import {
  useAuth,
} from './auth/useAuth';

import DashboardPage
  from './dashboard/DashboardPage';

import ProtectedRoute
  from './auth/ProtectedRoute';

import OperationsLayout
  from './layouts/OperationsLayout';

import LoginPage
  from './pages/LoginPage';

import AccessDeniedPage
  from './pages/AccessDeniedPage';

import InventoryPage
  from './inventory/InventoryPage';

import RecipesPage from "./recipes/RecipesPage";

import SuppliersPage from "./suppliers/SuppliersPage";

import PurchasesPage from "./purchases/PurchasesPage";

import IngredientsPage
  from './ingredients/IngredientsPage';

import ModulePlaceholderPage
  from './pages/ModulePlaceholderPage';

import MenuManagementPage
  from './menu/MenuManagementPage';

import {
  defaultRouteForUser,
} from './navigation/navigation';

/*
|--------------------------------------------------------------------------
| Authenticated Home Redirect
|--------------------------------------------------------------------------
*/

function HomeRedirect() {
  const {
    user,
    loading,
  } =
    useAuth();

  if (
    loading
  ) {
    return (
      <main className="app-loading-screen">
        <div className="app-loading-spinner" />

        <strong>
          Loading Operations
        </strong>
      </main>
    );
  }

  if (
    !user
  ) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return (
    <Navigate
      to={
        defaultRouteForUser(
          user,
        )
      }
      replace
    />
  );
}

/*
|--------------------------------------------------------------------------
| Application
|--------------------------------------------------------------------------
*/

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/*
                  |--------------------------------------------------------------------------
                  | Public
                  |--------------------------------------------------------------------------
                  */}

          <Route
            path="/login"
            element={
              <LoginPage />
            }
          />

          <Route
            path="/access-denied"
            element={
              <AccessDeniedPage />
            }
          />

          {/*
                  |--------------------------------------------------------------------------
                  | Protected Operations
                  |--------------------------------------------------------------------------
                  */}

          <Route
            element={
              <ProtectedRoute />
            }
          >
            <Route
              element={
                <OperationsLayout />
              }
            >
              <Route
                path="/dashboard"
                element={
                  <DashboardPage />
                }
              />

              <Route
                path="/tables"
                element={
                  <ModulePlaceholderPage
                    eyebrow="RESTAURANT"
                    title="Tables"
                    description="Manage restaurant tables, sessions, capacity and QR ordering."
                  />
                }
              />

              <Route
                path="/orders"
                element={
                  <ModulePlaceholderPage
                    eyebrow="RESTAURANT"
                    title="Orders"
                    description="Review waiter, customer and operational restaurant orders."
                  />
                }
              />

              <Route
                path="/menu"
                element={
                  <MenuManagementPage />
                }
              />

              <Route
                path="/inventory"
                element={
                  <InventoryPage />
                }
              />

              <Route
                path="/ingredients"
                element={
                  <IngredientsPage />
                }
              />

              <Route
                path="/stock-adjustments"
                element={
                  <ModulePlaceholderPage
                    eyebrow="INVENTORY"
                    title="Stock Adjustments"
                    description="Record and review controlled physical inventory corrections."
                  />
                }
              />

              <Route
                path="/wastage"
                element={
                  <ModulePlaceholderPage
                    eyebrow="INVENTORY"
                    title="Wastage"
                    description="Record spoiled, damaged and other ingredient wastage."
                  />
                }
              />

              <Route
                path="/recipes"
                element={
                  <RecipesPage />
                }
              />

              <Route
                path="/suppliers"
                element={
                  <SuppliersPage />
                }
              />

              <Route
                path="/purchases"
                element={
                  <PurchasesPage />
                }
              />

              <Route
                path="/supplier-payments"
                element={
                  <ModulePlaceholderPage
                    eyebrow="PURCHASING"
                    title="Supplier Payments"
                    description="Review supplier balances and record partial or multiple payments."
                  />
                }
              />

              <Route
                path="/expenses"
                element={
                  <ModulePlaceholderPage
                    eyebrow="FINANCE"
                    title="Expenses"
                    description="Record and manage restaurant operational expenses."
                  />
                }
              />

              <Route
                path="/business-day"
                element={
                  <ModulePlaceholderPage
                    eyebrow="FINANCE"
                    title="Business Day"
                    description="Review restaurant day status and controlled day closing."
                  />
                }
              />

              <Route
                path="/reports"
                element={
                  <ModulePlaceholderPage
                    eyebrow="REPORTING"
                    title="Reports"
                    description="Sales, profit, inventory, expenses, purchases and operational reporting."
                  />
                }
              />

              <Route
                path="/users"
                element={
                  <ModulePlaceholderPage
                    eyebrow="ADMINISTRATION"
                    title="Users & Roles"
                    description="Manage staff accounts, roles, status and active sessions."
                  />
                }
              />

              <Route
                path="/restaurant-settings"
                element={
                  <ModulePlaceholderPage
                    eyebrow="ADMINISTRATION"
                    title="Restaurant Settings"
                    description="Manage restaurant identity, taxation, numbering and operational configuration."
                  />
                }
              />

              <Route
                path="/website"
                element={
                  <ModulePlaceholderPage
                    eyebrow="ADMINISTRATION"
                    title="Website & Reviews"
                    description="Manage website content, gallery and customer review moderation."
                  />
                }
              />

              <Route
                path="/audit-logs"
                element={
                  <ModulePlaceholderPage
                    eyebrow="ADMINISTRATION"
                    title="Audit Logs"
                    description="Review sensitive administrative and financial activity history."
                  />
                }
              />
            </Route>
          </Route>

          {/*
                  |--------------------------------------------------------------------------
                  | Root / Unknown
                  |--------------------------------------------------------------------------
                  */}

          <Route
            path="/"
            element={
              <HomeRedirect />
            }
          />

          <Route
            path="*"
            element={
              <HomeRedirect />
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}