import { ChangeEvent, ReactNode, useMemo, useState } from "react";
import { useLocation } from "react-router";
import * as XLSX from "xlsx";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  Info,
  Mail,
  MailCheck,
  Maximize2,
  Minimize2,
  PauseCircle,
  Play,
  Plus,
  Save,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../components/ui/tooltip";
import {
  Client,
  CommunicationAudience,
  CommunicationCampaign,
  CommunicationCampaignType,
  CommunicationEvent,
  CommunicationImportList,
  CommunicationOutboxJob,
  CommunicationProviderAccount,
  CommunicationRecipient,
  CommunicationRecipientScope,
  CommunicationScheduleMode,
  CommunicationSender,
  CommunicationSendingRule,
  CommunicationStatus,
  CommunicationSuppression,
  CommunicationTemplate,
  CommunicationTemplateAsset,
  Reservation,
  useAppContext,
} from "../../context/AppContext";
import { exportToCSV, exportToExcel, exportToJSON, exportToPDF } from "../../utils/export";

type SectionKey =
  | "dashboard"
  | "senders"
  | "provider-settings"
  | "dns-verification"
  | "recipients"
  | "templates"
  | "sending-rules"
  | "campaigns"
  | "outbox"
  | "logs"
  | "suppression-list";

type ImportedRow = Record<string, string>;

const sectionTitles: Record<SectionKey, string> = {
  dashboard: "Dashboard",
  senders: "Senders",
  "provider-settings": "Provider Settings",
  "dns-verification": "DNS Verification",
  recipients: "Recipients",
  templates: "Templates",
  "sending-rules": "Sending Rules",
  campaigns: "Campaigns",
  outbox: "Outbox Queue",
  logs: "Logs",
  "suppression-list": "Suppression List",
};

const marketingTypes: CommunicationCampaignType[] = ["Operational", "Marketing"];
const statusOptions: CommunicationStatus[] = ["Draft", "Active", "Paused", "Archived"];
const scheduleModes: CommunicationScheduleMode[] = ["Manual", "Before Check-in", "After Check-out", "Birthday"];
const recipientScopes: CommunicationRecipientScope[] = ["Selected Audience", "All PMS Reservation Clients"];
const clientCategories: Array<Client["category"] | "All"> = ["All", "Tour Operator", "Agency", "Direct Client", "Corporate", "Other"];
const variables = ["{{name}}", "{{email}}", "{{hotel_name}}", "{{property_name}}", "{{reservation_code}}", "{{checkin_date}}", "{{checkout_date}}", "{{unsubscribe_url}}"];
const fallbackTimezones = [
  "Africa/Dar_es_Salaam",
  "Africa/Nairobi",
  "Africa/Johannesburg",
  "Africa/Cairo",
  "Africa/Lagos",
  "Europe/Madrid",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];
const timezoneOptions = (() => {
  try {
    const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    const zones = supportedValuesOf?.("timeZone");
    return zones?.length ? zones : fallbackTimezones;
  } catch {
    return fallbackTimezones;
  }
})();

export function Communications() {
  const location = useLocation();
  const section = getSection(location.pathname);
  const {
    currentUser,
    companies,
    properties,
    selectedCompanyId,
    selectedPropertyId,
    clients,
    reservations,
    communicationSenders,
    addCommunicationSender,
    updateCommunicationSender,
    deleteCommunicationSender,
    communicationProviderAccounts,
    addCommunicationProviderAccount,
    updateCommunicationProviderAccount,
    deleteCommunicationProviderAccount,
    communicationTemplates,
    addCommunicationTemplate,
    updateCommunicationTemplate,
    deleteCommunicationTemplate,
    communicationTemplateAssets,
    addCommunicationTemplateAsset,
    deleteCommunicationTemplateAsset,
    communicationImportLists,
    addCommunicationImportList,
    deleteCommunicationImportList,
    communicationRecipients,
    addCommunicationRecipient,
    updateCommunicationRecipient,
    deleteCommunicationRecipient,
    communicationAudiences,
    addCommunicationAudience,
    updateCommunicationAudience,
    deleteCommunicationAudience,
    communicationCampaigns,
    addCommunicationCampaign,
    updateCommunicationCampaign,
    deleteCommunicationCampaign,
    communicationSendingRules,
    addCommunicationSendingRule,
    updateCommunicationSendingRule,
    deleteCommunicationSendingRule,
    communicationOutbox,
    addCommunicationOutboxJob,
    updateCommunicationOutboxJob,
    deleteCommunicationOutboxJob,
    communicationEvents,
    addCommunicationEvent,
    communicationSuppressionList,
    addCommunicationSuppression,
    updateCommunicationSuppression,
    deleteCommunicationSuppression,
    communicationUnsubscribes,
    communicationHelpTooltips,
  } = useAppContext();

  const activeCompany = companies.find(company => company.id === selectedCompanyId);
  const activeProperty = properties.find(property => property.id === selectedPropertyId);
  const canEdit = Boolean(currentUser?.permissions.some(permission => permission.module === "Communications" && permission.section === sectionTitles[section] && permission.access === "edit"));
  const canView = canEdit || Boolean(currentUser?.permissions.some(permission => permission.module === "Communications" && permission.section === sectionTitles[section] && permission.access !== "none"));

  const scoped = useMemo(() => {
    const byProperty = <T extends { propertyId: string }>(items: T[]) => items.filter(item => item.propertyId === selectedPropertyId);
    return {
      senders: byProperty(communicationSenders),
      providers: byProperty(communicationProviderAccounts),
      templates: byProperty(communicationTemplates),
      assets: byProperty(communicationTemplateAssets),
      importLists: byProperty(communicationImportLists),
      recipients: byProperty(communicationRecipients),
      audiences: byProperty(communicationAudiences),
      campaigns: byProperty(communicationCampaigns),
      rules: byProperty(communicationSendingRules),
      outbox: byProperty(communicationOutbox),
      events: byProperty(communicationEvents),
      suppressions: byProperty(communicationSuppressionList),
      unsubscribes: communicationUnsubscribes.filter(item => item.propertyId === selectedPropertyId),
    };
  }, [
    selectedPropertyId,
    communicationSenders,
    communicationProviderAccounts,
    communicationTemplates,
    communicationTemplateAssets,
    communicationImportLists,
    communicationRecipients,
    communicationAudiences,
    communicationCampaigns,
    communicationSendingRules,
    communicationOutbox,
    communicationEvents,
    communicationSuppressionList,
    communicationUnsubscribes,
  ]);

  const helpFor = (fieldKey: string) => communicationHelpTooltips.find(item => item.fieldKey === fieldKey);
  const meta = () => ({
    tenantId: activeCompany?.parentCompanyId || activeCompany?.id || selectedCompanyId,
    companyId: selectedCompanyId,
    propertyId: selectedPropertyId,
    createdBy: currentUser?.id || "system",
    updatedBy: currentUser?.id || "system",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "Active" as CommunicationStatus,
  });

  if (!canView) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-destructive">
          You do not have permission to view this Communications section.
        </div>
      </div>
    );
  }

  const sharedProps = {
    activeCompany,
    activeProperty,
    currentUserId: currentUser?.id || "system",
    selectedCompanyId,
    selectedPropertyId,
    clients,
    reservations,
    canEdit,
    scoped,
    helpFor,
    meta,
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8" data-pdf-export-root>
      <Header section={section} scoped={scoped} />
      {section === "dashboard" && <Dashboard {...sharedProps} />}
      {section === "senders" && (
        <SendersSection
          {...sharedProps}
          addCommunicationSender={addCommunicationSender}
          updateCommunicationSender={updateCommunicationSender}
          deleteCommunicationSender={deleteCommunicationSender}
        />
      )}
      {section === "provider-settings" && (
        <ProviderSettingsSection
          {...sharedProps}
          addCommunicationProviderAccount={addCommunicationProviderAccount}
          updateCommunicationProviderAccount={updateCommunicationProviderAccount}
          deleteCommunicationProviderAccount={deleteCommunicationProviderAccount}
        />
      )}
      {section === "dns-verification" && (
        <DnsVerificationSection {...sharedProps} updateCommunicationSender={updateCommunicationSender} />
      )}
      {section === "recipients" && (
        <RecipientsSection
          {...sharedProps}
          addCommunicationRecipient={addCommunicationRecipient}
          updateCommunicationRecipient={updateCommunicationRecipient}
          deleteCommunicationRecipient={deleteCommunicationRecipient}
          addCommunicationImportList={addCommunicationImportList}
          deleteCommunicationImportList={deleteCommunicationImportList}
          addCommunicationAudience={addCommunicationAudience}
          updateCommunicationAudience={updateCommunicationAudience}
          deleteCommunicationAudience={deleteCommunicationAudience}
        />
      )}
      {section === "templates" && (
        <TemplatesSection
          {...sharedProps}
          addCommunicationTemplate={addCommunicationTemplate}
          updateCommunicationTemplate={updateCommunicationTemplate}
          deleteCommunicationTemplate={deleteCommunicationTemplate}
          addCommunicationTemplateAsset={addCommunicationTemplateAsset}
          deleteCommunicationTemplateAsset={deleteCommunicationTemplateAsset}
        />
      )}
      {section === "sending-rules" && (
        <SendingRulesSection
          {...sharedProps}
          addCommunicationSendingRule={addCommunicationSendingRule}
          updateCommunicationSendingRule={updateCommunicationSendingRule}
          deleteCommunicationSendingRule={deleteCommunicationSendingRule}
        />
      )}
      {section === "campaigns" && (
        <CampaignsSection
          {...sharedProps}
          addCommunicationCampaign={addCommunicationCampaign}
          updateCommunicationCampaign={updateCommunicationCampaign}
          deleteCommunicationCampaign={deleteCommunicationCampaign}
          addCommunicationRecipient={addCommunicationRecipient}
          addCommunicationOutboxJob={addCommunicationOutboxJob}
          addCommunicationEvent={addCommunicationEvent}
        />
      )}
      {section === "outbox" && (
        <OutboxSection
          {...sharedProps}
          updateCommunicationOutboxJob={updateCommunicationOutboxJob}
          deleteCommunicationOutboxJob={deleteCommunicationOutboxJob}
          updateCommunicationCampaign={updateCommunicationCampaign}
          addCommunicationEvent={addCommunicationEvent}
        />
      )}
      {section === "logs" && <LogsSection {...sharedProps} />}
      {section === "suppression-list" && (
        <SuppressionSection
          {...sharedProps}
          addCommunicationSuppression={addCommunicationSuppression}
          updateCommunicationSuppression={updateCommunicationSuppression}
          deleteCommunicationSuppression={deleteCommunicationSuppression}
        />
      )}
    </div>
  );
}

function Header({ section, scoped }: { section: SectionKey; scoped: ScopedData }) {
  const exportRows = [
    ...scoped.campaigns.map(item => ({ Type: "Campaign", Name: item.name, Status: item.status, Recipients: item.finalRecipientCount })),
    ...scoped.outbox.map(item => ({ Type: "Outbox", Name: item.recipientEmail, Status: item.status, Campaign: item.campaignId })),
    ...scoped.events.map(item => ({ Type: "Event", Name: item.type, Status: item.status, Message: item.message })),
  ];
  const title = `Communications - ${sectionTitles[section]}`;
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Email Communications</p>
        <h1 className="text-3xl font-bold">{sectionTitles[section]}</h1>
        <p className="max-w-3xl text-muted-foreground">
          Email-only campaign management with senders, templates, recipients, rate limits, outbox jobs, logs, and suppression controls.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => exportToCSV(exportRows, title)}><Download className="mr-2 h-4 w-4" />CSV</Button>
        <Button variant="outline" size="sm" onClick={() => exportToExcel(exportRows, title)}>Excel</Button>
        <Button variant="outline" size="sm" onClick={() => exportToJSON(exportRows, title)}>JSON</Button>
        <Button variant="outline" size="sm" onClick={() => exportToPDF(exportRows, title, title)}>PDF</Button>
      </div>
    </div>
  );
}

type ScopedData = {
  senders: CommunicationSender[];
  providers: CommunicationProviderAccount[];
  templates: CommunicationTemplate[];
  assets: CommunicationTemplateAsset[];
  importLists: CommunicationImportList[];
  recipients: CommunicationRecipient[];
  audiences: CommunicationAudience[];
  campaigns: CommunicationCampaign[];
  rules: CommunicationSendingRule[];
  outbox: CommunicationOutboxJob[];
  events: CommunicationEvent[];
  suppressions: CommunicationSuppression[];
  unsubscribes: { email: string; status: CommunicationStatus }[];
};

type SharedProps = {
  activeCompany?: { id: string; name: string } | undefined;
  activeProperty?: { id: string; name: string; timezone?: string; website?: string } | undefined;
  currentUserId: string;
  selectedCompanyId: string;
  selectedPropertyId: string;
  clients: Client[];
  reservations: Reservation[];
  canEdit: boolean;
  scoped: ScopedData;
  helpFor: (fieldKey: string) => { title: string; body: string; example?: string; warning?: string } | undefined;
  meta: () => {
    tenantId?: string;
    companyId: string;
    propertyId: string;
    createdBy: string;
    updatedBy: string;
    createdAt: string;
    updatedAt: string;
    status: CommunicationStatus;
  };
};

function Dashboard({ scoped }: SharedProps) {
  const sent = scoped.outbox.filter(job => ["sent", "delivered"].includes(job.status)).length;
  const failed = scoped.outbox.filter(job => job.status === "failed").length;
  const pending = scoped.outbox.filter(job => ["pending", "queued", "sending"].includes(job.status)).length;
  const delivered = scoped.outbox.filter(job => job.status === "delivered").length;
  const bounces = scoped.outbox.filter(job => ["hard_bounced", "soft_bounced"].includes(job.status)).length;
  const unsubscribes = scoped.suppressions.filter(item => item.reason === "Unsubscribe").length;
  const latestErrors = scoped.events.filter(event => event.type === "failed").slice(0, 5);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Metric icon={BarChart3} label="Campaigns" value={scoped.campaigns.length} />
        <Metric icon={MailCheck} label="Sent" value={sent} tone="positive" />
        <Metric icon={Clock} label="Pending" value={pending} />
        <Metric icon={CheckCircle2} label="Delivered" value={delivered} tone="positive" />
        <Metric icon={XCircle} label="Failed" value={failed} tone="negative" />
        <Metric icon={ShieldAlert} label="Bounces / Bajas" value={`${bounces} / ${unsubscribes}`} tone="negative" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Campaign Summary" icon={Send}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Campaign</th><th className="p-3">Status</th><th className="p-3">Recipients</th><th className="p-3">Outbox</th></tr>
              </thead>
              <tbody>
                {scoped.campaigns.map(campaign => (
                  <tr key={campaign.id} className="border-t border-border">
                    <td className="p-3 font-medium">{campaign.name}</td>
                    <td className="p-3">{campaign.status}</td>
                    <td className="p-3">{campaign.finalRecipientCount}</td>
                    <td className="p-3">{scoped.outbox.filter(job => job.campaignId === campaign.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!scoped.campaigns.length && <EmptyState>No campaigns created yet.</EmptyState>}
          </div>
        </Panel>

        <Panel title="Latest Errors" icon={AlertTriangle}>
          <div className="space-y-3">
            {latestErrors.map(error => (
              <div key={error.id} className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm">
                <p className="font-medium text-destructive">{error.recipientEmail || "Unknown recipient"}</p>
                <p className="text-muted-foreground">{error.errorDetail || error.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(error.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {!latestErrors.length && <EmptyState>No delivery errors yet.</EmptyState>}
          </div>
        </Panel>
      </div>
    </>
  );
}

function SendersSection({
  canEdit,
  scoped,
  helpFor,
  meta,
  addCommunicationSender,
  updateCommunicationSender,
  deleteCommunicationSender,
}: SharedProps & {
  addCommunicationSender: (sender: CommunicationSender) => void;
  updateCommunicationSender: (id: string, sender: Partial<CommunicationSender>) => void;
  deleteCommunicationSender: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<Partial<CommunicationSender>>({ fromName: "", fromEmail: "", replyToEmail: "", verified: false, defaultSender: false, status: "Active" });
  const [error, setError] = useState("");
  const startEdit = (sender: CommunicationSender) => {
    setEditingId(sender.id);
    setForm(sender);
    setError("");
  };
  const save = () => {
    setError("");
    const errors = [];
    if (!form.fromName) errors.push("From name is required.");
    if (!isValidEmail(form.fromEmail)) errors.push("From email must be valid.");
    if (form.replyToEmail && !isValidEmail(form.replyToEmail)) errors.push("Reply-to email must be valid.");
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    const now = new Date().toISOString();
    const payload: CommunicationSender = {
      ...meta(),
      id: editingId || `comm-sender-${Date.now()}`,
      providerAccountId: form.providerAccountId || "",
      fromName: form.fromName || "",
      fromEmail: form.fromEmail || "",
      replyToEmail: form.replyToEmail || form.fromEmail || "",
      verified: Boolean(form.verified),
      defaultSender: Boolean(form.defaultSender),
      status: form.status || "Active",
      updatedAt: now,
    };
    if (editingId) updateCommunicationSender(editingId, payload);
    else addCommunicationSender(payload);
    setEditingId("");
    setForm({ fromName: "", fromEmail: "", replyToEmail: "", verified: false, defaultSender: false, status: "Active" });
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Panel title={editingId ? "Edit Sender" : "Create Sender"} icon={Mail}>
        <div className="space-y-4">
          <Field label="From Name" info={helpFor("fromEmail")} value={form.fromName || ""} onChange={value => setForm({ ...form, fromName: value })} placeholder="Kumbukumbu Reservations" />
          <Field label="From Email" info={helpFor("fromEmail")} value={form.fromEmail || ""} onChange={value => setForm({ ...form, fromEmail: value })} placeholder="reservations@hotel.com" />
          <Field label="Reply-To Email" info={helpFor("replyToEmail")} value={form.replyToEmail || ""} onChange={value => setForm({ ...form, replyToEmail: value })} placeholder="guestrelations@hotel.com" />
          <SelectField label="Provider" info={helpFor("provider")} value={form.providerAccountId || ""} onChange={value => setForm({ ...form, providerAccountId: value })} options={[{ value: "", label: "No provider / use default" }, ...scoped.providers.map(provider => ({ value: provider.id, label: `${provider.name} (${provider.provider} - ${provider.mode})` }))]} />
          <SelectField label="Status" value={form.status || "Active"} onChange={value => setForm({ ...form, status: value as CommunicationStatus })} options={statusOptions.map(value => ({ value, label: value }))} />
          <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
            <input type="checkbox" checked={Boolean(form.verified)} onChange={event => setForm({ ...form, verified: event.target.checked })} />
            Verified sender
          </label>
          <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
            <input type="checkbox" checked={Boolean(form.defaultSender)} onChange={event => setForm({ ...form, defaultSender: event.target.checked })} />
            Default sender for this property
          </label>
          {error && <FormError message={error} />}
          <div className="flex justify-end gap-2">
            {editingId && <Button variant="outline" onClick={() => { setEditingId(""); setForm({}); }}>Cancel</Button>}
            <Button disabled={!canEdit} onClick={save}><Save className="mr-2 h-4 w-4" />Save Sender</Button>
          </div>
        </div>
      </Panel>

      <Panel title="Configured Senders" icon={MailCheck}>
        <div className="grid gap-3 md:grid-cols-2">
          {scoped.senders.map(sender => (
            <div key={sender.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{sender.fromName}</p>
                  <p className="text-sm text-muted-foreground">{sender.fromEmail}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Reply-to: {sender.replyToEmail}</p>
                </div>
                <Badge tone={sender.verified ? "positive" : "warning"}>{sender.verified ? "Verified" : "Not verified"}</Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {sender.defaultSender && <Badge>Default</Badge>}
                <Badge>{sender.status}</Badge>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => startEdit(sender)}>Edit</Button>
                <Button variant="ghost" size="icon" disabled={!canEdit} className="text-destructive" onClick={() => confirm("Delete this sender?") && deleteCommunicationSender(sender.id)}><Trash2 size={16} /></Button>
              </div>
            </div>
          ))}
          {!scoped.senders.length && <EmptyState>No senders created yet.</EmptyState>}
        </div>
      </Panel>
    </div>
  );
}

function ProviderSettingsSection({
  canEdit,
  scoped,
  helpFor,
  meta,
  addCommunicationProviderAccount,
  updateCommunicationProviderAccount,
  deleteCommunicationProviderAccount,
}: SharedProps & {
  addCommunicationProviderAccount: (account: CommunicationProviderAccount) => void;
  updateCommunicationProviderAccount: (id: string, account: Partial<CommunicationProviderAccount>) => void;
  deleteCommunicationProviderAccount: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<Partial<CommunicationProviderAccount>>({ provider: "Mock/Test", mode: "test", name: "Mock test provider", smtpPort: 465, secure: true, status: "Active" });
  const [error, setError] = useState("");
  const save = () => {
    setError("");
    const errors = [];
    if (!form.name) errors.push("Provider name is required.");
    if (form.provider === "SMTP" && form.mode === "live") {
      if (!form.smtpHost) errors.push("SMTP host is required for live SMTP.");
      if (!form.smtpPort) errors.push("SMTP port is required for live SMTP.");
      if (!form.smtpUsername) errors.push("SMTP username is required for live SMTP.");
      if (!form.smtpPassword) errors.push("SMTP password or app password is required for live SMTP.");
    }
    if (errors.length) {
      setError(errors.join(" "));
      return;
    }
    const payload: CommunicationProviderAccount = {
      ...meta(),
      id: editingId || `comm-provider-${Date.now()}`,
      provider: form.provider || "Mock/Test",
      mode: form.mode || "test",
      name: form.name || "Provider",
      smtpHost: form.smtpHost || "",
      smtpPort: Number(form.smtpPort || 465),
      smtpUsername: form.smtpUsername || "",
      smtpPassword: form.smtpPassword || "",
      secure: Boolean(form.secure),
      apiKeyLabel: form.apiKeyLabel || "",
      status: form.status || "Active",
    };
    if (editingId) updateCommunicationProviderAccount(editingId, payload);
    else addCommunicationProviderAccount(payload);
    setEditingId("");
    setForm({ provider: "Mock/Test", mode: "test", name: "Mock test provider", smtpPort: 465, secure: true, status: "Active" });
  };
  const startEdit = (provider: CommunicationProviderAccount) => {
    setEditingId(provider.id);
    setForm(provider);
    setError("");
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[460px_1fr]">
      <Panel title={editingId ? "Edit Provider" : "Create Provider"} icon={Database}>
        <div className="space-y-4">
          <Field label="Provider Name" info={helpFor("provider")} value={form.name || ""} onChange={value => setForm({ ...form, name: value })} placeholder="Zoho SMTP - Main Camp" />
          <SelectField label="Provider" info={helpFor("provider")} value={form.provider || "Mock/Test"} onChange={value => setForm({ ...form, provider: value as CommunicationProviderAccount["provider"] })} options={[{ value: "Mock/Test", label: "Mock/Test" }, { value: "SMTP", label: "SMTP" }]} />
          <SelectField label="Mode" value={form.mode || "test"} onChange={value => setForm({ ...form, mode: value as CommunicationProviderAccount["mode"] })} options={[{ value: "test", label: "Test / sandbox" }, { value: "live", label: "Live sending" }]} />
          <Field label="SMTP Host" value={form.smtpHost || ""} onChange={value => setForm({ ...form, smtpHost: value })} placeholder="smtp.zoho.eu" />
          <Field label="SMTP Port" value={String(form.smtpPort || "")} onChange={value => setForm({ ...form, smtpPort: Number(value) })} placeholder="465" type="number" />
          <Field label="SMTP Username" value={form.smtpUsername || ""} onChange={value => setForm({ ...form, smtpUsername: value })} placeholder="info@hotel.com" />
          <Field label="SMTP Password / App Password" info={helpFor("apiKey")} value={form.smtpPassword || ""} onChange={value => setForm({ ...form, smtpPassword: value })} placeholder="Provider app password" type="password" />
          <label className="flex items-center gap-2 rounded-md border border-border p-3 text-sm">
            <input type="checkbox" checked={Boolean(form.secure)} onChange={event => setForm({ ...form, secure: event.target.checked })} />
            SSL / secure SMTP
          </label>
          {error && <FormError message={error} />}
          <Button disabled={!canEdit} className="w-full" onClick={save}><Save className="mr-2 h-4 w-4" />Save Provider</Button>
        </div>
      </Panel>
      <Panel title="Provider Accounts" icon={Sparkles}>
        <div className="space-y-3">
          {scoped.providers.map(provider => (
            <div key={provider.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{provider.name}</p>
                  <p className="text-sm text-muted-foreground">{provider.provider} - {provider.mode}</p>
                </div>
                <Badge tone={provider.mode === "test" ? "warning" : "positive"}>{provider.mode === "test" ? "Sandbox" : "Live"}</Badge>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{provider.provider === "SMTP" ? `${provider.smtpHost}:${provider.smtpPort}` : "Mock provider records jobs and logs without sending real emails."}</p>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => startEdit(provider)}>Edit</Button>
                <Button variant="ghost" size="icon" disabled={!canEdit} className="text-destructive" onClick={() => confirm("Delete this provider?") && deleteCommunicationProviderAccount(provider.id)}><Trash2 size={16} /></Button>
              </div>
            </div>
          ))}
          {!scoped.providers.length && <EmptyState>Create a Mock/Test provider first to test campaigns safely.</EmptyState>}
        </div>
      </Panel>
    </div>
  );
}

function DnsVerificationSection({ canEdit, scoped, helpFor, updateCommunicationSender }: SharedProps & { updateCommunicationSender: (id: string, sender: Partial<CommunicationSender>) => void }) {
  const domains = Array.from(new Set(scoped.senders.map(sender => sender.fromEmail.split("@")[1]).filter(Boolean)));
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      {domains.map(domain => (
        <Panel key={domain} title={domain} icon={ShieldAlert}>
          <DnsRow label="SPF" info={helpFor("spf")} value={`v=spf1 include:_spf.${domain} include:zoho.eu include:spf.protection.outlook.com ~all`} />
          <DnsRow label="DKIM" info={helpFor("dkim")} value={`selector1._domainkey.${domain} TXT/CNAME from your provider`} />
          <DnsRow label="DMARC" info={helpFor("dmarc")} value={`v=DMARC1; p=none; rua=mailto:dmarc@${domain}`} />
          <div className="mt-4 space-y-2">
            {scoped.senders.filter(sender => sender.fromEmail.endsWith(`@${domain}`)).map(sender => (
              <div key={sender.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-sm">
                <span>{sender.fromEmail}</span>
                <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => updateCommunicationSender(sender.id, { verified: !sender.verified, updatedAt: new Date().toISOString() })}>
                  {sender.verified ? "Mark unverified" : "Mark verified"}
                </Button>
              </div>
            ))}
          </div>
        </Panel>
      ))}
      {!domains.length && <EmptyState>Create a sender first. DNS guidance will appear by sender domain.</EmptyState>}
    </div>
  );
}

function RecipientsSection({
  canEdit,
  selectedCompanyId,
  selectedPropertyId,
  scoped,
  clients,
  reservations,
  helpFor,
  meta,
  addCommunicationRecipient,
  updateCommunicationRecipient,
  deleteCommunicationRecipient,
  addCommunicationImportList,
  deleteCommunicationImportList,
  addCommunicationAudience,
  updateCommunicationAudience,
  deleteCommunicationAudience,
}: SharedProps & {
  clients: Client[];
  reservations: { id: string; propertyId: string; clientId: string; checkIn: string; checkOut: string; status: string }[];
  addCommunicationRecipient: (recipient: CommunicationRecipient) => void;
  updateCommunicationRecipient: (id: string, recipient: Partial<CommunicationRecipient>) => void;
  deleteCommunicationRecipient: (id: string) => void;
  addCommunicationImportList: (list: CommunicationImportList) => void;
  deleteCommunicationImportList: (id: string) => void;
  addCommunicationAudience: (audience: CommunicationAudience) => void;
  updateCommunicationAudience: (id: string, audience: Partial<CommunicationAudience>) => void;
  deleteCommunicationAudience: (id: string) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [filters, setFilters] = useState({ category: "All", from: "", to: "", stayStatus: "All" });
  const [audienceName, setAudienceName] = useState(`PMS clients ${new Date().toISOString().slice(0, 10)}`);
  const [importName, setImportName] = useState("Imported audience");
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState({ name: "Name", email: "Email", language: "Language", reservationCode: "Reservation", checkinDate: "Check-in", checkoutDate: "Check-out", dateOfBirth: "Date of Birth" });
  const [error, setError] = useState("");
  const [manualAudienceId, setManualAudienceId] = useState("");
  const [manualRecipient, setManualRecipient] = useState({ name: "", email: "", language: "", reservationCode: "", checkinDate: "", checkoutDate: "", dateOfBirth: "", marketingOptIn: false });
  const [manualError, setManualError] = useState("");
  const [editingAudienceId, setEditingAudienceId] = useState("");
  const [editingAudienceName, setEditingAudienceName] = useState("");

  const clientCandidates = useMemo(() => {
    const propertyReservations = reservations.filter(reservation => reservation.propertyId === selectedPropertyId);
    return propertyReservations
      .filter(reservation => {
        const client = clients.find(item => item.id === reservation.clientId);
        if (!client?.email && !client?.emails?.length) return false;
        if (filters.category !== "All" && client?.category !== filters.category) return false;
        if (filters.from && reservation.checkIn < filters.from) return false;
        if (filters.to && reservation.checkIn > filters.to) return false;
        if (filters.stayStatus === "Current" && !(reservation.checkIn <= today && reservation.checkOut >= today)) return false;
        if (filters.stayStatus === "Future" && reservation.checkIn < today) return false;
        return true;
      })
      .map(reservation => {
        const client = clients.find(item => item.id === reservation.clientId)!;
        return { reservation, client };
      });
  }, [clients, filters, reservations, selectedPropertyId, today]);

  const parseExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json<ImportedRow>(sheet, { defval: "" }).map(row =>
        Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key).trim(), String(value).trim()]))
      );
      const keys = Object.keys(parsed[0] || {});
      setRows(parsed);
      setColumns(keys);
      setMapping(current => ({
        name: findColumn(keys, ["name", "nombre", "guest", "client"]) || current.name,
        email: findColumn(keys, ["email", "mail", "correo"]) || current.email,
        language: findColumn(keys, ["language", "idioma", "lang"]) || current.language,
        reservationCode: findColumn(keys, ["reservation", "booking", "code"]) || current.reservationCode,
        checkinDate: findColumn(keys, ["check-in", "checkin", "arrival"]) || current.checkinDate,
        checkoutDate: findColumn(keys, ["check-out", "checkout", "departure"]) || current.checkoutDate,
        dateOfBirth: findColumn(keys, ["date of birth", "birth", "birthday", "dob"]) || current.dateOfBirth,
      }));
    } catch {
      setError("The Excel file could not be read. Use .xlsx, .xls, .csv, or .tsv with a visible first sheet.");
    }
  };

  const saveImport = () => {
    setError("");
    if (!rows.length) {
      setError("Upload an Excel file before saving an import list.");
      return;
    }
    if (!mapping.email || !columns.includes(mapping.email)) {
      setError("Map the email column before saving.");
      return;
    }
    const listId = `comm-import-${Date.now()}`;
    const seen = new Set<string>();
    const recipients = rows.map((row, index) => {
      const email = String(row[mapping.email] || "").trim().toLowerCase();
      const duplicate = seen.has(email);
      if (email) seen.add(email);
      const valid = isValidEmail(email) && !duplicate;
      const marketingOptIn = extractMarketingConsent(row);
      return {
        ...meta(),
        id: `comm-recipient-${Date.now()}-${index}`,
        source: "Excel" as const,
        importListId: listId,
        name: String(row[mapping.name] || email || `Recipient ${index + 1}`),
        email,
        language: String(row[mapping.language] || ""),
        reservationCode: String(row[mapping.reservationCode] || ""),
        checkinDate: String(row[mapping.checkinDate] || ""),
        checkoutDate: String(row[mapping.checkoutDate] || ""),
        dateOfBirth: String(row[mapping.dateOfBirth] || ""),
        marketingOptIn,
        variables: {
          ...row,
          date_of_birth: String(row[mapping.dateOfBirth] || ""),
          birthday_month_day: getMonthDay(String(row[mapping.dateOfBirth] || "")),
          marketing_opt_in: marketingOptIn ? "true" : "false",
        },
        valid,
        validationError: valid ? "" : duplicate ? "Duplicate email in import." : "Invalid or empty email.",
        suppressed: scoped.suppressions.some(item => item.email.toLowerCase() === email),
      } satisfies CommunicationRecipient;
    });
    recipients.forEach(addCommunicationRecipient);
    addCommunicationImportList({
      ...meta(),
      id: listId,
      name: importName || fileName,
      fileName,
      mappedColumns: mapping,
      recipientIds: recipients.map(item => item.id),
      totalRows: rows.length,
      validRows: recipients.filter(item => item.valid).length,
      invalidRows: recipients.filter(item => !item.valid).length,
      duplicateRows: rows.length - seen.size,
    });
    addCommunicationAudience({
      ...meta(),
      id: `comm-audience-${Date.now()}`,
      name: importName || fileName,
      source: "Import List",
      filters: { fileName },
      recipientIds: recipients.filter(item => item.valid).map(item => item.id),
    });
    setRows([]);
    setColumns([]);
    setFileName("");
  };

  const createAudienceFromClients = () => {
    const seen = new Set<string>();
    const recipients: CommunicationRecipient[] = [];
    const name = audienceName.trim();
    if (!name) {
      setError("Enter an audience name before creating a PMS client audience.");
      return;
    }
    setError("");
    clientCandidates.forEach(({ client, reservation }, index) => {
      const emails = client.emails?.length ? client.emails : client.email ? [client.email] : [];
      emails.forEach(emailValue => {
        const email = emailValue.trim().toLowerCase();
        if (!isValidEmail(email) || seen.has(email)) return;
        seen.add(email);
        recipients.push({
          ...meta(),
          id: `comm-recipient-client-${Date.now()}-${index}-${recipients.length}`,
          source: "Reservation",
          sourceId: reservation.id,
          name: client.name,
          email,
          reservationCode: reservation.id,
          checkinDate: reservation.checkIn,
          checkoutDate: reservation.checkOut,
          dateOfBirth: client.dateOfBirth || "",
          clientCategory: client.category,
          marketingOptIn: client.marketingOptIn,
          valid: true,
          suppressed: scoped.suppressions.some(item => item.email.toLowerCase() === email),
          variables: {
            name: client.name,
            email,
            client_id: client.id,
            client_category: client.category || "",
            marketing_opt_in: client.marketingOptIn ? "true" : "false",
            reservation_code: reservation.id,
            checkin_date: reservation.checkIn,
            checkout_date: reservation.checkOut,
            date_of_birth: client.dateOfBirth || "",
            birthday_month_day: getMonthDay(client.dateOfBirth || ""),
          },
        });
      });
    });
    recipients.forEach(addCommunicationRecipient);
    addCommunicationAudience({
      ...meta(),
      id: `comm-audience-clients-${Date.now()}`,
      name,
      source: "Reservations",
      filters,
      recipientIds: recipients.map(item => item.id),
    });
  };

  const saveAudienceName = (audience: CommunicationAudience) => {
    const name = editingAudienceName.trim();
    if (!name) return;
    updateCommunicationAudience(audience.id, { name, updatedAt: new Date().toISOString() });
    setEditingAudienceId("");
    setEditingAudienceName("");
  };

  const addManualRecipientToAudience = () => {
    setManualError("");
    const audience = scoped.audiences.find(item => item.id === manualAudienceId);
    const email = manualRecipient.email.trim().toLowerCase();
    if (!audience) {
      setManualError("Select the audience where this recipient should be added.");
      return;
    }
    if (!manualRecipient.name.trim()) {
      setManualError("Enter the recipient name before saving.");
      return;
    }
    if (!isValidEmail(email)) {
      setManualError("Enter a valid email address before saving.");
      return;
    }
    const duplicate = scoped.recipients.some(item => audience.recipientIds.includes(item.id) && item.email.toLowerCase() === email);
    if (duplicate) {
      setManualError("This email already exists inside the selected audience.");
      return;
    }
    const now = Date.now();
    const recipient: CommunicationRecipient = {
      ...meta(),
      id: `comm-recipient-manual-${now}`,
      source: "Manual",
      name: manualRecipient.name.trim(),
      email,
      language: manualRecipient.language.trim(),
      reservationCode: manualRecipient.reservationCode.trim(),
      checkinDate: manualRecipient.checkinDate,
      checkoutDate: manualRecipient.checkoutDate,
      dateOfBirth: manualRecipient.dateOfBirth,
      marketingOptIn: manualRecipient.marketingOptIn,
      valid: true,
      suppressed: scoped.suppressions.some(item => item.email.toLowerCase() === email && item.status === "Active"),
      variables: {
        name: manualRecipient.name.trim(),
        email,
        language: manualRecipient.language.trim(),
        reservation_code: manualRecipient.reservationCode.trim(),
        checkin_date: manualRecipient.checkinDate,
        checkout_date: manualRecipient.checkoutDate,
        date_of_birth: manualRecipient.dateOfBirth,
        birthday_month_day: getMonthDay(manualRecipient.dateOfBirth),
        marketing_opt_in: manualRecipient.marketingOptIn ? "true" : "false",
      },
    };
    addCommunicationRecipient(recipient);
    updateCommunicationAudience(audience.id, {
      source: audience.source === "Import List" || audience.source === "Reservations" ? "Manual Mix" : audience.source,
      recipientIds: [...audience.recipientIds, recipient.id],
      updatedAt: new Date().toISOString(),
    });
    setManualRecipient({ name: "", email: "", language: "", reservationCode: "", checkinDate: "", checkoutDate: "", dateOfBirth: "", marketingOptIn: false });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <Panel title="PMS Client Selection" icon={Users}>
          <div className="grid gap-3 md:grid-cols-4">
            <SelectField label="Client Type" value={filters.category} onChange={value => setFilters({ ...filters, category: value })} options={clientCategories.map(item => ({ value: String(item), label: String(item) }))} />
            <SelectField label="Stay Filter" value={filters.stayStatus} onChange={value => setFilters({ ...filters, stayStatus: value })} options={["All", "Current", "Future"].map(item => ({ value: item, label: item }))} />
            <Field label="Check-in From" type="date" value={filters.from} onChange={value => setFilters({ ...filters, from: value })} />
            <Field label="Check-in To" type="date" value={filters.to} onChange={value => setFilters({ ...filters, to: value })} />
          </div>
          <div className="mt-4 rounded-md border border-border bg-muted/30 p-4 text-sm">
            {clientCandidates.length} reservation-linked recipient candidates found for this property.
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
            <Field label="Audience Name" value={audienceName} onChange={setAudienceName} placeholder="Pre-arrival guests July" />
            <Button disabled={!canEdit || !clientCandidates.length} onClick={createAudienceFromClients}><Plus className="mr-2 h-4 w-4" />Create Audience From PMS Clients</Button>
          </div>
        </Panel>

        <Panel title="Excel Import" icon={FileSpreadsheet}>
          <Field label="Import List Name" value={importName} onChange={setImportName} placeholder="July agency list" />
          <label className="mt-4 block rounded-lg border border-dashed border-border bg-muted/20 p-4 text-center text-sm">
            <Upload className="mx-auto mb-2 h-5 w-5 text-primary" />
            <span className="font-medium">Upload Excel file</span>
            <input className="mt-3 w-full" type="file" accept=".xlsx,.xls,.csv,.tsv" disabled={!canEdit} onChange={parseExcel} />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">{helpFor("excelFile")?.body}</p>
        </Panel>
      </div>

      {rows.length > 0 && (
        <Panel title="Column Mapping and Preview" icon={Eye}>
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField label="Name Column" info={helpFor("nameColumn")} value={mapping.name} onChange={value => setMapping({ ...mapping, name: value })} options={columns.map(column => ({ value: column, label: column }))} />
            <SelectField label="Email Column" info={helpFor("emailColumn")} value={mapping.email} onChange={value => setMapping({ ...mapping, email: value })} options={columns.map(column => ({ value: column, label: column }))} />
            <SelectField label="Language Column" value={mapping.language} onChange={value => setMapping({ ...mapping, language: value })} options={[{ value: "", label: "None" }, ...columns.map(column => ({ value: column, label: column }))]} />
            <SelectField label="Date of Birth Column" value={mapping.dateOfBirth} onChange={value => setMapping({ ...mapping, dateOfBirth: value })} options={[{ value: "", label: "None" }, ...columns.map(column => ({ value: column, label: column }))]} />
          </div>
          <div className="mt-4 max-h-72 overflow-auto rounded-md border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 uppercase text-muted-foreground">
                <tr>{columns.map(column => <th key={column} className="p-2">{column}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 12).map((row, index) => (
                  <tr key={index} className="border-t border-border">
                    {columns.map(column => <td key={column} className="p-2">{row[column]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {error && <FormError message={error} />}
          <div className="mt-4 flex justify-end">
            <Button disabled={!canEdit} onClick={saveImport}>Save Import List and Audience</Button>
          </div>
        </Panel>
      )}

      <Panel title="Audiences and Recipients" icon={Users}>
        <div className="mb-5 rounded-lg border border-border bg-muted/20 p-4">
          <h4 className="mb-3 font-semibold">Add Manual Recipient to Existing Audience</h4>
          <div className="grid gap-3 md:grid-cols-3">
            <SelectField label="Audience" value={manualAudienceId} onChange={setManualAudienceId} options={[{ value: "", label: "Select audience" }, ...scoped.audiences.map(item => ({ value: item.id, label: `${item.name} (${item.recipientIds.length})` }))]} />
            <Field label="Full Name" value={manualRecipient.name} onChange={value => setManualRecipient({ ...manualRecipient, name: value })} placeholder="Jorge Fuertes" />
            <Field label="Email" type="email" value={manualRecipient.email} onChange={value => setManualRecipient({ ...manualRecipient, email: value })} placeholder="name@example.com" />
            <Field label="Language" value={manualRecipient.language} onChange={value => setManualRecipient({ ...manualRecipient, language: value })} placeholder="en, es, fr..." />
            <Field label="Reservation Code" value={manualRecipient.reservationCode} onChange={value => setManualRecipient({ ...manualRecipient, reservationCode: value })} placeholder="RR_000001" />
            <Field label="Date of Birth" type="date" value={manualRecipient.dateOfBirth} onChange={value => setManualRecipient({ ...manualRecipient, dateOfBirth: value })} />
            <Field label="Check-in Date" type="date" value={manualRecipient.checkinDate} onChange={value => setManualRecipient({ ...manualRecipient, checkinDate: value })} />
            <Field label="Check-out Date" type="date" value={manualRecipient.checkoutDate} onChange={value => setManualRecipient({ ...manualRecipient, checkoutDate: value })} />
            <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={manualRecipient.marketingOptIn}
                onChange={event => setManualRecipient({ ...manualRecipient, marketingOptIn: event.target.checked })}
              />
              Marketing Consent = Agree
            </label>
            <div className="flex items-end">
              <Button className="w-full" disabled={!canEdit || !scoped.audiences.length} onClick={addManualRecipientToAudience}><Plus className="mr-2 h-4 w-4" />Add Recipient</Button>
            </div>
          </div>
          {manualError && <FormError message={manualError} />}
        </div>
        <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
          <div className="space-y-2">
            {scoped.audiences.map(audience => (
              <div key={audience.id} className="rounded-md border border-border p-3">
                {editingAudienceId === audience.id ? (
                  <div className="space-y-3">
                    <Field label="Audience Name" value={editingAudienceName} onChange={setEditingAudienceName} />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setEditingAudienceId(""); setEditingAudienceName(""); }}>Cancel</Button>
                      <Button size="sm" disabled={!canEdit || !editingAudienceName.trim()} onClick={() => saveAudienceName(audience)}>Save Name</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{audience.name}</p>
                      <p className="text-xs text-muted-foreground">{audience.source} - {audience.recipientIds.length} recipients</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => { setEditingAudienceId(audience.id); setEditingAudienceName(audience.name); }}>Edit</Button>
                      <Button variant="ghost" size="icon" disabled={!canEdit} className="text-destructive" onClick={() => deleteCommunicationAudience(audience.id)}><Trash2 size={15} /></Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!scoped.audiences.length && <EmptyState>No audiences yet.</EmptyState>}
          </div>
          <div className="overflow-auto rounded-md border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Source</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {scoped.recipients.slice(0, 100).map(recipient => (
                  <tr key={recipient.id} className="border-t border-border">
                    <td className="p-3">{recipient.name}</td>
                    <td className="p-3">{recipient.email}</td>
                    <td className="p-3">{recipient.source}</td>
                    <td className="p-3"><Badge tone={recipient.valid && !recipient.suppressed ? "positive" : "negative"}>{recipient.suppressed ? "Suppressed" : recipient.valid ? "Valid" : "Invalid"}</Badge></td>
                    <td className="p-3 text-right">
                      <Button variant="ghost" size="icon" disabled={!canEdit} className="text-destructive" onClick={() => deleteCommunicationRecipient(recipient.id)}><Trash2 size={15} /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!scoped.recipients.length && <EmptyState>No recipients saved yet.</EmptyState>}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function TemplatesSection({
  canEdit,
  scoped,
  activeProperty,
  helpFor,
  meta,
  addCommunicationTemplate,
  updateCommunicationTemplate,
  deleteCommunicationTemplate,
  addCommunicationTemplateAsset,
  deleteCommunicationTemplateAsset,
}: SharedProps & {
  addCommunicationTemplate: (template: CommunicationTemplate) => void;
  updateCommunicationTemplate: (id: string, template: Partial<CommunicationTemplate>) => void;
  deleteCommunicationTemplate: (id: string) => void;
  addCommunicationTemplateAsset: (asset: CommunicationTemplateAsset) => void;
  deleteCommunicationTemplateAsset: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<Partial<CommunicationTemplate>>({ name: "", type: "Rich Text", subject: "", preheader: "", html: "", plainText: "", variables, assetIds: [], status: "Active" });
  const [files, setFiles] = useState<File[]>([]);
  const [previewRecipientId, setPreviewRecipientId] = useState("");
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [status, setStatus] = useState("");
  const previewRecipient = scoped.recipients.find(item => item.id === previewRecipientId) || scoped.recipients[0];
  const selectedTemplateAssets = (form.assetIds || [])
    .map(assetId => scoped.assets.find(asset => asset.id === assetId))
    .filter((asset): asset is CommunicationTemplateAsset => Boolean(asset));
  const visibleTemplateVariables = Array.from(new Set([
    ...variables,
    ...buildAttachedImageVariableNames(selectedTemplateAssets.length + files.length),
  ]));
  const renderedHtml = renderTemplate(form.html || richTextToHtml(form.plainText || ""), previewRecipient, activeProperty?.name || "", selectedTemplateAssets);
  const save = async () => {
    setStatus("");
    if (!form.name || !form.subject || (!form.html && !form.plainText)) {
      setStatus("Complete name, subject, and body before saving.");
      return;
    }
    const id = editingId || `comm-template-${Date.now()}`;
    const uploadedAssets: string[] = [];
    for (const file of files) {
      const asset = await uploadTemplateAsset(file, id, meta());
      addCommunicationTemplateAsset(asset);
      uploadedAssets.push(asset.id);
    }
    const sanitizedHtml = sanitizeHtml(form.html || richTextToHtml(form.plainText || ""));
    const assetIds = [...(form.assetIds || []), ...uploadedAssets];
    const templateVariables = Array.from(new Set([
      ...extractVariables(`${form.subject || ""} ${form.preheader || ""} ${sanitizedHtml} ${form.plainText || ""}`),
      ...buildAttachedImageVariableNames(assetIds.length),
    ]));
    const payload: CommunicationTemplate = {
      ...meta(),
      id,
      name: form.name || "",
      type: form.type || "Rich Text",
      subject: form.subject || "",
      preheader: form.preheader || "",
      html: sanitizedHtml,
      plainText: form.plainText || htmlToText(sanitizedHtml),
      variables: templateVariables,
      assetIds,
      status: form.status || "Active",
    };
    if (editingId) updateCommunicationTemplate(editingId, payload);
    else addCommunicationTemplate(payload);
    setEditingId("");
    setFiles([]);
    setForm({ name: "", type: "Rich Text", subject: "", preheader: "", html: "", plainText: "", variables, assetIds: [], status: "Active" });
  };
  const startEdit = (template: CommunicationTemplate) => {
    setEditingId(template.id);
    setForm(template);
    setStatus("");
  };

  return (
    <>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel title={editingId ? "Edit Template" : "Create Template"} icon={Mail}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Template Name" value={form.name || ""} onChange={value => setForm({ ...form, name: value })} placeholder="Pre-arrival email" />
          <SelectField label="Template Type" value={form.type || "Rich Text"} onChange={value => setForm({ ...form, type: value as CommunicationTemplate["type"] })} options={[{ value: "Rich Text", label: "Rich Text" }, { value: "HTML", label: "HTML" }]} />
          <Field label="Subject" info={helpFor("subject")} value={form.subject || ""} onChange={value => setForm({ ...form, subject: value })} placeholder="Welcome to {{property_name}}, {{name}}" />
          <Field label="Preheader" info={helpFor("preheader")} value={form.preheader || ""} onChange={value => setForm({ ...form, preheader: value })} placeholder="Your pre-arrival details are inside." />
          <div className="md:col-span-2">
            <label className="mb-1 flex items-center gap-2 text-sm font-medium">HTML Body <InfoTip info={helpFor("html")} /></label>
            <textarea className="min-h-44 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.html || ""} onChange={event => setForm({ ...form, html: event.target.value })} placeholder="<h1>Hello {{name}}</h1>" />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 flex items-center gap-2 text-sm font-medium">Plain Text <InfoTip info={helpFor("plainText")} /></label>
            <textarea className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.plainText || ""} onChange={event => setForm({ ...form, plainText: event.target.value })} placeholder="Hello {{name}}, ..." />
          </div>
          <label className="md:col-span-2 rounded-lg border border-dashed border-border bg-muted/20 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium"><Upload className="h-4 w-4 text-primary" /> Images / Assets <InfoTip info={helpFor("images")} /></div>
            <input type="file" accept="image/*" multiple disabled={!canEdit} onChange={event => setFiles(Array.from(event.target.files || []))} />
            <p className="mt-2 text-xs text-muted-foreground">{files.length ? files.map(file => file.name).join(", ") : "No images selected."}</p>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {visibleTemplateVariables.map(variable => <Badge key={variable}>{variable}</Badge>)}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Use attached image variables exactly where the image should appear in the email body. The first uploaded image replaces {"{{attached_image1}}"}, the second replaces {"{{attached_image2}}"}, and so on.
        </p>
        {status && <FormError message={status} />}
        <div className="mt-5 flex justify-end gap-2">
          {editingId && <Button variant="outline" onClick={() => { setEditingId(""); setForm({}); }}>Cancel</Button>}
          <Button disabled={!canEdit} onClick={save}><Save className="mr-2 h-4 w-4" />Save Template</Button>
        </div>
      </Panel>

      <div className="space-y-5">
        <Panel title="Rendered Preview" icon={Eye}>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <SelectField label="Preview Recipient" value={previewRecipientId} onChange={setPreviewRecipientId} options={[{ value: "", label: "First available recipient" }, ...scoped.recipients.map(item => ({ value: item.id, label: `${item.name} - ${item.email}` }))]} />
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => setPreviewExpanded(true)} aria-label="Maximize rendered preview" title="Maximize preview">
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 h-[420px] overflow-auto rounded-md border border-border bg-white p-4 text-sm text-[#2d2924]" dangerouslySetInnerHTML={{ __html: renderedHtml || "<p>No preview yet.</p>" }} />
        </Panel>
        <Panel title="Saved Templates" icon={Database}>
          <div className="space-y-3">
            {scoped.templates.map(template => (
              <div key={template.id} className="rounded-md border border-border p-3">
                <p className="font-medium">{template.name}</p>
                <p className="text-sm text-muted-foreground">{template.subject}</p>
                <div className="mt-3 flex justify-end gap-2">
                  <Button size="sm" variant="outline" disabled={!canEdit} onClick={() => startEdit(template)}>Edit</Button>
                  <Button size="icon" variant="ghost" disabled={!canEdit} className="text-destructive" onClick={() => confirm("Delete this template?") && deleteCommunicationTemplate(template.id)}><Trash2 size={15} /></Button>
                </div>
              </div>
            ))}
            {!scoped.templates.length && <EmptyState>No templates yet.</EmptyState>}
          </div>
        </Panel>
        <Panel title="Template Assets" icon={Upload}>
          {scoped.assets.map(asset => {
            const variableIndex = selectedTemplateAssets.findIndex(item => item.id === asset.id);
            return (
            <div key={asset.id} className="mb-2 flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
              <span className="min-w-0">
                <span className="block truncate">{asset.name}</span>
                {variableIndex >= 0 && <span className="text-xs text-muted-foreground">{`{{attached_image${variableIndex + 1}}}`}</span>}
              </span>
              <Button variant="ghost" size="icon" disabled={!canEdit} className="text-destructive" onClick={() => deleteCommunicationTemplateAsset(asset.id)}><Trash2 size={14} /></Button>
            </div>
          )})}
          {!scoped.assets.length && <EmptyState>No template assets uploaded yet.</EmptyState>}
        </Panel>
      </div>
    </div>
    {previewExpanded && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4">
        <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-primary">Rendered Preview</p>
              <p className="text-xs text-muted-foreground">Full email preview with the selected recipient variables applied.</p>
            </div>
            <Button type="button" variant="outline" size="icon" onClick={() => setPreviewExpanded(false)} aria-label="Minimize rendered preview" title="Minimize preview">
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-white p-6 text-[#2d2924]" dangerouslySetInnerHTML={{ __html: renderedHtml || "<p>No preview yet.</p>" }} />
        </div>
      </div>
    )}
    </>
  );
}

function SendingRulesSection({
  canEdit,
  scoped,
  activeProperty,
  helpFor,
  meta,
  addCommunicationSendingRule,
  updateCommunicationSendingRule,
  deleteCommunicationSendingRule,
}: SharedProps & {
  addCommunicationSendingRule: (rule: CommunicationSendingRule) => void;
  updateCommunicationSendingRule: (id: string, rule: Partial<CommunicationSendingRule>) => void;
  deleteCommunicationSendingRule: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<Partial<CommunicationSendingRule>>({ name: "50 emails every hour", batchSize: 50, batchIntervalMinutes: 60, dailyLimit: 500, allowedFromTime: "08:00", allowedToTime: "18:00", timezone: activeProperty?.timezone || "Africa/Dar_es_Salaam", retryCount: 0, maxRetries: 3, errorPauseThreshold: 10, bouncePauseThreshold: 5, status: "Active" });
  const save = () => {
    const payload: CommunicationSendingRule = {
      ...meta(),
      id: editingId || `comm-rule-${Date.now()}`,
      name: form.name || "Sending rule",
      batchSize: Math.max(1, Number(form.batchSize || 50)),
      batchIntervalMinutes: Math.max(1, Number(form.batchIntervalMinutes || 60)),
      dailyLimit: Math.max(1, Number(form.dailyLimit || 500)),
      allowedFromTime: form.allowedFromTime || "08:00",
      allowedToTime: form.allowedToTime || "18:00",
      timezone: form.timezone || activeProperty?.timezone || "Africa/Dar_es_Salaam",
      retryCount: Number(form.retryCount || 0),
      maxRetries: Math.max(0, Number(form.maxRetries || 3)),
      errorPauseThreshold: Math.max(0, Number(form.errorPauseThreshold || 10)),
      bouncePauseThreshold: Math.max(0, Number(form.bouncePauseThreshold || 5)),
      status: form.status || "Active",
    };
    if (editingId) updateCommunicationSendingRule(editingId, payload);
    else addCommunicationSendingRule(payload);
    setEditingId("");
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Panel title={editingId ? "Edit Sending Rule" : "Create Sending Rule"} icon={Clock}>
        <div className="space-y-4">
          <Field label="Rule Name" value={form.name || ""} onChange={value => setForm({ ...form, name: value })} placeholder="50 emails every hour" />
          <Field label="Batch Size" info={helpFor("batchSize")} type="number" value={String(form.batchSize || "")} onChange={value => setForm({ ...form, batchSize: Number(value) })} />
          <Field label="Batch Interval Minutes" info={helpFor("batchInterval")} type="number" value={String(form.batchIntervalMinutes || "")} onChange={value => setForm({ ...form, batchIntervalMinutes: Number(value) })} />
          <Field label="Daily Limit" info={helpFor("dailyLimit")} type="number" value={String(form.dailyLimit || "")} onChange={value => setForm({ ...form, dailyLimit: Number(value) })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Allowed From" value={form.allowedFromTime || ""} onChange={value => setForm({ ...form, allowedFromTime: value })} type="time" />
            <Field label="Allowed To" value={form.allowedToTime || ""} onChange={value => setForm({ ...form, allowedToTime: value })} type="time" />
          </div>
          <SelectField
            label="Timezone"
            value={form.timezone || activeProperty?.timezone || "Africa/Dar_es_Salaam"}
            onChange={value => setForm({ ...form, timezone: value })}
            options={timezoneOptions.map(zone => ({ value: zone, label: zone }))}
          />
          <Field label="Max Retries" info={helpFor("retryCount")} type="number" value={String(form.maxRetries || "")} onChange={value => setForm({ ...form, maxRetries: Number(value) })} />
          <Field label="Bounce Pause Threshold %" info={helpFor("bounceThreshold")} type="number" value={String(form.bouncePauseThreshold || "")} onChange={value => setForm({ ...form, bouncePauseThreshold: Number(value) })} />
          <Button disabled={!canEdit} className="w-full" onClick={save}>Save Sending Rule</Button>
        </div>
      </Panel>
      <Panel title="Rules" icon={Database}>
        <div className="grid gap-3 md:grid-cols-2">
          {scoped.rules.map(rule => (
            <div key={rule.id} className="rounded-md border border-border p-4">
              <p className="font-semibold">{rule.name}</p>
              <p className="text-sm text-muted-foreground">{rule.batchSize} emails every {rule.batchIntervalMinutes} min - daily limit {rule.dailyLimit}</p>
              <p className="mt-1 text-xs text-muted-foreground">{rule.allowedFromTime} to {rule.allowedToTime} ({rule.timezone})</p>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => { setEditingId(rule.id); setForm(rule); }}>Edit</Button>
                <Button variant="ghost" size="icon" disabled={!canEdit} className="text-destructive" onClick={() => deleteCommunicationSendingRule(rule.id)}><Trash2 size={15} /></Button>
              </div>
            </div>
          ))}
          {!scoped.rules.length && <EmptyState>No sending rules yet.</EmptyState>}
        </div>
      </Panel>
    </div>
  );
}

function CampaignsSection({
  canEdit,
  scoped,
  activeProperty,
  selectedPropertyId,
  clients,
  reservations,
  helpFor,
  meta,
  addCommunicationCampaign,
  updateCommunicationCampaign,
  deleteCommunicationCampaign,
  addCommunicationRecipient,
  addCommunicationOutboxJob,
  addCommunicationEvent,
}: SharedProps & {
  addCommunicationCampaign: (campaign: CommunicationCampaign) => void;
  updateCommunicationCampaign: (id: string, campaign: Partial<CommunicationCampaign>) => void;
  deleteCommunicationCampaign: (id: string) => void;
  addCommunicationRecipient: (recipient: CommunicationRecipient) => void;
  addCommunicationOutboxJob: (job: CommunicationOutboxJob) => void;
  addCommunicationEvent: (event: CommunicationEvent) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    type: "Operational" as CommunicationCampaignType,
    senderId: "",
    templateId: "",
    audienceId: "",
    recipientScope: "Selected Audience" as CommunicationRecipientScope,
    sendingRuleId: "",
    scheduledAt: "",
    scheduleMode: "Manual" as CommunicationScheduleMode,
    scheduleOffsetDays: 0,
    scheduleOffsetHours: 0,
    scheduleTimeOfDay: "09:00",
    scheduleTimezone: activeProperty?.timezone || "Africa/Dar_es_Salaam",
    repeatCount: 1,
    repeatIntervalMinutes: 30,
  });
  const [preflight, setPreflight] = useState<string[]>([]);
  const [preflightWarnings, setPreflightWarnings] = useState<string[]>([]);
  const [readyRecipients, setReadyRecipients] = useState<CommunicationRecipient[]>([]);
  const sender = scoped.senders.find(item => item.id === form.senderId);
  const provider = scoped.providers.find(item => item.id === sender?.providerAccountId) || scoped.providers[0];
  const template = scoped.templates.find(item => item.id === form.templateId);
  const audience = scoped.audiences.find(item => item.id === form.audienceId);
  const rule = scoped.rules.find(item => item.id === form.sendingRuleId);
  const campaignTimezone = rule?.timezone || form.scheduleTimezone || activeProperty?.timezone || "Africa/Dar_es_Salaam";
  const templateAssets = template?.assetIds
    .map(assetId => scoped.assets.find(asset => asset.id === assetId))
    .filter((asset): asset is CommunicationTemplateAsset => Boolean(asset)) || [];

  const runPreflight = () => {
    const selectedRecipients = form.recipientScope === "All PMS Reservation Clients"
      ? buildPmsReservationRecipients(clients, reservations, selectedPropertyId, scoped.suppressions, meta(), "preview")
      : undefined;
    const result = preflightCampaign({
      sender,
      provider,
      template,
      audience,
      rule,
      recipients: scoped.recipients,
      selectedRecipients,
      suppressions: scoped.suppressions,
      clients,
      reservations,
      type: form.type,
      scheduleMode: form.scheduleMode,
      recipientScope: form.recipientScope,
    });
    setPreflight(result.errors);
    setPreflightWarnings(result.warnings);
    setReadyRecipients(result.recipients);
    return result;
  };

  const launch = () => {
    const result = runPreflight();
    if (result.errors.length || !sender || !template || !rule) return;
    const id = `comm-campaign-${Date.now()}`;
    const now = new Date().toISOString();
    const repeatCount = Math.max(1, Number(form.repeatCount || 1));
    const repeatIntervalMinutes = Math.max(0, Number(form.repeatIntervalMinutes || 0));
    const launchRecipients = result.recipients;
    if (form.recipientScope === "All PMS Reservation Clients") {
      launchRecipients.forEach(addCommunicationRecipient);
    }
    const campaign: CommunicationCampaign = {
      ...meta(),
      id,
      name: form.name || template.name,
      type: form.type,
      senderId: sender.id,
      providerAccountId: provider?.id,
      templateId: template.id,
      audienceId: audience?.id,
      recipientScope: form.recipientScope,
      recipientIds: launchRecipients.map(item => item.id),
      sendingRuleId: rule.id,
      scheduledAt: form.scheduleMode === "Manual" ? form.scheduledAt || "" : "",
      scheduleMode: form.scheduleMode,
      scheduleOffsetDays: Number(form.scheduleOffsetDays || 0),
      scheduleOffsetHours: Number(form.scheduleOffsetHours || 0),
      scheduleTimeOfDay: form.scheduleTimeOfDay || "09:00",
      scheduleTimezone: campaignTimezone,
      repeatCount,
      repeatIntervalMinutes,
      status: form.scheduleMode !== "Manual" || form.scheduledAt ? "scheduled" : "sending",
      preflightErrors: [],
      finalRecipientCount: launchRecipients.length,
      createdAt: now,
      updatedAt: now,
    };
    addCommunicationCampaign(campaign);
    result.suppressedRecipients.forEach(recipient => {
      addCommunicationEvent(buildEvent(meta(), {
        campaignId: id,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        senderId: sender.id,
        templateId: template.id,
        type: "suppressed",
        message: `${recipient.email} was skipped because it is on the suppression list.`,
      }));
    });
    launchRecipients.forEach((recipient, index) => {
      const unsubscribeUrl = `${window.location.origin}/unsubscribe/${encodeURIComponent(buildUnsubscribeToken(recipient.email, id))}`;
      const htmlVars = {
        ...getRecipientVariables(recipient, activeProperty?.name || "", unsubscribeUrl, "html"),
        ...getAttachedImageVariables(templateAssets, "html"),
      };
      const textVars = {
        ...getRecipientVariables(recipient, activeProperty?.name || "", unsubscribeUrl, "text"),
        ...getAttachedImageVariables(templateAssets, "text"),
      };
      const firstScheduledFor = resolveCampaignScheduleForRecipient(recipient, index, rule, {
        scheduleMode: form.scheduleMode,
        scheduledAt: form.scheduledAt,
        scheduleOffsetDays: Number(form.scheduleOffsetDays || 0),
        scheduleOffsetHours: Number(form.scheduleOffsetHours || 0),
        scheduleTimeOfDay: form.scheduleTimeOfDay || "09:00",
        timezone: campaignTimezone,
      });
      for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
        const scheduledFor = addMinutesToIso(firstScheduledFor, repeatIndex * repeatIntervalMinutes);
        const job: CommunicationOutboxJob = {
          ...meta(),
          id: `comm-job-${Date.now()}-${index}-${repeatIndex}`,
          campaignId: id,
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          senderId: sender.id,
          templateId: template.id,
          providerAccountId: provider?.id,
          subject: renderString(template.subject, htmlVars),
          html: renderString(template.html, htmlVars),
          plainText: renderString(template.plainText, textVars),
          status: "queued",
          attempts: 0,
          maxRetries: rule.maxRetries,
          repeatIndex: repeatIndex + 1,
          repeatTotal: repeatCount,
          scheduledFor,
          createdAt: now,
          updatedAt: now,
        };
        addCommunicationOutboxJob(job);
        addCommunicationEvent(buildEvent(meta(), {
          campaignId: id,
          outboxJobId: job.id,
          recipientId: recipient.id,
          recipientEmail: recipient.email,
          senderId: sender.id,
          templateId: template.id,
          type: "queued",
          message: `Queued email ${repeatIndex + 1}/${repeatCount} for ${recipient.email}.`,
        }));
      }
    });
    setForm({ name: "", type: "Operational", senderId: "", templateId: "", audienceId: "", recipientScope: "Selected Audience", sendingRuleId: "", scheduledAt: "", scheduleMode: "Manual", scheduleOffsetDays: 0, scheduleOffsetHours: 0, scheduleTimeOfDay: "09:00", scheduleTimezone: activeProperty?.timezone || "Africa/Dar_es_Salaam", repeatCount: 1, repeatIntervalMinutes: 30 });
    setPreflight([]);
    setPreflightWarnings([]);
    setReadyRecipients([]);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[460px_1fr]">
      <Panel title="Create Campaign" icon={Send}>
        <div className="space-y-4">
          <Field label="Campaign Name" value={form.name} onChange={value => setForm({ ...form, name: value })} placeholder="July guest update" />
          <SelectField label="Campaign Type" info={helpFor("campaignType")} value={form.type} onChange={value => setForm({ ...form, type: value as CommunicationCampaignType })} options={marketingTypes.map(item => ({ value: item, label: item }))} />
          <SelectField label="Sender" value={form.senderId} onChange={value => setForm({ ...form, senderId: value })} options={[{ value: "", label: "Select sender" }, ...scoped.senders.map(item => ({ value: item.id, label: `${item.fromName} - ${item.fromEmail}` }))]} />
          <SelectField label="Template" value={form.templateId} onChange={value => setForm({ ...form, templateId: value })} options={[{ value: "", label: "Select template" }, ...scoped.templates.map(item => ({ value: item.id, label: item.name }))]} />
          <SelectField label="Recipient Scope" info={helpFor("audience")} value={form.recipientScope} onChange={value => setForm({ ...form, recipientScope: value as CommunicationRecipientScope, audienceId: value === "All PMS Reservation Clients" ? "" : form.audienceId })} options={recipientScopes.map(item => ({ value: item, label: item }))} />
          {form.recipientScope === "Selected Audience" ? (
            <SelectField label="Audience" info={helpFor("audience")} value={form.audienceId} onChange={value => setForm({ ...form, audienceId: value })} options={[{ value: "", label: "Select audience" }, ...scoped.audiences.map(item => ({ value: item.id, label: `${item.name} (${item.recipientIds.length})` }))]} />
          ) : (
            <div className="rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
              The campaign will build recipients from all current PMS reservations for the active property. Operational check-in/check-out emails do not require marketing consent; Marketing campaigns automatically exclude guests without consent.
            </div>
          )}
          <SelectField label="Sending Rule" value={form.sendingRuleId} onChange={value => setForm({ ...form, sendingRuleId: value })} options={[{ value: "", label: "Select sending rule" }, ...scoped.rules.map(item => ({ value: item.id, label: item.name }))]} />
          <SelectField label="Delivery Timing" value={form.scheduleMode} onChange={value => setForm({ ...form, scheduleMode: value as CommunicationScheduleMode })} options={scheduleModes.map(item => ({ value: item, label: item }))} />
          {rule && (
            <div className="rounded-md border border-[#c98736]/25 bg-[#c98736]/10 p-3 text-xs text-muted-foreground">
              Scheduled times are interpreted in <strong>{campaignTimezone}</strong>, inherited from the selected sending rule.
            </div>
          )}
          {form.scheduleMode === "Manual" ? (
            <Field label="Schedule At" type="datetime-local" value={form.scheduledAt} onChange={value => setForm({ ...form, scheduledAt: value })} />
          ) : form.scheduleMode === "Birthday" ? (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-3 text-sm font-medium">Birthday automation</p>
              <Field label="Send Time" type="time" value={form.scheduleTimeOfDay} onChange={value => setForm({ ...form, scheduleTimeOfDay: value })} />
              <p className="mt-2 text-xs text-muted-foreground">
                The campaign sends every year on each recipient's day and month of birth. Only recipients with Date of Birth and Marketing Consent = Agree are eligible.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <p className="mb-3 text-sm font-medium">
                {form.scheduleMode === "Before Check-in" ? "Reservation check-in automation" : "Reservation check-out automation"}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={form.scheduleMode === "Before Check-in" ? "Days Before" : "Days After"} type="number" value={String(form.scheduleOffsetDays)} onChange={value => setForm({ ...form, scheduleOffsetDays: Number(value) })} />
                <Field label={form.scheduleMode === "Before Check-in" ? "Hours Before" : "Hours After"} type="number" value={String(form.scheduleOffsetHours)} onChange={value => setForm({ ...form, scheduleOffsetHours: Number(value) })} />
                <Field label="Send Time" type="time" value={form.scheduleTimeOfDay} onChange={value => setForm({ ...form, scheduleTimeOfDay: value })} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Check-in hour rules count backwards from 00:00 at the start of the check-in day. When a send time is set with days, the system uses that hour on the calculated day. Check-out rules calculate after the checkout date using the chosen send time.
              </p>
            </div>
          )}
          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="mb-3 text-sm font-medium">Repeat Delivery</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Repeat Count" type="number" value={String(form.repeatCount)} onChange={value => setForm({ ...form, repeatCount: Number(value) })} />
              <Field label="Repeat Interval Minutes" type="number" value={String(form.repeatIntervalMinutes)} onChange={value => setForm({ ...form, repeatIntervalMinutes: Number(value) })} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Use 1 to send once. Use 3 and 30 minutes to send the same campaign at the scheduled time, then again 30 and 60 minutes later. Max retries remain separate and only apply after failed delivery attempts.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" disabled={!canEdit} onClick={runPreflight}>Preflight Check</Button>
            <Button disabled={!canEdit || preflight.length > 0} onClick={launch}><Play className="mr-2 h-4 w-4" />Launch Campaign</Button>
          </div>
          {preflight.length > 0 && <FormError message={`Preflight blocked launch:\n${preflight.map(item => `- ${item}`).join("\n")}`} />}
          {preflightWarnings.length > 0 && !preflight.length && <InfoMessage message={preflightWarnings.join("\n")} />}
          {readyRecipients.length > 0 && !preflight.length && <SuccessMessage message={`Preflight passed. ${readyRecipients.length} final recipients will be queued.`} />}
        </div>
      </Panel>

      <Panel title="Campaigns" icon={BarChart3}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Campaign</th><th className="p-3">Type</th><th className="p-3">Timing</th><th className="p-3">Repeat</th><th className="p-3">Status</th><th className="p-3">Recipients</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {scoped.campaigns.map(campaign => (
                <tr key={campaign.id} className="border-t border-border">
                  <td className="p-3 font-medium">{campaign.name}</td>
                  <td className="p-3">{campaign.type}</td>
                  <td className="p-3 text-xs text-muted-foreground">{formatCampaignTiming(campaign)}</td>
                  <td className="p-3 text-xs text-muted-foreground">{formatCampaignRepeat(campaign)}</td>
                  <td className="p-3"><Badge>{campaign.status}</Badge></td>
                  <td className="p-3">{campaign.finalRecipientCount}</td>
                  <td className="p-3 text-right">
                    <Button variant="outline" size="sm" disabled={!canEdit || ["completed", "cancelled"].includes(campaign.status)} onClick={() => updateCommunicationCampaign(campaign.id, { status: campaign.status === "paused" ? "sending" : "paused", updatedAt: new Date().toISOString() })}>
                      {campaign.status === "paused" ? "Resume" : "Pause"}
                    </Button>
                    <Button variant="ghost" size="icon" disabled={!canEdit} className="text-destructive" onClick={() => deleteCommunicationCampaign(campaign.id)}><Trash2 size={15} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!scoped.campaigns.length && <EmptyState>No campaigns yet.</EmptyState>}
        </div>
      </Panel>
    </div>
  );
}

function OutboxSection({
  canEdit,
  scoped,
  updateCommunicationOutboxJob,
  deleteCommunicationOutboxJob,
  updateCommunicationCampaign,
  addCommunicationEvent,
  meta,
}: SharedProps & {
  updateCommunicationOutboxJob: (id: string, job: Partial<CommunicationOutboxJob>) => void;
  deleteCommunicationOutboxJob: (id: string) => void;
  updateCommunicationCampaign: (id: string, campaign: Partial<CommunicationCampaign>) => void;
  addCommunicationEvent: (event: CommunicationEvent) => void;
}) {
  const [campaignId, setCampaignId] = useState("All");
  const [status, setStatus] = useState("All");
  const [processing, setProcessing] = useState("");
  const filtered = scoped.outbox.filter(job =>
    (campaignId === "All" || job.campaignId === campaignId) &&
    (status === "All" || job.status === status)
  );
  const processNextBatch = async () => {
    setProcessing("");
    const campaign = scoped.campaigns.find(item => item.id === (campaignId === "All" ? filtered[0]?.campaignId : campaignId));
    const rule = scoped.rules.find(item => item.id === campaign?.sendingRuleId);
    const candidates = filtered
      .filter(job => !campaign?.id || job.campaignId === campaign.id)
      .filter(job => ["queued", "sending", "failed"].includes(job.status))
      .filter(job => job.attempts < Math.max(1, job.maxRetries || rule?.maxRetries || 1))
      .slice(0, rule?.batchSize || 50);
    const activeSuppressions = new Set(scoped.suppressions.filter(item => item.status === "Active").map(item => item.email.toLowerCase()));
    const suppressedJobs = candidates.filter(job => activeSuppressions.has(job.recipientEmail.toLowerCase()));
    suppressedJobs.forEach(job => {
      updateCommunicationOutboxJob(job.id, { status: "suppressed", lastError: "Recipient is on the suppression list.", updatedAt: new Date().toISOString() });
      addCommunicationEvent(buildEvent(meta(), {
        campaignId: job.campaignId,
        outboxJobId: job.id,
        recipientId: job.recipientId,
        recipientEmail: job.recipientEmail,
        senderId: job.senderId,
        templateId: job.templateId,
        type: "suppressed",
        message: `${job.recipientEmail} was skipped because it is on the suppression list.`,
      }));
    });
    const jobs = candidates.filter(job => !activeSuppressions.has(job.recipientEmail.toLowerCase()));
    if (!jobs.length) {
      setProcessing(suppressedJobs.length
        ? `${suppressedJobs.length} jobs were marked as suppressed. No deliverable jobs remain in this batch.`
        : "No queued, recoverable, or retryable jobs match this filter.");
      return;
    }
    const sender = scoped.senders.find(item => item.id === jobs[0].senderId);
    const provider = scoped.providers.find(item => item.id === jobs[0].providerAccountId);
    try {
      jobs.forEach(job => updateCommunicationOutboxJob(job.id, { status: "sending", attempts: job.attempts + 1, updatedAt: new Date().toISOString() }));
      const response = await fetch("/api/communications-process-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobs, sender, provider }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Queue processing failed.");
      payload.results.forEach((result: any) => {
        const jobId = result.jobId || result.id;
        const sourceJob = jobs.find(job => job.id === jobId);
        if (!sourceJob) return;
        const attempts = sourceJob.attempts + 1;
        const nextStatus = result.status === "failed" && attempts < Math.max(1, sourceJob.maxRetries)
          ? "queued"
          : result.status;
        updateCommunicationOutboxJob(jobId, {
          status: nextStatus,
          attempts,
          providerMessageId: result.providerMessageId,
          lastError: result.error || "",
          sentAt: result.status === "sent" ? new Date().toISOString() : sourceJob.sentAt,
          updatedAt: new Date().toISOString(),
        });
        addCommunicationEvent(buildEvent(meta(), {
          campaignId: sourceJob.campaignId,
          outboxJobId: sourceJob.id,
          recipientId: sourceJob.recipientId,
          recipientEmail: sourceJob.recipientEmail,
          senderId: sourceJob.senderId,
          templateId: sourceJob.templateId,
          type: result.status === "sent" ? "sent" : "failed",
          message: result.status === "sent"
            ? `Sent email to ${sourceJob.recipientEmail}.`
            : `Failed email to ${sourceJob.recipientEmail}. ${nextStatus === "queued" ? "Queued for retry." : "Retry limit reached."}`,
          providerMessageId: result.providerMessageId,
          errorDetail: result.error,
        }));
      });
      const processedIds = new Set(payload.results.map((result: any) => result.jobId || result.id).filter(Boolean));
      const retriedBackToQueue = payload.results.filter((result: any) => {
        const sourceJob = jobs.find(job => job.id === (result.jobId || result.id));
        return result.status === "failed" && sourceJob && sourceJob.attempts + 1 < Math.max(1, sourceJob.maxRetries);
      }).length;
      const remainingOpen = scoped.outbox.filter(job =>
        job.campaignId === campaign?.id &&
        !processedIds.has(job.id) &&
        ["pending", "queued", "sending", "failed"].includes(job.status) &&
        job.attempts < Math.max(1, job.maxRetries)
      ).length + retriedBackToQueue;
      if (campaign && remainingOpen === 0) updateCommunicationCampaign(campaign.id, { status: "completed", updatedAt: new Date().toISOString() });
      setProcessing(`Processed ${payload.results.length} jobs now. Future scheduled jobs remain in the queue unless this button is used again.`);
    } catch (error) {
      jobs.forEach(job => {
        const attempts = job.attempts + 1;
        updateCommunicationOutboxJob(job.id, {
          status: attempts < Math.max(1, job.maxRetries) ? "queued" : "failed",
          attempts,
          lastError: error instanceof Error ? error.message : String(error),
          updatedAt: new Date().toISOString(),
        });
      });
      setProcessing(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Panel title="Outbox Jobs" icon={Database}>
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <SelectField label="Campaign" value={campaignId} onChange={setCampaignId} options={[{ value: "All", label: "All campaigns" }, ...scoped.campaigns.map(item => ({ value: item.id, label: item.name }))]} />
        <SelectField label="Status" value={status} onChange={setStatus} options={["All", "queued", "sending", "sent", "delivered", "failed", "hard_bounced", "soft_bounced", "suppressed", "unsubscribed", "cancelled"].map(item => ({ value: item, label: item }))} />
        <div className="flex items-end">
          <Button disabled={!canEdit} className="h-10 w-full" onClick={processNextBatch}><Send className="mr-2 h-4 w-4" />Process Next Batch Now</Button>
        </div>
      </div>
      <div className="mb-4 rounded-md border border-[#c98736]/25 bg-[#c98736]/10 p-3 text-sm text-muted-foreground">
        This manual test button sends the next eligible batch immediately, including future-scheduled jobs and recoverable jobs stuck in sending. Sending rules still define batch size; repeat delivery creates separate scheduled jobs per recipient.
      </div>
      {processing && <div className="mb-4 rounded-md border border-[#c98736]/30 bg-[#c98736]/10 p-3 text-sm">{processing}</div>}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Recipient</th><th className="p-3">Campaign</th><th className="p-3">Scheduled For</th><th className="p-3">Repeat</th><th className="p-3">Status</th><th className="p-3">Retry Attempts</th><th className="p-3">Error</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(job => (
              <tr key={job.id} className="border-t border-border">
                <td className="p-3"><p className="font-medium">{job.recipientName}</p><p className="text-xs text-muted-foreground">{job.recipientEmail}</p></td>
                <td className="p-3">{scoped.campaigns.find(item => item.id === job.campaignId)?.name || job.campaignId}</td>
                <td className="p-3 text-xs text-muted-foreground">{formatDateTime(job.scheduledFor)}</td>
                <td className="p-3 text-xs text-muted-foreground">{job.repeatTotal && job.repeatTotal > 1 ? `${job.repeatIndex || 1}/${job.repeatTotal}` : "Once"}</td>
                <td className="p-3"><Badge tone={job.status === "sent" ? "positive" : job.status === "failed" ? "negative" : "warning"}>{job.status}</Badge></td>
                <td className="p-3">{job.attempts}/{job.maxRetries}</td>
                <td className="max-w-xs truncate p-3">{job.lastError}</td>
                <td className="p-3 text-right"><Button variant="ghost" size="icon" disabled={!canEdit} className="text-destructive" onClick={() => deleteCommunicationOutboxJob(job.id)}><Trash2 size={15} /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <EmptyState>No outbox jobs match this filter.</EmptyState>}
      </div>
    </Panel>
  );
}

function LogsSection({ scoped }: SharedProps) {
  const [type, setType] = useState("All");
  const [campaignId, setCampaignId] = useState("All");
  const filtered = scoped.events.filter(event =>
    (type === "All" || event.type === type) &&
    (campaignId === "All" || event.campaignId === campaignId)
  );
  return (
    <Panel title="Delivery and Campaign Logs" icon={Database}>
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <SelectField label="Event Type" value={type} onChange={setType} options={["All", "created", "queued", "sent", "delivered", "failed", "suppressed", "unsubscribed", "paused", "cancelled", "test"].map(item => ({ value: item, label: item }))} />
        <SelectField label="Campaign" value={campaignId} onChange={setCampaignId} options={[{ value: "All", label: "All campaigns" }, ...scoped.campaigns.map(item => ({ value: item.id, label: item.name }))]} />
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Time</th><th className="p-3">Type</th><th className="p-3">Recipient</th><th className="p-3">Message</th><th className="p-3">Provider ID</th></tr>
          </thead>
          <tbody>
            {filtered.map(event => (
              <tr key={event.id} className="border-t border-border">
                <td className="p-3">{new Date(event.createdAt).toLocaleString()}</td>
                <td className="p-3"><Badge tone={event.type === "failed" ? "negative" : "positive"}>{event.type}</Badge></td>
                <td className="p-3">{event.recipientEmail || "-"}</td>
                <td className="p-3">{event.errorDetail || event.message}</td>
                <td className="p-3">{event.providerMessageId || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <EmptyState>No logs yet.</EmptyState>}
      </div>
    </Panel>
  );
}

function SuppressionSection({
  canEdit,
  scoped,
  helpFor,
  meta,
  addCommunicationSuppression,
  updateCommunicationSuppression,
  deleteCommunicationSuppression,
}: SharedProps & {
  addCommunicationSuppression: (suppression: CommunicationSuppression) => void;
  updateCommunicationSuppression: (id: string, suppression: Partial<CommunicationSuppression>) => void;
  deleteCommunicationSuppression: (id: string) => void;
}) {
  const [form, setForm] = useState<Partial<CommunicationSuppression>>({ email: "", reason: "Manual Block", notes: "" });
  const [error, setError] = useState("");
  const save = () => {
    setError("");
    if (!isValidEmail(form.email)) {
      setError("Enter a valid email before adding it to the suppression list.");
      return;
    }
    addCommunicationSuppression({
      ...meta(),
      id: `comm-suppression-${Date.now()}`,
      email: form.email!.toLowerCase(),
      reason: form.reason || "Manual Block",
      notes: form.notes || "",
    });
    setForm({ email: "", reason: "Manual Block", notes: "" });
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <Panel title="Add Suppression" icon={ShieldAlert}>
        <Field label="Email" info={helpFor("suppressionList")} value={form.email || ""} onChange={value => setForm({ ...form, email: value })} placeholder="guest@example.com" />
        <SelectField label="Reason" value={form.reason || "Manual Block"} onChange={value => setForm({ ...form, reason: value as CommunicationSuppression["reason"] })} options={["Manual Block", "Unsubscribe", "Hard Bounce", "Complaint"].map(item => ({ value: item, label: item }))} />
        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Notes</label>
          <textarea className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.notes || ""} onChange={event => setForm({ ...form, notes: event.target.value })} />
        </div>
        {error && <FormError message={error} />}
        <Button className="mt-4 w-full" disabled={!canEdit} onClick={save}>Add to Suppression List</Button>
      </Panel>
      <Panel title="Suppressed Emails" icon={Database}>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Email</th><th className="p-3">Reason</th><th className="p-3">Source</th><th className="p-3">Notes</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {scoped.suppressions.map(item => (
                <tr key={item.id} className="border-t border-border">
                  <td className="p-3">{item.email}</td>
                  <td className="p-3">{item.reason}</td>
                  <td className="p-3">
                    <Badge tone={item.createdBy === "public-unsubscribe" ? "warning" : "neutral"}>
                      {item.createdBy === "public-unsubscribe" ? "Client request" : "Manual / internal"}
                    </Badge>
                  </td>
                  <td className="p-3">{item.notes}</td>
                  <td className="p-3">{item.status}</td>
                  <td className="p-3 text-right">
                    <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => updateCommunicationSuppression(item.id, { status: item.status === "Active" ? "Paused" : "Active", updatedAt: new Date().toISOString() })}>{item.status === "Active" ? "Pause" : "Activate"}</Button>
                    <Button variant="ghost" size="icon" disabled={!canEdit} className="text-destructive" onClick={() => deleteCommunicationSuppression(item.id)}><Trash2 size={15} /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!scoped.suppressions.length && <EmptyState>No suppressed emails yet.</EmptyState>}
        </div>
      </Panel>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone = "neutral" }: { icon: typeof BarChart3; label: string; value: string | number; tone?: "neutral" | "positive" | "negative" | "warning" }) {
  const color = tone === "positive" ? "text-green-600" : tone === "negative" ? "text-destructive" : tone === "warning" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <p className={`mt-3 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Mail; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, placeholder = "", type = "text", info }: { label: string; value?: string; onChange: (value: string) => void; placeholder?: string; type?: string; info?: { title: string; body: string; example?: string; warning?: string } }) {
  return (
    <label className="block text-sm font-medium">
      <span className="mb-1 flex items-center gap-2">{label}<InfoTip info={info} /></span>
      <Input type={type} value={value || ""} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function SelectField({ label, value, onChange, options, info }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; info?: { title: string; body: string; example?: string; warning?: string } }) {
  return (
    <label className="block text-sm font-medium">
      <span className="mb-1 flex items-center gap-2">{label}<InfoTip info={info} /></span>
      <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={event => onChange(event.target.value)}>
        {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function InfoTip({ info }: { info?: { title: string; body: string; example?: string; warning?: string } }) {
  if (!info) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border text-xs text-primary" aria-label={`Info: ${info.title}`}>
          <Info className="h-3.5 w-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm bg-[#2d2924] text-white">
        <p className="font-semibold">{info.title}</p>
        <p className="mt-1 leading-5">{info.body}</p>
        {info.example && <p className="mt-2 text-[#f4c27d]">Example: {info.example}</p>}
        {info.warning && <p className="mt-2 text-red-200">{info.warning}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function DnsRow({ label, value, info }: { label: string; value: string; info?: { title: string; body: string; example?: string; warning?: string } }) {
  return (
    <div className="mb-3 rounded-md border border-border p-3 text-sm">
      <div className="mb-1 flex items-center gap-2 font-medium">{label}<InfoTip info={info} /></div>
      <code className="block break-all rounded bg-muted p-2 text-xs">{value}</code>
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "positive" | "negative" | "warning" }) {
  const classes = tone === "positive"
    ? "bg-green-100 text-green-800"
    : tone === "negative"
      ? "bg-red-100 text-red-800"
      : tone === "warning"
        ? "bg-[#c98736]/15 text-primary"
        : "bg-muted text-muted-foreground";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>{children}</span>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{children}</div>;
}

function FormError({ message }: { message: string }) {
  return <div className="mt-3 whitespace-pre-line rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</div>;
}

function InfoMessage({ message }: { message: string }) {
  return <div className="whitespace-pre-line rounded-md border border-[#c98736]/30 bg-[#c98736]/10 p-3 text-sm text-muted-foreground">{message}</div>;
}

function SuccessMessage({ message }: { message: string }) {
  return <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div>;
}

function getSection(pathname: string): SectionKey {
  const segment = pathname.split("/").pop() || "dashboard";
  if (segment === "provider-settings") return "provider-settings";
  if (segment === "dns-verification") return "dns-verification";
  if (segment === "sending-rules") return "sending-rules";
  if (segment === "suppression-list") return "suppression-list";
  if (segment === "senders" || segment === "recipients" || segment === "templates" || segment === "campaigns" || segment === "outbox" || segment === "logs") return segment;
  return "dashboard";
}

function isValidEmail(value?: string) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function findColumn(columns: string[], candidates: string[]) {
  return columns.find(column => candidates.some(candidate => column.toLowerCase().includes(candidate.toLowerCase()))) || "";
}

function extractMarketingConsent(row: ImportedRow) {
  const entry = Object.entries(row).find(([key]) => ["marketing", "consent", "opt in", "opt-in", "agree"].some(candidate => key.toLowerCase().includes(candidate)));
  const value = String(entry?.[1] || "").trim().toLowerCase();
  return ["true", "yes", "1", "agree", "agreed", "accepted", "consented", "si", "sí"].includes(value);
}

function extractVariables(content: string) {
  return Array.from(new Set((content.match(/\{\{[a-zA-Z0-9_]+\}\}/g) || []).map(item => item.trim())));
}

function sanitizeHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function htmlToText(value: string) {
  return value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function richTextToHtml(value: string) {
  return `<div>${escapeHtml(value).replace(/\n/g, "<br />")}</div>`;
}

function renderTemplate(html: string, recipient?: CommunicationRecipient, propertyName = "", assets: CommunicationTemplateAsset[] = []) {
  if (!recipient) return sanitizeHtml(html);
  return renderString(sanitizeHtml(html), {
    ...getRecipientVariables(recipient, propertyName, "#unsubscribe", "html"),
    ...getAttachedImageVariables(assets, "html"),
  });
}

function renderString(value: string, variablesMap: Record<string, string>) {
  return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => variablesMap[key] ?? "");
}

function getRecipientVariables(recipient: CommunicationRecipient, propertyName: string, unsubscribeUrl: string, mode: "html" | "text" = "html") {
  const unsubscribeValue = mode === "html"
    ? `<a href="${escapeAttribute(unsubscribeUrl)}" target="_blank" rel="noopener noreferrer">Click here to unsubscribe communications</a>`
    : `Click here to unsubscribe communications: ${unsubscribeUrl}`;
  return {
    ...(recipient.variables || {}),
    name: recipient.name || "",
    email: recipient.email || "",
    hotel_name: propertyName,
    property_name: propertyName,
    reservation_code: recipient.reservationCode || "",
    checkin_date: recipient.checkinDate || "",
    checkout_date: recipient.checkoutDate || "",
    date_of_birth: getRecipientBirthDate(recipient),
    birthday_month_day: getMonthDay(getRecipientBirthDate(recipient)),
    unsubscribe_url: unsubscribeValue,
  };
}

function buildAttachedImageVariableNames(count: number) {
  return Array.from({ length: count }, (_, index) => `{{attached_image${index + 1}}}`);
}

function getAttachedImageVariables(assets: CommunicationTemplateAsset[], mode: "html" | "text") {
  return Object.fromEntries(assets.map((asset, index) => {
    const source = asset.downloadUrl || asset.embeddedDataUrl || "";
    const alt = escapeAttribute(asset.name || `Attached image ${index + 1}`);
    const value = mode === "html"
      ? source
        ? `<img src="${escapeAttribute(source)}" alt="${alt}" style="max-width:100%;height:auto;display:block;border:0;" />`
        : ""
      : source
        ? `[Image: ${asset.name}] ${source}`
        : `[Image: ${asset.name}]`;
    return [`attached_image${index + 1}`, value];
  }));
}

function preflightCampaign({
  sender,
  provider,
  template,
  audience,
  rule,
  recipients,
  selectedRecipients,
  suppressions,
  clients,
  reservations,
  type,
  scheduleMode,
  recipientScope,
}: {
  sender?: CommunicationSender;
  provider?: CommunicationProviderAccount;
  template?: CommunicationTemplate;
  audience?: CommunicationAudience;
  rule?: CommunicationSendingRule;
  recipients: CommunicationRecipient[];
  selectedRecipients?: CommunicationRecipient[];
  suppressions: CommunicationSuppression[];
  clients: Client[];
  reservations: Reservation[];
  type: CommunicationCampaignType;
  scheduleMode: CommunicationScheduleMode;
  recipientScope: CommunicationRecipientScope;
}) {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!sender) errors.push("Select a sender.");
  if (sender && !sender.verified && provider?.mode !== "test") errors.push("Sender must be verified before live campaigns.");
  if (!provider) errors.push("Configure a provider account or Mock/Test provider.");
  if (provider?.provider === "SMTP" && provider.mode === "live" && (!provider.smtpHost || !provider.smtpPort || !provider.smtpUsername || !provider.smtpPassword)) errors.push("Live SMTP provider is incomplete.");
  if (!template) errors.push("Select a template.");
  if (template && !template.subject.trim()) errors.push("Template subject is required.");
  if (template && !template.html.trim() && !template.plainText.trim()) errors.push("Template body is required.");
  if (recipientScope === "Selected Audience" && !audience) errors.push("Select an audience.");
  if (recipientScope === "All PMS Reservation Clients" && !selectedRecipients?.length) errors.push("No reservation-linked PMS recipients exist for the active property.");
  if (!rule) errors.push("Select a sending rule.");
  if (scheduleMode === "Birthday" && type !== "Marketing") errors.push("Birthday campaigns must be Marketing campaigns because they require guest communication consent.");

  const activeSuppressions = new Set(suppressions.filter(item => item.status === "Active").map(item => item.email.toLowerCase()));
  const seen = new Set<string>();
  let suppressedCount = 0;
  const suppressedRecipients: CommunicationRecipient[] = [];
  let finalRecipients = (selectedRecipients || (audience?.recipientIds || []).map(id => recipients.find(item => item.id === id)))
    .filter((item): item is CommunicationRecipient => Boolean(item))
    .filter(item => {
      const email = item.email.toLowerCase();
      if (!item.valid || !isValidEmail(item.email)) return false;
      if (seen.has(email)) return false;
      seen.add(email);
      if (activeSuppressions.has(email) || item.suppressed) {
        suppressedCount += 1;
        suppressedRecipients.push(item);
        return false;
      }
      return true;
    });
  if (suppressedCount > 0) {
    warnings.push(`${suppressedCount} recipient${suppressedCount === 1 ? "" : "s"} excluded because they are on the suppression list.`);
  }
  if (type === "Marketing" || scheduleMode === "Birthday") {
    const beforeConsent = finalRecipients.length;
    finalRecipients = finalRecipients.filter(recipient => hasMarketingConsent(recipient, clients, reservations));
    const removed = beforeConsent - finalRecipients.length;
    if (removed > 0) warnings.push(`${removed} recipient${removed === 1 ? "" : "s"} excluded because Marketing campaigns require guest communication consent.`);
  }
  if (scheduleMode === "Birthday") {
    const beforeBirthday = finalRecipients.length;
    finalRecipients = finalRecipients.filter(recipient => hasRecipientBirthDate(recipient, clients, reservations));
    finalRecipients = finalRecipients.map(recipient => {
      const dateOfBirth = getRecipientBirthDate(recipient, clients, reservations);
      return {
        ...recipient,
        dateOfBirth,
        variables: {
          ...(recipient.variables || {}),
          date_of_birth: dateOfBirth,
          birthday_month_day: getMonthDay(dateOfBirth),
        },
      };
    });
    const removed = beforeBirthday - finalRecipients.length;
    if (removed > 0) warnings.push(`${removed} recipient${removed === 1 ? "" : "s"} excluded because Birthday automation requires Date of Birth.`);
  }
  if (!finalRecipients.length) errors.push("No valid final recipients after duplicate and suppression checks.");
  if (type === "Marketing" && template && !`${template.html} ${template.plainText}`.includes("{{unsubscribe_url}}")) {
    errors.push("Marketing campaigns must include {{unsubscribe_url}} in the template.");
  }
  if (scheduleMode === "Before Check-in" && finalRecipients.some(item => !item.checkinDate)) {
    errors.push("Every recipient in a check-in automation needs a check-in date.");
  }
  if (scheduleMode === "After Check-out" && finalRecipients.some(item => !item.checkoutDate)) {
    errors.push("Every recipient in a check-out automation needs a check-out date.");
  }
  return { errors, warnings, recipients: finalRecipients, suppressedRecipients };
}

function buildPmsReservationRecipients(
  clients: Client[],
  reservations: Reservation[],
  selectedPropertyId: string,
  suppressions: CommunicationSuppression[],
  baseMeta: ReturnType<SharedProps["meta"]>,
  idSeed: string,
) {
  const activeSuppressions = new Set(suppressions.filter(item => item.status === "Active").map(item => item.email.toLowerCase()));
  const seen = new Set<string>();
  const output: CommunicationRecipient[] = [];
  reservations
    .filter(reservation => reservation.propertyId === selectedPropertyId)
    .filter(reservation => reservation.status !== "Cancelled")
    .forEach((reservation, reservationIndex) => {
      const client = clients.find(item => item.id === reservation.clientId);
      const emails = client?.emails?.length ? client.emails : client?.email ? [client.email] : [];
      emails.forEach(emailValue => {
        const email = emailValue.trim().toLowerCase();
        if (!isValidEmail(email) || seen.has(email)) return;
        seen.add(email);
        output.push({
          ...baseMeta,
          id: `comm-recipient-${idSeed}-${reservationIndex}-${output.length}`,
          source: "Reservation",
          sourceId: reservation.id,
          name: client?.name || email,
          email,
          reservationCode: reservation.id,
          checkinDate: reservation.checkIn,
          checkoutDate: reservation.checkOut,
          dateOfBirth: client?.dateOfBirth || "",
          clientCategory: client?.category,
          marketingOptIn: Boolean(client?.marketingOptIn),
          valid: true,
          suppressed: activeSuppressions.has(email),
          variables: {
            name: client?.name || email,
            email,
            client_id: client?.id || "",
            client_category: client?.category || "",
            marketing_opt_in: client?.marketingOptIn ? "true" : "false",
            reservation_code: reservation.id,
            checkin_date: reservation.checkIn,
            checkout_date: reservation.checkOut,
            date_of_birth: client?.dateOfBirth || "",
            birthday_month_day: getMonthDay(client?.dateOfBirth || ""),
          },
        });
      });
    });
  return output;
}

function hasMarketingConsent(recipient: CommunicationRecipient, clients: Client[], reservations: Reservation[]) {
  if (recipient.marketingOptIn) return true;
  const rawConsent = String(recipient.variables?.marketing_opt_in || recipient.variables?.marketingOptIn || "").toLowerCase();
  if (["true", "yes", "1", "accepted", "consented"].includes(rawConsent)) return true;

  const sourceReservation = recipient.source === "Reservation" && recipient.sourceId
    ? reservations.find(reservation => reservation.id === recipient.sourceId)
    : undefined;
  const sourceClient = sourceReservation
    ? clients.find(client => client.id === sourceReservation.clientId)
    : clients.find(client =>
      client.id === recipient.sourceId ||
      client.email.toLowerCase() === recipient.email.toLowerCase() ||
      (client.emails || []).some(email => email.toLowerCase() === recipient.email.toLowerCase())
    );

  return Boolean(sourceClient?.marketingOptIn);
}

function hasRecipientBirthDate(recipient: CommunicationRecipient, clients: Client[] = [], reservations: Reservation[] = []) {
  return Boolean(getRecipientBirthDate(recipient, clients, reservations));
}

function getRecipientBirthDate(recipient: CommunicationRecipient, clients: Client[] = [], reservations: Reservation[] = []) {
  const ownValue = recipient.dateOfBirth || recipient.variables?.date_of_birth || recipient.variables?.dateOfBirth || "";
  if (ownValue) return ownValue;
  const sourceReservation = recipient.source === "Reservation" && recipient.sourceId
    ? reservations.find(reservation => reservation.id === recipient.sourceId)
    : undefined;
  const sourceClient = sourceReservation
    ? clients.find(client => client.id === sourceReservation.clientId)
    : clients.find(client =>
      client.id === recipient.sourceId ||
      client.email.toLowerCase() === recipient.email.toLowerCase() ||
      (client.emails || []).some(email => email.toLowerCase() === recipient.email.toLowerCase())
    );
  return sourceClient?.dateOfBirth || "";
}

function resolveCampaignScheduleForRecipient(
  recipient: CommunicationRecipient,
  index: number,
  rule: CommunicationSendingRule,
  timing: {
    scheduleMode: CommunicationScheduleMode;
    scheduledAt?: string;
    scheduleOffsetDays?: number;
    scheduleOffsetHours?: number;
    scheduleTimeOfDay?: string;
    timezone?: string;
  },
) {
  const timezone = timing.timezone || rule.timezone || "UTC";
  if (timing.scheduleMode === "Manual") {
    const scheduledAt = timing.scheduledAt
      ? zonedDateTimeToIso(timing.scheduledAt, timezone)
      : scheduleByRule(index, rule);
    return timing.scheduledAt ? addRuleBatchDelay(scheduledAt, index, rule) : scheduledAt;
  }

  if (timing.scheduleMode === "Birthday") {
    const birthdayIso = resolveNextBirthdayIso(getRecipientBirthDate(recipient), timing.scheduleTimeOfDay || "09:00", timezone);
    return birthdayIso ? addRuleBatchDelay(birthdayIso, index, rule) : scheduleByRule(index, rule);
  }

  const sourceDate = timing.scheduleMode === "Before Check-in" ? recipient.checkinDate : recipient.checkoutDate;
  const normalizedSourceDate = normalizeDateOnly(sourceDate || "");
  if (!normalizedSourceDate) return scheduleByRule(index, rule);
  const days = Math.max(0, Number(timing.scheduleOffsetDays || 0));
  const hours = Math.max(0, Number(timing.scheduleOffsetHours || 0));
  const sendTime = normalizeTimeOfDay(timing.scheduleTimeOfDay || "09:00");
  let scheduledIso: string;
  if (timing.scheduleMode === "Before Check-in") {
    if (days > 0) {
      scheduledIso = zonedDateTimeToIso(`${addDaysToDateString(normalizedSourceDate, -days)}T${sendTime}`, timezone);
      if (hours > 0) scheduledIso = addMinutesToIso(scheduledIso, -hours * 60);
    } else if (hours > 0) {
      scheduledIso = addMinutesToIso(zonedDateTimeToIso(`${normalizedSourceDate}T00:00`, timezone), -hours * 60);
    } else {
      scheduledIso = zonedDateTimeToIso(`${normalizedSourceDate}T${sendTime}`, timezone);
    }
  } else {
    scheduledIso = zonedDateTimeToIso(`${addDaysToDateString(normalizedSourceDate, days)}T${sendTime}`, timezone);
    if (hours > 0) scheduledIso = addMinutesToIso(scheduledIso, hours * 60);
  }

  return addRuleBatchDelay(scheduledIso, index, rule);
}

function addRuleBatchDelay(value: string, index: number, rule: CommunicationSendingRule) {
  const batchIndex = Math.floor(index / Math.max(1, Number(rule.batchSize || 1)));
  return addMinutesToIso(value, batchIndex * Math.max(0, Number(rule.batchIntervalMinutes || 0)));
}

function addMinutesToIso(value: string, minutes: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    fallback.setMinutes(fallback.getMinutes() + minutes);
    return fallback.toISOString();
  }
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function scheduleByRule(index: number, rule: CommunicationSendingRule) {
  const batchIndex = Math.floor(index / Math.max(1, rule.batchSize));
  const date = new Date();
  date.setMinutes(date.getMinutes() + batchIndex * rule.batchIntervalMinutes);
  return date.toISOString();
}

function normalizeDateOnly(value: string) {
  if (!value) return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function addDaysToDateString(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeTimeOfDay(value: string) {
  const [hour, minute] = parseTimeOfDay(value);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseTimeOfDay(value: string): [number, number] {
  const [hour, minute] = value.split(":").map(part => Number(part));
  return [Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0];
}

function zonedDateTimeToIso(localValue: string, timezone: string) {
  const match = localValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) {
    const fallback = new Date(localValue);
    return Number.isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
  }
  const parts = match.slice(1).map(Number);
  const utcGuess = Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], 0, 0);
  let offset = getTimeZoneOffsetMs(new Date(utcGuess), timezone);
  let result = new Date(utcGuess - offset);
  const correctedOffset = getTimeZoneOffsetMs(result, timezone);
  if (correctedOffset !== offset) result = new Date(utcGuess - correctedOffset);
  return result.toISOString();
}

function getTimeZoneOffsetMs(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const lookup = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const asUtc = Date.UTC(
      Number(lookup.year),
      Number(lookup.month) - 1,
      Number(lookup.day),
      Number(lookup.hour),
      Number(lookup.minute),
      Number(lookup.second),
    );
    return asUtc - date.getTime();
  } catch {
    return 0;
  }
}

function resolveNextBirthdayIso(dateOfBirth: string, sendTime: string, timezone: string) {
  const birthday = normalizeDateOnly(dateOfBirth);
  if (!birthday) return "";
  const [, month, day] = birthday.split("-");
  const now = new Date();
  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const todayLookup = Object.fromEntries(todayParts.map(part => [part.type, part.value]));
  const currentYear = Number(todayLookup.year);
  let candidateIso = zonedDateTimeToIso(`${currentYear}-${month}-${day}T${normalizeTimeOfDay(sendTime)}`, timezone);
  if (new Date(candidateIso) <= now) {
    candidateIso = zonedDateTimeToIso(`${currentYear + 1}-${month}-${day}T${normalizeTimeOfDay(sendTime)}`, timezone);
  }
  return candidateIso;
}

function getMonthDay(value: string) {
  const normalized = normalizeDateOnly(value);
  return normalized ? normalized.slice(5) : "";
}

function formatCampaignTiming(campaign: CommunicationCampaign) {
  const mode = campaign.scheduleMode || "Manual";
  if (mode === "Manual") return campaign.scheduledAt ? `Manual: ${campaign.scheduledAt} (${campaign.scheduleTimezone || "rule timezone"})` : "Immediate / sending rule";
  if (mode === "Birthday") return `Birthday: ${campaign.scheduleTimeOfDay || "09:00"} (${campaign.scheduleTimezone || "rule timezone"})`;
  const days = Number(campaign.scheduleOffsetDays || 0);
  const hours = Number(campaign.scheduleOffsetHours || 0);
  const time = campaign.scheduleTimeOfDay || "09:00";
  const parts = [`${days}d`, `${hours}h`, time].filter(Boolean).join(" / ");
  return `${mode}: ${parts} (${campaign.scheduleTimezone || "rule timezone"})`;
}

function formatCampaignRepeat(campaign: CommunicationCampaign) {
  const repeatCount = Math.max(1, Number(campaign.repeatCount || 1));
  const repeatInterval = Math.max(0, Number(campaign.repeatIntervalMinutes || 0));
  if (repeatCount === 1) return "Once";
  return `${repeatCount} sends / ${repeatInterval} min`;
}

function formatDateTime(value?: string) {
  if (!value) return "Immediate";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function buildUnsubscribeToken(email: string, campaignId: string) {
  return btoa(`${email}|${campaignId}|${Date.now()}`).replace(/=+$/g, "");
}

function buildEvent(
  meta: ReturnType<SharedProps["meta"]>,
  event: Omit<CommunicationEvent, "id" | "tenantId" | "companyId" | "propertyId" | "createdBy" | "createdAt" | "status">,
): CommunicationEvent {
  return {
    ...meta,
    id: `comm-event-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    ...event,
    createdAt: new Date().toISOString(),
    status: "Active",
  };
}

async function uploadTemplateAsset(file: File, templateId: string, meta: ReturnType<SharedProps["meta"]>): Promise<CommunicationTemplateAsset> {
  const embeddedDataUrl = await fileToDataUrl(file);
  try {
    const response = await fetch("/api/communications-template-asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertyId: meta.propertyId,
        templateId,
        file: { name: file.name, mimeType: file.type || "application/octet-stream", data: embeddedDataUrl },
      }),
    });
    const payload = await response.json().catch(() => null);
    if (response.ok && payload?.ok) {
      return {
        ...meta,
        ...payload.asset,
        templateId,
        status: "Active",
      };
    }
  } catch {
    // Keep an embedded fallback so the template remains testable without Firebase Storage.
  }
  return {
    ...meta,
    id: `comm-asset-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    templateId,
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    embeddedDataUrl,
    status: "Active",
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/'/g, "&#039;");
}
