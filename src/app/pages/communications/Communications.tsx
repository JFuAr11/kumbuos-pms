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
  CommunicationScheduleMode,
  CommunicationSender,
  CommunicationSendingRule,
  CommunicationStatus,
  CommunicationSuppression,
  CommunicationTemplate,
  CommunicationTemplateAsset,
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
const scheduleModes: CommunicationScheduleMode[] = ["Manual", "Before Check-in", "After Check-out"];
const clientCategories: Array<Client["category"] | "All"> = ["All", "Tour Operator", "Agency", "Direct Client", "Corporate", "Other"];
const variables = ["{{name}}", "{{email}}", "{{hotel_name}}", "{{property_name}}", "{{reservation_code}}", "{{checkin_date}}", "{{checkout_date}}", "{{unsubscribe_url}}"];

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
          clients={clients}
          reservations={reservations}
          addCommunicationRecipient={addCommunicationRecipient}
          updateCommunicationRecipient={updateCommunicationRecipient}
          deleteCommunicationRecipient={deleteCommunicationRecipient}
          addCommunicationImportList={addCommunicationImportList}
          deleteCommunicationImportList={deleteCommunicationImportList}
          addCommunicationAudience={addCommunicationAudience}
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
  deleteCommunicationAudience: (id: string) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [filters, setFilters] = useState({ category: "All", from: "", to: "", stayStatus: "All" });
  const [importName, setImportName] = useState("Imported audience");
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState({ name: "Name", email: "Email", language: "Language", reservationCode: "Reservation", checkinDate: "Check-in", checkoutDate: "Check-out" });
  const [error, setError] = useState("");

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
        variables: row,
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
          clientCategory: client.category,
          valid: true,
          suppressed: scoped.suppressions.some(item => item.email.toLowerCase() === email),
          variables: {
            name: client.name,
            email,
            reservation_code: reservation.id,
            checkin_date: reservation.checkIn,
            checkout_date: reservation.checkOut,
          },
        });
      });
    });
    recipients.forEach(addCommunicationRecipient);
    addCommunicationAudience({
      ...meta(),
      id: `comm-audience-clients-${Date.now()}`,
      name: `PMS clients ${new Date().toISOString().slice(0, 10)}`,
      source: "Reservations",
      filters,
      recipientIds: recipients.map(item => item.id),
    });
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
          <div className="mt-4 flex justify-end">
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
        <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
          <div className="space-y-2">
            {scoped.audiences.map(audience => (
              <div key={audience.id} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{audience.name}</p>
                    <p className="text-xs text-muted-foreground">{audience.source} - {audience.recipientIds.length} recipients</p>
                  </div>
                  <Button variant="ghost" size="icon" disabled={!canEdit} className="text-destructive" onClick={() => deleteCommunicationAudience(audience.id)}><Trash2 size={15} /></Button>
                </div>
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
  const renderedHtml = renderTemplate(form.html || richTextToHtml(form.plainText || ""), previewRecipient, activeProperty?.name || "");
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
    const payload: CommunicationTemplate = {
      ...meta(),
      id,
      name: form.name || "",
      type: form.type || "Rich Text",
      subject: form.subject || "",
      preheader: form.preheader || "",
      html: sanitizedHtml,
      plainText: form.plainText || htmlToText(sanitizedHtml),
      variables: extractVariables(`${form.subject || ""} ${form.preheader || ""} ${sanitizedHtml} ${form.plainText || ""}`),
      assetIds: [...(form.assetIds || []), ...uploadedAssets],
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
          {variables.map(variable => <Badge key={variable}>{variable}</Badge>)}
        </div>
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
          {scoped.assets.map(asset => (
            <div key={asset.id} className="mb-2 flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
              <span className="truncate">{asset.name}</span>
              <Button variant="ghost" size="icon" disabled={!canEdit} className="text-destructive" onClick={() => deleteCommunicationTemplateAsset(asset.id)}><Trash2 size={14} /></Button>
            </div>
          ))}
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
          <Field label="Timezone" value={form.timezone || ""} onChange={value => setForm({ ...form, timezone: value })} placeholder="Africa/Dar_es_Salaam" />
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
  helpFor,
  meta,
  addCommunicationCampaign,
  updateCommunicationCampaign,
  deleteCommunicationCampaign,
  addCommunicationOutboxJob,
  addCommunicationEvent,
}: SharedProps & {
  addCommunicationCampaign: (campaign: CommunicationCampaign) => void;
  updateCommunicationCampaign: (id: string, campaign: Partial<CommunicationCampaign>) => void;
  deleteCommunicationCampaign: (id: string) => void;
  addCommunicationOutboxJob: (job: CommunicationOutboxJob) => void;
  addCommunicationEvent: (event: CommunicationEvent) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    type: "Operational" as CommunicationCampaignType,
    senderId: "",
    templateId: "",
    audienceId: "",
    sendingRuleId: "",
    scheduledAt: "",
    scheduleMode: "Manual" as CommunicationScheduleMode,
    scheduleOffsetDays: 0,
    scheduleOffsetHours: 0,
    scheduleTimeOfDay: "09:00",
  });
  const [preflight, setPreflight] = useState<string[]>([]);
  const [readyRecipients, setReadyRecipients] = useState<CommunicationRecipient[]>([]);
  const sender = scoped.senders.find(item => item.id === form.senderId);
  const provider = scoped.providers.find(item => item.id === sender?.providerAccountId) || scoped.providers[0];
  const template = scoped.templates.find(item => item.id === form.templateId);
  const audience = scoped.audiences.find(item => item.id === form.audienceId);
  const rule = scoped.rules.find(item => item.id === form.sendingRuleId);

  const runPreflight = () => {
    const result = preflightCampaign({
      sender,
      provider,
      template,
      audience,
      rule,
      recipients: scoped.recipients,
      suppressions: scoped.suppressions,
      type: form.type,
      scheduleMode: form.scheduleMode,
    });
    setPreflight(result.errors);
    setReadyRecipients(result.recipients);
    return result;
  };

  const launch = () => {
    const result = runPreflight();
    if (result.errors.length || !sender || !template || !rule) return;
    const id = `comm-campaign-${Date.now()}`;
    const now = new Date().toISOString();
    const campaign: CommunicationCampaign = {
      ...meta(),
      id,
      name: form.name || template.name,
      type: form.type,
      senderId: sender.id,
      providerAccountId: provider?.id,
      templateId: template.id,
      audienceId: audience?.id,
      recipientIds: result.recipients.map(item => item.id),
      sendingRuleId: rule.id,
      scheduledAt: form.scheduleMode === "Manual" ? form.scheduledAt || "" : "",
      scheduleMode: form.scheduleMode,
      scheduleOffsetDays: Number(form.scheduleOffsetDays || 0),
      scheduleOffsetHours: Number(form.scheduleOffsetHours || 0),
      scheduleTimeOfDay: form.scheduleTimeOfDay || "09:00",
      status: form.scheduleMode !== "Manual" || form.scheduledAt ? "scheduled" : "sending",
      preflightErrors: [],
      finalRecipientCount: result.recipients.length,
      createdAt: now,
      updatedAt: now,
    };
    addCommunicationCampaign(campaign);
    result.recipients.forEach((recipient, index) => {
      const unsubscribeUrl = `${window.location.origin}/unsubscribe/${encodeURIComponent(buildUnsubscribeToken(recipient.email, id))}`;
      const vars = getRecipientVariables(recipient, activeProperty?.name || "", unsubscribeUrl);
      const scheduledFor = resolveCampaignScheduleForRecipient(recipient, index, rule, {
        scheduleMode: form.scheduleMode,
        scheduledAt: form.scheduledAt,
        scheduleOffsetDays: Number(form.scheduleOffsetDays || 0),
        scheduleOffsetHours: Number(form.scheduleOffsetHours || 0),
        scheduleTimeOfDay: form.scheduleTimeOfDay || "09:00",
      });
      const job: CommunicationOutboxJob = {
        ...meta(),
        id: `comm-job-${Date.now()}-${index}`,
        campaignId: id,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        senderId: sender.id,
        templateId: template.id,
        providerAccountId: provider?.id,
        subject: renderString(template.subject, vars),
        html: renderString(template.html, vars),
        plainText: renderString(template.plainText, vars),
        status: "queued",
        attempts: 0,
        maxRetries: rule.maxRetries,
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
        message: `Queued email for ${recipient.email}.`,
      }));
    });
    setForm({ name: "", type: "Operational", senderId: "", templateId: "", audienceId: "", sendingRuleId: "", scheduledAt: "", scheduleMode: "Manual", scheduleOffsetDays: 0, scheduleOffsetHours: 0, scheduleTimeOfDay: "09:00" });
    setPreflight([]);
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
          <SelectField label="Audience" info={helpFor("audience")} value={form.audienceId} onChange={value => setForm({ ...form, audienceId: value })} options={[{ value: "", label: "Select audience" }, ...scoped.audiences.map(item => ({ value: item.id, label: `${item.name} (${item.recipientIds.length})` }))]} />
          <SelectField label="Sending Rule" value={form.sendingRuleId} onChange={value => setForm({ ...form, sendingRuleId: value })} options={[{ value: "", label: "Select sending rule" }, ...scoped.rules.map(item => ({ value: item.id, label: item.name }))]} />
          <SelectField label="Delivery Timing" value={form.scheduleMode} onChange={value => setForm({ ...form, scheduleMode: value as CommunicationScheduleMode })} options={scheduleModes.map(item => ({ value: item, label: item }))} />
          {form.scheduleMode === "Manual" ? (
            <Field label="Schedule At" type="datetime-local" value={form.scheduledAt} onChange={value => setForm({ ...form, scheduledAt: value })} />
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
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" disabled={!canEdit} onClick={runPreflight}>Preflight Check</Button>
            <Button disabled={!canEdit || preflight.length > 0} onClick={launch}><Play className="mr-2 h-4 w-4" />Launch Campaign</Button>
          </div>
          {preflight.length > 0 && <FormError message={`Preflight blocked launch:\n${preflight.map(item => `- ${item}`).join("\n")}`} />}
          {readyRecipients.length > 0 && !preflight.length && <SuccessMessage message={`Preflight passed. ${readyRecipients.length} final recipients will be queued.`} />}
        </div>
      </Panel>

      <Panel title="Campaigns" icon={BarChart3}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">Campaign</th><th className="p-3">Type</th><th className="p-3">Timing</th><th className="p-3">Status</th><th className="p-3">Recipients</th><th className="p-3 text-right">Actions</th></tr>
            </thead>
            <tbody>
              {scoped.campaigns.map(campaign => (
                <tr key={campaign.id} className="border-t border-border">
                  <td className="p-3 font-medium">{campaign.name}</td>
                  <td className="p-3">{campaign.type}</td>
                  <td className="p-3 text-xs text-muted-foreground">{formatCampaignTiming(campaign)}</td>
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
    const now = new Date();
    const jobs = filtered
      .filter(job => job.status === "queued")
      .filter(job => !job.scheduledFor || new Date(job.scheduledFor) <= now)
      .slice(0, rule?.batchSize || 50);
    if (!jobs.length) {
      setProcessing("No queued jobs are due for this filter yet.");
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
        updateCommunicationOutboxJob(result.id, {
          status: result.status,
          providerMessageId: result.providerMessageId,
          lastError: result.error || "",
          sentAt: result.status === "sent" ? new Date().toISOString() : undefined,
          updatedAt: new Date().toISOString(),
        });
        addCommunicationEvent(buildEvent(meta(), {
          campaignId: result.campaignId,
          outboxJobId: result.id,
          recipientEmail: result.recipientEmail,
          senderId: result.senderId,
          templateId: result.templateId,
          type: result.status === "sent" ? "sent" : "failed",
          message: result.status === "sent" ? `Sent email to ${result.recipientEmail}.` : `Failed email to ${result.recipientEmail}.`,
          providerMessageId: result.providerMessageId,
          errorDetail: result.error,
        }));
      });
      const remainingQueued = scoped.outbox.filter(job => job.campaignId === campaign?.id && job.status === "queued" && !jobs.some(item => item.id === job.id)).length;
      if (campaign && remainingQueued === 0) updateCommunicationCampaign(campaign.id, { status: "completed", updatedAt: new Date().toISOString() });
      setProcessing(`Processed ${payload.results.length} jobs.`);
    } catch (error) {
      jobs.forEach(job => updateCommunicationOutboxJob(job.id, { status: "failed", lastError: error instanceof Error ? error.message : String(error), updatedAt: new Date().toISOString() }));
      setProcessing(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Panel title="Outbox Jobs" icon={Database}>
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <SelectField label="Campaign" value={campaignId} onChange={setCampaignId} options={[{ value: "All", label: "All campaigns" }, ...scoped.campaigns.map(item => ({ value: item.id, label: item.name }))]} />
        <SelectField label="Status" value={status} onChange={setStatus} options={["All", "queued", "sending", "sent", "delivered", "failed", "hard_bounced", "soft_bounced", "suppressed", "unsubscribed", "cancelled"].map(item => ({ value: item, label: item }))} />
        <div className="flex items-end">
          <Button disabled={!canEdit} className="h-10 w-full" onClick={processNextBatch}><Send className="mr-2 h-4 w-4" />Process Next Batch</Button>
        </div>
      </div>
      {processing && <div className="mb-4 rounded-md border border-[#c98736]/30 bg-[#c98736]/10 p-3 text-sm">{processing}</div>}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Recipient</th><th className="p-3">Campaign</th><th className="p-3">Status</th><th className="p-3">Attempts</th><th className="p-3">Error</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map(job => (
              <tr key={job.id} className="border-t border-border">
                <td className="p-3"><p className="font-medium">{job.recipientName}</p><p className="text-xs text-muted-foreground">{job.recipientEmail}</p></td>
                <td className="p-3">{scoped.campaigns.find(item => item.id === job.campaignId)?.name || job.campaignId}</td>
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

function renderTemplate(html: string, recipient?: CommunicationRecipient, propertyName = "") {
  if (!recipient) return sanitizeHtml(html);
  return renderString(sanitizeHtml(html), getRecipientVariables(recipient, propertyName, "#unsubscribe"));
}

function renderString(value: string, variablesMap: Record<string, string>) {
  return value.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => variablesMap[key] ?? "");
}

function getRecipientVariables(recipient: CommunicationRecipient, propertyName: string, unsubscribeUrl: string) {
  return {
    ...(recipient.variables || {}),
    name: recipient.name || "",
    email: recipient.email || "",
    hotel_name: propertyName,
    property_name: propertyName,
    reservation_code: recipient.reservationCode || "",
    checkin_date: recipient.checkinDate || "",
    checkout_date: recipient.checkoutDate || "",
    unsubscribe_url: unsubscribeUrl,
  };
}

function preflightCampaign({
  sender,
  provider,
  template,
  audience,
  rule,
  recipients,
  suppressions,
  type,
  scheduleMode,
}: {
  sender?: CommunicationSender;
  provider?: CommunicationProviderAccount;
  template?: CommunicationTemplate;
  audience?: CommunicationAudience;
  rule?: CommunicationSendingRule;
  recipients: CommunicationRecipient[];
  suppressions: CommunicationSuppression[];
  type: CommunicationCampaignType;
  scheduleMode: CommunicationScheduleMode;
}) {
  const errors: string[] = [];
  if (!sender) errors.push("Select a sender.");
  if (sender && !sender.verified && provider?.mode !== "test") errors.push("Sender must be verified before live campaigns.");
  if (!provider) errors.push("Configure a provider account or Mock/Test provider.");
  if (provider?.provider === "SMTP" && provider.mode === "live" && (!provider.smtpHost || !provider.smtpPort || !provider.smtpUsername || !provider.smtpPassword)) errors.push("Live SMTP provider is incomplete.");
  if (!template) errors.push("Select a template.");
  if (template && !template.subject.trim()) errors.push("Template subject is required.");
  if (template && !template.html.trim() && !template.plainText.trim()) errors.push("Template body is required.");
  if (!audience) errors.push("Select an audience.");
  if (!rule) errors.push("Select a sending rule.");

  const activeSuppressions = new Set(suppressions.filter(item => item.status === "Active").map(item => item.email.toLowerCase()));
  const seen = new Set<string>();
  const finalRecipients = (audience?.recipientIds || [])
    .map(id => recipients.find(item => item.id === id))
    .filter((item): item is CommunicationRecipient => Boolean(item))
    .filter(item => {
      const email = item.email.toLowerCase();
      if (!item.valid || !isValidEmail(item.email)) return false;
      if (seen.has(email)) return false;
      seen.add(email);
      if (activeSuppressions.has(email) || item.suppressed) return false;
      return true;
    });
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
  return { errors, recipients: finalRecipients };
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
  },
) {
  if (timing.scheduleMode === "Manual") {
    return timing.scheduledAt || scheduleByRule(index, rule);
  }

  const sourceDate = timing.scheduleMode === "Before Check-in" ? recipient.checkinDate : recipient.checkoutDate;
  const base = parseLocalDate(sourceDate || "");
  if (!base) return scheduleByRule(index, rule);

  const days = Math.max(0, Number(timing.scheduleOffsetDays || 0));
  const hours = Math.max(0, Number(timing.scheduleOffsetHours || 0));
  const [sendHour, sendMinute] = parseTimeOfDay(timing.scheduleTimeOfDay || "09:00");

  if (timing.scheduleMode === "Before Check-in") {
    if (days > 0) {
      base.setDate(base.getDate() - days);
      base.setHours(sendHour, sendMinute, 0, 0);
      if (hours > 0) base.setHours(base.getHours() - hours);
    } else if (hours > 0) {
      base.setHours(0, 0, 0, 0);
      base.setHours(base.getHours() - hours);
    } else {
      base.setHours(sendHour, sendMinute, 0, 0);
    }
  } else {
    base.setDate(base.getDate() + days);
    base.setHours(sendHour, sendMinute, 0, 0);
    if (hours > 0) base.setHours(base.getHours() + hours);
  }

  const batchIndex = Math.floor(index / Math.max(1, rule.batchSize));
  base.setMinutes(base.getMinutes() + batchIndex * rule.batchIntervalMinutes);
  return base.toISOString();
}

function scheduleByRule(index: number, rule: CommunicationSendingRule) {
  const batchIndex = Math.floor(index / Math.max(1, rule.batchSize));
  const date = new Date();
  date.setMinutes(date.getMinutes() + batchIndex * rule.batchIntervalMinutes);
  return date.toISOString();
}

function parseLocalDate(value: string) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseTimeOfDay(value: string): [number, number] {
  const [hour, minute] = value.split(":").map(part => Number(part));
  return [Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0];
}

function formatCampaignTiming(campaign: CommunicationCampaign) {
  const mode = campaign.scheduleMode || "Manual";
  if (mode === "Manual") return campaign.scheduledAt ? `Manual: ${campaign.scheduledAt}` : "Immediate / sending rule";
  const days = Number(campaign.scheduleOffsetDays || 0);
  const hours = Number(campaign.scheduleOffsetHours || 0);
  const time = campaign.scheduleTimeOfDay || "09:00";
  const parts = [`${days}d`, `${hours}h`, time].filter(Boolean).join(" / ");
  return `${mode}: ${parts}`;
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
