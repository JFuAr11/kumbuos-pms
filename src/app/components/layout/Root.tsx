import { Outlet, NavLink, useLocation } from "react-router";
import {
  Bell,
  BookOpenCheck,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Search,
  Settings as SettingsIcon,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const navItems = [
  { path: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { path: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/app/reservations", label: "Reservations", icon: BookOpenCheck },
  { path: "/app/check-in", label: "Check-in", icon: UserCheck },
  { path: "/app/settings", label: "Configuration", icon: SettingsIcon },
  { path: "/app/admin", label: "Admin Platform", icon: ShieldAlert },
];

export function Root() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <h1 className="text-xl font-bold text-primary">KUMBUKUMBU</h1>
        </div>

        <div className="p-4 border-b border-border flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-secondary flex items-center justify-center text-secondary-foreground font-bold">
            OS
          </div>
          <div>
            <p className="text-sm font-medium">No property selected</p>
            <p className="text-xs text-muted-foreground">KumbuOS</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 flex flex-col gap-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);

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
            <NavLink to="/login">
              <LogOut size={18} />
              Log Out
            </NavLink>
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
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
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">User</p>
                <p className="text-xs text-muted-foreground">Team Member</p>
              </div>
              <Avatar>
                <AvatarFallback>US</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-background/50">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
