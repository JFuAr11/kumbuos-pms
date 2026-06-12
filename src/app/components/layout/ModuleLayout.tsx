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
  ChevronDown
} from "lucide-react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useAppContext } from "../../context/AppContext";

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
  
  const activeProperty = properties.find(p => p.id === selectedPropertyId) || properties[0];

  useEffect(() => {
    if (!currentUser) navigate("/login");
  }, [currentUser, navigate]);

  let navItems: any[] = [];
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
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center justify-between px-4 border-b border-border cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate("/app")}>
          <h1 className="text-xl font-bold text-primary truncate flex-1">KumbuOS</h1>
          <Home className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
        
        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center text-secondary-foreground font-bold shrink-0">
            {(activeProperty?.name || "OS").substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{activeProperty?.name || "No property selected"}</p>
            <p className="text-xs text-muted-foreground truncate">{moduleTitle}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-primary text-primary-foreground" 
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <Button variant="outline" className="w-full justify-start gap-2 text-destructive border-transparent hover:bg-destructive/10" asChild>
            <NavLink to="/login" onClick={() => logout()}>
              <LogOut size={18} />
              Log Out
            </NavLink>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
          <div className="flex-1 flex items-center gap-4 max-w-xl">
            <div className="relative w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search..." 
                className="pl-9 w-full bg-muted/50 border-transparent focus:bg-background"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 ml-4">
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={20} />
              <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
            </Button>
            <Button variant="ghost" size="icon">
              <MessageSquare size={20} />
            </Button>
            <div className="h-8 w-px bg-border mx-2" />
            <div className="relative">
              <button
                type="button"
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
                onClick={() => setUserMenuOpen(current => !current)}
              >
              <div className="text-right hidden sm:block">
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

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-background/50 relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
