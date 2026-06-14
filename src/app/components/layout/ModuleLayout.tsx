import { Outlet, NavLink, useLocation, useNavigate } from "react-router";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  LayoutDashboard,
  BookOpenCheck,
  UserCheck,
  Settings as SettingsIcon,
  ShieldAlert,
  LogOut,
  Bell,
  Search,
  MessageSquare,
  DollarSign,
  Package,
  Home,
  Building2,
  BarChart,
  Bot,
  Wallet,
  TrendingUp,
  TrendingDown,
  Scale,
  Coffee,
  Utensils,
  Wind,
  Wrench,
  Fuel,
  BedDouble,
  Database,
  Users,
  Crown,
  ChevronDown,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useAppContext } from "../../context/AppContext";

type NavItem = {
  path: string;
  label: string;
  icon: typeof CalendarDays;
};

const RESERVATION_ITEMS = [
  { path: "/app/reservations/calendar", label: "Calendar", icon: CalendarDays },
  { path: "/app/reservations/bookings", label: "Bookings", icon: BookOpenCheck },
  { path: "/app/reservations/payments", label: "Booking Payments", icon: Wallet },
  { path: "/app/reservations/configuration", label: "Configuration", icon: SettingsIcon },
  { path: "/app/reservations/policies", label: "Policies", icon: ShieldAlert },
  { path: "/app/reservations/ota-sync", label: "OTA Sync", icon: Database },
  { path: "/app/reservations/notifications", label: "Notifications", icon: Bell },
];

const ACCOUNTANCY_ITEMS = [
  { path: "/app/accountancy/overview", label: "Overview", icon: BarChart },
  { path: "/app/accountancy/revenues", label: "Revenues", icon: TrendingUp },
  { path: "/app/accountancy/expenses", label: "Expenses", icon: TrendingDown },
  { path: "/app/accountancy/profit-loss", label: "Profit & Loss (P&L)", icon: BarChart },
  { path: "/app/accountancy/assets", label: "Assets", icon: Wallet },
  { path: "/app/accountancy/liabilities", label: "Liabilities", icon: DollarSign },
  { path: "/app/accountancy/balance", label: "Balance", icon: Scale },
  { path: "/app/accountancy/genai-assistant", label: "GenAI Assistant", icon: Bot },
  { path: "/app/accountancy/notifications", label: "Notifications", icon: Bell },
];

const SUPPLY_ITEMS = [
  { path: "/app/supply-requests/beverage", label: "Beverage", icon: Coffee },
  { path: "/app/supply-requests/client-food", label: "Client Food", icon: Utensils },
  { path: "/app/supply-requests/staff-food", label: "Staff Food", icon: Users },
  { path: "/app/supply-requests/shishas", label: "Shishas", icon: Wind },
  { path: "/app/supply-requests/housekeeping", label: "Housekeeping", icon: BedDouble },
  { path: "/app/supply-requests/mechanical", label: "Mechanical", icon: Wrench },
  { path: "/app/supply-requests/fuel", label: "Fuel & Petrol", icon: Fuel },
  { path: "/app/supply-requests/notifications", label: "Notifications", icon: Bell },
];

const CHECKIN_ITEMS = [
  { path: "/app/check-in/form", label: "Check-in Form", icon: UserCheck },
  { path: "/app/check-in/database", label: "Database", icon: Database },
  { path: "/app/check-in/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/app/check-in/notifications", label: "Notifications", icon: Bell },
];

const ADMIN_ITEMS = [
  { path: "/app/admin/companies", label: "Company Scope", icon: Building2 },
  { path: "/app/admin/users", label: "Manage Users", icon: Users },
  { path: "/app/admin/notifications", label: "Notifications", icon: Bell },
];

const OWNER_ITEMS = [
  { path: "/app/owner/tenants", label: "Tenant Companies", icon: Crown },
  { path: "/app/owner/notifications", label: "Notifications", icon: Bell },
];

export function ModuleLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { properties, selectedPropertyId, currentUser, logout } = useAppContext();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activeProperty = properties.find(p => p.id === selectedPropertyId) || properties[0];

  useEffect(() => {
    if (!currentUser) navigate("/login");
  }, [currentUser, navigate]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  let navItems: NavItem[] = [];
  let moduleTitle = "Module";

  if (location.pathname.startsWith("/app/reservations")) {
    navItems = RESERVATION_ITEMS;
    moduleTitle = "Reservations";
  } else if (location.pathname.startsWith("/app/accountancy")) {
    navItems = ACCOUNTANCY_ITEMS;
    moduleTitle = "Accountancy";
  } else if (location.pathname.startsWith("/app/supply-requests")) {
    navItems = SUPPLY_ITEMS;
    moduleTitle = "Supply Requests";
  } else if (location.pathname.startsWith("/app/check-in")) {
    navItems = CHECKIN_ITEMS;
    moduleTitle = "Check-in";
  } else if (location.pathname.startsWith("/app/admin")) {
    navItems = ADMIN_ITEMS;
    moduleTitle = "Admin Platform";
  } else if (location.pathname.startsWith("/app/owner")) {
    navItems = OWNER_ITEMS;
    moduleTitle = "Owner Console";
  }

  const hasCurrentModuleAccess =
    !currentUser ||
    moduleTitle === "Module" ||
    currentUser.ownerConsoleAccess ||
    currentUser.permissions.some(permission => permission.module === moduleTitle && permission.access !== "none");

  const hasSectionAccess = (section: string) =>
    !currentUser ||
    currentUser.ownerConsoleAccess ||
    currentUser.permissions.some(permission => permission.module === moduleTitle && permission.section === section && permission.access !== "none");

  const visibleNavItems = navItems.filter(item => hasSectionAccess(item.label));

  const quickLinks = [
    { label: "Home", path: "/app", module: "Module" },
    { label: "Reservations", path: "/app/reservations/calendar", module: "Reservations" },
    { label: "Accountancy", path: "/app/accountancy/overview", module: "Accountancy" },
    { label: "Supply Requests", path: "/app/supply-requests/beverage", module: "Supply Requests" },
    { label: "Check-in", path: "/app/check-in/form", module: "Check-in" },
    { label: "Admin Platform", path: "/app/admin/companies", module: "Admin Platform" },
    { label: "Owner Console", path: "/app/owner/tenants", module: "Owner Console" },
  ].filter(item =>
    item.module === "Module" ||
    currentUser?.ownerConsoleAccess ||
    currentUser?.permissions.some(permission => permission.module === item.module && permission.access !== "none")
  );

  useEffect(() => {
    if (currentUser && !hasCurrentModuleAccess) navigate("/app");
  }, [currentUser, hasCurrentModuleAccess, navigate]);

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-foreground">
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-card lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Section Menu</p>
              <h2 className="text-lg font-semibold">{moduleTitle}</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} aria-label="Close section menu">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="border-b border-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-secondary font-bold text-secondary-foreground">
                {(activeProperty?.name || "OS").substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{activeProperty?.name || "No property selected"}</p>
                <p className="truncate text-xs text-muted-foreground">{moduleTitle}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto p-4">
            <NavigationList items={visibleNavItems} collapsed={false} onNavigate={() => setMobileMenuOpen(false)} />
          </nav>
        </div>
      )}

      <aside className={`hidden border-r border-border bg-card transition-all duration-200 lg:flex lg:flex-col ${sidebarCollapsed ? "lg:w-20" : "lg:w-64"}`}>
        <div className="flex h-16 items-center gap-2 border-b border-border px-3">
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/50"
            onClick={() => navigate("/app")}
            title="Home"
          >
            <h1 className={`truncate font-bold text-primary ${sidebarCollapsed ? "text-lg" : "text-xl"}`}>
              {sidebarCollapsed ? "KO" : "KumbuOS"}
            </h1>
            {!sidebarCollapsed && <Home className="h-5 w-5 shrink-0 text-muted-foreground" />}
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(current => !current)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        <div className={`border-b border-border p-4 ${sidebarCollapsed ? "flex justify-center" : "flex items-center gap-3"}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary font-bold text-secondary-foreground">
            {(activeProperty?.name || "OS").substring(0, 2).toUpperCase()}
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{activeProperty?.name || "No property selected"}</p>
              <p className="truncate text-xs text-muted-foreground">{moduleTitle}</p>
            </div>
          )}
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          <NavigationList items={visibleNavItems} collapsed={sidebarCollapsed} />
        </nav>

        <div className="border-t border-border p-4">
          <Button variant="outline" className={`w-full gap-2 border-transparent text-destructive hover:bg-destructive/10 ${sidebarCollapsed ? "justify-center px-0" : "justify-start"}`} asChild>
            <NavLink to="/login" onClick={() => logout()} title="Log Out">
              <LogOut size={18} />
              {!sidebarCollapsed && "Log Out"}
            </NavLink>
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Open section menu">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="relative hidden w-full max-w-xl sm:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="w-full border-transparent bg-muted/50 pl-9 focus:bg-background"
              />
            </div>
          </div>
          <div className="ml-4 flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={20} />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
            </Button>
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
              <MessageSquare size={20} />
            </Button>
            <div className="mx-2 hidden h-8 w-px bg-border sm:block" />
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
                onClick={() => setUserMenuOpen(current => !current)}
              >
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium">{currentUser?.name || "User"}</p>
                  <p className="text-xs text-muted-foreground">{currentUser?.role || "Team Member"}</p>
                </div>
                <Avatar>
                  <AvatarFallback>{(currentUser?.name || "User").substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-md border border-border bg-card shadow-xl">
                  <div className="border-b border-border p-3">
                    <p className="font-medium">{currentUser?.name || "User"}</p>
                    <p className="text-xs text-muted-foreground">{currentUser?.email}</p>
                  </div>
                  <div className="p-2">
                    {quickLinks.map(link => (
                      <button
                        key={link.path}
                        type="button"
                        className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setUserMenuOpen(false);
                          navigate(link.path);
                        }}
                      >
                        {link.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                        navigate("/login");
                      }}
                    >
                      <LogOut size={16} />
                      Log Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="relative flex-1 overflow-auto bg-background/50">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavigationList({
  items,
  collapsed,
  onNavigate,
}: {
  items: NavItem[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            title={item.label}
            onClick={onNavigate}
            className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              collapsed ? "justify-center" : ""
            } ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:bg-muted"
            }`}
          >
            <Icon size={18} />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        );
      })}
    </>
  );
}
