import { useMemo, useState } from "react";
import { useLocation } from "react-router";
import { Bell, Mail, MessageSquare, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { NotificationAutomation, useAppContext } from "../context/AppContext";

const MODULE_DETAILS: Record<string, { name: string; triggers: string[]; recipients: string[] }> = {
  reservations: {
    name: "Reservations",
    triggers: ["Reservation confirmed", "Reservation cancelled", "7 days before arrival", "24 hours before arrival", "Outstanding payment detected"],
    recipients: ["Guests with confirmed bookings", "Guests with pending bookings", "Reservations team", "Property manager"],
  },
  accountancy: {
    name: "Accountancy",
    triggers: ["Invoice created", "Payment overdue", "Daily revenue close", "Monthly statement ready", "Expense approved"],
    recipients: ["Finance team", "Property manager", "Company directors", "External accountant"],
  },
  "supply-requests": {
    name: "Supply Requests",
    triggers: ["Request created", "Request approved", "Budget threshold reached", "Supplier follow-up needed", "Delivery due today"],
    recipients: ["Department heads", "Purchasing team", "Property manager", "Supplier contacts"],
  },
  "check-in": {
    name: "Check-in",
    triggers: ["Guest form completed", "Guest form incomplete", "Arrival due in 48 hours", "Guest checked in", "Marketing consent captured"],
    recipients: ["Arriving guests", "Front desk", "Guest relations", "Property manager"],
  },
  admin: {
    name: "Admin Platform",
    triggers: ["New user created", "Permissions changed", "Company activated", "Property profile updated", "Support access started"],
    recipients: ["Super admins", "Company admins", "Support team", "Property managers"],
  },
  owner: {
    name: "Owner Console",
    triggers: ["New tenant created", "Tenant suspended", "Owner user created", "License boundary warning", "First admin created"],
    recipients: ["System owner", "Owner console users", "Billing operations", "Implementation team"],
  },
};

const emptyForm = (moduleKey: string, moduleName: string): Partial<NotificationAutomation> => ({
  moduleKey,
  moduleName,
  name: "",
  channel: "Email",
  recipientGroup: "",
  subject: "",
  message: "",
  trigger: "",
  timing: "Immediately",
  enabled: true,
});

function getModuleKey(pathname: string) {
  if (pathname.startsWith("/app/supply-requests")) return "supply-requests";
  if (pathname.startsWith("/app/check-in")) return "check-in";
  if (pathname.startsWith("/app/accountancy")) return "accountancy";
  if (pathname.startsWith("/app/admin")) return "admin";
  if (pathname.startsWith("/app/owner")) return "owner";
  return "reservations";
}

export function Notifications() {
  const location = useLocation();
  const moduleKey = getModuleKey(location.pathname);
  const moduleDetails = MODULE_DETAILS[moduleKey];
  const {
    notifications,
    addNotification,
    updateNotification,
    deleteNotification,
    notificationEmailConfigs,
    selectedCompanyId,
    selectedPropertyId,
  } = useAppContext();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<NotificationAutomation> & { explicitRecipientEmailText?: string }>(emptyForm(moduleKey, moduleDetails.name));
  const [formError, setFormError] = useState("");

  const senderConfigs = useMemo(
    () => notificationEmailConfigs.filter(config =>
      (!selectedCompanyId || config.companyId === selectedCompanyId) &&
      (!selectedPropertyId || config.propertyId === selectedPropertyId)
    ),
    [notificationEmailConfigs, selectedCompanyId, selectedPropertyId]
  );

  const moduleNotifications = useMemo(
    () => notifications.filter(notification =>
      notification.moduleKey === moduleKey &&
      (!selectedCompanyId || !notification.companyId || notification.companyId === selectedCompanyId) &&
      (!selectedPropertyId || !notification.propertyId || notification.propertyId === selectedPropertyId)
    ),
    [notifications, moduleKey, selectedCompanyId, selectedPropertyId]
  );

  const resetForm = () => {
    setForm(emptyForm(moduleKey, moduleDetails.name));
    setFormError("");
    setEditingId(null);
    setIsCreating(false);
  };

  const startEdit = (notification: NotificationAutomation) => {
    setForm({
      ...notification,
      explicitRecipientEmailText: (notification.explicitRecipientEmails || []).join(", "),
    });
    setFormError("");
    setEditingId(notification.id);
    setIsCreating(true);
  };

  const saveAutomation = () => {
    setFormError("");
    if (!form.name || !form.subject || !form.message || !form.trigger || !form.recipientGroup) {
      setFormError("Complete name, trigger, recipient group, subject, and message before saving.");
      return;
    }
    const emailResult = parseEmailList(form.explicitRecipientEmailText || "");
    if (emailResult.invalid.length) {
      setFormError(`Check these specific recipient emails: ${emailResult.invalid.join(", ")}`);
      return;
    }

    const payload: NotificationAutomation = {
      id: editingId || `ntf-${Date.now()}`,
      companyId: selectedCompanyId || undefined,
      propertyId: selectedPropertyId || undefined,
      moduleKey,
      moduleName: moduleDetails.name,
      name: form.name,
      channel: form.channel || "Email",
      recipientGroup: form.recipientGroup,
      explicitRecipientEmails: emailResult.valid,
      senderConfigId: form.senderConfigId || senderConfigs[0]?.id,
      subject: form.subject,
      message: form.message,
      trigger: form.trigger,
      timing: form.timing || "Immediately",
      enabled: Boolean(form.enabled),
      lastUpdated: new Date().toISOString().split("T")[0],
    };

    if (editingId) {
      updateNotification(editingId, payload);
    } else {
      addNotification(payload);
    }
    resetForm();
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{moduleDetails.name} Notifications</h1>
          <p className="text-muted-foreground">
            Create automatic emails, messages, and alerts connected to this module.
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} className="gap-2">
          <Plus size={16} />
          New Automation
        </Button>
      </div>

      {isCreating && (
        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{editingId ? "Edit automation" : "Create automation"}</h2>
              <p className="text-sm text-muted-foreground">Set what is sent, who receives it, and when it goes out.</p>
            </div>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Automation name</label>
              <Input value={form.name || ""} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="e.g. Pre-arrival reminder" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Channel</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.channel || "Email"}
                onChange={event => setForm({ ...form, channel: event.target.value as NotificationAutomation["channel"] })}
              >
                <option>Email</option>
                <option>WhatsApp</option>
                <option>SMS</option>
                <option>In-app</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Trigger</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.trigger || ""}
                onChange={event => setForm({ ...form, trigger: event.target.value })}
              >
                <option value="">Select trigger</option>
                {moduleDetails.triggers.map(trigger => <option key={trigger}>{trigger}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Recipient group</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.recipientGroup || ""}
                onChange={event => setForm({ ...form, recipientGroup: event.target.value })}
              >
                <option value="">Select recipients</option>
                {moduleDetails.recipients.map(group => <option key={group}>{group}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Timing rule</label>
              <Input value={form.timing || ""} onChange={event => setForm({ ...form, timing: event.target.value })} placeholder="e.g. 2 days before arrival at 09:00" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Subject</label>
              <Input value={form.subject || ""} onChange={event => setForm({ ...form, subject: event.target.value })} placeholder="Message subject" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Sender email</label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.senderConfigId || ""}
                onChange={event => setForm({ ...form, senderConfigId: event.target.value })}
              >
                <option value="">{senderConfigs.length ? "Use property default sender" : "No sender configured yet"}</option>
                {senderConfigs.map(config => (
                  <option key={config.id} value={config.id}>
                    {config.fromName} - {config.fromEmail}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">Configure sender emails in Admin Platform before enabling real outgoing notifications.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Specific recipient emails</label>
              <Input
                value={form.explicitRecipientEmailText || ""}
                onChange={event => setForm({ ...form, explicitRecipientEmailText: event.target.value })}
                placeholder="Optional: director@company.com, finance@company.com"
              />
              <p className="mt-1 text-xs text-muted-foreground">Leave blank when the automation should use the recipient group or client/agency emails in their profile.</p>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Message body</label>
              <textarea
                className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.message || ""}
                onChange={event => setForm({ ...form, message: event.target.value })}
                placeholder="Write the email, WhatsApp, SMS, or in-app message content."
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.enabled)}
                onChange={event => setForm({ ...form, enabled: event.target.checked })}
              />
              Enabled
            </label>
          </div>
          {formError && <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{formError}</p>}

          <div className="mt-5 flex justify-end">
            <Button onClick={saveAutomation} className="gap-2">
              <Save size={16} />
              Save Automation
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {moduleNotifications.map(notification => (
          <div key={notification.id} className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2 text-primary">
                  {notification.channel === "Email" ? <Mail size={18} /> : notification.channel === "In-app" ? <Bell size={18} /> : <MessageSquare size={18} />}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{notification.name}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${notification.enabled ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>
                      {notification.enabled ? "Enabled" : "Paused"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{notification.subject}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(notification)}>Edit</Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteNotification(notification.id)}>
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Trigger</p>
                <p className="font-medium">{notification.trigger}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Timing</p>
                <p className="font-medium">{notification.timing}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Recipients</p>
                <p className="font-medium">{notification.recipientGroup}</p>
                {notification.explicitRecipientEmails?.length ? (
                  <p className="mt-1 text-xs text-muted-foreground">{notification.explicitRecipientEmails.join(", ")}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">Uses profile/client emails when available.</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Channel</p>
                <p className="font-medium">{notification.channel}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Sender</p>
                <p className="font-medium">
                  {senderConfigs.find(config => config.id === notification.senderConfigId)?.fromEmail || "No sender configured"}
                </p>
              </div>
            </div>

            <p className="mt-4 rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{notification.message}</p>
          </div>
        ))}
      </div>

      {moduleNotifications.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center text-muted-foreground">
          No automations have been created for {moduleDetails.name} yet.
        </div>
      )}
    </div>
  );
}

function parseEmailList(value: string) {
  const items = value
    .split(/[,\n;]/)
    .map(item => item.trim())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];

  items.forEach(item => {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item)) valid.push(item);
    else invalid.push(item);
  });

  return { valid, invalid };
}
