import { useMemo, useState } from "react";
import { Building, Building2, Crown, Edit, KeyRound, Plus, Save, ShieldAlert, Trash2, UserPlus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Company, Property, SystemUser, UserProfile, useAppContext } from "../context/AppContext";
import { validatePasswordPolicy } from "../utils/authSecurity";

const roleOptions: UserProfile[] = ["Owner", "Admin", "General Director", "Reservations", "Accountancy", "Supplies", "Check-in"];
const isValidEmail = (value?: string) => Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
const isValidPhone = (value?: string) => !value || /^\+?[0-9\s().-]{7,24}$/.test(value);
const hasValue = (value?: string | number) => value !== undefined && value !== null && String(value).trim().length > 0;
const normalizeWebsite = (value?: string) => {
  const trimmed = value?.trim() || "";
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};
const isValidUrl = (value?: string) => {
  try {
    const url = new URL(normalizeWebsite(value));
    return Boolean(url.hostname.includes(".") && !url.hostname.includes(" ") && url.hostname.length >= 4);
  } catch {
    return false;
  }
};
const validationMessage = (items: string[]) => `Please correct the following fields:\n${items.map(item => `- ${item}`).join("\n")}`;

export function OwnerConsole() {
  const {
    currentUser,
    canAccessOwnerConsole,
    canManageOwnerUsers,
    companies,
    addCompany,
    updateCompany,
    deleteCompany,
    properties,
    setSelectedCompanyId,
    setSelectedPropertyId,
    addProperty,
    updateProperty,
    deleteProperty,
    systemUsers,
    addSystemUser,
    updateSystemUser,
    deleteSystemUser,
    requestPasswordReset,
    credentialSyncStatus,
    pmsDataSyncStatus,
    profileDefinitions,
  } = useAppContext();

  const allowed = canAccessOwnerConsole(currentUser);
  const canManageOwners = canManageOwnerUsers(currentUser);
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [showCompanyEdit, setShowCompanyEdit] = useState(false);
  const [showOwnerUserForm, setShowOwnerUserForm] = useState(false);
  const [companyForm, setCompanyForm] = useState<Partial<Company>>({ plan: "Enterprise", status: "Active", tenantType: "Billable Tenant" });
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [adminForm, setAdminForm] = useState<Partial<SystemUser>>({ profile: "Admin", role: "Tenant Admin", status: "Active", departments: ["Admin"] });
  const [ownerUserForm, setOwnerUserForm] = useState<Partial<SystemUser>>({ profile: "Owner", role: "Owner Console Manager", status: "Active", departments: ["Owner Console"] });
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [propertyForm, setPropertyForm] = useState<Partial<Property>>({ status: "Setup", currency: "USD", timezone: "Africa/Dar_es_Salaam" });
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [formError, setFormError] = useState("");

  const billableTenants = useMemo(
    () => companies.filter(company => (company.tenantType || "Billable Tenant") === "Billable Tenant"),
    [companies]
  );
  const ownerUsers = systemUsers.filter(user => user.ownerConsoleAccess);
  const credentialUsers = systemUsers;
  const activeTenant = billableTenants.find(company => company.id === selectedTenantId) || billableTenants[0];
  const tenantProperties = activeTenant ? properties.filter(property => property.companyId === activeTenant.id) : [];

  if (!allowed) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6">
          <div className="mb-3 flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            <h1 className="text-xl font-semibold">Owner Console Restricted</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            This module is visible only to the system owner email or to owner-console users explicitly created by the owner.
          </p>
        </div>
      </div>
    );
  }

  const ownerPermissions = profileDefinitions.find(profile => profile.name === "Owner")?.permissions || [];
  const adminPermissions = profileDefinitions.find(profile => profile.name === "Admin")?.permissions || [];

  const saveTenant = () => {
    setFormError("");
    const errors: string[] = [];
    const requiredCompanyFields = [
      ["Company Name", companyForm.name],
      ["Website", companyForm.website],
      ["Business Sector", companyForm.businessSector],
      ["Legal Name", companyForm.legalName],
      ["Tax ID", companyForm.taxId],
      ["Registration Number", companyForm.registrationNumber],
      ["Official Address", companyForm.officialAddress],
      ["Invoice Email", companyForm.invoiceEmail],
    ];
    requiredCompanyFields.forEach(([label, value]) => {
      if (!hasValue(value)) errors.push(`${label} is required.`);
    });
    if (!hasValue(adminForm.name)) errors.push("First Tenant Admin Full Name is required.");
    if (!hasValue(adminForm.email)) errors.push("First Tenant Admin Email is required.");
    if (!hasValue(adminForm.password)) errors.push("First Tenant Admin Password is required.");
    if (hasValue(adminForm.password)) {
      const passwordPolicy = validatePasswordPolicy(adminForm.password || "");
      if (!passwordPolicy.valid) errors.push(...passwordPolicy.errors.map(error => `First Tenant Admin ${error}`));
    }
    if (hasValue(companyForm.website) && !isValidUrl(companyForm.website)) errors.push("Website must be a valid domain, for example www.luxurytentedcamp.com or https://www.luxurytentedcamp.com.");
    if (hasValue(companyForm.invoiceEmail) && !isValidEmail(companyForm.invoiceEmail)) errors.push("Invoice Email must be a valid email, for example billing@company.com.");
    if (hasValue(adminForm.email) && !isValidEmail(adminForm.email)) errors.push("First Tenant Admin Email must be a valid email, for example admin@company.com.");
    if (!isValidPhone(adminForm.phone)) errors.push("First Tenant Admin Phone must be a valid international phone number, for example +34618829981.");
    if (errors.length) {
      setFormError(validationMessage(errors));
      return;
    }
    const normalizedCompanyWebsite = normalizeWebsite(companyForm.website);

    const company: Company = {
      id: `co-${Date.now()}`,
      name: companyForm.name,
      website: normalizedCompanyWebsite,
      businessSector: companyForm.businessSector || "Luxury Hospitality",
      legalName: companyForm.legalName,
      taxId: companyForm.taxId || "",
      registrationNumber: companyForm.registrationNumber || "",
      officialAddress: companyForm.officialAddress || "",
      invoiceEmail: companyForm.invoiceEmail || "",
      plan: companyForm.plan || "Enterprise",
      status: companyForm.status || "Active",
      joinedAt: new Date().toISOString().split("T")[0],
      tenantType: "Billable Tenant",
      createdByOwnerId: currentUser?.id,
    };

    addCompany(company);
    addSystemUser({
      id: `usr-${Date.now()}`,
      companyId: company.id,
      propertyIds: [],
      name: adminForm.name,
      email: adminForm.email,
      role: adminForm.role || "Tenant Admin",
      profile: "Admin",
      departments: ["Admin", "Reservations", "Accountancy", "Supplies", "Check-in"],
      phone: adminForm.phone || "",
      password: adminForm.password,
      status: "Active",
      ownerConsoleAccess: false,
      permissions: adminPermissions,
    });

    setCompanyForm({ plan: "Enterprise", status: "Active", tenantType: "Billable Tenant" });
    setAdminForm({ profile: "Admin", role: "Tenant Admin", status: "Active", departments: ["Admin"] });
    setSelectedCompanyId(company.id);
    setShowTenantForm(false);
  };

  const editTenant = (company: Company) => {
    setEditingCompanyId(company.id);
    setCompanyForm(company);
    setShowCompanyEdit(true);
  };

  const saveTenantProfile = () => {
    setFormError("");
    const errors: string[] = [];
    const requiredCompanyFields = [
      ["Company Name", companyForm.name],
      ["Website", companyForm.website],
      ["Business Sector", companyForm.businessSector],
      ["Legal Name", companyForm.legalName],
      ["Tax ID", companyForm.taxId],
      ["Registration Number", companyForm.registrationNumber],
      ["Official Address", companyForm.officialAddress],
      ["Invoice Email", companyForm.invoiceEmail],
    ];
    requiredCompanyFields.forEach(([label, value]) => {
      if (!hasValue(value)) errors.push(`${label} is required.`);
    });
    if (!editingCompanyId) errors.push("Select a company before saving.");
    if (hasValue(companyForm.website) && !isValidUrl(companyForm.website)) errors.push("Website must be a valid domain, for example www.luxurytentedcamp.com or https://www.luxurytentedcamp.com.");
    if (hasValue(companyForm.invoiceEmail) && !isValidEmail(companyForm.invoiceEmail)) errors.push("Invoice Email must be a valid email, for example billing@company.com.");
    if (errors.length) {
      setFormError(validationMessage(errors));
      return;
    }
    updateCompany(editingCompanyId, {
      ...companyForm,
      website: normalizeWebsite(companyForm.website),
      tenantType: "Billable Tenant",
    });
    setEditingCompanyId(null);
    setShowCompanyEdit(false);
    setCompanyForm({ plan: "Enterprise", status: "Active", tenantType: "Billable Tenant" });
  };

  const openNewProperty = (companyId: string) => {
    setSelectedTenantId(companyId);
    setEditingPropertyId(null);
    setPropertyForm({ status: "Setup", currency: "USD", timezone: "Africa/Dar_es_Salaam" });
    setShowPropertyForm(true);
  };

  const editProperty = (property: Property) => {
    setSelectedTenantId(property.companyId);
    setEditingPropertyId(property.id);
    setPropertyForm(property);
    setShowPropertyForm(true);
  };

  const saveProperty = () => {
    setFormError("");
    const errors: string[] = [];
    const requiredPropertyFields = [
      ["Property Name", propertyForm.name],
      ["Website", propertyForm.website],
      ["Business Sector", propertyForm.businessSector],
      ["Legal Name", propertyForm.legalName],
      ["Tax ID", propertyForm.taxId],
      ["Registration Number", propertyForm.registrationNumber],
      ["Official Address", propertyForm.officialAddress],
      ["Invoice Email", propertyForm.invoiceEmail],
      ["Currency", propertyForm.currency],
      ["Timezone", propertyForm.timezone],
      ["Rooms Count", propertyForm.roomsCount?.toString()],
    ];
    requiredPropertyFields.forEach(([label, value]) => {
      if (!hasValue(value)) errors.push(`${label} is required.`);
    });
    if (!activeTenant) errors.push("Select a tenant company before saving a property.");
    if (hasValue(propertyForm.website) && !isValidUrl(propertyForm.website)) errors.push("Property Website must be a valid domain, for example www.property.com or https://www.property.com.");
    if (hasValue(propertyForm.invoiceEmail) && !isValidEmail(propertyForm.invoiceEmail)) errors.push("Property Invoice Email must be a valid email, for example billing@property.com.");
    if (Number(propertyForm.roomsCount) < 0) errors.push("Rooms Count must be zero or a positive number.");
    if (errors.length) {
      setFormError(validationMessage(errors));
      return;
    }

    const payload: Property = {
      id: editingPropertyId || `prop-${Date.now()}`,
      companyId: activeTenant.id,
      name: propertyForm.name,
      website: normalizeWebsite(propertyForm.website),
      businessSector: propertyForm.businessSector || activeTenant.businessSector,
      legalName: propertyForm.legalName,
      taxId: propertyForm.taxId || activeTenant.taxId,
      registrationNumber: propertyForm.registrationNumber || "",
      officialAddress: propertyForm.officialAddress || activeTenant.officialAddress,
      invoiceEmail: propertyForm.invoiceEmail || activeTenant.invoiceEmail,
      status: propertyForm.status || "Setup",
      currency: propertyForm.currency || "USD",
      timezone: propertyForm.timezone || "Africa/Dar_es_Salaam",
      roomsCount: Number(propertyForm.roomsCount) || 0,
    };

    if (editingPropertyId) {
      updateProperty(editingPropertyId, payload);
    } else {
      addProperty(payload);
    }
    setSelectedCompanyId(activeTenant.id);
    setSelectedPropertyId(payload.id);
    setEditingPropertyId(null);
    setShowPropertyForm(false);
    setPropertyForm({ status: "Setup", currency: "USD", timezone: "Africa/Dar_es_Salaam" });
  };

  const saveOwnerUser = () => {
    setFormError("");
    const errors: string[] = [];
    if (!canManageOwners) errors.push("Only the Root Owner can create Owner users.");
    if (!hasValue(ownerUserForm.name)) errors.push("Owner Full Name is required.");
    if (!hasValue(ownerUserForm.email)) errors.push("Owner Email is required.");
    if (!hasValue(ownerUserForm.password)) errors.push("Owner Password is required.");
    if (hasValue(ownerUserForm.password)) {
      const passwordPolicy = validatePasswordPolicy(ownerUserForm.password || "");
      if (!passwordPolicy.valid) errors.push(...passwordPolicy.errors.map(error => `Owner ${error}`));
    }
    if (hasValue(ownerUserForm.email) && !isValidEmail(ownerUserForm.email)) errors.push("Owner Email must be a valid email, for example owner@company.com.");
    if (!isValidPhone(ownerUserForm.phone)) errors.push("Owner Phone must be a valid international phone number, for example +34618829981.");
    if (errors.length) {
      setFormError(validationMessage(errors));
      return;
    }

    addSystemUser({
      id: `usr-owner-${Date.now()}`,
      companyId: currentUser?.companyId || "co-1",
      propertyIds: currentUser?.propertyIds || [],
      name: ownerUserForm.name,
      email: ownerUserForm.email,
      role: ownerUserForm.role || "Owner Console Manager",
      profile: "Owner",
      departments: ["Owner Console"],
      phone: ownerUserForm.phone || "",
      password: ownerUserForm.password,
      status: "Active",
      ownerConsoleAccess: true,
      permissions: ownerPermissions,
    });

    setOwnerUserForm({ profile: "Owner", role: "Owner Console Manager", status: "Active", departments: ["Owner Console"] });
    setShowOwnerUserForm(false);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            <Crown className="h-5 w-5" />
            <p className="text-sm font-medium uppercase">System Owner Module</p>
          </div>
          <h1 className="text-2xl font-bold">Owner Console</h1>
          <p className="text-muted-foreground">
            Manage billable customer tenants, first tenant admins, owner-console collaborators, and anti-resale boundaries.
          </p>
        </div>
        <div className="flex gap-2">
          {canManageOwners && (
            <Button variant="outline" className="gap-2" onClick={() => setShowOwnerUserForm(current => !current)}>
              <UserPlus size={16} />
              Add Owner User
            </Button>
          )}
          <Button className="gap-2" onClick={() => setShowTenantForm(current => !current)}>
            <Plus size={16} />
            New Tenant Sale
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-[#c98736]/30 bg-[#c98736]/10 p-5">
        <h2 className="mb-2 flex items-center gap-2 font-semibold"><KeyRound className="h-5 w-5 text-primary" /> Licensing Guardrail</h2>
        <p className="text-sm text-muted-foreground">
          Only this Owner Console can create or modify billable tenant companies and properties. Tenant admins can manage users and permissions only inside owner-provisioned properties, so they can self-manage operations without reselling KumbuOS to unrelated companies.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="h-5 w-5 text-primary" /> Credential Security Registry</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              All accounts are synced to the internal credential store. Passwords are stored as secure hashes with the last five password hashes retained for reuse prevention.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">{credentialSyncStatus}</span>
            <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">{pmsDataSyncStatus}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Account</th>
                <th className="px-5 py-3 font-medium">Profile</th>
                <th className="px-5 py-3 font-medium">Company / Properties</th>
                <th className="px-5 py-3 font-medium">Credential Status</th>
                <th className="px-5 py-3 font-medium text-right">Controls</th>
              </tr>
            </thead>
            <tbody>
              {credentialUsers.map(user => {
                const company = companies.find(item => item.id === user.companyId);
                const canControlCredential = canManageOwners || (!user.ownerConsoleAccess && user.profile !== "Owner");
                return (
                  <tr key={user.id} className="border-t border-border">
                    <td className="px-5 py-4">
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p>{user.profile || user.role}</p>
                      <p className="text-xs text-muted-foreground">{user.status}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p>{company?.name || (user.ownerConsoleAccess ? "Owner Console" : "Unassigned")}</p>
                      <p className="text-xs text-muted-foreground">{user.propertyIds.length} assigned properties</p>
                    </td>
                    <td className="px-5 py-4">
                      <p>{user.passwordHash ? "Secure hash stored" : "Legacy password pending migration"}</p>
                      <p className="text-xs text-muted-foreground">
                        Updated {user.passwordUpdatedAt ? new Date(user.passwordUpdatedAt).toLocaleDateString() : "pending"} - History {user.passwordHistory?.length || 0}/5
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canControlCredential}
                          onClick={async () => {
                            const request = await requestPasswordReset(user.email);
                            window.alert(request?.deliveryStatus === "Sent"
                              ? "Reset email sent from info@luxurytentedcamp.com."
                              : "Reset request created, but Zoho SMTP could not send the email.");
                          }}
                        >
                          Send Reset
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canControlCredential || user.id === currentUser?.id}
                          onClick={() => updateSystemUser(user.id, { status: user.status === "Active" ? "Suspended" : "Active" })}
                        >
                          {user.status === "Active" ? "Suspend" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {showTenantForm && (
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Create Billable Tenant and First Admin</h2>
          {formError && <FormError message={formError} />}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4 rounded-md border border-border p-4">
              <h3 className="font-semibold">Tenant Company</h3>
              <CompanyFields form={companyForm} onChange={setCompanyForm} />
            </div>
            <div className="space-y-4 rounded-md border border-border p-4">
              <h3 className="font-semibold">First Tenant Admin</h3>
              <UserFields form={adminForm} onChange={setAdminForm} />
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowTenantForm(false)}>Cancel</Button>
            <Button className="gap-2" onClick={saveTenant}><Save size={16} /> Create Tenant</Button>
          </div>
        </section>
      )}

      {showCompanyEdit && (
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Edit Billable Tenant</h2>
          {formError && <FormError message={formError} />}
          <CompanyFields form={companyForm} onChange={setCompanyForm} />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCompanyEdit(false)}>Cancel</Button>
            <Button className="gap-2" onClick={saveTenantProfile}><Save size={16} /> Save Tenant</Button>
          </div>
        </section>
      )}

      {showOwnerUserForm && canManageOwners && (
        <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Add Owner Console User</h2>
          {formError && <FormError message={formError} />}
          <UserFields form={ownerUserForm} onChange={setOwnerUserForm} />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowOwnerUserForm(false)}>Cancel</Button>
            <Button className="gap-2" onClick={saveOwnerUser}><Save size={16} /> Save Owner User</Button>
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold">Billable Tenant Companies</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Company</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">First Admins</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Owner Controls</th>
              </tr>
            </thead>
            <tbody>
              {billableTenants.map(company => (
                <tr key={company.id} className="border-t border-border">
                  <td className="px-5 py-4">
                    <p className="font-medium">{company.name}</p>
                    <p className="text-xs text-muted-foreground">{company.legalName}</p>
                  </td>
                  <td className="px-5 py-4">{company.plan}</td>
                  <td className="px-5 py-4">{systemUsers.filter(user => user.companyId === company.id && user.profile === "Admin").length}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2 py-1 text-xs ${company.status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {company.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => updateCompany(company.id, { status: company.status === "Active" ? "Suspended" : "Active" })}>
                        {company.status === "Active" ? "Suspend" : "Activate"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => editTenant(company)}>
                        <Edit size={14} /> Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openNewProperty(company.id)}>
                        <Building size={14} /> Add Property
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("Delete this tenant and all linked users/properties?") && deleteCompany(company.id)}>
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Building className="h-5 w-5 text-primary" /> Owner-Managed Properties</h2>
            <p className="text-sm text-muted-foreground">Only Owner Console users can create, edit, or delete tenant properties.</p>
          </div>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={activeTenant?.id || ""}
            onChange={event => setSelectedTenantId(event.target.value)}
          >
            {billableTenants.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}
          </select>
        </div>

        {showPropertyForm && (
          <div className="mb-5 rounded-md border border-border bg-muted/20 p-4">
            <h3 className="mb-3 font-semibold">{editingPropertyId ? "Edit Property" : "Add Property"}</h3>
            {formError && <FormError message={formError} />}
            <PropertyFields form={propertyForm} onChange={setPropertyForm} />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPropertyForm(false)}>Cancel</Button>
              <Button onClick={saveProperty}>Save Property</Button>
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          {tenantProperties.map(property => (
            <div key={property.id} className="rounded-md border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{property.name}</p>
                  <p className="text-sm text-muted-foreground">{property.website}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => editProperty(property)}><Edit size={15} /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("Delete this property?") && deleteProperty(property.id)}><Trash2 size={15} /></Button>
                </div>
              </div>
              <div className="mt-3 grid gap-2 text-sm">
                <p><span className="text-muted-foreground">Legal:</span> {property.legalName}</p>
                <p><span className="text-muted-foreground">Tax:</span> {property.taxId || "Pending"}</p>
                <p><span className="text-muted-foreground">Status:</span> {property.status || "Setup"}</p>
              </div>
            </div>
          ))}
          {tenantProperties.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No properties have been provisioned for this tenant yet.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="flex items-center gap-2 font-semibold"><Building2 className="h-5 w-5 text-primary" /> Owner Console Users</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {canManageOwners
              ? "Root Owner can create and manage Owner users."
              : "Only the Root Owner can create, edit, or delete Owner users."}
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {ownerUsers.map(user => (
            <div key={user.id} className="rounded-md border border-border p-4">
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="mt-2 text-xs text-muted-foreground">{user.status} · {user.role}</p>
            </div>
          ))}
        </div>
        {canManageOwners && (
          <div className="mt-5 rounded-md border border-border bg-muted/20 p-4">
            <h3 className="mb-3 font-semibold">Owner User Controls</h3>
            <div className="space-y-2">
              {ownerUsers.filter(user => user.id !== currentUser?.id).map(user => (
                <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-card p-3">
                  <div>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{user.email} - {user.status}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => updateSystemUser(user.id, { status: user.status === "Active" ? "Suspended" : "Active" })}>
                      {user.status === "Active" ? "Suspend" : "Activate"}
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => confirm("Delete this Owner user?") && deleteSystemUser(user.id)}>
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              ))}
              {ownerUsers.filter(user => user.id !== currentUser?.id).length === 0 && (
                <p className="text-sm text-muted-foreground">No additional Owner users have been created yet.</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function CompanyFields({ form, onChange }: { form: Partial<Company>; onChange: (form: Partial<Company>) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TextField label="Company Name" required value={form.name} onChange={value => onChange({ ...form, name: value })} placeholder="Customer company" />
      <TextField label="Website" required value={form.website} onChange={value => onChange({ ...form, website: value })} placeholder="https://company.com" />
      <TextField label="Business Sector" required value={form.businessSector} onChange={value => onChange({ ...form, businessSector: value })} placeholder="Luxury Hospitality" />
      <TextField label="Legal Name" required value={form.legalName} onChange={value => onChange({ ...form, legalName: value })} placeholder="Registered legal entity" />
      <TextField label="Tax ID" required value={form.taxId} onChange={value => onChange({ ...form, taxId: value })} placeholder="Tax ID" />
      <TextField label="Registration Number" required value={form.registrationNumber} onChange={value => onChange({ ...form, registrationNumber: value })} placeholder="Registry number" />
      <TextField label="Official Address" required value={form.officialAddress} onChange={value => onChange({ ...form, officialAddress: value })} placeholder="Official address" />
      <TextField label="Invoice Email" required value={form.invoiceEmail} onChange={value => onChange({ ...form, invoiceEmail: value })} placeholder="billing@company.com" />
    </div>
  );
}

function PropertyFields({ form, onChange }: { form: Partial<Property>; onChange: (form: Partial<Property>) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TextField label="Property Name" required value={form.name} onChange={value => onChange({ ...form, name: value })} placeholder="Property name" />
      <TextField label="Website" required value={form.website} onChange={value => onChange({ ...form, website: value })} placeholder="https://property.com" />
      <TextField label="Business Sector" required value={form.businessSector} onChange={value => onChange({ ...form, businessSector: value })} placeholder="Luxury Tented Camp" />
      <TextField label="Legal Name" required value={form.legalName} onChange={value => onChange({ ...form, legalName: value })} placeholder="Registered property entity" />
      <TextField label="Tax ID" required value={form.taxId} onChange={value => onChange({ ...form, taxId: value })} placeholder="Tax ID" />
      <TextField label="Registration Number" required value={form.registrationNumber} onChange={value => onChange({ ...form, registrationNumber: value })} placeholder="Registry number" />
      <TextField label="Official Address" required value={form.officialAddress} onChange={value => onChange({ ...form, officialAddress: value })} placeholder="Official address" />
      <TextField label="Invoice Email" required value={form.invoiceEmail} onChange={value => onChange({ ...form, invoiceEmail: value })} placeholder="billing@property.com" />
      <TextField label="Currency" required value={form.currency} onChange={value => onChange({ ...form, currency: value })} placeholder="USD" />
      <TextField label="Timezone" required value={form.timezone} onChange={value => onChange({ ...form, timezone: value })} placeholder="Africa/Dar_es_Salaam" />
      <TextField label="Rooms Count" required type="number" value={form.roomsCount?.toString()} onChange={value => onChange({ ...form, roomsCount: Number(value) })} placeholder="12" />
      <div>
        <label className="mb-1 block text-sm font-medium">Status *</label>
        <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.status || "Setup"} onChange={event => onChange({ ...form, status: event.target.value as Property["status"] })}>
          <option>Setup</option>
          <option>Active</option>
          <option>Inactive</option>
        </select>
      </div>
    </div>
  );
}

function UserFields({ form, onChange }: { form: Partial<SystemUser>; onChange: (form: Partial<SystemUser>) => void }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <TextField label="Full Name" required value={form.name} onChange={value => onChange({ ...form, name: value })} placeholder="Full name" />
      <TextField label="Email" required value={form.email} onChange={value => onChange({ ...form, email: value })} placeholder="user@company.com" />
      <TextField label="Phone" value={form.phone} onChange={value => onChange({ ...form, phone: value })} placeholder="+255 700 000 000" />
      <TextField label="Password" required value={form.password} onChange={value => onChange({ ...form, password: value })} placeholder="Create password" type="password" />
      <p className="text-xs text-muted-foreground md:col-span-2">Password must include uppercase, lowercase, number, and special character.</p>
      <div>
        <label className="mb-1 block text-sm font-medium">Role *</label>
        <select
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={form.profile || "Admin"}
          onChange={event => {
            const profile = event.target.value as UserProfile;
            onChange({ ...form, profile, role: profile === "Owner" ? "Owner Console Manager" : profile, ownerConsoleAccess: profile === "Owner" });
          }}
        >
          {roleOptions.map(role => <option key={role}>{role}</option>)}
        </select>
      </div>
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div className="mb-4 whitespace-pre-line rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      {message}
    </div>
  );
}

function TextField({ label, value, onChange, placeholder, type = "text", required = false }: { label: string; value?: string; onChange: (value: string) => void; placeholder: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}{required ? " *" : ""}</label>
      <Input type={type} required={required} value={value || ""} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}
