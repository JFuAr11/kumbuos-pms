import { useNavigate } from "react-router";
import { useEffect } from "react";
import {
  CalendarDays,
  DollarSign,
  LogOut,
  Package,
  Crown,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useAppContext } from "../context/AppContext";

const primaryModuleStyle = "border-[#c98736] bg-[#2d2924] hover:bg-[#c98736]";
const secondaryPanelStyle = "border-[#c98736] bg-[#5b5143] hover:bg-[#463d33]";

export function Mainpage() {
  const navigate = useNavigate();
  const {
    companies,
    properties,
    selectedCompanyId,
    setSelectedCompanyId,
    selectedPropertyId,
    setSelectedPropertyId,
    currentUser,
    logout,
    canAccessOwnerConsole,
  } = useAppContext();
  const ownerAllowed = canAccessOwnerConsole(currentUser);
  const visibleCompanies = ownerAllowed || !currentUser
    ? companies
    : companies.filter(company => company.id === currentUser.companyId);
  const visibleProperties = ownerAllowed || !currentUser
    ? properties.filter(property => property.companyId === selectedCompanyId)
    : properties.filter(property => property.companyId === selectedCompanyId && currentUser.propertyIds.includes(property.id));
  const hasModuleAccess = (moduleName: string) =>
    ownerAllowed || Boolean(currentUser?.permissions.some(permission => permission.module === moduleName && permission.access !== "none"));

  useEffect(() => {
    if (!currentUser) navigate("/login");
  }, [currentUser, navigate]);

  const sections = [
    {
      id: "reservations",
      title: "Reservations",
      subtitle: "Calendar, bookings, rates, and guest stays",
      icon: CalendarDays,
      path: "/app/reservations/calendar",
    },
    {
      id: "accountancy",
      title: "Accountancy",
      subtitle: "Revenue, expenses, balance, and exports",
      icon: DollarSign,
      path: "/app/accountancy/overview",
    },
    {
      id: "supply-requests",
      title: "Supply Requests",
      subtitle: "Department purchases and operating needs",
      icon: Package,
      path: "/app/supply-requests/beverage",
    },
    {
      id: "check-in",
      title: "Check-in",
      subtitle: "Guest registration, database, and dashboard",
      icon: UserCheck,
      path: "/app/check-in/form",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#2d2924] text-white">
      <img
        src="https://images.unsplash.com/photo-1741850826374-234124a31bf2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBzYWZhcmklMjB0ZW50JTIwY2FtcCUyMGxhbmRzY2FwZXxlbnwxfHx8fDE3ODA3Nzg0ODR8MA&ixlib=rb-4.1.0&q=80&w=1600&utm_source=figma&utm_medium=referral"
        alt="Kumbukumbu Luxury Tented Camp"
        className="absolute inset-0 h-full w-full object-cover opacity-30"
      />
      <div className="absolute inset-0 bg-[#2d2924]/80" />

      <div className="relative z-10 flex min-h-screen flex-col px-6 py-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white md:text-4xl">KumbuOS</h1>
            <p className="mt-1 text-sm font-medium text-[#f4c27d]">Hospitality Management System</p>
          </div>
          <Button
            variant="outline"
            className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            onClick={() => { logout(); navigate("/login"); }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </Button>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-8 py-10">
          <section className="max-w-3xl">
            <p className="text-sm font-medium uppercase text-[#f4c27d]">Property Management System</p>
            <h2 className="mt-3 text-4xl font-semibold leading-tight text-white md:text-5xl">
              Select the operating module
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#f7ead8]">
              Focused tools for luxury hotel operations, finance, supplies, guest check-in, and administration.
            </p>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sections.filter(section => hasModuleAccess(
              section.id === "supply-requests" ? "Supply Requests" :
              section.id === "check-in" ? "Check-in" :
              section.title
            )).map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => navigate(section.path)}
                  className={`group min-h-44 rounded-lg border p-6 text-left text-white shadow-xl transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#f4c27d] ${primaryModuleStyle}`}
                >
                  <div className="flex h-full items-start justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-semibold text-white">{section.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/85">{section.subtitle}</p>
                    </div>
                    <Icon className="h-9 w-9 shrink-0 text-white" />
                  </div>
                </button>
              );
            })}
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {hasModuleAccess("Admin Platform") && (
              <button
                onClick={() => navigate("/app/admin/companies")}
                className={`rounded-lg border p-6 text-left text-white shadow-xl transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#f4c27d] ${secondaryPanelStyle}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold text-white">Admin Platform</h3>
                    <p className="mt-2 text-sm leading-6 text-white/80">
                      Companies, properties, support access, users, and permissions.
                    </p>
                  </div>
                  <ShieldAlert className="h-9 w-9 text-white" />
                </div>
              </button>
            )}

            {ownerAllowed && (
              <button
                onClick={() => navigate("/app/owner/tenants")}
                className={`rounded-lg border p-6 text-left text-white shadow-xl transition-all hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-[#f4c27d] ${secondaryPanelStyle}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-semibold text-white">Owner Console</h3>
                    <p className="mt-2 text-sm leading-6 text-white/85">
                      Tenant sales, first admins, owner users, and licensing controls.
                    </p>
                  </div>
                  <Crown className="h-9 w-9 text-white" />
                </div>
              </button>
            )}

            <div className={`rounded-lg border p-5 text-white shadow-xl lg:col-span-1 ${secondaryPanelStyle}`}>
              <div className="grid gap-4">
                <div>
                  <label className="text-xs font-medium uppercase text-[#f4c27d]">
                    Active Company
                  </label>
                  <select
                    className="mt-3 h-11 w-full rounded-md border border-white/20 bg-[#2d2924] px-3 text-sm font-medium text-white shadow-sm"
                    value={selectedCompanyId}
                    onChange={event => setSelectedCompanyId(event.target.value)}
                  >
                    {visibleCompanies.map(company => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium uppercase text-[#f4c27d]">
                    Active Property
                  </label>
                  <select
                    className="mt-3 h-11 w-full rounded-md border border-white/20 bg-[#2d2924] px-3 text-sm font-medium text-white shadow-sm"
                    value={selectedPropertyId}
                    onChange={event => setSelectedPropertyId(event.target.value)}
                  >
                    {visibleProperties.map(property => (
                      <option key={property.id} value={property.id}>{property.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
