import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router";
import {
  Building,
  Building2,
  Edit,
  KeyRound,
  Mail,
  Plus,
  Save,
  Server,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Company,
  NotificationEmailConfig,
  PermissionAccess,
  PermissionRule,
  Property,
  SystemUser,
  UserProfile,
  useAppContext,
} from "../context/AppContext";
import { validatePasswordPolicy } from "../utils/authSecurity";

const modules = [
  { module: "Reservations", sections: ["Calendar", "Bookings", "Booking Payments", "Configuration", "Policies", "OTA Sync", "Notifications"] },
  { module: "Accountancy", sections: ["Overview", "Profit & Loss (P&L)", "Revenues", "Expenses", "Balance", "Assets", "Liabilities", "GenAI Assistant", "Notifications"] },
  { module: "Supply Requests", sections: ["Beverage", "Client Food", "Staff Food", "Shishas", "Housekeeping", "Mechanical", "Fuel & Petrol", "Notifications"] },
  { module: "Check-in", sections: ["Check-in Form", "Database", "Dashboard", "Notifications"] },
  { module: "Admin Platform", sections: ["Companies", "Manage Users", "Assign Permissions", "Notifications"] },
];

const createEmptyPermissions = (): PermissionRule[] =>
  modules.flatMap(group => group.sections.map(section => ({
    module: group.module,
    section,
    access: "none" as PermissionAccess,
  })));

const accessOptions: PermissionAccess[] = ["none", "view", "edit"];
const departments = ["Reservations", "Accountancy", "Supplies", "Check-in", "Admin"];
const roleTitleOptions = ["Tenant Admin", "General Director", "Reservations Agent", "Accountancy Manager", "Supplies Manager", "Check-in Manager", "Property Manager", "Read-only Viewer"];
const senderProviderDefaults: Record<NotificationEmailConfig["provider"], { host: string; port: number; secure: boolean; guide: string }> = {
  Zoho: {
    host: "smtp.zoho.eu",
    port: 465,
    secure: true,
    guide: "Zoho Mail: create an app password in Zoho Accounts, use the full mailbox as username, host smtp.zoho.eu, port 465, SSL enabled.",
  },
  Gmail: {
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    guide: "Gmail / Google Workspace: enable 2-step verification, create an App Password, use smtp.gmail.com, port 465, SSL enabled.",
  },
  "Microsoft 365": {
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    guide: "Microsoft 365 / Outlook: enable authenticated SMTP for the mailbox, use smtp.office365.com, port 587, STARTTLS enabled.",
  },
  "Custom SMTP": {
    host: "",
    port: 465,
    secure: true,
    guide: "Custom SMTP: ask the provider for SMTP host, port, username, password/app password, and whether SSL or STARTTLS is required.",
  },
};

const blankSenderConfig = (companyId = "", propertyId = ""): Partial<NotificationEmailConfig> => ({
  companyId,
  propertyId,
  provider: "Zoho",
  fromName: "KumbuOS",
  fromEmail: "",
  smtpHost: senderProviderDefaults.Zoho.host,
  smtpPort: senderProviderDefaults.Zoho.port,
  smtpUsername: "",
  smtpPassword: "",
  secure: senderProviderDefaults.Zoho.secure,
  status: "Not configured",
  notes: "",
});

export function PlatformAdmin() {
  const location = useLocation();
  const mode = location.pathname.includes("/users") ? "users" : "companies";
  const {
    companies,
    properties,
    systemUsers,
    addSystemUser,
    updateSystemUser,
    deleteSystemUser,
    currentUser,
    profileDefinitions,
    canAccessOwnerConsole,
    notificationEmailConfigs,
    addNotificationEmailConfig,
    updateNotificationEmailConfig,
    deleteNotificationEmailConfig,
  } = useAppContext();

  const ownerMode = canAccessOwnerConsole(currentUser);
  const tenantCompanyId = currentUser?.companyId || companies[0]?.id || "";
  const visibleCompanies = ownerMode
    ? companies
    : companies.filter(company => company.id === tenantCompanyId || company.parentCompanyId === tenantCompanyId);
  const [selectedCompanyId, setSelectedCompanyId] = useState(visibleCompanies[0]?.id || tenantCompanyId);
  const activeCompany = visibleCompanies.find(company => company.id === selectedCompanyId) || visibleCompanies[0];
  const companyProperties = properties.filter(property => property.companyId === activeCompany?.id);
  const companyUsers = systemUsers.filter(user =>
    user.companyId === activeCompany?.id &&
    user.profile !== "Owner" &&
    !user.ownerConsoleAccess
  );

  const [selectedPropertyForUsers, setSelectedPropertyForUsers] = useState<string>("");
  const [senderForm, setSenderForm] = useState<Partial<NotificationEmailConfig>>(blankSenderConfig(activeCompany?.id || "", companyProperties[0]?.id || ""));
  const [senderError, setSenderError] = useState("");
  const [senderTestStatus, setSenderTestStatus] = useState("");

  const [userSection, setUserSection] = useState<"users" | "permissions" | "profiles">("users");
  const [userForm, setUserForm] = useState<Partial<SystemUser>>({ profile: "Reservations", role: "Reservations Agent", status: "Active", departments: ["Reservations"] });
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userPropertyIds, setUserPropertyIds] = useState<string[]>([]);
  const [permissionDraft, setPermissionDraft] = useState<PermissionRule[]>(createEmptyPermissions());
  const [formError, setFormError] = useState("");
  const selectedUser = companyUsers.find(user => user.id === editingUserId) || companyUsers[0];

  const usersForSelectedProperty = useMemo(
    () => selectedPropertyForUsers
      ? companyUsers.filter(user => user.propertyIds.includes(selectedPropertyForUsers))
      : [],
    [companyUsers, selectedPropertyForUsers]
  );
  const companySenderConfigs = notificationEmailConfigs.filter(config => config.companyId === activeCompany?.id);
  const activeSenderPropertyId = senderForm.propertyId || companyProperties[0]?.id || "";
  const activeSenderConfig = notificationEmailConfigs.find(config => config.propertyId === activeSenderPropertyId);

  useEffect(() => {
    if (!activeCompany) return;
    const propertyId = companyProperties[0]?.id || "";
    const existing = notificationEmailConfigs.find(config => config.propertyId === propertyId);
    setSenderForm(existing || blankSenderConfig(activeCompany.id, propertyId));
    setSenderError("");
  }, [activeCompany?.id]);

  const setProfile = (profile: UserProfile) => {
    if (profile === "Owner") return;
    const definition = profileDefinitions.find(item => item.name === profile);
    const nextPermissions = definition?.permissions || createEmptyPermissions();
    setUserForm(current => ({
      ...current,
      profile,
      role: profile,
      departments: profile === "Admin" || profile === "General Director" ? departments : [profile === "Supplies" ? "Supplies" : profile],
      ownerConsoleAccess: profile === "Owner",
    }));
    setPermissionDraft(nextPermissions);
  };

  const openNewUser = () => {
    setEditingUserId(null);
    setUserForm({ profile: "Reservations", role: "Reservations Agent", status: "Active", departments: ["Reservations"], ownerConsoleAccess: false });
    setUserPropertyIds(companyProperties.map(property => property.id));
    setPermissionDraft(profileDefinitions.find(item => item.name === "Reservations")?.permissions || createEmptyPermissions());
    setUserSection("users");
  };

  const editUser = (user: SystemUser) => {
    setEditingUserId(user.id);
    setUserForm(user);
    setUserPropertyIds(user.propertyIds);
    setPermissionDraft(user.permissions.length ? user.permissions : createEmptyPermissions());
    setUserSection("users");
  };

  const saveUser = () => {
    setFormError("");
    if (!activeCompany || !userForm.name || !userForm.email || (!editingUserId && !userForm.password)) {
      setFormError("Complete name, email, and password for new users before saving.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userForm.email)) {
      setFormError("Use a valid email address before saving.");
      return;
    }
    if (userForm.phone && !/^\+?[0-9\s().-]{7,24}$/.test(userForm.phone)) {
      setFormError("Use a valid international phone number before saving.");
      return;
    }
    if (!editingUserId || userForm.password) {
      const passwordPolicy = validatePasswordPolicy(userForm.password || "");
      if (!passwordPolicy.valid) {
        setFormError(passwordPolicy.errors.join(" "));
        return;
      }
    }
    if (userForm.profile === "Owner" || userForm.ownerConsoleAccess) {
      setFormError("Owner profiles can only be created, modified, or deleted from Owner Console.");
      return;
    }

    const payload: SystemUser = {
      id: editingUserId || `usr-${Date.now()}`,
      companyId: activeCompany.id,
      propertyIds: userPropertyIds,
      name: userForm.name,
      email: userForm.email,
      role: userForm.role || userForm.profile || "Team Member",
      profile: userForm.profile || "Reservations",
      departments: userForm.departments || [],
      phone: userForm.phone || "",
      password: userForm.password || "",
      status: userForm.status || "Active",
      ownerConsoleAccess: false,
      permissions: permissionDraft,
    };

    if (editingUserId) {
      updateSystemUser(editingUserId, payload);
    } else {
      addSystemUser(payload);
    }
    setEditingUserId(payload.id);
  };

  const toggleUserProperty = (propertyId: string) => {
    setUserPropertyIds(current =>
      current.includes(propertyId)
        ? current.filter(id => id !== propertyId)
        : [...current, propertyId]
    );
  };

  const toggleDepartment = (department: string) => {
    const currentDepartments = userForm.departments || [];
    setUserForm({
      ...userForm,
      departments: currentDepartments.includes(department)
        ? currentDepartments.filter(item => item !== department)
        : [...currentDepartments, department],
    });
  };

  const updatePermission = (module: string, section: string, access: PermissionAccess) => {
    setPermissionDraft(current => {
      const exists = current.some(rule => rule.module === module && rule.section === section);
      if (!exists) return [...current, { module, section, access }];
      return current.map(rule => rule.module === module && rule.section === section ? { ...rule, access } : rule);
    });
  };

  const loadSenderConfigForProperty = (propertyId: string) => {
    const existing = notificationEmailConfigs.find(config => config.propertyId === propertyId);
    setSenderForm(existing || blankSenderConfig(activeCompany?.id || "", propertyId));
    setSenderError("");
    setSenderTestStatus("");
  };

  const setSenderProvider = (provider: NotificationEmailConfig["provider"]) => {
    const defaults = senderProviderDefaults[provider];
    setSenderForm(current => ({
      ...current,
      provider,
      smtpHost: defaults.host,
      smtpPort: defaults.port,
      secure: defaults.secure,
    }));
  };

  const saveSenderConfig = () => {
    setSenderError("");
    setSenderTestStatus("");
    if (!activeCompany || !senderForm.propertyId) {
      setSenderError("Select a property before saving a notification sender.");
      return;
    }
    if (!senderForm.fromName || !senderForm.fromEmail || !senderForm.smtpHost || !senderForm.smtpPort || !senderForm.smtpUsername) {
      setSenderError("Complete sender name, sender email, SMTP host, port, and username before saving.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderForm.fromEmail)) {
      setSenderError("Use a valid sender email address.");
      return;
    }
    if (senderForm.smtpUsername && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderForm.smtpUsername)) {
      setSenderError("Use the full mailbox email as SMTP username.");
      return;
    }

    const existing = notificationEmailConfigs.find(config => config.propertyId === senderForm.propertyId);
    const payload: NotificationEmailConfig = {
      id: existing?.id || `mail-${senderForm.propertyId}-${Date.now()}`,
      companyId: activeCompany.id,
      propertyId: senderForm.propertyId,
      provider: senderForm.provider || "Zoho",
      fromName: senderForm.fromName,
      fromEmail: senderForm.fromEmail,
      smtpHost: senderForm.smtpHost,
      smtpPort: Number(senderForm.smtpPort),
      smtpUsername: senderForm.smtpUsername,
      smtpPassword: senderForm.smtpPassword || existing?.smtpPassword || "",
      secure: Boolean(senderForm.secure),
      status: "Configured",
      notes: senderForm.notes || "",
      updatedAt: new Date().toISOString(),
    };

    if (existing) updateNotificationEmailConfig(existing.id, payload);
    else addNotificationEmailConfig(payload);
    setSenderForm(payload);
    setSenderTestStatus("Sender configuration saved in Firebase.");
  };

  const removeSenderConfig = () => {
    if (!activeSenderConfig) return;
    if (confirm("Delete this notification sender configuration?")) {
      deleteNotificationEmailConfig(activeSenderConfig.id);
      setSenderForm(blankSenderConfig(activeCompany?.id || "", activeSenderPropertyId));
      setSenderTestStatus("");
    }
  };

  const sendSenderTest = async () => {
    setSenderError("");
    setSenderTestStatus("");
    const config = activeSenderConfig || (senderForm.id ? senderForm as NotificationEmailConfig : null);
    if (!config?.smtpPassword) {
      setSenderError("Save a complete sender configuration with SMTP password before sending a test email.");
      return;
    }
    if (!currentUser?.email) {
      setSenderError("No current user email is available for the test.");
      return;
    }

    try {
      const response = await fetch("/api/send-notification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderConfig: config,
          to: currentUser.email,
          subject: "KumbuOS notification sender test",
          message: `This is a test notification email sent from ${config.fromEmail}.`,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        setSenderError(payload?.error || "The test email could not be sent.");
        return;
      }
      setSenderTestStatus(`Test email sent to ${currentUser.email}.`);
    } catch {
      setSenderError("The test email could not be sent. Check SMTP data and Vercel network access.");
    }
  };

  if (!activeCompany) {
    return <div className="p-8 text-muted-foreground">No company is available for this user.</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {mode === "companies" ? "Companies" : "Manage Users"}
          </h2>
          <p className="text-muted-foreground">
            {mode === "companies"
              ? "Manage tenant companies, operating entities, property profiles, and property access visibility."
              : "Create credentials, assign property access, choose department profiles, and configure permissions."}
          </p>
        </div>
        {mode === "companies" ? (
          <Button className="gap-2" variant="outline" disabled>
            Owner Managed
          </Button>
        ) : (
          <Button className="gap-2" onClick={openNewUser}>
            <UserPlus size={16} />
            New User
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={Building2} label="Visible Companies" value={visibleCompanies.length} />
        <Metric icon={Building} label="Visible Properties" value={visibleCompanies.flatMap(company => properties.filter(property => property.companyId === company.id)).length} />
        <Metric icon={Users} label="Visible Users" value={visibleCompanies.flatMap(company => systemUsers.filter(user => user.companyId === company.id)).length} />
      </div>

      {!ownerMode && (
        <div className="rounded-md border border-[#c98736]/30 bg-[#c98736]/10 p-4 text-sm text-foreground">
          Tenant guardrail: companies and properties are provisioned only by the Owner Console. Tenant admins can manage users and permissions only inside the already-provisioned properties assigned to their company.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-semibold">Company Scope</h3>
          <div className="space-y-2">
            {visibleCompanies.map(company => (
              <button
                key={company.id}
                onClick={() => setSelectedCompanyId(company.id)}
                className={`w-full rounded-md border p-3 text-left transition-colors ${activeCompany.id === company.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
              >
                <p className="font-medium">{company.name}</p>
                <p className="text-xs text-muted-foreground">{company.tenantType || "Billable Tenant"} · {company.status}</p>
              </button>
            ))}
          </div>
        </aside>

        {mode === "companies" ? (
          <section className="space-y-5">
            <Panel title="Company Profile" icon={Building2}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-semibold">{activeCompany.name}</h3>
                  <p className="text-sm text-muted-foreground">{activeCompany.legalName}</p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Owner managed</span>
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <Info label="Website" value={activeCompany.website} />
                <Info label="Business Sector" value={activeCompany.businessSector} />
                <Info label="Tax ID" value={activeCompany.taxId || "Pending"} />
                <Info label="Registration" value={activeCompany.registrationNumber || "Pending"} />
                <Info label="Invoice Email" value={activeCompany.invoiceEmail || "Pending"} />
                <Info label="Official Address" value={activeCompany.officialAddress || "Pending"} />
              </div>
            </Panel>

            <Panel title="Properties" icon={Building}>
              <div className="mb-4 flex justify-between gap-3">
                <p className="text-sm text-muted-foreground">Review provisioned properties and the users assigned to each one. Property creation, editing, and deletion are owner-only actions.</p>
              </div>

              <div className="space-y-3">
                {companyProperties.map(property => (
                  <div key={property.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <button className="text-left" onClick={() => setSelectedPropertyForUsers(property.id)}>
                        <p className="font-medium">{property.name}</p>
                        <p className="text-sm text-muted-foreground">{property.website}</p>
                      </button>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedPropertyForUsers(property.id)}>
                          Users ({companyUsers.filter(user => user.propertyIds.includes(property.id)).length})
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                      <Info label="Status" value={property.status || "Setup"} />
                      <Info label="Currency" value={property.currency || "USD"} />
                      <Info label="Timezone" value={property.timezone || "Africa/Dar_es_Salaam"} />
                    </div>
                  </div>
                ))}
              </div>

              {selectedPropertyForUsers && (
                <div className="mt-5 rounded-md border border-border bg-muted/20 p-4">
                  <h4 className="mb-3 font-semibold">Users with access to this property</h4>
                  <div className="space-y-2">
                    {usersForSelectedProperty.map(user => (
                      <div key={user.id} className="flex items-center justify-between rounded-md bg-card p-3">
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-sm text-muted-foreground">{user.email} · {user.profile}</p>
                        </div>
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{user.status}</span>
                      </div>
                    ))}
                    {usersForSelectedProperty.length === 0 && <p className="text-sm text-muted-foreground">No users have access to this property yet.</p>}
                  </div>
                </div>
              )}
            </Panel>
            <NotificationSenderPanel
              properties={companyProperties}
              configs={companySenderConfigs}
              form={senderForm}
              error={senderError}
              testStatus={senderTestStatus}
              activeConfig={activeSenderConfig}
              onSelectProperty={loadSenderConfigForProperty}
              onSetProvider={setSenderProvider}
              onChange={updates => setSenderForm(current => ({ ...current, ...updates }))}
              onSave={saveSenderConfig}
              onDelete={removeSenderConfig}
              onSendTest={sendSenderTest}
            />
          </section>
        ) : (
          <section className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {(["users", "permissions", "profiles"] as const).map(section => (
                <Button key={section} variant={userSection === section ? "default" : "outline"} onClick={() => setUserSection(section)}>
                  {section === "users" ? "Users" : section === "permissions" ? "Assign Permissions" : "Profiles"}
                </Button>
              ))}
            </div>

            {userSection === "users" && (
              <Panel title={editingUserId ? "Edit User" : "Create User"} icon={UserPlus}>
                <UserFields
                  form={userForm}
                  onChange={setUserForm}
                  setProfile={setProfile}
                  profileDefinitions={profileDefinitions}
                  toggleDepartment={toggleDepartment}
                />
                {formError && <FormError message={formError} />}
                <PropertyAccess properties={companyProperties} selected={userPropertyIds} toggle={toggleUserProperty} />
                <div className="mt-5 flex justify-between gap-2">
                  <Button variant="outline" onClick={openNewUser}>New Blank User</Button>
                  <Button className="gap-2" onClick={saveUser}><Save size={16} /> Save User</Button>
                </div>
              </Panel>
            )}

            {userSection === "permissions" && (
              <Panel title="Assign Permissions" icon={UserCog}>
                <div className="mb-4 grid gap-3 md:grid-cols-[260px_1fr]">
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={editingUserId || selectedUser?.id || ""}
                    onChange={event => {
                      const nextUser = companyUsers.find(user => user.id === event.target.value);
                      if (nextUser) editUser(nextUser);
                    }}
                  >
                    {companyUsers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                  <p className="text-sm text-muted-foreground">Permissions apply only inside the assigned company and selected properties.</p>
                </div>
                <PropertyAccess properties={companyProperties} selected={userPropertyIds} toggle={toggleUserProperty} />
                <PermissionEditor permissions={permissionDraft} update={updatePermission} />
                {formError && <FormError message={formError} />}
                <div className="mt-5 flex justify-end">
                  <Button className="gap-2" onClick={saveUser}><Save size={16} /> Save Permissions</Button>
                </div>
              </Panel>
            )}

            {userSection === "profiles" && (
              <Panel title="Department Profiles" icon={ShieldCheck}>
                <div className="grid gap-3 md:grid-cols-2">
                  {profileDefinitions.filter(profile => !profile.ownerOnly).map(profile => (
                    <div key={profile.name} className="rounded-md border border-border p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold">{profile.name}</h4>
                      </div>
                      <p className="text-sm text-muted-foreground">{profile.description}</p>
                      <p className="mt-3 text-xs text-muted-foreground">{profile.permissions.length} default permissions</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            <Panel title="Users and Credentials" icon={Users}>
              <div className="space-y-3">
                {companyUsers.map(user => (
                  <div key={user.id} className="rounded-md border border-border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{user.email} · {user.profile || user.role}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => editUser(user)}>Edit</Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("Delete this user?") && deleteSystemUser(user.id)}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
                      <Info label="Status" value={user.status} />
                      <Info label="Departments" value={(user.departments || []).join(", ") || "None"} />
                      <Info label="Properties" value={user.propertyIds.length.toString()} />
                      <Info label="Editable Rules" value={user.permissions.filter(rule => rule.access === "edit").length.toString()} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
        )}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-primary/10 p-2 text-primary"><Icon size={20} /></div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <p><span className="text-muted-foreground">{label}:</span> {value}</p>
  );
}

function FormError({ message }: { message: string }) {
  return <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</div>;
}

function CompanyFields({ form, onChange, ownerMode, companies }: { form: Partial<Company>; onChange: (form: Partial<Company>) => void; ownerMode: boolean; companies: Company[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <TextField label="Company Name" value={form.name} onChange={value => onChange({ ...form, name: value })} placeholder="Company name" />
      <TextField label="Website" value={form.website} onChange={value => onChange({ ...form, website: value })} placeholder="https://company.com" />
      <TextField label="Business Sector" value={form.businessSector} onChange={value => onChange({ ...form, businessSector: value })} placeholder="Luxury Hospitality" />
      <TextField label="Legal Name" value={form.legalName} onChange={value => onChange({ ...form, legalName: value })} placeholder="Legal entity" />
      <TextField label="Tax ID" value={form.taxId} onChange={value => onChange({ ...form, taxId: value })} placeholder="Tax ID" />
      <TextField label="Registration Number" value={form.registrationNumber} onChange={value => onChange({ ...form, registrationNumber: value })} placeholder="Registry number" />
      <TextField label="Official Address" value={form.officialAddress} onChange={value => onChange({ ...form, officialAddress: value })} placeholder="Official address" />
      <TextField label="Invoice Email" value={form.invoiceEmail} onChange={value => onChange({ ...form, invoiceEmail: value })} placeholder="billing@company.com" />
      <div>
        <label className="mb-1 block text-sm font-medium">Plan</label>
        <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.plan || "Enterprise"} onChange={event => onChange({ ...form, plan: event.target.value as Company["plan"] })}>
          <option>Starter</option>
          <option>Pro</option>
          <option>Enterprise</option>
        </select>
      </div>
      {ownerMode && (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium">Tenant Type</label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.tenantType || "Billable Tenant"} onChange={event => onChange({ ...form, tenantType: event.target.value as Company["tenantType"] })}>
              <option>Billable Tenant</option>
              <option>Operating Entity</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Parent Company</label>
            <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.parentCompanyId || ""} onChange={event => onChange({ ...form, parentCompanyId: event.target.value || undefined })}>
              <option value="">None</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
            </select>
          </div>
        </>
      )}
    </div>
  );
}

function PropertyFields({ form, onChange }: { form: Partial<Property>; onChange: (form: Partial<Property>) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <TextField label="Property Name" value={form.name} onChange={value => onChange({ ...form, name: value })} placeholder="Property name" />
      <TextField label="Website" value={form.website} onChange={value => onChange({ ...form, website: value })} placeholder="https://property.com" />
      <TextField label="Business Sector" value={form.businessSector} onChange={value => onChange({ ...form, businessSector: value })} placeholder="Luxury Tented Camp" />
      <TextField label="Legal Name" value={form.legalName} onChange={value => onChange({ ...form, legalName: value })} placeholder="Legal property entity" />
      <TextField label="Tax ID" value={form.taxId} onChange={value => onChange({ ...form, taxId: value })} placeholder="Tax ID" />
      <TextField label="Registration Number" value={form.registrationNumber} onChange={value => onChange({ ...form, registrationNumber: value })} placeholder="Registry number" />
      <TextField label="Official Address" value={form.officialAddress} onChange={value => onChange({ ...form, officialAddress: value })} placeholder="Official address" />
      <TextField label="Invoice Email" value={form.invoiceEmail} onChange={value => onChange({ ...form, invoiceEmail: value })} placeholder="billing@property.com" />
      <TextField label="Currency" value={form.currency} onChange={value => onChange({ ...form, currency: value })} placeholder="USD" />
      <TextField label="Timezone" value={form.timezone} onChange={value => onChange({ ...form, timezone: value })} placeholder="Africa/Dar_es_Salaam" />
      <TextField label="Rooms Count" value={form.roomsCount?.toString()} onChange={value => onChange({ ...form, roomsCount: Number(value) })} placeholder="12" />
      <div>
        <label className="mb-1 block text-sm font-medium">Status</label>
        <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.status || "Setup"} onChange={event => onChange({ ...form, status: event.target.value as Property["status"] })}>
          <option>Setup</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </div>
    </div>
  );
}

function NotificationSenderPanel({
  properties,
  configs,
  form,
  error,
  testStatus,
  activeConfig,
  onSelectProperty,
  onSetProvider,
  onChange,
  onSave,
  onDelete,
  onSendTest,
}: {
  properties: Property[];
  configs: NotificationEmailConfig[];
  form: Partial<NotificationEmailConfig>;
  error: string;
  testStatus: string;
  activeConfig?: NotificationEmailConfig;
  onSelectProperty: (propertyId: string) => void;
  onSetProvider: (provider: NotificationEmailConfig["provider"]) => void;
  onChange: (updates: Partial<NotificationEmailConfig>) => void;
  onSave: () => void;
  onDelete: () => void;
  onSendTest: () => void;
}) {
  const provider = form.provider || "Zoho";
  const providerGuide = senderProviderDefaults[provider];

  return (
    <Panel title="Notification Sender Email" icon={Mail}>
      <div className="mb-4 rounded-md border border-[#c98736]/30 bg-[#c98736]/10 p-4 text-sm text-foreground">
        Every notification automation for this property must use a configured sender email. Use app passwords or SMTP-specific credentials from the email provider.
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Property</label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={form.propertyId || ""}
            onChange={event => onSelectProperty(event.target.value)}
            disabled={!properties.length}
          >
            {!properties.length && <option value="">No property available</option>}
            {properties.map(property => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Email Provider</label>
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={provider}
            onChange={event => onSetProvider(event.target.value as NotificationEmailConfig["provider"])}
          >
            {Object.keys(senderProviderDefaults).map(option => <option key={option}>{option}</option>)}
          </select>
        </div>
        <TextField label="Sender Name" value={form.fromName} onChange={value => onChange({ fromName: value })} placeholder="KumbuOS Reservations" />
        <TextField label="Sender Email" value={form.fromEmail} onChange={value => onChange({ fromEmail: value, smtpUsername: form.smtpUsername || value })} placeholder="info@company.com" />
        <TextField label="SMTP Username" value={form.smtpUsername} onChange={value => onChange({ smtpUsername: value })} placeholder="info@company.com" />
        <TextField label="SMTP Password / App Password" value={form.smtpPassword} onChange={value => onChange({ smtpPassword: value })} placeholder="Provider app password" type="password" />
        <TextField label="SMTP Host" value={form.smtpHost} onChange={value => onChange({ smtpHost: value })} placeholder="smtp.zoho.eu" />
        <TextField label="SMTP Port" value={form.smtpPort?.toString()} onChange={value => onChange({ smtpPort: Number(value) })} placeholder="465" />
        <label className="flex items-center gap-2 self-end rounded-md border border-border p-3 text-sm">
          <input type="checkbox" checked={Boolean(form.secure)} onChange={event => onChange({ secure: event.target.checked })} />
          SSL / secure SMTP
        </label>
        <div className="md:col-span-2 lg:col-span-3">
          <label className="mb-1 block text-sm font-medium">Internal Notes</label>
          <textarea
            className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={form.notes || ""}
            onChange={event => onChange({ notes: event.target.value })}
            placeholder="Implementation notes, provider requirements, or renewal details."
          />
        </div>
      </div>

      {error && <FormError message={error} />}
      {testStatus && <p className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{testStatus}</p>}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <Server className="h-4 w-4 text-primary" />
            Provider setup guide
          </div>
          <p className="leading-6 text-muted-foreground">{providerGuide.guide}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Use an app password, not the normal mailbox password.</li>
            <li>Confirm SMTP sending is enabled for the mailbox.</li>
            <li>Keep sender email aligned with the property or company domain.</li>
          </ul>
        </div>

        <div className="rounded-md border border-border p-4 text-sm">
          <p className="mb-2 font-semibold">Configured senders</p>
          <div className="space-y-2">
            {configs.map(config => (
              <button
                key={config.id}
                type="button"
                className={`w-full rounded-md border p-3 text-left ${config.id === activeConfig?.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`}
                onClick={() => onSelectProperty(config.propertyId)}
              >
                <p className="font-medium">{config.fromEmail}</p>
                <p className="text-xs text-muted-foreground">{config.provider} - {config.status}</p>
              </button>
            ))}
            {!configs.length && <p className="text-muted-foreground">No sender configured yet.</p>}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {activeConfig && <Button variant="outline" className="gap-2 text-destructive" onClick={onDelete}><Trash2 size={16} /> Delete Sender</Button>}
        {activeConfig && <Button variant="outline" className="gap-2" onClick={onSendTest}><Mail size={16} /> Send Test</Button>}
        <Button className="gap-2" onClick={onSave}><Save size={16} /> Save Sender</Button>
      </div>
    </Panel>
  );
}

function UserFields({
  form,
  onChange,
  setProfile,
  profileDefinitions,
  toggleDepartment,
}: {
  form: Partial<SystemUser>;
  onChange: (form: Partial<SystemUser>) => void;
  setProfile: (profile: UserProfile) => void;
  profileDefinitions: { name: UserProfile; description: string; ownerOnly?: boolean }[];
  toggleDepartment: (department: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <TextField label="Full Name" value={form.name} onChange={value => onChange({ ...form, name: value })} placeholder="Full name" />
        <TextField label="Email" value={form.email} onChange={value => onChange({ ...form, email: value })} placeholder="user@company.com" />
        <TextField label="Phone" value={form.phone} onChange={value => onChange({ ...form, phone: value })} placeholder="+255 700 000 000" />
        <div>
          <TextField label="Password" value={form.password} onChange={value => onChange({ ...form, password: value })} placeholder="Create or update password" type="password" />
          <p className="mt-1 text-xs text-muted-foreground">Uppercase, lowercase, number, and special character required.</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Profile</label>
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.profile || "Reservations"} onChange={event => setProfile(event.target.value as UserProfile)}>
            {profileDefinitions.filter(profile => !profile.ownerOnly).map(profile => <option key={profile.name}>{profile.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Role Title</label>
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.role || form.profile || "Reservations Agent"} onChange={event => onChange({ ...form, role: event.target.value })}>
            {roleTitleOptions.map(role => <option key={role}>{role}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Status</label>
          <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.status || "Active"} onChange={event => onChange({ ...form, status: event.target.value as SystemUser["status"] })}>
            <option>Active</option>
            <option>Suspended</option>
          </select>
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Departments</p>
        <div className="grid gap-2 md:grid-cols-5">
          {departments.map(department => (
            <label key={department} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
              <input type="checkbox" checked={(form.departments || []).includes(department)} onChange={() => toggleDepartment(department)} />
              {department}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function PropertyAccess({ properties, selected, toggle }: { properties: Property[]; selected: string[]; toggle: (propertyId: string) => void }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-sm font-medium">Property Access</p>
      <div className="grid gap-2 md:grid-cols-3">
        {properties.map(property => (
          <label key={property.id} className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
            <input type="checkbox" checked={selected.includes(property.id)} onChange={() => toggle(property.id)} />
            {property.name}
          </label>
        ))}
      </div>
    </div>
  );
}

function PermissionEditor({ permissions, update }: { permissions: PermissionRule[]; update: (module: string, section: string, access: PermissionAccess) => void }) {
  const accessFor = (module: string, section: string) =>
    permissions.find(rule => rule.module === module && rule.section === section)?.access || "none";

  return (
    <div className="mt-5 overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Module</th>
            <th className="px-4 py-3 font-medium">Section / Subsection</th>
            <th className="px-4 py-3 font-medium">Access</th>
          </tr>
        </thead>
        <tbody>
          {modules.flatMap(group => group.sections.map(section => (
            <tr key={`${group.module}-${section}`} className="border-t border-border">
              <td className="px-4 py-3 font-medium">{group.module}</td>
              <td className="px-4 py-3 text-muted-foreground">{section}</td>
              <td className="px-4 py-3">
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={accessFor(group.module, section)} onChange={event => update(group.module, section, event.target.value as PermissionAccess)}>
                  {accessOptions.map(access => <option key={access} value={access}>{access}</option>)}
                </select>
              </td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, type = "text" }: { label: string; value?: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      <Input type={type} value={value || ""} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}
