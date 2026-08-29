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

import OrdersPage
  from './orders/OrdersPage';

import InventoryPage
  from './inventory/InventoryPage';

import RecipesPage from "./recipes/RecipesPage";

import SuppliersPage from "./suppliers/SuppliersPage";

import PurchasesPage from "./purchases/PurchasesPage";

import ReportsPage
  from './reports/ReportsPage';

import UsersPage
  from './users/UsersPage';

import TablesPage
  from "./tables/TablesPage";

import StockAdjustmentsPage
  from "./stockAdjustments/StockAdjustmentsPage";

import BusinessDayPage
  from "./businessDay/BusinessDayPage";

import ExpensesPage
  from "./expenses/ExpensesPage";

import WastagePage
  from "./wastage/WastagePage";

import SupplierPaymentsPage
  from "./supplierPayments/SupplierPaymentsPage";

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
                  <TablesPage />
                }
              />

              <Route
                path="/orders"
                element={
                  <OrdersPage />
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
                  <StockAdjustmentsPage />
                }
              />

              <Route
                path="/wastage"
                element={
                  <WastagePage />
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
                  <SupplierPaymentsPage />
                }
              />
              <Route
                path="/expenses"
                element={
                  <ExpensesPage />
                }
              />

              <Route
                path="/business-day"
                element={
                  <BusinessDayPage />
                }
              />

              <Route
                path="/reports"
                element={
                  <ReportsPage />
                }
              />

              <Route
                path="/users"
                element={
                  <UsersPage />
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