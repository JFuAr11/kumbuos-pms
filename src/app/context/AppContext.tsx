import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import {
  migrateLegacyUserPassword,
  prepareUserWithPassword,
  verifyUserPassword,
} from '../utils/authSecurity';
import { firebaseCredentialsEnabled, publishCredentials, subscribeCredentials } from '../utils/firebaseCredentials';
import { firebasePmsDataEnabled, publishPmsData, subscribePmsData } from '../utils/firebasePmsData';

export type Company = {
  id: string;
  name: string;
  website: string;
  businessSector: string;
  legalName: string;
  taxId: string;
  registrationNumber: string;
  officialAddress: string;
  invoiceEmail: string;
  plan: 'Starter' | 'Pro' | 'Enterprise';
  status: 'Active' | 'Suspended';
  joinedAt: string;
  tenantType?: 'Billable Tenant' | 'Operating Entity';
  parentCompanyId?: string;
  createdByOwnerId?: string;
};

export type Property = {
  id: string;
  companyId: string;
  name: string;
  website: string;
  businessSector: string;
  legalName: string;
  taxId: string;
  registrationNumber: string;
  officialAddress: string;
  invoiceEmail: string;
  status?: 'Active' | 'Inactive' | 'Setup';
  currency?: string;
  timezone?: string;
  roomsCount?: number;
};

export type PermissionAccess = 'none' | 'view' | 'edit';

export type PermissionRule = {
  module: string;
  section: string;
  access: PermissionAccess;
};

export type SystemUser = {
  id: string;
  companyId: string;
  propertyIds: string[];
  name: string;
  email: string;
  role: string;
  profile?: UserProfile;
  departments?: string[];
  phone?: string;
  password: string;
  passwordHash?: string;
  passwordSalt?: string;
  passwordHistory?: string[];
  passwordUpdatedAt?: string;
  mustChangePassword?: boolean;
  status: 'Active' | 'Suspended';
  ownerConsoleAccess?: boolean;
  permissions: PermissionRule[];
};

export type UserProfile =
  | 'Owner'
  | 'Admin'
  | 'General Director'
  | 'Reservations'
  | 'Accountancy'
  | 'Supplies'
  | 'Check-in'
  | 'Communications';

export type ProfileDefinition = {
  name: UserProfile;
  description: string;
  ownerOnly?: boolean;
  permissions: PermissionRule[];
};

export type PasswordResetRequest = {
  id: string;
  userId: string;
  contact: string;
  deliveryMethod: 'Email';
  token: string;
  resetUrl: string;
  fromEmail?: string;
  deliveryStatus?: 'Queued' | 'Sent' | 'Failed';
  createdAt: string;
  used: boolean;
};

export type NotificationAutomation = {
  id: string;
  companyId?: string;
  propertyId?: string;
  moduleKey: string;
  moduleName: string;
  name: string;
  channel: 'Email' | 'WhatsApp' | 'SMS' | 'In-app';
  recipientGroup: string;
  explicitRecipientEmails?: string[];
  senderConfigId?: string;
  subject: string;
  message: string;
  trigger: string;
  timing: string;
  enabled: boolean;
  lastUpdated: string;
};

export type NotificationEmailConfig = {
  id: string;
  companyId: string;
  propertyId: string;
  provider: 'Zoho' | 'Gmail' | 'Microsoft 365' | 'Custom SMTP';
  fromName: string;
  fromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword?: string;
  secure: boolean;
  status: 'Not configured' | 'Configured' | 'Needs review';
  notes?: string;
  updatedAt: string;
};

export type CommunicationStatus = 'Draft' | 'Active' | 'Paused' | 'Archived';
export type CommunicationCampaignStatus = 'draft' | 'ready' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type CommunicationOutboxStatus =
  | 'pending'
  | 'queued'
  | 'sending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'hard_bounced'
  | 'soft_bounced'
  | 'suppressed'
  | 'unsubscribed'
  | 'cancelled';
export type CommunicationProviderKind = 'Mock/Test' | 'SMTP';
export type CommunicationCampaignType = 'Operational' | 'Marketing';
export type CommunicationScheduleMode = 'Manual' | 'Before Check-in' | 'After Check-out' | 'Birthday';
export type CommunicationRecipientScope = 'Selected Audience' | 'All PMS Reservation Clients';

export type CommunicationSender = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  providerAccountId?: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  verified: boolean;
  defaultSender: boolean;
  status: CommunicationStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationProviderAccount = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  provider: CommunicationProviderKind;
  name: string;
  mode: 'test' | 'live';
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  secure?: boolean;
  apiKeyLabel?: string;
  status: CommunicationStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationTemplateAsset = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  templateId?: string;
  assetRole?: 'Inline Image' | 'Email Attachment';
  name: string;
  mimeType: string;
  size: number;
  storagePath?: string;
  downloadUrl?: string;
  embeddedDataUrl?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  status: CommunicationStatus;
};

export type CommunicationTemplate = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  versionNumber?: number;
  versionHistory?: Array<{
    versionNumber: number;
    subject: string;
    preheader: string;
    html: string;
    plainText: string;
    assetIds: string[];
    attachmentIds?: string[];
    savedAt: string;
    savedBy: string;
  }>;
  name: string;
  type: 'Rich Text' | 'HTML';
  subject: string;
  preheader: string;
  html: string;
  plainText: string;
  variables: string[];
  assetIds: string[];
  attachmentIds?: string[];
  deliverabilityScore?: number;
  deliverabilityWarnings?: string[];
  status: CommunicationStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationRecipient = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  source: 'Client' | 'Reservation' | 'Excel' | 'Manual' | 'Check-in Database';
  sourceId?: string;
  importListId?: string;
  audienceIds?: string[];
  audienceNames?: string[];
  name: string;
  email: string;
  language?: string;
  reservationCode?: string;
  checkinDate?: string;
  checkoutDate?: string;
  dateOfBirth?: string;
  clientCategory?: Client['category'];
  marketingOptIn?: boolean;
  variables?: Record<string, string>;
  valid: boolean;
  validationError?: string;
  suppressed?: boolean;
  status: CommunicationStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationImportList = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  name: string;
  fileName: string;
  mappedColumns: Record<string, string>;
  recipientIds: string[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  status: CommunicationStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationAudience = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  name: string;
  source: 'Clients' | 'Reservations' | 'Import List' | 'Manual Mix' | 'Check-in Database';
  filters?: Record<string, string>;
  recipientIds: string[];
  status: CommunicationStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationSendingRule = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  name: string;
  batchSize: number;
  batchIntervalMinutes: number;
  dailyLimit: number;
  allowedFromTime: string;
  allowedToTime: string;
  timezone: string;
  retryCount: number;
  maxRetries: number;
  errorPauseThreshold: number;
  bouncePauseThreshold: number;
  status: CommunicationStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationCampaign = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  clonedFromCampaignId?: string;
  name: string;
  type: CommunicationCampaignType;
  senderId: string;
  providerAccountId?: string;
  templateId: string;
  audienceId?: string;
  recipientScope?: CommunicationRecipientScope;
  recipientIds: string[];
  sendingRuleId: string;
  scheduledAt?: string;
  scheduleMode?: CommunicationScheduleMode;
  scheduleOffsetDays?: number;
  scheduleOffsetHours?: number;
  scheduleTimeOfDay?: string;
  scheduleTimezone?: string;
  repeatCount?: number;
  repeatIntervalMinutes?: number;
  approvalStatus?: 'Draft' | 'Pending Approval' | 'Approved' | 'Rejected';
  approvalRequestedBy?: string;
  approvalRequestedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  status: CommunicationCampaignStatus;
  preflightErrors: string[];
  finalRecipientCount: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationCampaignStep = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  campaignId: string;
  stepIndex: number;
  delayMinutes: number;
  templateId: string;
  status: CommunicationStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationOutboxJob = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  campaignId: string;
  campaignStepId?: string;
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  senderId: string;
  templateId: string;
  providerAccountId?: string;
  subject: string;
  html: string;
  plainText: string;
  attachmentIds?: string[];
  attachments?: Array<{
    name: string;
    mimeType: string;
    size: number;
    downloadUrl?: string;
    embeddedDataUrl?: string;
    cid?: string;
    inline?: boolean;
  }>;
  status: CommunicationOutboxStatus;
  attempts: number;
  maxRetries: number;
  repeatIndex?: number;
  repeatTotal?: number;
  providerMessageId?: string;
  lastError?: string;
  scheduledFor: string;
  sentAt?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationEvent = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  campaignId?: string;
  outboxJobId?: string;
  recipientId?: string;
  recipientEmail?: string;
  senderId?: string;
  templateId?: string;
  type: 'created' | 'queued' | 'sent' | 'delivered' | 'failed' | 'suppressed' | 'unsubscribed' | 'paused' | 'cancelled' | 'test';
  message: string;
  providerMessageId?: string;
  errorCode?: string;
  errorDetail?: string;
  createdBy: string;
  createdAt: string;
  status: CommunicationStatus;
};

export type CommunicationSuppression = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  email: string;
  reason: 'Manual Block' | 'Unsubscribe' | 'Hard Bounce' | 'Complaint';
  appliesTo?: 'All' | 'Marketing';
  sourceCampaignId?: string;
  notes?: string;
  status: CommunicationStatus;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunicationUnsubscribe = {
  id: string;
  tenantId?: string;
  companyId: string;
  propertyId: string;
  email: string;
  token: string;
  campaignId?: string;
  reason?: string;
  consentPreferences?: Record<string, boolean>;
  createdAt: string;
  status: CommunicationStatus;
};

export type CommunicationHelpTooltip = {
  id: string;
  fieldKey: string;
  title: string;
  body: string;
  example?: string;
  warning?: string;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  emails?: string[];
  phone: string;
  nationality: string;
  dateOfBirth?: string;
  category?: 'Tour Operator' | 'Agency' | 'Direct Client' | 'Corporate' | 'Other';
  defaultPaymentPlanId?: string;
  marketingOptIn: boolean;
};

export type CheckInSubmission = {
  id: string;
  uuid: string;
  propertyId: string;
  fullName: string;
  countryOfNationality: string;
  documentType: 'Passport' | 'National ID' | "Driver's License" | 'Other';
  documentNumber: string;
  dateOfBirth: string;
  permanentAddress: string;
  emailAddress: string;
  marketingConsentText: string;
  unsubscribeText: string;
  privacyPolicyText: string;
  marketingConsent: boolean;
  marketingConsentAgree: 'Agree' | 'Not agreed';
  guestSignatureName?: string;
  guestSignatureUrl: string;
  validationStatus: 'Valid' | 'Needs Review';
  notes: string;
  status: 'Submitted' | 'Reviewed' | 'Archived';
  submittedBy: string;
  submissionTime: string;
  version: string;
};

export type Room = {
  id: string;
  propertyId: string;
  name: string;
  type: string;
  capacity: number;
  minOccupancy?: number;
  maxOccupancy?: number;
};

export type Rate = {
  id: string;
  propertyId: string;
  name: string;
  amount: number;
  startDate?: string;
  endDate?: string;
  roomType?: string;
  residency?: 'Resident' | 'Non Resident' | 'Both';
  active?: boolean;
};

export type RateAdjustment = {
  id: string;
  propertyId: string;
  name: string;
  kind: 'Discount' | 'Tax';
  valueType: 'Percentage' | 'Fixed';
  value: number;
  appliesTo: 'All Reservations' | 'Manual Selection';
  taxMode?: 'Included' | 'Added';
  active: boolean;
};

export type PaymentPlanStep = {
  id: string;
  label: string;
  timingType: 'After Booking' | 'Before Check-in';
  days: number;
  amountType: 'Percentage' | 'Fixed' | 'Remaining Balance';
  amount: number;
};

export type PaymentPlan = {
  id: string;
  propertyId: string;
  name: string;
  clientCategory?: Client['category'] | 'All';
  steps: PaymentPlanStep[];
  active: boolean;
};

export type ReservationStatus = 'Provisional' | 'Confirmed' | 'Fully Paid' | 'Cancelled';

export type BookingPayment = {
  id: string;
  reservationId: string;
  propertyId: string;
  date: string;
  amount: number;
  method: 'Bank Transfer' | 'Card' | 'Cash' | 'Mobile Money' | 'Other';
  reference: string;
  notes?: string;
};

export type ReservationInvoice = {
  id: string;
  reservationId: string;
  propertyId: string;
  createdAt: string;
  clientName: string;
  clientEmails: string[];
  lineItems: { description: string; quantity: number; unitPrice: number; total: number }[];
  subtotal: number;
  discounts: number;
  taxes: number;
  total: number;
  paymentSchedule: { label: string; dueDate: string; amount: number }[];
  emailStatus: 'Queued' | 'Sent';
  emailFrom: string;
};

export type OtaConnection = {
  id: string;
  propertyId: string;
  provider: 'Booking.com' | 'Expedia' | 'Airbnb' | 'Other';
  status: 'Connected' | 'Disconnected' | 'Needs Attention';
  lastSyncAt?: string;
  notes?: string;
};

export type ReservationPolicy = {
  id: string;
  propertyId: string;
  section: 'Payment and Booking Policies' | 'Cancellation Policies' | 'Child Policies' | 'Room Amenities Included' | 'Important Notes';
  title: string;
  content: string;
};

export type Reservation = {
  id: string;
  propertyId: string;
  clientId: string;
  roomId: string;
  checkIn: string;
  checkOut: string;
  price: number;
  status: ReservationStatus;
  guests?: number;
  rateId?: string;
  discountId?: string;
  taxIds?: string[];
  paymentPlanId?: string;
  source?: 'Direct' | 'Booking.com' | 'Expedia' | 'Airbnb' | 'Other OTA';
  residency?: 'Resident' | 'Non Resident';
  invoiceId?: string;
  importantNotes?: string;
};

export type SupplyRequest = {
  id: string;
  propertyId: string;
  category: string;
  amount: number;
  date: string;
  description: string;
};

export type AccountancyAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  storagePath?: string;
  downloadUrl?: string;
  source?: 'GenAI Assistant' | 'Manual' | 'Financial Baseline';
  uploadedAt: string;
};

export type AccountancyLineItem = {
  name: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  amount: number;
  amountUsd: number;
  amountThs: number;
  unitPriceUsd?: number;
  unitPriceThs?: number;
  lineTotalUsd?: number;
  lineTotalThs?: number;
};

export type AccountancyEntry = {
  id: string;
  propertyId: string;
  type: 'Revenue' | 'Expense' | 'Asset' | 'Liability';
  date: string;
  category: string;
  subcategories?: string[];
  subcategoryBreakdown?: AccountancyLineItem[];
  counterparty: string;
  description: string;
  amount: number;
  currency: string;
  amountUsd?: number;
  amountThs?: number;
  fxUsdThs?: number;
  fxThsUsd?: number;
  reservationId?: string;
  customerInvoiceId?: string;
  supplierInvoiceId?: string;
  documentType: 'Supplier Invoice' | 'Proof of Payment' | 'Reservation Payment' | 'Other';
  paymentMethod?: string;
  reference?: string;
  taxAmount?: number;
  source: 'GenAI Assistant' | 'Financial Baseline' | 'Manual' | 'Reservations' | 'Supply Requests';
  status: 'Draft' | 'Confirmed';
  attachmentName?: string;
  attachments?: AccountancyAttachment[];
  rawSummary?: string;
  ifrsTreatment?: 'Operating Expense' | 'Inventory' | 'PPE Capitalization' | 'PPE Depreciation' | 'Intangible Amortization' | 'Revenue Recognition' | 'Liability Recognition' | 'Prepayment' | 'Manual Adjustment';
  capitalizationCandidate?: boolean;
  linkedAssetEntryId?: string;
  assetUsefulLifeMonths?: number;
  depreciationMethod?: 'Straight-line' | 'Manual';
  depreciationStartDate?: string;
  assetResidualValue?: number;
  ifrsNotes?: string;
  createdAt: string;
};

export type AccountancyDisplayCurrency = 'USD' | 'TZS';

type AppContextType = {
  currentUser: SystemUser | null;
  login: (email: string, password: string) => Promise<SystemUser | null>;
  logout: () => void;
  profileDefinitions: ProfileDefinition[];
  passwordResetRequests: PasswordResetRequest[];
  credentialSyncStatus: string;
  pmsDataSyncStatus: string;
  requestPasswordReset: (contact: string) => Promise<PasswordResetRequest | null>;
  resetPassword: (token: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  canAccessOwnerConsole: (user?: SystemUser | null) => boolean;
  isRootOwner: (user?: SystemUser | null) => boolean;
  canManageOwnerUsers: (user?: SystemUser | null) => boolean;

  companies: Company[];
  addCompany: (company: Company) => void;
  updateCompany: (id: string, company: Partial<Company>) => void;
  deleteCompany: (id: string) => void;

  properties: Property[];
  selectedCompanyId: string;
  setSelectedCompanyId: (id: string) => void;
  selectedPropertyId: string;
  setSelectedPropertyId: (id: string) => void;
  addProperty: (property: Property) => void;
  updateProperty: (id: string, property: Partial<Property>) => void;
  deleteProperty: (id: string) => void;

  systemUsers: SystemUser[];
  addSystemUser: (user: SystemUser) => void;
  updateSystemUser: (id: string, user: Partial<SystemUser>) => void;
  deleteSystemUser: (id: string) => void;

  notifications: NotificationAutomation[];
  addNotification: (notification: NotificationAutomation) => void;
  updateNotification: (id: string, notification: Partial<NotificationAutomation>) => void;
  deleteNotification: (id: string) => void;
  notificationEmailConfigs: NotificationEmailConfig[];
  addNotificationEmailConfig: (config: NotificationEmailConfig) => void;
  updateNotificationEmailConfig: (id: string, config: Partial<NotificationEmailConfig>) => void;
  deleteNotificationEmailConfig: (id: string) => void;

  clients: Client[];
  addClient: (c: Client) => void;
  updateClient: (id: string, c: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  checkInSubmissions: CheckInSubmission[];
  addCheckInSubmission: (submission: CheckInSubmission) => void;
  updateCheckInSubmission: (id: string, submission: Partial<CheckInSubmission>) => void;

  rooms: Room[];
  addRoom: (r: Room) => void;
  updateRoom: (id: string, r: Partial<Room>) => void;
  deleteRoom: (id: string) => void;

  rates: Rate[];
  addRate: (r: Rate) => void;
  updateRate: (id: string, r: Partial<Rate>) => void;
  deleteRate: (id: string) => void;

  rateAdjustments: RateAdjustment[];
  addRateAdjustment: (r: RateAdjustment) => void;
  updateRateAdjustment: (id: string, r: Partial<RateAdjustment>) => void;
  deleteRateAdjustment: (id: string) => void;

  paymentPlans: PaymentPlan[];
  addPaymentPlan: (p: PaymentPlan) => void;
  updatePaymentPlan: (id: string, p: Partial<PaymentPlan>) => void;
  deletePaymentPlan: (id: string) => void;

  reservations: Reservation[];
  addReservation: (r: Reservation) => void;
  updateReservation: (id: string, r: Partial<Reservation>) => void;
  deleteReservation: (id: string) => void;

  bookingPayments: BookingPayment[];
  addBookingPayment: (p: BookingPayment) => void;
  updateBookingPayment: (id: string, p: Partial<BookingPayment>) => void;
  deleteBookingPayment: (id: string) => void;

  invoices: ReservationInvoice[];
  generateInvoiceHtml: (reservationId: string) => string;

  otaConnections: OtaConnection[];
  addOtaConnection: (c: OtaConnection) => void;
  updateOtaConnection: (id: string, c: Partial<OtaConnection>) => void;
  deleteOtaConnection: (id: string) => void;

  reservationPolicies: ReservationPolicy[];
  addReservationPolicy: (p: ReservationPolicy) => void;
  updateReservationPolicy: (id: string, p: Partial<ReservationPolicy>) => void;
  deleteReservationPolicy: (id: string) => void;

  supplyRequests: SupplyRequest[];
  addSupplyRequest: (s: SupplyRequest) => void;
  updateSupplyRequest: (id: string, s: Partial<SupplyRequest>) => void;
  deleteSupplyRequest: (id: string) => void;

  accountancyEntries: AccountancyEntry[];
  accountancyDisplayCurrency: AccountancyDisplayCurrency;
  setAccountancyDisplayCurrency: (currency: AccountancyDisplayCurrency) => void;
  addAccountancyEntry: (entry: AccountancyEntry) => void;
  updateAccountancyEntry: (id: string, entry: Partial<AccountancyEntry>) => void;
  deleteAccountancyEntry: (id: string) => void;

  communicationSenders: CommunicationSender[];
  addCommunicationSender: (sender: CommunicationSender) => void;
  updateCommunicationSender: (id: string, sender: Partial<CommunicationSender>) => void;
  deleteCommunicationSender: (id: string) => void;
  communicationProviderAccounts: CommunicationProviderAccount[];
  addCommunicationProviderAccount: (account: CommunicationProviderAccount) => void;
  updateCommunicationProviderAccount: (id: string, account: Partial<CommunicationProviderAccount>) => void;
  deleteCommunicationProviderAccount: (id: string) => void;
  communicationTemplates: CommunicationTemplate[];
  addCommunicationTemplate: (template: CommunicationTemplate) => void;
  updateCommunicationTemplate: (id: string, template: Partial<CommunicationTemplate>) => void;
  deleteCommunicationTemplate: (id: string) => void;
  communicationTemplateAssets: CommunicationTemplateAsset[];
  addCommunicationTemplateAsset: (asset: CommunicationTemplateAsset) => void;
  updateCommunicationTemplateAsset: (id: string, asset: Partial<CommunicationTemplateAsset>) => void;
  deleteCommunicationTemplateAsset: (id: string) => void;
  communicationImportLists: CommunicationImportList[];
  addCommunicationImportList: (list: CommunicationImportList) => void;
  updateCommunicationImportList: (id: string, list: Partial<CommunicationImportList>) => void;
  deleteCommunicationImportList: (id: string) => void;
  communicationRecipients: CommunicationRecipient[];
  addCommunicationRecipient: (recipient: CommunicationRecipient) => void;
  updateCommunicationRecipient: (id: string, recipient: Partial<CommunicationRecipient>) => void;
  deleteCommunicationRecipient: (id: string) => void;
  communicationAudiences: CommunicationAudience[];
  addCommunicationAudience: (audience: CommunicationAudience) => void;
  updateCommunicationAudience: (id: string, audience: Partial<CommunicationAudience>) => void;
  deleteCommunicationAudience: (id: string) => void;
  communicationCampaigns: CommunicationCampaign[];
  addCommunicationCampaign: (campaign: CommunicationCampaign) => void;
  updateCommunicationCampaign: (id: string, campaign: Partial<CommunicationCampaign>) => void;
  deleteCommunicationCampaign: (id: string) => void;
  communicationCampaignSteps: CommunicationCampaignStep[];
  addCommunicationCampaignStep: (step: CommunicationCampaignStep) => void;
  updateCommunicationCampaignStep: (id: string, step: Partial<CommunicationCampaignStep>) => void;
  deleteCommunicationCampaignStep: (id: string) => void;
  communicationSendingRules: CommunicationSendingRule[];
  addCommunicationSendingRule: (rule: CommunicationSendingRule) => void;
  updateCommunicationSendingRule: (id: string, rule: Partial<CommunicationSendingRule>) => void;
  deleteCommunicationSendingRule: (id: string) => void;
  communicationOutbox: CommunicationOutboxJob[];
  addCommunicationOutboxJob: (job: CommunicationOutboxJob) => void;
  updateCommunicationOutboxJob: (id: string, job: Partial<CommunicationOutboxJob>) => void;
  deleteCommunicationOutboxJob: (id: string) => void;
  communicationEvents: CommunicationEvent[];
  addCommunicationEvent: (event: CommunicationEvent) => void;
  updateCommunicationEvent: (id: string, event: Partial<CommunicationEvent>) => void;
  deleteCommunicationEvent: (id: string) => void;
  communicationSuppressionList: CommunicationSuppression[];
  addCommunicationSuppression: (suppression: CommunicationSuppression) => void;
  updateCommunicationSuppression: (id: string, suppression: Partial<CommunicationSuppression>) => void;
  deleteCommunicationSuppression: (id: string) => void;
  communicationUnsubscribes: CommunicationUnsubscribe[];
  addCommunicationUnsubscribe: (unsubscribe: CommunicationUnsubscribe) => void;
  updateCommunicationUnsubscribe: (id: string, unsubscribe: Partial<CommunicationUnsubscribe>) => void;
  deleteCommunicationUnsubscribe: (id: string) => void;
  communicationHelpTooltips: CommunicationHelpTooltip[];
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const ROOT_OWNER_ID = 'usr-owner';
const ROOT_OWNER_EMAIL = 'jorge@luxurytentedcamp.com';
const ROOT_OWNER_PASSWORD = 'Owner2026!';
const OWNER_CONSOLE_COMPANY_ID = 'owner-console';

const initialCompanies: Company[] = [];

const initialProperties: Property[] = [];

const initialSystemUsers: SystemUser[] = [
  {
    id: ROOT_OWNER_ID,
    companyId: OWNER_CONSOLE_COMPANY_ID,
    propertyIds: [],
    name: 'Jorge Fuertes',
    email: ROOT_OWNER_EMAIL,
    role: 'System Owner',
    profile: 'Owner',
    departments: ['Owner Console', 'Admin'],
    phone: '+34 000 000 000',
    password: ROOT_OWNER_PASSWORD,
    status: 'Active',
    ownerConsoleAccess: true,
    permissions: [
      { module: 'Owner Console', section: 'Tenant Companies', access: 'edit' },
      { module: 'Owner Console', section: 'Owner Users', access: 'edit' },
      { module: 'Owner Console', section: 'Licensing Guardrails', access: 'edit' },
      { module: 'Admin Platform', section: 'Companies', access: 'edit' },
      { module: 'Admin Platform', section: 'Manage Users', access: 'edit' },
      { module: 'Admin Platform', section: 'Assign Permissions', access: 'edit' },
    ],
  },
];

const initialNotifications: NotificationAutomation[] = [];

const initialCommunicationHelpTooltips: CommunicationHelpTooltip[] = [
  { id: 'help-from-email', fieldKey: 'fromEmail', title: 'From Email', body: 'Email address that recipients will see as the sender. Use a mailbox controlled by this company or property.', example: 'reservations@hotel.com', warning: 'Do not use public or unverified addresses for live campaigns.' },
  { id: 'help-reply-to', fieldKey: 'replyToEmail', title: 'Reply-To', body: 'Mailbox or mailboxes where guest replies should arrive. Use one email or several valid emails separated by commas.', example: 'guestrelations@hotel.com, reservations@hotel.com' },
  { id: 'help-provider', fieldKey: 'provider', title: 'Provider', body: 'Email sending method used by this property. Mock/Test records delivery without sending real emails; SMTP uses the configured mailbox.', example: 'Mock/Test for testing, SMTP for live sending.' },
  { id: 'help-api-key', fieldKey: 'apiKey', title: 'API Key', body: 'Secret token supplied by an email provider. This first version stores SMTP credentials through the secure server bridge and keeps API provider support ready for later.', warning: 'Never paste provider secrets in campaign copy or templates.' },
  { id: 'help-spf', fieldKey: 'spf', title: 'SPF', body: 'DNS TXT record authorizing a mail server to send emails for your domain.', example: 'v=spf1 include:zoho.eu ~all' },
  { id: 'help-dkim', fieldKey: 'dkim', title: 'DKIM', body: 'DNS record that lets email providers cryptographically verify your outgoing messages.', example: 'Add the TXT/CNAME values given by Zoho, Google Workspace, Microsoft 365, or your SMTP provider.' },
  { id: 'help-dmarc', fieldKey: 'dmarc', title: 'DMARC', body: 'DNS policy that tells receivers how to handle mail that fails SPF or DKIM.', example: 'v=DMARC1; p=none; rua=mailto:dmarc@hotel.com' },
  { id: 'help-excel', fieldKey: 'excelFile', title: 'Excel File', body: 'Upload an .xlsx, .xls, .csv, or .tsv list with recipient columns such as name, email, language, reservation code, check-in, and check-out.', example: 'Columns: Name, Email, Language, Reservation' },
  { id: 'help-name-column', fieldKey: 'nameColumn', title: 'Name Column', body: 'Column containing the recipient name used for personalization.', example: '{{name}} becomes Maria Garcia.' },
  { id: 'help-email-column', fieldKey: 'emailColumn', title: 'Email Column', body: 'Column containing the recipient email. Invalid or empty emails will be blocked before campaign launch.', example: 'guest@example.com' },
  { id: 'help-subject', fieldKey: 'subject', title: 'Subject', body: 'Email subject line. It can include variables such as {{name}} or {{property_name}}.', example: 'Your stay at {{property_name}}' },
  { id: 'help-preheader', fieldKey: 'preheader', title: 'Preheader', body: 'Short preview text shown by many inboxes after the subject.', example: 'Everything you need before arrival.' },
  { id: 'help-html', fieldKey: 'html', title: 'HTML', body: 'HTML version of the email body. Scripts, iframes, and unsafe attributes are removed before saving.', example: '<h1>Hello {{name}}</h1>' },
  { id: 'help-plain-text', fieldKey: 'plainText', title: 'Plain Text', body: 'Fallback email body for inboxes that do not render HTML. It can be generated from rich text or edited manually.' },
  { id: 'help-images', fieldKey: 'images', title: 'Images', body: 'Upload images used by an HTML template. Store only images you have permission to send.', example: 'Header photo, logo, campaign banner.' },
  { id: 'help-batch-size', fieldKey: 'batchSize', title: 'Batch Size', body: 'Number of emails processed per batch. Smaller batches reduce spikes and sender reputation risk.', example: '50' },
  { id: 'help-batch-interval', fieldKey: 'batchInterval', title: 'Batch Interval', body: 'Minutes to wait between batches.', example: '60 means one batch every hour.' },
  { id: 'help-daily-limit', fieldKey: 'dailyLimit', title: 'Daily Limit', body: 'Maximum emails allowed per day for this rule.', example: '500' },
  { id: 'help-retry-count', fieldKey: 'retryCount', title: 'Retry Count', body: 'How many times a failed job can be retried before it is marked failed.', example: '3' },
  { id: 'help-bounce-threshold', fieldKey: 'bounceThreshold', title: 'Bounce Threshold', body: 'If failures or bounces exceed this percentage, pause the campaign for review.', example: '10' },
  { id: 'help-campaign-type', fieldKey: 'campaignType', title: 'Campaign Type', body: 'Operational emails relate to bookings or service. Marketing campaigns require unsubscribe links.', example: 'Marketing for newsletters, Operational for pre-arrival details.' },
  { id: 'help-audience', fieldKey: 'audience', title: 'Audience', body: 'Set of recipients built from PMS clients, reservations, imported Excel lists, or manual combinations.' },
  { id: 'help-suppression-list', fieldKey: 'suppressionList', title: 'Suppression List', body: 'Emails that must never receive campaigns from this property due to unsubscribe, bounce, complaint, or manual block.' },
];

const editAllPermissions: PermissionRule[] = [
  { module: 'Reservations', section: 'Calendar', access: 'edit' },
  { module: 'Reservations', section: 'Bookings', access: 'edit' },
  { module: 'Reservations', section: 'Booking Payments', access: 'edit' },
  { module: 'Reservations', section: 'Reports', access: 'edit' },
  { module: 'Reservations', section: 'Configuration', access: 'edit' },
  { module: 'Reservations', section: 'Policies', access: 'edit' },
  { module: 'Reservations', section: 'OTA Sync', access: 'edit' },
  { module: 'Reservations', section: 'Notifications', access: 'edit' },
  { module: 'Accountancy', section: 'Overview', access: 'edit' },
  { module: 'Accountancy', section: 'Revenues', access: 'edit' },
  { module: 'Accountancy', section: 'Expenses', access: 'edit' },
  { module: 'Accountancy', section: 'Profit & Loss (P&L)', access: 'edit' },
  { module: 'Accountancy', section: 'Assets', access: 'edit' },
  { module: 'Accountancy', section: 'Liabilities', access: 'edit' },
  { module: 'Accountancy', section: 'Balance', access: 'edit' },
  { module: 'Accountancy', section: 'Depreciation & Amortization', access: 'edit' },
  { module: 'Accountancy', section: 'GenAI Assistant', access: 'edit' },
  { module: 'Accountancy', section: 'Notifications', access: 'edit' },
  { module: 'Supply Requests', section: 'Beverage', access: 'edit' },
  { module: 'Supply Requests', section: 'Client Food', access: 'edit' },
  { module: 'Supply Requests', section: 'Staff Food', access: 'edit' },
  { module: 'Supply Requests', section: 'Shishas', access: 'edit' },
  { module: 'Supply Requests', section: 'Housekeeping', access: 'edit' },
  { module: 'Supply Requests', section: 'Mechanical', access: 'edit' },
  { module: 'Supply Requests', section: 'Fuel & Petrol', access: 'edit' },
  { module: 'Supply Requests', section: 'Notifications', access: 'edit' },
  { module: 'Check-in', section: 'Check-in Form', access: 'edit' },
  { module: 'Check-in', section: 'Database', access: 'edit' },
  { module: 'Check-in', section: 'Dashboard', access: 'edit' },
  { module: 'Check-in', section: 'Notifications', access: 'edit' },
  { module: 'Communications', section: 'Dashboard', access: 'edit' },
  { module: 'Communications', section: 'Senders', access: 'edit' },
  { module: 'Communications', section: 'Provider Settings', access: 'edit' },
  { module: 'Communications', section: 'DNS Verification', access: 'edit' },
  { module: 'Communications', section: 'Recipients', access: 'edit' },
  { module: 'Communications', section: 'Templates', access: 'edit' },
  { module: 'Communications', section: 'Sending Rules', access: 'edit' },
  { module: 'Communications', section: 'Campaigns', access: 'edit' },
  { module: 'Communications', section: 'Campaign Calendar', access: 'edit' },
  { module: 'Communications', section: 'Guest Journey Builder', access: 'edit' },
  { module: 'Communications', section: 'Outbox Queue', access: 'edit' },
  { module: 'Communications', section: 'Logs', access: 'edit' },
  { module: 'Communications', section: 'Suppression List', access: 'edit' },
  { module: 'Communications', section: 'Notifications', access: 'edit' },
  { module: 'Admin Platform', section: 'Companies', access: 'edit' },
  { module: 'Admin Platform', section: 'Manage Users', access: 'edit' },
  { module: 'Admin Platform', section: 'Assign Permissions', access: 'edit' },
  { module: 'Admin Platform', section: 'Notifications', access: 'edit' },
];

const profileDefinitions: ProfileDefinition[] = [
  {
    name: 'Owner',
    description: 'Full platform ownership, tenant creation, owner-console access, and licensing guardrails.',
    ownerOnly: true,
    permissions: [
      ...editAllPermissions,
      { module: 'Owner Console', section: 'Tenant Companies', access: 'edit' },
      { module: 'Owner Console', section: 'Owner Users', access: 'edit' },
      { module: 'Owner Console', section: 'Licensing Guardrails', access: 'edit' },
    ],
  },
  {
    name: 'Admin',
    description: 'Can manage the tenant company, properties, users, credentials, permissions, and all hotel modules.',
    permissions: editAllPermissions,
  },
  {
    name: 'General Director',
    description: 'Can view and edit all hotel operations except user permissions and owner licensing.',
    permissions: editAllPermissions.filter(rule => rule.module !== 'Admin Platform'),
  },
  {
    name: 'Reservations',
    description: 'Can manage reservation calendar, bookings, rates, configuration, and reservation notifications.',
    permissions: editAllPermissions.filter(rule => rule.module === 'Reservations'),
  },
  {
    name: 'Accountancy',
    description: 'Can manage revenues, expenses, assets, liabilities, balance, finance exports, and finance notifications.',
    permissions: editAllPermissions.filter(rule => rule.module === 'Accountancy'),
  },
  {
    name: 'Supplies',
    description: 'Can manage supply requests, purchasing categories, supplier follow-ups, and supply notifications.',
    permissions: editAllPermissions.filter(rule => rule.module === 'Supply Requests'),
  },
  {
    name: 'Check-in',
    description: 'Can manage guest check-in, guest database, dashboard, and arrival notifications.',
    permissions: editAllPermissions.filter(rule => rule.module === 'Check-in'),
  },
  {
    name: 'Communications',
    description: 'Can manage email senders, recipients, templates, campaigns, outbox, logs, and suppression lists.',
    permissions: editAllPermissions.filter(rule => rule.module === 'Communications'),
  },
];

const getRootOwnerUser = (existing?: Partial<SystemUser>): SystemUser => {
  const ownerPermissions = profileDefinitions.find(profile => profile.name === 'Owner')?.permissions || [];

  return {
    id: ROOT_OWNER_ID,
    companyId: OWNER_CONSOLE_COMPANY_ID,
    propertyIds: [],
    name: existing?.name === 'Jorge Owner' ? 'Jorge Fuertes' : existing?.name || 'Jorge Fuertes',
    email: ROOT_OWNER_EMAIL,
    role: 'System Owner',
    profile: 'Owner',
    departments: ['Owner Console', 'Admin'],
    phone: existing?.phone || '+34 000 000 000',
    password: existing?.passwordHash ? '' : existing?.password || ROOT_OWNER_PASSWORD,
    passwordHash: existing?.passwordHash,
    passwordSalt: existing?.passwordSalt,
    passwordHistory: existing?.passwordHistory,
    passwordUpdatedAt: existing?.passwordUpdatedAt,
    mustChangePassword: existing?.mustChangePassword,
    status: 'Active',
    ownerConsoleAccess: true,
    permissions: ownerPermissions,
  };
};

const STORAGE_NAMESPACE = 'kumbuos-root-baseline-v3';
let legacyStorageCleanupDone = false;

function clearLegacyKumbuOSStorage() {
  if (legacyStorageCleanupDone || typeof window === 'undefined') return;

  legacyStorageCleanupDone = true;
  const legacyPrefixes = [
    'kumbuos-clean-v1:',
    'kumbuos-empty-v1:',
    'kumbuos-root-baseline-v1:',
    'kumbuos-root-baseline-v2:',
    'pms-',
  ];

  try {
    const keysToRemove = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index))
      .filter((key): key is string => Boolean(key))
      .filter(key => legacyPrefixes.some(prefix => key.startsWith(prefix)));

    keysToRemove.forEach(key => window.localStorage.removeItem(key));
  } catch {
    // Local storage can be unavailable in private or restricted browser contexts.
  }
}

function usePersistentState<T>(key: string, initialValue: T) {
  const storageKey = `${STORAGE_NAMESPACE}:${key}`;
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) as T : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // Local storage can be unavailable in private or restricted browser contexts.
    }
  }, [storageKey, value]);

  return [value, setValue] as const;
}

export function AppProvider({ children }: { children: ReactNode }) {
  clearLegacyKumbuOSStorage();

  const [currentUserId, setCurrentUserId] = usePersistentState<string | null>('pms-current-user-id', null);
  const [companies, setCompanies] = usePersistentState<Company[]>('pms-companies', initialCompanies);
  const [properties, setProperties] = usePersistentState<Property[]>('pms-properties', initialProperties);
  const [selectedCompanyId, persistSelectedCompanyId] = usePersistentState<string>('pms-selected-company', initialCompanies[0]?.id || '');
  const [selectedPropertyId, persistSelectedPropertyId] = usePersistentState<string>('pms-selected-property', initialProperties[0]?.id || '');
  const [systemUsers, setSystemUsers] = usePersistentState<SystemUser[]>('pms-system-users', initialSystemUsers);
  const [notifications, setNotifications] = usePersistentState<NotificationAutomation[]>('pms-notifications', initialNotifications);
  const [notificationEmailConfigs, setNotificationEmailConfigs] = usePersistentState<NotificationEmailConfig[]>('pms-notification-email-configs', []);
  const [passwordResetRequests, setPasswordResetRequests] = usePersistentState<PasswordResetRequest[]>('pms-password-reset-requests', []);
  const [credentialSyncStatus, setCredentialSyncStatus] = useState(
    firebaseCredentialsEnabled()
      ? 'Firebase credential sync is starting...'
      : 'Firebase credential sync is not configured. Using local secure credential store.'
  );
  const [credentialSyncReady, setCredentialSyncReady] = useState(!firebaseCredentialsEnabled());
  const latestCredentialSnapshot = useRef('');
  const applyingRemoteCredentials = useRef(false);
  const [pmsDataSyncStatus, setPmsDataSyncStatus] = useState(
    firebasePmsDataEnabled()
      ? 'Firebase PMS data sync is starting...'
      : 'Firebase PMS data sync is not configured. Using local PMS data store.'
  );
  const [pmsDataSyncReady, setPmsDataSyncReady] = useState(!firebasePmsDataEnabled());
  const latestPmsDataSnapshot = useRef('');
  const applyingRemotePmsData = useRef(false);

  const [clients, setClients] = usePersistentState<Client[]>('pms-clients', []);
  const [checkInSubmissions, setCheckInSubmissions] = usePersistentState<CheckInSubmission[]>('pms-check-in-submissions', []);

  const [rooms, setRooms] = usePersistentState<Room[]>('pms-rooms', []);

  const [rates, setRates] = usePersistentState<Rate[]>('pms-rates', []);

  const [rateAdjustments, setRateAdjustments] = usePersistentState<RateAdjustment[]>('pms-rate-adjustments', []);

  const [paymentPlans, setPaymentPlans] = usePersistentState<PaymentPlan[]>('pms-payment-plans', []);

  const [reservations, setReservations] = usePersistentState<Reservation[]>('pms-reservations', []);

  const [bookingPayments, setBookingPayments] = usePersistentState<BookingPayment[]>('pms-booking-payments', []);
  const [invoices, setInvoices] = usePersistentState<ReservationInvoice[]>('pms-reservation-invoices', []);
  const [otaConnections, setOtaConnections] = usePersistentState<OtaConnection[]>('pms-ota-connections', []);
  const [reservationPolicies, setReservationPolicies] = usePersistentState<ReservationPolicy[]>('pms-reservation-policies', []);

  const [supplyRequests, setSupplyRequests] = usePersistentState<SupplyRequest[]>('pms-supply-requests', []);

  const [accountancyEntries, setAccountancyEntries] = usePersistentState<AccountancyEntry[]>('pms-accountancy-entries-v2', []);
  const [accountancyDisplayCurrency, setAccountancyDisplayCurrency] = usePersistentState<AccountancyDisplayCurrency>('pms-accountancy-display-currency', 'USD');
  const [communicationSenders, setCommunicationSenders] = usePersistentState<CommunicationSender[]>('pms-communication-senders', []);
  const [communicationProviderAccounts, setCommunicationProviderAccounts] = usePersistentState<CommunicationProviderAccount[]>('pms-communication-provider-accounts', []);
  const [communicationTemplates, setCommunicationTemplates] = usePersistentState<CommunicationTemplate[]>('pms-communication-templates', []);
  const [communicationTemplateAssets, setCommunicationTemplateAssets] = usePersistentState<CommunicationTemplateAsset[]>('pms-communication-template-assets', []);
  const [communicationImportLists, setCommunicationImportLists] = usePersistentState<CommunicationImportList[]>('pms-communication-import-lists', []);
  const [communicationRecipients, setCommunicationRecipients] = usePersistentState<CommunicationRecipient[]>('pms-communication-recipients', []);
  const [communicationAudiences, setCommunicationAudiences] = usePersistentState<CommunicationAudience[]>('pms-communication-audiences', []);
  const [communicationCampaigns, setCommunicationCampaigns] = usePersistentState<CommunicationCampaign[]>('pms-communication-campaigns', []);
  const [communicationCampaignSteps, setCommunicationCampaignSteps] = usePersistentState<CommunicationCampaignStep[]>('pms-communication-campaign-steps', []);
  const [communicationSendingRules, setCommunicationSendingRules] = usePersistentState<CommunicationSendingRule[]>('pms-communication-sending-rules', []);
  const [communicationOutbox, setCommunicationOutbox] = usePersistentState<CommunicationOutboxJob[]>('pms-communication-outbox', []);
  const [communicationEvents, setCommunicationEvents] = usePersistentState<CommunicationEvent[]>('pms-communication-events', []);
  const [communicationSuppressionList, setCommunicationSuppressionList] = usePersistentState<CommunicationSuppression[]>('pms-communication-suppression-list', []);
  const [communicationUnsubscribes, setCommunicationUnsubscribes] = usePersistentState<CommunicationUnsubscribe[]>('pms-communication-unsubscribes', []);
  const [communicationHelpTooltips, setCommunicationHelpTooltips] = usePersistentState<CommunicationHelpTooltip[]>('pms-communication-help-tooltips', initialCommunicationHelpTooltips);

  useEffect(() => {
    if ((accountancyDisplayCurrency as string) === 'THS') {
      setAccountancyDisplayCurrency('TZS');
    }
  }, [accountancyDisplayCurrency, setAccountancyDisplayCurrency]);

  const currentUser = systemUsers.find(user => user.id === currentUserId) || (currentUserId === ROOT_OWNER_ID ? getRootOwnerUser() : null);

  const isRootOwner = (user: SystemUser | null = currentUser) =>
    Boolean(user && user.id === ROOT_OWNER_ID && user.email.toLowerCase() === ROOT_OWNER_EMAIL);

  const canManageOwnerUsers = (user: SystemUser | null = currentUser) => isRootOwner(user);

  const canAccessOwnerConsole = (user: SystemUser | null = currentUser) =>
    isRootOwner(user) ||
    Boolean(user?.ownerConsoleAccess && user.permissions.some(permission => permission.module === 'Owner Console' && permission.access === 'edit'));

  const setSelectedPropertyId = (id: string) => {
    persistSelectedPropertyId(id);
    const property = properties.find(item => item.id === id);
    if (property) persistSelectedCompanyId(property.companyId);
  };

  const setSelectedCompanyId = (id: string) => {
    persistSelectedCompanyId(id);
    const visibleCompanyProperties = properties
      .filter(property => property.companyId === id)
      .filter(property => !currentUser || canAccessOwnerConsole(currentUser) || currentUser.propertyIds.includes(property.id));
    if (!visibleCompanyProperties.length) {
      persistSelectedPropertyId('');
      return;
    }
    if (visibleCompanyProperties.length && !visibleCompanyProperties.some(property => property.id === selectedPropertyId)) {
      persistSelectedPropertyId(visibleCompanyProperties[0].id);
    }
  };

  useEffect(() => {
    setNotifications(current => {
      const missingDefaults = initialNotifications.filter(
        defaultNotification => !current.some(notification => notification.id === defaultNotification.id)
      );
      return missingDefaults.length ? [...current, ...missingDefaults] : current;
    });
  }, [setNotifications]);

  useEffect(() => {
    setCommunicationHelpTooltips(current => {
      const missingDefaults = initialCommunicationHelpTooltips.filter(
        tooltip => !current.some(item => item.id === tooltip.id || item.fieldKey === tooltip.fieldKey)
      );
      return missingDefaults.length ? [...current, ...missingDefaults] : current;
    });
  }, [setCommunicationHelpTooltips]);

  useEffect(() => {
    setSystemUsers(current => {
      const existingRoot = current.find(user => user.id === ROOT_OWNER_ID || user.email.toLowerCase() === ROOT_OWNER_EMAIL);
      const rootOwner = getRootOwnerUser(existingRoot);
      const usersWithoutRootDuplicates = current.filter(
        user => user.id !== ROOT_OWNER_ID && user.email.toLowerCase() !== ROOT_OWNER_EMAIL
      );
      return [rootOwner, ...usersWithoutRootDuplicates];
    });
  }, [setSystemUsers]);

  useEffect(() => {
    let cancelled = false;

    Promise.all(systemUsers.map(migrateLegacyUserPassword)).then(migratedUsers => {
      if (cancelled) return;
      if (JSON.stringify(migratedUsers) !== JSON.stringify(systemUsers)) {
        setSystemUsers(migratedUsers);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [systemUsers, setSystemUsers]);

  useEffect(() => {
    return subscribeCredentials(payload => {
      setCredentialSyncReady(true);

      const existingRoot = payload.users.find(user => user.id === ROOT_OWNER_ID || user.email.toLowerCase() === ROOT_OWNER_EMAIL);
      const rootOwner = getRootOwnerUser(existingRoot);
      const remoteUsers = [
        rootOwner,
        ...payload.users.filter(user => user.id !== ROOT_OWNER_ID && user.email.toLowerCase() !== ROOT_OWNER_EMAIL),
      ];
      const resetRequests = payload.users.length ? payload.passwordResetRequests || [] : [];
      const snapshot = JSON.stringify({
        users: remoteUsers,
        passwordResetRequests: resetRequests,
      });

      applyingRemoteCredentials.current = true;
      latestCredentialSnapshot.current = payload.users.length ? snapshot : '';
      setSystemUsers(remoteUsers);
      setPasswordResetRequests(resetRequests);
      window.setTimeout(() => {
        applyingRemoteCredentials.current = false;
      }, 0);
    }, status => {
      setCredentialSyncStatus(status);
      if (status.includes('no remote credential data')) setCredentialSyncReady(true);
      if (status.includes('not configured')) setCredentialSyncReady(true);
    });
  }, [setSystemUsers, setPasswordResetRequests]);

  useEffect(() => {
    if (!credentialSyncReady || applyingRemoteCredentials.current) return;
    const snapshot = JSON.stringify({ users: systemUsers, passwordResetRequests });
    if (snapshot === latestCredentialSnapshot.current) return;

    latestCredentialSnapshot.current = snapshot;
    publishCredentials(systemUsers, passwordResetRequests)
      .then(() => {
        if (firebaseCredentialsEnabled()) setCredentialSyncStatus('Firebase credential store is synced in real time.');
      })
      .catch(error => setCredentialSyncStatus(`Firebase credential publish failed: ${error.message}`));
  }, [credentialSyncReady, systemUsers, passwordResetRequests]);

  useEffect(() => {
    return subscribePmsData(payload => {
      setPmsDataSyncReady(true);
      const snapshot = JSON.stringify(payload);

      applyingRemotePmsData.current = true;
      latestPmsDataSnapshot.current = snapshot;
      setCompanies(payload.companies);
      setProperties(payload.properties);
      setNotifications(payload.notifications);
      setNotificationEmailConfigs(payload.notificationEmailConfigs);
      setClients(payload.clients);
      setCheckInSubmissions(payload.checkInSubmissions);
      setRooms(payload.rooms);
      setRates(payload.rates);
      setRateAdjustments(payload.rateAdjustments);
      setPaymentPlans(payload.paymentPlans);
      setReservations(payload.reservations);
      setBookingPayments(payload.bookingPayments);
      setInvoices(payload.invoices);
      setOtaConnections(payload.otaConnections);
      setReservationPolicies(payload.reservationPolicies);
      setSupplyRequests(payload.supplyRequests);
      setAccountancyEntries(payload.accountancyEntries);
      setCommunicationSenders(payload.communicationSenders);
      setCommunicationProviderAccounts(payload.communicationProviderAccounts);
      setCommunicationTemplates(payload.communicationTemplates);
      setCommunicationTemplateAssets(payload.communicationTemplateAssets);
      setCommunicationImportLists(payload.communicationImportLists);
      setCommunicationRecipients(payload.communicationRecipients);
      setCommunicationAudiences(payload.communicationAudiences);
      setCommunicationCampaigns(payload.communicationCampaigns);
      setCommunicationCampaignSteps(payload.communicationCampaignSteps);
      setCommunicationSendingRules(payload.communicationSendingRules);
      setCommunicationOutbox(payload.communicationOutbox);
      setCommunicationEvents(payload.communicationEvents);
      setCommunicationSuppressionList(payload.communicationSuppressionList);
      setCommunicationUnsubscribes(payload.communicationUnsubscribes);
      setCommunicationHelpTooltips(payload.communicationHelpTooltips.length ? payload.communicationHelpTooltips : initialCommunicationHelpTooltips);
      window.setTimeout(() => {
        applyingRemotePmsData.current = false;
      }, 0);
    }, status => {
      setPmsDataSyncStatus(status);
      if (status.includes('no remote PMS data')) setPmsDataSyncReady(true);
      if (status.includes('not configured')) setPmsDataSyncReady(true);
    });
  }, [
    setCompanies,
    setProperties,
    setNotifications,
    setNotificationEmailConfigs,
    setClients,
    setCheckInSubmissions,
    setRooms,
    setRates,
    setRateAdjustments,
    setPaymentPlans,
    setReservations,
    setBookingPayments,
    setInvoices,
    setOtaConnections,
    setReservationPolicies,
    setSupplyRequests,
    setAccountancyEntries,
    setCommunicationSenders,
    setCommunicationProviderAccounts,
    setCommunicationTemplates,
    setCommunicationTemplateAssets,
    setCommunicationImportLists,
    setCommunicationRecipients,
    setCommunicationAudiences,
    setCommunicationCampaigns,
    setCommunicationCampaignSteps,
    setCommunicationSendingRules,
    setCommunicationOutbox,
    setCommunicationEvents,
    setCommunicationSuppressionList,
    setCommunicationUnsubscribes,
    setCommunicationHelpTooltips,
  ]);

  useEffect(() => {
    if (!pmsDataSyncReady || applyingRemotePmsData.current) return;

    const payload = {
      companies,
      properties,
      notifications,
      notificationEmailConfigs,
      clients,
      checkInSubmissions,
      rooms,
      rates,
      rateAdjustments,
      paymentPlans,
      reservations,
      bookingPayments,
      invoices,
      otaConnections,
      reservationPolicies,
      supplyRequests,
      accountancyEntries,
      communicationSenders,
      communicationProviderAccounts,
      communicationTemplates,
      communicationTemplateAssets,
      communicationImportLists,
      communicationRecipients,
      communicationAudiences,
      communicationCampaigns,
      communicationCampaignSteps,
      communicationSendingRules,
      communicationOutbox,
      communicationEvents,
      communicationSuppressionList,
      communicationUnsubscribes,
      communicationHelpTooltips,
    };
    const snapshot = JSON.stringify(payload);
    if (snapshot === latestPmsDataSnapshot.current) return;

    latestPmsDataSnapshot.current = snapshot;
    publishPmsData(payload)
      .then(() => {
        if (firebasePmsDataEnabled()) setPmsDataSyncStatus('Firebase PMS data store is synced in real time.');
      })
      .catch(error => setPmsDataSyncStatus(`Firebase PMS data publish failed: ${error.message}`));
  }, [
    pmsDataSyncReady,
    companies,
    properties,
    notifications,
    notificationEmailConfigs,
    clients,
    checkInSubmissions,
    rooms,
    rates,
    rateAdjustments,
    paymentPlans,
    reservations,
    bookingPayments,
    invoices,
    otaConnections,
    reservationPolicies,
    supplyRequests,
    accountancyEntries,
    communicationSenders,
    communicationProviderAccounts,
    communicationTemplates,
    communicationTemplateAssets,
    communicationImportLists,
    communicationRecipients,
    communicationAudiences,
    communicationCampaigns,
    communicationCampaignSteps,
    communicationSendingRules,
    communicationOutbox,
    communicationEvents,
    communicationSuppressionList,
    communicationUnsubscribes,
    communicationHelpTooltips,
  ]);

  useEffect(() => {
    setSystemUsers(current => current.map(user => {
      let permissions = user.permissions;
      if (user.profile === 'Admin') {
        permissions = editAllPermissions.reduce((rules, requiredRule) => {
          const existingRule = rules.find(rule => rule.module === requiredRule.module && rule.section === requiredRule.section);
          if (!existingRule) return [...rules, requiredRule];
          if (existingRule.access === 'edit') return rules;
          return rules.map(rule =>
            rule.module === requiredRule.module && rule.section === requiredRule.section
              ? { ...rule, access: 'edit' as PermissionAccess }
              : rule
          );
        }, permissions);
      }

      const accountancyAccess = permissions.find(permission => permission.module === 'Accountancy' && permission.access !== 'none')?.access;
      const reservationsAccess = permissions.find(permission => permission.module === 'Reservations' && permission.access !== 'none')?.access;
      const legacyCheckInAccess = permissions.find(permission => permission.module === 'Check-in' && permission.section === 'Guest Form' && permission.access !== 'none')?.access;

      const additions: PermissionRule[] = ['Assets', 'Liabilities', 'Depreciation & Amortization']
        .filter(() => Boolean(accountancyAccess))
        .filter(section => !permissions.some(permission => permission.module === 'Accountancy' && permission.section === section))
        .map(section => ({ module: 'Accountancy', section, access: accountancyAccess || 'none' }));

      if (reservationsAccess && !permissions.some(permission => permission.module === 'Reservations' && permission.section === 'Reports')) {
        additions.push({ module: 'Reservations', section: 'Reports', access: reservationsAccess });
      }

      if (legacyCheckInAccess && !permissions.some(permission => permission.module === 'Check-in' && permission.section === 'Check-in Form')) {
        additions.push({ module: 'Check-in', section: 'Check-in Form', access: legacyCheckInAccess });
      }

      const communicationsAccess = permissions.find(permission => permission.module === 'Communications' && permission.access !== 'none')?.access;
      if ((user.profile === 'Admin' || user.profile === 'General Director') && !communicationsAccess) {
        editAllPermissions
          .filter(rule => rule.module === 'Communications')
          .forEach(rule => additions.push(rule));
      }

      const nextPermissions = additions.length ? [...permissions, ...additions] : permissions;
      return nextPermissions !== user.permissions ? { ...user, permissions: nextPermissions } : user;
    }));
  }, [setSystemUsers]);

  useEffect(() => {
    const visibleProperties = currentUser && !canAccessOwnerConsole(currentUser)
      ? properties.filter(property => currentUser.propertyIds.includes(property.id))
      : properties;

    if (!visibleProperties.length && selectedPropertyId) {
      persistSelectedPropertyId('');
      return;
    }

    if (!visibleProperties.some(property => property.id === selectedPropertyId) && visibleProperties[0]) {
      setSelectedPropertyId(visibleProperties[0].id);
    }
  }, [properties, selectedPropertyId, setSelectedPropertyId, currentUserId]);

  useEffect(() => {
    const visibleCompanies = currentUser && !canAccessOwnerConsole(currentUser)
      ? companies.filter(company => company.id === currentUser.companyId)
      : companies;

    if (!visibleCompanies.length && selectedCompanyId) {
      persistSelectedCompanyId('');
      return;
    }

    if (!visibleCompanies.some(company => company.id === selectedCompanyId) && visibleCompanies[0]) {
      setSelectedCompanyId(visibleCompanies[0].id);
    }
  }, [companies, selectedCompanyId, currentUserId]);

  useEffect(() => {
    const companyProperties = properties.filter(property => property.companyId === selectedCompanyId);
    const visibleCompanyProperties = currentUser && !canAccessOwnerConsole(currentUser)
      ? companyProperties.filter(property => currentUser.propertyIds.includes(property.id))
      : companyProperties;

    if (!visibleCompanyProperties.length && selectedPropertyId) {
      persistSelectedPropertyId('');
      return;
    }

    if (visibleCompanyProperties.length && !visibleCompanyProperties.some(property => property.id === selectedPropertyId)) {
      setSelectedPropertyId(visibleCompanyProperties[0].id);
    }
  }, [properties, selectedCompanyId, selectedPropertyId, setSelectedPropertyId, currentUserId]);

  const login = async (email: string, password: string) => {
    const existingRoot = systemUsers.find(user => user.id === ROOT_OWNER_ID || user.email.toLowerCase() === ROOT_OWNER_EMAIL);
    const rootPasswordMatches = existingRoot
      ? await verifyUserPassword(existingRoot, password)
      : password === ROOT_OWNER_PASSWORD;
    const rootBootstrapMatches = !existingRoot?.passwordHash && password === ROOT_OWNER_PASSWORD;
    const isRootLogin = email.toLowerCase() === ROOT_OWNER_EMAIL && (rootBootstrapMatches || rootPasswordMatches);
    if (isRootLogin) {
      const rootOwner = getRootOwnerUser(existingRoot);
      setSystemUsers(current => {
        const usersWithoutRootDuplicates = current.filter(
          user => user.id !== ROOT_OWNER_ID && user.email.toLowerCase() !== ROOT_OWNER_EMAIL
        );
        return [rootOwner, ...usersWithoutRootDuplicates];
      });
      setCurrentUserId(ROOT_OWNER_ID);
      return rootOwner;
    }

    const candidate = systemUsers.find(
      item => item.email.toLowerCase() === email.toLowerCase() && item.status === 'Active'
    ) || null;
    const user = candidate && await verifyUserPassword(candidate, password) ? candidate : null;

    if (user) {
      setCurrentUserId(user.id);
      const firstPropertyId = user.propertyIds[0];
      if (firstPropertyId) {
        const firstProperty = properties.find(property => property.id === firstPropertyId);
        if (firstProperty) setSelectedCompanyId(firstProperty.companyId);
        setSelectedPropertyId(firstPropertyId);
      }
    }

    return user;
  };

  const logout = () => setCurrentUserId(null);

  const sendPasswordResetEmail = async (user: SystemUser, request: PasswordResetRequest): Promise<PasswordResetRequest['deliveryStatus']> => {
    try {
      const response = await fetch('/api/password-reset-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: user.email,
          userName: user.name,
          resetUrl: request.resetUrl,
        }),
      });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : null;
      return response.ok && payload?.ok ? 'Sent' : 'Failed';
    } catch {
      return 'Failed';
    }
  };

  const requestPasswordReset = async (contact: string) => {
    const normalizedContact = contact.trim().toLowerCase();
    const user = systemUsers.find(item =>
      item.email.toLowerCase() === normalizedContact
    );

    if (!user) return null;

    const token = `rst-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const resetUrl = `${window.location.origin}/login?resetToken=${token}`;
    const request: PasswordResetRequest = {
      id: `pr-${Date.now()}`,
      userId: user.id,
      contact,
      deliveryMethod: 'Email',
      token,
      resetUrl,
      fromEmail: 'info@luxurytentedcamp.com',
      deliveryStatus: 'Queued',
      createdAt: new Date().toISOString(),
      used: false,
    };

    setPasswordResetRequests(current => [request, ...current]);
    const deliveryStatus = await sendPasswordResetEmail(user, request);
    const updatedRequest = { ...request, deliveryStatus };
    setPasswordResetRequests(current =>
      current.map(item => item.id === request.id ? updatedRequest : item)
    );
    return updatedRequest;
  };

  const resetPassword = async (token: string, newPassword: string) => {
    const request = passwordResetRequests.find(item => item.token === token && !item.used);
    if (!request) return { ok: false, error: 'This reset link is invalid or has already been used.' };
    const user = systemUsers.find(item => item.id === request.userId);
    if (!user) return { ok: false, error: 'The user linked to this reset request no longer exists.' };

    const result = await prepareUserWithPassword(user, newPassword);
    if (!result.ok) return { ok: false, error: result.error };

    setSystemUsers(current => current.map(item => item.id === request.userId ? result.user : item));
    setPasswordResetRequests(current =>
      current.map(item => item.token === token ? { ...item, used: true } : item)
    );
    return { ok: true };
  };

  const addCompany = (company: Company) => {
    setCompanies(current => [...current, company]);
    if (!selectedCompanyId) persistSelectedCompanyId(company.id);
  };
  const updateCompany = (id: string, updates: Partial<Company>) =>
    setCompanies(current => current.map(company => company.id === id ? { ...company, ...updates } : company));
  const deleteCompany = (id: string) => {
    setCompanies(current => current.filter(company => company.id !== id));
    setProperties(current => current.filter(property => property.companyId !== id));
    setSystemUsers(current => current.filter(user => user.companyId !== id || user.ownerConsoleAccess || user.id === ROOT_OWNER_ID));
  };

  const addProperty = (property: Property) => {
    setProperties(current => [...current, property]);
    persistSelectedCompanyId(property.companyId);
    if (!selectedPropertyId) persistSelectedPropertyId(property.id);
    setSystemUsers(current => current.map(user => {
      if (user.companyId !== property.companyId) return user;
      if (user.profile !== 'Admin' && user.profile !== 'General Director') return user;
      if (user.propertyIds.includes(property.id)) return user;
      return { ...user, propertyIds: [...user.propertyIds, property.id] };
    }));
  };
  const updateProperty = (id: string, updates: Partial<Property>) =>
    setProperties(current => current.map(property => property.id === id ? { ...property, ...updates } : property));
  const deleteProperty = (id: string) => {
    setProperties(current => current.filter(property => property.id !== id));
    setRooms(current => current.filter(room => room.propertyId !== id));
    setRates(current => current.filter(rate => rate.propertyId !== id));
    setReservations(current => current.filter(reservation => reservation.propertyId !== id));
    setSupplyRequests(current => current.filter(request => request.propertyId !== id));
    setAccountancyEntries(current => current.filter(entry => entry.propertyId !== id));
    setCommunicationSenders(current => current.filter(item => item.propertyId !== id));
    setCommunicationProviderAccounts(current => current.filter(item => item.propertyId !== id));
    setCommunicationTemplates(current => current.filter(item => item.propertyId !== id));
    setCommunicationTemplateAssets(current => current.filter(item => item.propertyId !== id));
    setCommunicationImportLists(current => current.filter(item => item.propertyId !== id));
    setCommunicationRecipients(current => current.filter(item => item.propertyId !== id));
    setCommunicationAudiences(current => current.filter(item => item.propertyId !== id));
    setCommunicationCampaigns(current => current.filter(item => item.propertyId !== id));
    setCommunicationCampaignSteps(current => current.filter(item => item.propertyId !== id));
    setCommunicationSendingRules(current => current.filter(item => item.propertyId !== id));
    setCommunicationOutbox(current => current.filter(item => item.propertyId !== id));
    setCommunicationEvents(current => current.filter(item => item.propertyId !== id));
    setCommunicationSuppressionList(current => current.filter(item => item.propertyId !== id));
    setCommunicationUnsubscribes(current => current.filter(item => item.propertyId !== id));
    setSystemUsers(current => current.map(user => ({
      ...user,
      propertyIds: user.propertyIds.filter(propertyId => propertyId !== id),
    })));
  };

  const addSystemUser = (user: SystemUser) => {
    if ((user.ownerConsoleAccess || user.profile === 'Owner') && !canManageOwnerUsers(currentUser)) return;
    if (systemUsers.some(item => item.email.toLowerCase() === user.email.toLowerCase())) {
      window.alert('A user with this email already exists.');
      return;
    }
    void prepareUserWithPassword(user, user.password).then(result => {
      if (!result.ok) {
        window.alert(result.error);
        return;
      }
      setSystemUsers(current => [...current, result.user]);
    });
  };
  const updateSystemUser = (id: string, updates: Partial<SystemUser>) =>
    setSystemUsers(current => {
      const target = current.find(user => user.id === id);
      if (!target) return current;

      if (updates.email && current.some(user => user.id !== id && user.email.toLowerCase() === updates.email?.toLowerCase())) {
        window.alert('A user with this email already exists.');
        return current;
      }

      if ((target.ownerConsoleAccess || target.profile === 'Owner' || updates.ownerConsoleAccess || updates.profile === 'Owner') && !canManageOwnerUsers(currentUser)) {
        return current;
      }

      const plainPassword = typeof updates.password === 'string' ? updates.password.trim() : '';
      const sanitizedUpdates = { ...updates };
      if (!plainPassword) delete sanitizedUpdates.password;

      if (plainPassword) {
        void prepareUserWithPassword(
          isRootOwner(target)
            ? getRootOwnerUser({ ...target, ...sanitizedUpdates, email: ROOT_OWNER_EMAIL })
            : { ...target, ...sanitizedUpdates, password: plainPassword },
          plainPassword
        ).then(result => {
          if (!result.ok) {
            window.alert(result.error);
            return;
          }
          setSystemUsers(latest => latest.map(user => user.id === id
            ? (isRootOwner(user) ? getRootOwnerUser(result.user) : result.user)
            : user
          ));
        });
        return current;
      }

      return current.map(user => {
        if (user.id !== id) return user;
        return isRootOwner(user)
          ? getRootOwnerUser({ ...user, ...sanitizedUpdates, email: ROOT_OWNER_EMAIL })
          : { ...user, ...sanitizedUpdates };
      });
    });
  const deleteSystemUser = (id: string) => {
    const target = systemUsers.find(user => user.id === id);
    if (!target || isRootOwner(target)) return;
    if ((target.ownerConsoleAccess || target.profile === 'Owner') && !canManageOwnerUsers(currentUser)) return;

    setSystemUsers(current => current.filter(user => user.id !== id));
    if (currentUserId === id) setCurrentUserId(null);
  };

  const addNotification = (notification: NotificationAutomation) =>
    setNotifications(current => [...current, notification]);
  const updateNotification = (id: string, updates: Partial<NotificationAutomation>) =>
    setNotifications(current => current.map(notification => notification.id === id ? { ...notification, ...updates } : notification));
  const deleteNotification = (id: string) =>
    setNotifications(current => current.filter(notification => notification.id !== id));

  const addNotificationEmailConfig = (config: NotificationEmailConfig) =>
    setNotificationEmailConfigs(current => [...current, config]);
  const updateNotificationEmailConfig = (id: string, updates: Partial<NotificationEmailConfig>) =>
    setNotificationEmailConfigs(current => current.map(config => config.id === id ? { ...config, ...updates } : config));
  const deleteNotificationEmailConfig = (id: string) => {
    setNotificationEmailConfigs(current => current.filter(config => config.id !== id));
    setNotifications(current => current.map(notification =>
      notification.senderConfigId === id ? { ...notification, senderConfigId: undefined } : notification
    ));
  };

  const addClient = (c: Client) => setClients(current => [...current, c]);
  const updateClient = (id: string, updates: Partial<Client>) =>
    setClients(current => current.map(c => c.id === id ? { ...c, ...updates } : c));
  const deleteClient = (id: string) =>
    setClients(current => current.filter(c => c.id !== id));

  const addCheckInSubmission = (submission: CheckInSubmission) =>
    setCheckInSubmissions(current => [submission, ...current]);
  const updateCheckInSubmission = (id: string, updates: Partial<CheckInSubmission>) =>
    setCheckInSubmissions(current => current.map(submission => submission.id === id ? { ...submission, ...updates } : submission));

  const addRoom = (r: Room) => setRooms(current => [...current, r]);
  const updateRoom = (id: string, updates: Partial<Room>) =>
    setRooms(current => current.map(r => r.id === id ? { ...r, ...updates } : r));
  const deleteRoom = (id: string) =>
    setRooms(current => current.filter(r => r.id !== id));

  const addRate = (r: Rate) => setRates(current => [...current, r]);
  const updateRate = (id: string, updates: Partial<Rate>) =>
    setRates(current => current.map(r => r.id === id ? { ...r, ...updates } : r));
  const deleteRate = (id: string) =>
    setRates(current => current.filter(r => r.id !== id));

  const addRateAdjustment = (r: RateAdjustment) => setRateAdjustments(current => [...current, r]);
  const updateRateAdjustment = (id: string, updates: Partial<RateAdjustment>) =>
    setRateAdjustments(current => current.map(r => r.id === id ? { ...r, ...updates } : r));
  const deleteRateAdjustment = (id: string) =>
    setRateAdjustments(current => current.filter(r => r.id !== id));

  const addPaymentPlan = (p: PaymentPlan) => setPaymentPlans(current => [...current, p]);
  const updatePaymentPlan = (id: string, updates: Partial<PaymentPlan>) =>
    setPaymentPlans(current => current.map(p => p.id === id ? { ...p, ...updates } : p));
  const deletePaymentPlan = (id: string) =>
    setPaymentPlans(current => current.filter(p => p.id !== id));

  const nextReservationId = (items: Reservation[]) => {
    const maxNumber = items.reduce((max, item) => {
      const match = /^RR_(\d+)$/.exec(item.id);
      return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `RR_${String(maxNumber + 1).padStart(6, '0')}`;
  };

  const nightsBetween = (checkIn: string, checkOut: string) => {
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    return Math.max(1, Math.round((end - start) / 86400000));
  };

  const buildPaymentSchedule = (reservation: Reservation, total: number) => {
    const plan = paymentPlans.find(item => item.id === reservation.paymentPlanId);
    if (!plan) return [];

    let allocated = 0;
    return plan.steps.map(step => {
      const dueDate = new Date(step.timingType === 'After Booking' ? new Date() : new Date(reservation.checkIn));
      if (step.timingType === 'After Booking') dueDate.setDate(dueDate.getDate() + step.days);
      if (step.timingType === 'Before Check-in') dueDate.setDate(dueDate.getDate() - step.days);

      const amount = step.amountType === 'Remaining Balance'
        ? Math.max(0, total - allocated)
        : step.amountType === 'Percentage'
          ? total * (step.amount / 100)
          : step.amount;
      allocated += amount;

      return {
        label: step.label,
        dueDate: dueDate.toISOString().split('T')[0],
        amount: Number(amount.toFixed(2)),
      };
    });
  };

  const buildInvoice = (reservation: Reservation): ReservationInvoice => {
    const client = clients.find(item => item.id === reservation.clientId);
    const room = rooms.find(item => item.id === reservation.roomId);
    const rate = rates.find(item => item.id === reservation.rateId);
    const property = properties.find(item => item.id === reservation.propertyId);
    const nights = nightsBetween(reservation.checkIn, reservation.checkOut);
    const subtotal = (rate?.amount || reservation.price || 0) * nights;
    const discount = reservation.discountId ? rateAdjustments.find(item => item.id === reservation.discountId) : undefined;
    const discountAmount = discount
      ? discount.valueType === 'Percentage' ? subtotal * (discount.value / 100) : discount.value
      : 0;
    const taxableBase = Math.max(0, subtotal - discountAmount);
    const selectedTaxes = (reservation.taxIds || [])
      .map(id => rateAdjustments.find(item => item.id === id && item.kind === 'Tax'))
      .filter(Boolean);
    const taxes = selectedTaxes.reduce((sum, tax) => {
        if (!tax) return sum;
        return sum + (tax.valueType === 'Percentage' ? taxableBase * (tax.value / 100) : tax.value);
      }, 0);
    const addedTaxes = selectedTaxes.reduce((sum, tax) => {
      if (!tax || tax.taxMode === 'Included') return sum;
      return sum + (tax.valueType === 'Percentage' ? taxableBase * (tax.value / 100) : tax.value);
    }, 0);
    const total = Number((taxableBase + addedTaxes).toFixed(2));

    return {
      id: reservation.id,
      reservationId: reservation.id,
      propertyId: reservation.propertyId,
      createdAt: new Date().toISOString(),
      clientName: client?.name || 'Unknown client',
      clientEmails: client?.emails?.length ? client.emails : client?.email ? [client.email] : [],
      lineItems: [
        {
          description: `${property?.name || 'Property'} - ${room?.name || 'Room'} - ${rate?.name || 'Rate'} (${nights} nights)`,
          quantity: nights,
          unitPrice: rate?.amount || reservation.price || 0,
          total: subtotal,
        },
      ],
      subtotal,
      discounts: Number(discountAmount.toFixed(2)),
      taxes: Number(taxes.toFixed(2)),
      total,
      paymentSchedule: buildPaymentSchedule({ ...reservation, price: total }, total),
      emailStatus: 'Queued',
      emailFrom: 'info@luxurytentedcamp.com',
    };
  };

  const addReservation = (r: Reservation) => {
    setReservations(current => {
      const id = r.id?.startsWith('RR_') ? r.id : nextReservationId(current);
      const reservation: Reservation = { ...r, id, status: r.status || 'Provisional', invoiceId: id };
      const invoice = buildInvoice(reservation);
      setInvoices(invoiceCurrent => [invoice, ...invoiceCurrent.filter(item => item.reservationId !== id)]);
      return [...current, { ...reservation, price: invoice.total }];
    });
  };
  const updateReservation = (id: string, updates: Partial<Reservation>) =>
    setReservations(current => current.map(r => r.id === id ? { ...r, ...updates } : r));
  const deleteReservation = (id: string) =>
    setReservations(current => current.filter(r => r.id !== id));

  const addBookingPayment = (p: BookingPayment) => {
    setBookingPayments(current => [...current, p]);
    const reservationPayments = [...bookingPayments.filter(item => item.reservationId === p.reservationId), p];
    const reservation = reservations.find(item => item.id === p.reservationId);
    const paid = reservationPayments.reduce((sum, item) => sum + item.amount, 0);
    if (reservation) {
      updateReservation(p.reservationId, { status: paid >= reservation.price ? 'Fully Paid' : 'Confirmed' });
    }
  };
  const updateBookingPayment = (id: string, updates: Partial<BookingPayment>) =>
    setBookingPayments(current => current.map(p => p.id === id ? { ...p, ...updates } : p));
  const deleteBookingPayment = (id: string) =>
    setBookingPayments(current => current.filter(p => p.id !== id));

  const addOtaConnection = (c: OtaConnection) => setOtaConnections(current => [...current, c]);
  const updateOtaConnection = (id: string, updates: Partial<OtaConnection>) =>
    setOtaConnections(current => current.map(c => c.id === id ? { ...c, ...updates } : c));
  const deleteOtaConnection = (id: string) =>
    setOtaConnections(current => current.filter(c => c.id !== id));

  const addReservationPolicy = (p: ReservationPolicy) => setReservationPolicies(current => [...current, p]);
  const updateReservationPolicy = (id: string, updates: Partial<ReservationPolicy>) =>
    setReservationPolicies(current => current.map(p => p.id === id ? { ...p, ...updates } : p));
  const deleteReservationPolicy = (id: string) =>
    setReservationPolicies(current => current.filter(p => p.id !== id));

  const generateInvoiceHtml = (reservationId: string) => {
    const invoice = invoices.find(item => item.reservationId === reservationId);
    const reservation = reservations.find(item => item.id === reservationId);
    const client = reservation ? clients.find(item => item.id === reservation.clientId) : null;
    const property = reservation ? properties.find(item => item.id === reservation.propertyId) : null;
    if (!invoice || !reservation) return '<p>Invoice not found.</p>';
    return `
      <html><head><title>Invoice ${invoice.id}</title><style>
      body{font-family:Arial,sans-serif;color:#2d2924;margin:40px} .top{display:flex;justify-content:space-between;border-bottom:2px solid #c98736;padding-bottom:18px}
      h1{color:#c98736;margin:0}.muted{color:#6b6258}.box{border:1px solid #ddd;padding:16px;margin-top:18px}.right{text-align:right}
      table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border-bottom:1px solid #ddd;padding:10px;text-align:left}th{background:#f7ead8}
      .totals{width:320px;margin-left:auto}.notes{white-space:pre-line}
      </style></head><body>
      <div class="top"><div><h1>Kumbukumbu Luxury Tented Camp</h1><p class="muted">${property?.legalName || ''}<br/>${property?.officialAddress || ''}<br/>${property?.invoiceEmail || ''}</p></div><div class="right"><h2>INVOICE</h2><p><strong>${invoice.id}</strong><br/>${new Date(invoice.createdAt).toLocaleDateString()}</p></div></div>
      <div class="box"><strong>Bill To</strong><p>${invoice.clientName}<br/>${invoice.clientEmails.join(', ')}<br/>${client?.phone || ''}</p></div>
      <div class="box"><strong>Reservation</strong><p>ID: ${reservation.id}<br/>Check-in: ${reservation.checkIn}<br/>Check-out: ${reservation.checkOut}<br/>Status: ${reservation.status}</p></div>
      <table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>${invoice.lineItems.map(item => `<tr><td>${item.description}</td><td>${item.quantity}</td><td>$${item.unitPrice.toFixed(2)}</td><td>$${item.total.toFixed(2)}</td></tr>`).join('')}</tbody></table>
      <table class="totals"><tbody><tr><td>Subtotal</td><td class="right">$${invoice.subtotal.toFixed(2)}</td></tr><tr><td>Discounts</td><td class="right">-$${invoice.discounts.toFixed(2)}</td></tr><tr><td>Taxes</td><td class="right">$${invoice.taxes.toFixed(2)}</td></tr><tr><th>Total</th><th class="right">$${invoice.total.toFixed(2)}</th></tr></tbody></table>
      <div class="box"><strong>Payment Schedule</strong>${invoice.paymentSchedule.length ? `<ul>${invoice.paymentSchedule.map(step => `<li>${step.label}: $${step.amount.toFixed(2)} due ${step.dueDate}</li>`).join('')}</ul>` : '<p>No payment plan selected.</p>'}</div>
      <div class="box notes"><strong>Important Notes</strong><br/>${reservationPolicies.filter(policy => policy.propertyId === reservation.propertyId && policy.section === 'Important Notes').map(policy => policy.content).join('\n')}</div>
      </body></html>`;
  };

  const addSupplyRequest = (s: SupplyRequest) => setSupplyRequests(current => [...current, s]);
  const updateSupplyRequest = (id: string, updates: Partial<SupplyRequest>) =>
    setSupplyRequests(current => current.map(s => s.id === id ? { ...s, ...updates } : s));
  const deleteSupplyRequest = (id: string) =>
    setSupplyRequests(current => current.filter(s => s.id !== id));

  const addAccountancyEntry = (entry: AccountancyEntry) =>
    setAccountancyEntries(current => [entry, ...current]);
  const updateAccountancyEntry = (id: string, updates: Partial<AccountancyEntry>) =>
    setAccountancyEntries(current => current.map(entry => entry.id === id ? { ...entry, ...updates } : entry));
  const deleteAccountancyEntry = (id: string) =>
    setAccountancyEntries(current => current.filter(entry => entry.id !== id));

  const addCommunicationSender = (sender: CommunicationSender) =>
    setCommunicationSenders(current => [sender, ...current.map(item => sender.defaultSender && item.propertyId === sender.propertyId ? { ...item, defaultSender: false } : item)]);
  const updateCommunicationSender = (id: string, updates: Partial<CommunicationSender>) =>
    setCommunicationSenders(current => current.map(item => {
      if (item.id === id) return { ...item, ...updates };
      if (updates.defaultSender && item.propertyId === current.find(target => target.id === id)?.propertyId) return { ...item, defaultSender: false };
      return item;
    }));
  const deleteCommunicationSender = (id: string) => {
    setCommunicationSenders(current => current.filter(item => item.id !== id));
    setCommunicationCampaigns(current => current.map(item => item.senderId === id ? { ...item, senderId: '', status: 'draft' } : item));
  };

  const addCommunicationProviderAccount = (account: CommunicationProviderAccount) =>
    setCommunicationProviderAccounts(current => [account, ...current]);
  const updateCommunicationProviderAccount = (id: string, updates: Partial<CommunicationProviderAccount>) =>
    setCommunicationProviderAccounts(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const deleteCommunicationProviderAccount = (id: string) => {
    setCommunicationProviderAccounts(current => current.filter(item => item.id !== id));
    setCommunicationSenders(current => current.map(item => item.providerAccountId === id ? { ...item, providerAccountId: undefined, verified: false } : item));
  };

  const addCommunicationTemplate = (template: CommunicationTemplate) =>
    setCommunicationTemplates(current => [template, ...current]);
  const updateCommunicationTemplate = (id: string, updates: Partial<CommunicationTemplate>) =>
    setCommunicationTemplates(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const deleteCommunicationTemplate = (id: string) => {
    setCommunicationTemplates(current => current.filter(item => item.id !== id));
    setCommunicationCampaigns(current => current.map(item => item.templateId === id ? { ...item, templateId: '', status: 'draft' } : item));
  };

  const addCommunicationTemplateAsset = (asset: CommunicationTemplateAsset) =>
    setCommunicationTemplateAssets(current => [asset, ...current]);
  const updateCommunicationTemplateAsset = (id: string, updates: Partial<CommunicationTemplateAsset>) =>
    setCommunicationTemplateAssets(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const deleteCommunicationTemplateAsset = (id: string) =>
    setCommunicationTemplateAssets(current => current.filter(item => item.id !== id));

  const addCommunicationImportList = (list: CommunicationImportList) =>
    setCommunicationImportLists(current => [list, ...current]);
  const updateCommunicationImportList = (id: string, updates: Partial<CommunicationImportList>) =>
    setCommunicationImportLists(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const deleteCommunicationImportList = (id: string) => {
    setCommunicationImportLists(current => current.filter(item => item.id !== id));
    setCommunicationRecipients(current => current.filter(item => item.importListId !== id));
  };

  const addCommunicationRecipient = (recipient: CommunicationRecipient) =>
    setCommunicationRecipients(current => [recipient, ...current]);
  const updateCommunicationRecipient = (id: string, updates: Partial<CommunicationRecipient>) =>
    setCommunicationRecipients(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const deleteCommunicationRecipient = (id: string) => {
    setCommunicationRecipients(current => current.filter(item => item.id !== id));
    setCommunicationAudiences(current => current.map(item => ({ ...item, recipientIds: item.recipientIds.filter(recipientId => recipientId !== id) })));
  };

  const addCommunicationAudience = (audience: CommunicationAudience) =>
    setCommunicationAudiences(current => [audience, ...current]);
  const updateCommunicationAudience = (id: string, updates: Partial<CommunicationAudience>) => {
    setCommunicationAudiences(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
    if (updates.name) {
      setCommunicationRecipients(current => current.map(item => item.audienceIds?.includes(id)
        ? {
          ...item,
          audienceNames: (item.audienceIds || []).map(audienceId => audienceId === id ? updates.name! : item.audienceNames?.[item.audienceIds?.indexOf(audienceId) || 0] || audienceId),
          updatedAt: new Date().toISOString(),
        }
        : item));
    }
  };
  const deleteCommunicationAudience = (id: string) => {
    const audience = communicationAudiences.find(item => item.id === id);
    const recipientIdsToDelete = new Set(audience?.recipientIds || []);
    setCommunicationRecipients(current => current.filter(item => !recipientIdsToDelete.has(item.id) && !item.audienceIds?.includes(id)));
    setCommunicationAudiences(current => current
      .filter(item => item.id !== id)
      .map(item => ({ ...item, recipientIds: item.recipientIds.filter(recipientId => !recipientIdsToDelete.has(recipientId)) })));
  };

  const addCommunicationCampaign = (campaign: CommunicationCampaign) =>
    setCommunicationCampaigns(current => [campaign, ...current]);
  const updateCommunicationCampaign = (id: string, updates: Partial<CommunicationCampaign>) =>
    setCommunicationCampaigns(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const deleteCommunicationCampaign = (id: string) => {
    setCommunicationCampaigns(current => current.filter(item => item.id !== id));
    setCommunicationOutbox(current => current.map(item => item.campaignId === id ? { ...item, status: 'cancelled' } : item));
  };

  const addCommunicationCampaignStep = (step: CommunicationCampaignStep) =>
    setCommunicationCampaignSteps(current => [step, ...current]);
  const updateCommunicationCampaignStep = (id: string, updates: Partial<CommunicationCampaignStep>) =>
    setCommunicationCampaignSteps(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const deleteCommunicationCampaignStep = (id: string) =>
    setCommunicationCampaignSteps(current => current.filter(item => item.id !== id));

  const addCommunicationSendingRule = (rule: CommunicationSendingRule) =>
    setCommunicationSendingRules(current => [rule, ...current]);
  const updateCommunicationSendingRule = (id: string, updates: Partial<CommunicationSendingRule>) =>
    setCommunicationSendingRules(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const deleteCommunicationSendingRule = (id: string) =>
    setCommunicationSendingRules(current => current.filter(item => item.id !== id));

  const addCommunicationOutboxJob = (job: CommunicationOutboxJob) =>
    setCommunicationOutbox(current => [job, ...current]);
  const updateCommunicationOutboxJob = (id: string, updates: Partial<CommunicationOutboxJob>) =>
    setCommunicationOutbox(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const deleteCommunicationOutboxJob = (id: string) =>
    setCommunicationOutbox(current => current.filter(item => item.id !== id));

  const addCommunicationEvent = (event: CommunicationEvent) =>
    setCommunicationEvents(current => [event, ...current]);
  const updateCommunicationEvent = (id: string, updates: Partial<CommunicationEvent>) =>
    setCommunicationEvents(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const deleteCommunicationEvent = (id: string) =>
    setCommunicationEvents(current => current.filter(item => item.id !== id));

  const addCommunicationSuppression = (suppression: CommunicationSuppression) =>
    setCommunicationSuppressionList(current => [suppression, ...current.filter(item =>
      item.email.toLowerCase() !== suppression.email.toLowerCase() ||
      item.propertyId !== suppression.propertyId ||
      (item.appliesTo || "All") !== (suppression.appliesTo || "All")
    )]);
  const updateCommunicationSuppression = (id: string, updates: Partial<CommunicationSuppression>) =>
    setCommunicationSuppressionList(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const deleteCommunicationSuppression = (id: string) =>
    setCommunicationSuppressionList(current => current.filter(item => item.id !== id));

  const addCommunicationUnsubscribe = (unsubscribe: CommunicationUnsubscribe) =>
    setCommunicationUnsubscribes(current => [unsubscribe, ...current]);
  const updateCommunicationUnsubscribe = (id: string, updates: Partial<CommunicationUnsubscribe>) =>
    setCommunicationUnsubscribes(current => current.map(item => item.id === id ? { ...item, ...updates } : item));
  const deleteCommunicationUnsubscribe = (id: string) =>
    setCommunicationUnsubscribes(current => current.filter(item => item.id !== id));

  return (
    <AppContext.Provider value={{
      currentUser, login, logout,
      profileDefinitions,
      passwordResetRequests, credentialSyncStatus, pmsDataSyncStatus, requestPasswordReset, resetPassword,
      canAccessOwnerConsole, isRootOwner, canManageOwnerUsers,
      companies, addCompany, updateCompany, deleteCompany,
      properties, selectedCompanyId, setSelectedCompanyId, selectedPropertyId, setSelectedPropertyId, addProperty, updateProperty, deleteProperty,
      systemUsers, addSystemUser, updateSystemUser, deleteSystemUser,
      notifications, addNotification, updateNotification, deleteNotification,
      notificationEmailConfigs, addNotificationEmailConfig, updateNotificationEmailConfig, deleteNotificationEmailConfig,
      clients, addClient, updateClient, deleteClient,
      checkInSubmissions, addCheckInSubmission, updateCheckInSubmission,
      rooms, addRoom, updateRoom, deleteRoom,
      rates, addRate, updateRate, deleteRate,
      rateAdjustments, addRateAdjustment, updateRateAdjustment, deleteRateAdjustment,
      paymentPlans, addPaymentPlan, updatePaymentPlan, deletePaymentPlan,
      reservations, addReservation, updateReservation, deleteReservation,
      bookingPayments, addBookingPayment, updateBookingPayment, deleteBookingPayment,
      invoices, generateInvoiceHtml,
      otaConnections, addOtaConnection, updateOtaConnection, deleteOtaConnection,
      reservationPolicies, addReservationPolicy, updateReservationPolicy, deleteReservationPolicy,
      supplyRequests, addSupplyRequest, updateSupplyRequest, deleteSupplyRequest,
      accountancyEntries, accountancyDisplayCurrency, setAccountancyDisplayCurrency, addAccountancyEntry, updateAccountancyEntry, deleteAccountancyEntry,
      communicationSenders, addCommunicationSender, updateCommunicationSender, deleteCommunicationSender,
      communicationProviderAccounts, addCommunicationProviderAccount, updateCommunicationProviderAccount, deleteCommunicationProviderAccount,
      communicationTemplates, addCommunicationTemplate, updateCommunicationTemplate, deleteCommunicationTemplate,
      communicationTemplateAssets, addCommunicationTemplateAsset, updateCommunicationTemplateAsset, deleteCommunicationTemplateAsset,
      communicationImportLists, addCommunicationImportList, updateCommunicationImportList, deleteCommunicationImportList,
      communicationRecipients, addCommunicationRecipient, updateCommunicationRecipient, deleteCommunicationRecipient,
      communicationAudiences, addCommunicationAudience, updateCommunicationAudience, deleteCommunicationAudience,
      communicationCampaigns, addCommunicationCampaign, updateCommunicationCampaign, deleteCommunicationCampaign,
      communicationCampaignSteps, addCommunicationCampaignStep, updateCommunicationCampaignStep, deleteCommunicationCampaignStep,
      communicationSendingRules, addCommunicationSendingRule, updateCommunicationSendingRule, deleteCommunicationSendingRule,
      communicationOutbox, addCommunicationOutboxJob, updateCommunicationOutboxJob, deleteCommunicationOutboxJob,
      communicationEvents, addCommunicationEvent, updateCommunicationEvent, deleteCommunicationEvent,
      communicationSuppressionList, addCommunicationSuppression, updateCommunicationSuppression, deleteCommunicationSuppression,
      communicationUnsubscribes, addCommunicationUnsubscribe, updateCommunicationUnsubscribe, deleteCommunicationUnsubscribe,
      communicationHelpTooltips,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
