import { createBrowserRouter, redirect } from "react-router";
import { Login } from "./pages/Login";
import { Mainpage } from "./pages/Mainpage";
import { ModuleLayout } from "./components/layout/ModuleLayout";

import { Calendar } from "./pages/Calendar";
import { Reservations } from "./pages/Reservations";
import { Settings } from "./pages/Settings";
import { BookingPayments } from "./pages/BookingPayments";
import { OtaSync } from "./pages/OtaSync";
import { ReservationPolicies } from "./pages/ReservationPolicies";

import { AccountancyOverview as Overview } from "./pages/accountancy/Overview";
import { AccountancyRevenues as Revenues } from "./pages/accountancy/Revenues";
import { AccountancyExpenses as Expenses } from "./pages/accountancy/Expenses";
import { AccountancyProfitLoss as ProfitLoss } from "./pages/accountancy/ProfitLoss";
import { AccountancyAssets as Assets } from "./pages/accountancy/Assets";
import { AccountancyLiabilities as Liabilities } from "./pages/accountancy/Liabilities";
import { AccountancyBalance as Balance } from "./pages/accountancy/Balance";
import { AccountancyGenAIAssistant as GenAIAssistant } from "./pages/accountancy/GenAIAssistant";

import { SupplyRequests } from "./pages/supply/SupplyRequests";

import { CheckIn } from "./pages/CheckIn";
import { CheckInDatabase as CheckInDatabase } from "./pages/checkin/Database";
import { CheckInDashboard as CheckInDashboard } from "./pages/checkin/Dashboard";

import { PlatformAdmin } from "./pages/PlatformAdmin";
import { Notifications } from "./pages/Notifications";
import { OwnerConsole } from "./pages/OwnerConsole";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/",
    loader: () => redirect("/login"),
  },
  {
    path: "/app",
    Component: Mainpage,
  },
  {
    path: "/app/calendar",
    loader: () => redirect("/app/reservations/calendar"),
  },
  {
    path: "/app/dashboard",
    loader: () => redirect("/app/accountancy/overview"),
  },
  {
    path: "/app/settings",
    loader: () => redirect("/app/reservations/configuration"),
  },
  {
    path: "/app/reservations",
    Component: ModuleLayout,
    children: [
      { index: true, loader: () => redirect("/app/reservations/calendar") },
      { path: "calendar", Component: Calendar },
      { path: "bookings", Component: Reservations },
      { path: "payments", Component: BookingPayments },
      { path: "configuration", Component: Settings },
      { path: "policies", Component: ReservationPolicies },
      { path: "ota-sync", Component: OtaSync },
      { path: "notifications", Component: Notifications },
    ],
  },
  {
    path: "/app/accountancy",
    Component: ModuleLayout,
    children: [
      { index: true, loader: () => redirect("/app/accountancy/overview") },
      { path: "overview", Component: Overview },
      { path: "revenues", Component: Revenues },
      { path: "expenses", Component: Expenses },
      { path: "profit-loss", Component: ProfitLoss },
      { path: "assets", Component: Assets },
      { path: "liabilities", Component: Liabilities },
      { path: "balance", Component: Balance },
      { path: "genai-assistant", Component: GenAIAssistant },
      { path: "notifications", Component: Notifications },
    ],
  },
  {
    path: "/app/supply-requests",
    Component: ModuleLayout,
    children: [
      { index: true, loader: () => redirect("/app/supply-requests/beverage") },
      { path: "notifications", Component: Notifications },
      { path: ":category", Component: SupplyRequests },
    ],
  },
  {
    path: "/app/check-in",
    Component: ModuleLayout,
    children: [
      { index: true, loader: () => redirect("/app/check-in/form") },
      { path: "form", Component: CheckIn },
      { path: "database", Component: CheckInDatabase },
      { path: "dashboard", Component: CheckInDashboard },
      { path: "notifications", Component: Notifications },
    ],
  },
  {
    path: "/app/admin",
    Component: ModuleLayout,
    children: [
      { index: true, loader: () => redirect("/app/admin/companies") },
      { path: "companies", Component: PlatformAdmin },
      { path: "properties", loader: () => redirect("/app/admin/companies") },
      { path: "users", Component: PlatformAdmin },
      { path: "notifications", Component: Notifications },
    ],
  },
  {
    path: "/app/owner",
    Component: ModuleLayout,
    children: [
      { index: true, loader: () => redirect("/app/owner/tenants") },
      { path: "tenants", Component: OwnerConsole },
      { path: "notifications", Component: Notifications },
    ],
  },
]);
