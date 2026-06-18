import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import {
  migrateLegacyUserPassword,
  prepareUserWithPassword,
  verifyUserPassword,
} from '../utils/authSecurity';
import { firebaseCredentialsEnabled, publishCredentials, subscribeCredentials } from '../utils/firebaseCredentials';

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
  | 'Check-in';

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
  deliveryMethod: 'Email' | 'Phone';
  token: string;
  resetUrl: string;
  fromEmail?: string;
  deliveryStatus?: 'Queued' | 'Sent' | 'Failed';
  createdAt: string;
  used: boolean;
};

export type NotificationAutomation = {
  id: string;
  moduleKey: string;
  moduleName: string;
  name: string;
  channel: 'Email' | 'WhatsApp' | 'SMS' | 'In-app';
  recipientGroup: string;
  subject: string;
  message: string;
  trigger: string;
  timing: string;
  enabled: boolean;
  lastUpdated: string;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  emails?: string[];
  phone: string;
  nationality: string;
  category?: 'Tour Operator' | 'Agency' | 'Direct Client' | 'Corporate' | 'Other';
  defaultPaymentPlanId?: string;
  marketingOptIn: boolean;
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

export type AccountancyEntry = {
  id: string;
  propertyId: string;
  type: 'Revenue' | 'Expense' | 'Asset' | 'Liability';
  date: string;
  category: string;
  subcategories?: string[];
  subcategoryBreakdown?: {
    name: string;
    amount: number;
    amountUsd: number;
    amountThs: number;
  }[];
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
  source: 'GenAI Assistant' | 'Manual' | 'Reservations' | 'Supply Requests';
  status: 'Draft' | 'Confirmed';
  attachmentName?: string;
  rawSummary?: string;
  createdAt: string;
};

export type AccountancyDisplayCurrency = 'USD' | 'THS';

type AppContextType = {
  currentUser: SystemUser | null;
  login: (email: string, password: string) => Promise<SystemUser | null>;
  logout: () => void;
  profileDefinitions: ProfileDefinition[];
  passwordResetRequests: PasswordResetRequest[];
  credentialSyncStatus: string;
  requestPasswordReset: (contact: string, deliveryMethod: 'Email' | 'Phone') => Promise<PasswordResetRequest | null>;
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

  clients: Client[];
  addClient: (c: Client) => void;
  updateClient: (id: string, c: Partial<Client>) => void;
  deleteClient: (id: string) => void;

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
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const ROOT_OWNER_ID = 'usr-owner';
const ROOT_OWNER_EMAIL = 'jorge@luxurytentedcamp.com';
const ROOT_OWNER_PASSWORD = 'Owner2026!';
const OWNER_CONSOLE_COMPANY_ID = 'owner-console';

const initialCompanies: Company[] = [
  {
    id: 'co-1',
    name: 'Kumbukumbu Ltd.',
    website: 'https://kumbukumbu.com',
    businessSector: 'Luxury Hospitality',
    legalName: 'Kumbukumbu Luxury Tented Camp Ltd.',
    taxId: 'TZ-184-772-901',
    registrationNumber: 'REG-2025-KUM-001',
    officialAddress: 'Moshi Road, Arusha, Tanzania',
    invoiceEmail: 'finance@kumbukumbu.com',
    plan: 'Enterprise',
    status: 'Active',
    joinedAt: '2025-01-12',
  },
  {
    id: 'co-2',
    name: 'Serengeti Safaris',
    website: 'https://serengetisafaris.example',
    businessSector: 'Safari Operator',
    legalName: 'Serengeti Safaris Company Limited',
    taxId: 'TZ-445-118-220',
    registrationNumber: 'REG-2026-SER-014',
    officialAddress: 'Nyerere Road, Arusha, Tanzania',
    invoiceEmail: 'accounts@serengetisafaris.example',
    plan: 'Pro',
    status: 'Active',
    joinedAt: '2026-03-03',
  },
  {
    id: 'co-3',
    name: 'Maasai Mara Camps',
    website: 'https://maasaimaracamps.example',
    businessSector: 'Luxury Camps',
    legalName: 'Maasai Mara Camps Holdings',
    taxId: 'KE-991-430-211',
    registrationNumber: 'REG-2025-MMC-097',
    officialAddress: 'Narok County, Kenya',
    invoiceEmail: 'billing@maasaimaracamps.example',
    plan: 'Enterprise',
    status: 'Suspended',
    joinedAt: '2025-11-14',
  },
];

const initialProperties: Property[] = [
  {
    id: '1',
    companyId: 'co-1',
    name: 'Kumbukumbu Main Camp',
    website: 'https://kumbukumbu.com/main-camp',
    businessSector: 'Luxury Tented Camp',
    legalName: 'Kumbukumbu Main Camp Ltd.',
    taxId: 'TZ-184-772-901',
    registrationNumber: 'PROP-KUM-MAIN',
    officialAddress: 'Main Conservancy Road, Arusha, Tanzania',
    invoiceEmail: 'finance@kumbukumbu.com',
  },
  {
    id: '2',
    companyId: 'co-1',
    name: 'Kumbukumbu Serengeti',
    website: 'https://kumbukumbu.com/serengeti',
    businessSector: 'Luxury Tented Camp',
    legalName: 'Kumbukumbu Serengeti Camp Ltd.',
    taxId: 'TZ-184-772-902',
    registrationNumber: 'PROP-KUM-SER',
    officialAddress: 'Serengeti National Park, Tanzania',
    invoiceEmail: 'finance@kumbukumbu.com',
  },
  {
    id: '3',
    companyId: 'co-1',
    name: 'Kumbukumbu Tarangire',
    website: 'https://kumbukumbu.com/tarangire',
    businessSector: 'Luxury Lodge',
    legalName: 'Kumbukumbu Tarangire Lodge Ltd.',
    taxId: 'TZ-184-772-903',
    registrationNumber: 'PROP-KUM-TAR',
    officialAddress: 'Tarangire Road, Tanzania',
    invoiceEmail: 'finance@kumbukumbu.com',
  },
  {
    id: '4',
    companyId: 'co-2',
    name: 'Serengeti Safari House',
    website: 'https://serengetisafaris.example/house',
    businessSector: 'Safari Lodge',
    legalName: 'Serengeti Safari House Ltd.',
    taxId: 'TZ-445-118-220',
    registrationNumber: 'PROP-SER-HOUSE',
    officialAddress: 'Central Serengeti, Tanzania',
    invoiceEmail: 'accounts@serengetisafaris.example',
  },
];

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
  {
    id: 'usr-super',
    companyId: 'co-1',
    propertyIds: ['1', '2', '3'],
    name: 'Platform Admin',
    email: 'admin@kumbukumbu.com',
    role: 'Super Admin',
    profile: 'Admin',
    departments: ['Admin', 'Reservations', 'Accountancy', 'Supplies', 'Check-in'],
    phone: '+255 700 000 001',
    password: 'KumbuAdmin2026!',
    status: 'Active',
    ownerConsoleAccess: false,
    permissions: [
      { module: 'Reservations', section: 'Calendar', access: 'edit' },
      { module: 'Reservations', section: 'Bookings', access: 'edit' },
      { module: 'Reservations', section: 'Configuration', access: 'edit' },
      { module: 'Reservations', section: 'Notifications', access: 'edit' },
      { module: 'Accountancy', section: 'Overview', access: 'edit' },
      { module: 'Accountancy', section: 'Revenues', access: 'edit' },
      { module: 'Accountancy', section: 'Expenses', access: 'edit' },
      { module: 'Accountancy', section: 'Profit & Loss (P&L)', access: 'edit' },
      { module: 'Accountancy', section: 'Assets', access: 'edit' },
      { module: 'Accountancy', section: 'Liabilities', access: 'edit' },
      { module: 'Accountancy', section: 'Balance', access: 'edit' },
      { module: 'Accountancy', section: 'GenAI Assistant', access: 'edit' },
      { module: 'Accountancy', section: 'Notifications', access: 'edit' },
      { module: 'Supply Requests', section: 'All Categories', access: 'edit' },
      { module: 'Supply Requests', section: 'Notifications', access: 'edit' },
      { module: 'Check-in', section: 'Guest Form', access: 'edit' },
      { module: 'Check-in', section: 'Database', access: 'edit' },
      { module: 'Check-in', section: 'Dashboard', access: 'edit' },
      { module: 'Check-in', section: 'Notifications', access: 'edit' },
      { module: 'Admin Platform', section: 'Companies & Access', access: 'edit' },
      { module: 'Admin Platform', section: 'Notifications', access: 'edit' },
    ],
  },
  {
    id: 'usr-1',
    companyId: 'co-1',
    propertyIds: ['1', '2', '3'],
    name: 'Jane Doe',
    email: 'manager@kumbukumbu.com',
    role: 'General Manager',
    profile: 'General Director',
    departments: ['Reservations', 'Accountancy', 'Supplies', 'Check-in'],
    phone: '+255 700 000 002',
    password: 'Kumbu2026!',
    status: 'Active',
    ownerConsoleAccess: false,
    permissions: [
      { module: 'Reservations', section: 'Calendar', access: 'edit' },
      { module: 'Reservations', section: 'Bookings', access: 'edit' },
      { module: 'Accountancy', section: 'Overview', access: 'view' },
      { module: 'Supply Requests', section: 'Beverage', access: 'edit' },
      { module: 'Check-in', section: 'Guest Form', access: 'edit' },
    ],
  },
];

const initialNotifications: NotificationAutomation[] = [
  {
    id: 'ntf-1',
    moduleKey: 'reservations',
    moduleName: 'Reservations',
    name: 'Pre-arrival confirmation',
    channel: 'Email',
    recipientGroup: 'Guests with confirmed bookings',
    subject: 'Your Kumbukumbu stay is confirmed',
    message: 'Send arrival details, transfer information, and camp expectations.',
    trigger: 'Reservation confirmed',
    timing: 'Immediately after confirmation',
    enabled: true,
    lastUpdated: '2026-06-08',
  },
  {
    id: 'ntf-2',
    moduleKey: 'check-in',
    moduleName: 'Check-in',
    name: 'Digital registration reminder',
    channel: 'WhatsApp',
    recipientGroup: 'Guests arriving within 48 hours',
    subject: 'Complete your guest details',
    message: 'Invite guests to complete their pre-check-in form before arrival.',
    trigger: '48 hours before check-in',
    timing: 'Daily at 09:00 local time',
    enabled: true,
    lastUpdated: '2026-06-08',
  },
  {
    id: 'ntf-3',
    moduleKey: 'accountancy',
    moduleName: 'Accountancy',
    name: 'Monthly finance pack',
    channel: 'Email',
    recipientGroup: 'Company directors',
    subject: 'Monthly finance pack is ready',
    message: 'Send revenue, expenses, balance, and invoice summary to ownership.',
    trigger: 'Monthly statement ready',
    timing: 'First day of each month at 08:00',
    enabled: true,
    lastUpdated: '2026-06-09',
  },
  {
    id: 'ntf-4',
    moduleKey: 'supply-requests',
    moduleName: 'Supply Requests',
    name: 'Budget threshold alert',
    channel: 'In-app',
    recipientGroup: 'Property manager',
    subject: 'Supply budget threshold reached',
    message: 'Notify management when department requests exceed the configured threshold.',
    trigger: 'Budget threshold reached',
    timing: 'Immediately',
    enabled: true,
    lastUpdated: '2026-06-09',
  },
  {
    id: 'ntf-5',
    moduleKey: 'admin',
    moduleName: 'Admin Platform',
    name: 'Permission change notice',
    channel: 'Email',
    recipientGroup: 'Super admins',
    subject: 'User permissions were updated',
    message: 'Inform platform administrators when a support user changes access rules.',
    trigger: 'Permissions changed',
    timing: 'Immediately',
    enabled: true,
    lastUpdated: '2026-06-09',
  },
  {
    id: 'ntf-6',
    moduleKey: 'owner',
    moduleName: 'Owner Console',
    name: 'New tenant sale handoff',
    channel: 'Email',
    recipientGroup: 'System owner',
    subject: 'A new KumbuOS tenant was created',
    message: 'Send the tenant creation summary, first admin credentials, and implementation checklist to the owner.',
    trigger: 'New tenant created',
    timing: 'Immediately',
    enabled: true,
    lastUpdated: '2026-06-09',
  },
];

const editAllPermissions: PermissionRule[] = [
  { module: 'Reservations', section: 'Calendar', access: 'edit' },
  { module: 'Reservations', section: 'Bookings', access: 'edit' },
  { module: 'Reservations', section: 'Booking Payments', access: 'edit' },
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
  { module: 'Check-in', section: 'Guest Form', access: 'edit' },
  { module: 'Check-in', section: 'Database', access: 'edit' },
  { module: 'Check-in', section: 'Dashboard', access: 'edit' },
  { module: 'Check-in', section: 'Notifications', access: 'edit' },
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

function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? JSON.parse(stored) as T : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Local storage can be unavailable in private or restricted browser contexts.
    }
  }, [key, value]);

  return [value, setValue] as const;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUserId, setCurrentUserId] = usePersistentState<string | null>('pms-current-user-id', null);
  const [companies, setCompanies] = usePersistentState<Company[]>('pms-companies', initialCompanies);
  const [properties, setProperties] = usePersistentState<Property[]>('pms-properties', initialProperties);
  const [selectedCompanyId, persistSelectedCompanyId] = usePersistentState<string>('pms-selected-company', initialCompanies[0].id);
  const [selectedPropertyId, persistSelectedPropertyId] = usePersistentState<string>('pms-selected-property', initialProperties[0].id);
  const [systemUsers, setSystemUsers] = usePersistentState<SystemUser[]>('pms-system-users', initialSystemUsers);
  const [notifications, setNotifications] = usePersistentState<NotificationAutomation[]>('pms-notifications', initialNotifications);
  const [passwordResetRequests, setPasswordResetRequests] = usePersistentState<PasswordResetRequest[]>('pms-password-reset-requests', []);
  const [credentialSyncStatus, setCredentialSyncStatus] = useState(
    firebaseCredentialsEnabled()
      ? 'Firebase credential sync is starting...'
      : 'Firebase credential sync is not configured. Using local secure credential store.'
  );
  const [credentialSyncReady, setCredentialSyncReady] = useState(!firebaseCredentialsEnabled());
  const latestCredentialSnapshot = useRef('');
  const applyingRemoteCredentials = useRef(false);

  const [clients, setClients] = usePersistentState<Client[]>('pms-clients', [
    { id: 'c1', name: 'John Doe', email: 'john@example.com', emails: ['john@example.com'], phone: '123456789', nationality: 'USA', category: 'Direct Client', marketingOptIn: true },
    { id: 'c2', name: 'Alice Smith', email: 'alice@example.com', emails: ['alice@example.com'], phone: '987654321', nationality: 'UK', category: 'Agency', marketingOptIn: false },
  ]);

  const [rooms, setRooms] = usePersistentState<Room[]>('pms-rooms', [
    { id: 'rm1', propertyId: '1', name: 'Tent 1', type: 'Luxury', capacity: 2, minOccupancy: 1, maxOccupancy: 2 },
    { id: 'rm2', propertyId: '1', name: 'Tent 2', type: 'Standard', capacity: 2, minOccupancy: 1, maxOccupancy: 2 },
    { id: 'rm3', propertyId: '1', name: 'Family Tent', type: 'Family', capacity: 4, minOccupancy: 2, maxOccupancy: 6 },
  ]);

  const [rates, setRates] = usePersistentState<Rate[]>('pms-rates', [
    { id: 'rt1', propertyId: '1', name: 'Standard Rate', amount: 500, startDate: '2026-01-01', endDate: '2026-12-31', roomType: 'Luxury', residency: 'Both', active: true },
    { id: 'rt2', propertyId: '1', name: 'High Season', amount: 800, startDate: '2026-06-01', endDate: '2026-09-30', roomType: 'Luxury', residency: 'Non Resident', active: true },
  ]);

  const [rateAdjustments, setRateAdjustments] = usePersistentState<RateAdjustment[]>('pms-rate-adjustments', [
    { id: 'disc-early', propertyId: '1', name: 'Early booking discount', kind: 'Discount', valueType: 'Percentage', value: 10, appliesTo: 'Manual Selection', active: true },
    { id: 'tax-tdl', propertyId: '1', name: 'TDL 1%', kind: 'Tax', valueType: 'Percentage', value: 1, appliesTo: 'All Reservations', taxMode: 'Added', active: true },
  ]);

  const [paymentPlans, setPaymentPlans] = usePersistentState<PaymentPlan[]>('pms-payment-plans', [
    {
      id: 'pp-standard',
      propertyId: '1',
      name: 'Standard 30/70',
      clientCategory: 'All',
      active: true,
      steps: [
        { id: 'pps-1', label: 'Deposit', timingType: 'After Booking', days: 7, amountType: 'Percentage', amount: 30 },
        { id: 'pps-2', label: 'Final balance', timingType: 'Before Check-in', days: 30, amountType: 'Remaining Balance', amount: 0 },
      ],
    },
  ]);

  const [reservations, setReservations] = usePersistentState<Reservation[]>('pms-reservations', [
    { id: 'RR_000001', propertyId: '1', clientId: 'c1', roomId: 'rm1', checkIn: '2026-06-10', checkOut: '2026-06-15', price: 1500, status: 'Confirmed', guests: 2, rateId: 'rt1', taxIds: ['tax-tdl'], source: 'Direct', residency: 'Non Resident' },
    { id: 'RR_000002', propertyId: '1', clientId: 'c2', roomId: 'rm2', checkIn: '2026-06-12', checkOut: '2026-06-14', price: 800, status: 'Confirmed', guests: 2, rateId: 'rt1', source: 'Direct', residency: 'Non Resident' },
  ]);

  const [bookingPayments, setBookingPayments] = usePersistentState<BookingPayment[]>('pms-booking-payments', []);
  const [invoices, setInvoices] = usePersistentState<ReservationInvoice[]>('pms-reservation-invoices', []);
  const [otaConnections, setOtaConnections] = usePersistentState<OtaConnection[]>('pms-ota-connections', [
    { id: 'ota-booking', propertyId: '1', provider: 'Booking.com', status: 'Needs Attention', notes: 'Connect API credentials or channel manager webhook.' },
    { id: 'ota-expedia', propertyId: '1', provider: 'Expedia', status: 'Needs Attention', notes: 'Connect API credentials or channel manager webhook.' },
  ]);
  const [reservationPolicies, setReservationPolicies] = usePersistentState<ReservationPolicy[]>('pms-reservation-policies', [
    { id: 'pol-pay', propertyId: '1', section: 'Payment and Booking Policies', title: 'Booking confirmation', content: 'Reservations remain provisional until the first payment is received.' },
    { id: 'pol-cancel', propertyId: '1', section: 'Cancellation Policies', title: 'Standard cancellation', content: 'Cancellation terms depend on the signed agreement and arrival date.' },
    { id: 'pol-child', propertyId: '1', section: 'Child Policies', title: 'Children', content: 'Child rates and age policies must be confirmed before arrival.' },
    { id: 'pol-amenities', propertyId: '1', section: 'Room Amenities Included', title: 'Included amenities', content: 'Accommodation, selected meals, and configured room amenities are included as per the selected rate.' },
    { id: 'pol-notes', propertyId: '1', section: 'Important Notes', title: 'Important notes', content: 'Family rooms are an interconnection of two or three separate rooms and will be charged as two or three rooms depending on the configuration.\nRates do not include government taxes. TDL applies a 1% charge on all rates.\nAny government-mandated changes in taxes/fees will be implemented immediately as indicated.' },
  ]);

  const [supplyRequests, setSupplyRequests] = usePersistentState<SupplyRequest[]>('pms-supply-requests', [
    { id: 's1', propertyId: '1', category: 'Beverage', amount: 300, date: '2026-06-01', description: 'Wine & spirits restocking' },
    { id: 's2', propertyId: '1', category: 'Housekeeping', amount: 150, date: '2026-06-05', description: 'Cleaning supplies' },
  ]);

  const [accountancyEntries, setAccountancyEntries] = usePersistentState<AccountancyEntry[]>('pms-accountancy-entries-v2', []);
  const [accountancyDisplayCurrency, setAccountancyDisplayCurrency] = usePersistentState<AccountancyDisplayCurrency>('pms-accountancy-display-currency', 'USD');

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
      if (!payload.users.length) return;

      const existingRoot = payload.users.find(user => user.id === ROOT_OWNER_ID || user.email.toLowerCase() === ROOT_OWNER_EMAIL);
      const rootOwner = getRootOwnerUser(existingRoot);
      const remoteUsers = [
        rootOwner,
        ...payload.users.filter(user => user.id !== ROOT_OWNER_ID && user.email.toLowerCase() !== ROOT_OWNER_EMAIL),
      ];
      const snapshot = JSON.stringify({
        users: remoteUsers,
        passwordResetRequests: payload.passwordResetRequests || [],
      });

      applyingRemoteCredentials.current = true;
      latestCredentialSnapshot.current = snapshot;
      setSystemUsers(remoteUsers);
      setPasswordResetRequests(payload.passwordResetRequests || []);
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
    setSystemUsers(current => current.map(user => {
      const accountancyAccess = user.permissions.find(permission => permission.module === 'Accountancy' && permission.access !== 'none')?.access;
      if (!accountancyAccess) return user;

      const additions: PermissionRule[] = ['Assets', 'Liabilities']
        .filter(section => !user.permissions.some(permission => permission.module === 'Accountancy' && permission.section === section))
        .map(section => ({ module: 'Accountancy', section, access: accountancyAccess }));

      return additions.length ? { ...user, permissions: [...user.permissions, ...additions] } : user;
    }));
  }, [setSystemUsers]);

  useEffect(() => {
    const visibleProperties = currentUser && !canAccessOwnerConsole(currentUser)
      ? properties.filter(property => currentUser.propertyIds.includes(property.id))
      : properties;

    if (!visibleProperties.some(property => property.id === selectedPropertyId) && visibleProperties[0]) {
      setSelectedPropertyId(visibleProperties[0].id);
    }
  }, [properties, selectedPropertyId, setSelectedPropertyId, currentUserId]);

  useEffect(() => {
    const visibleCompanies = currentUser && !canAccessOwnerConsole(currentUser)
      ? companies.filter(company => company.id === currentUser.companyId)
      : companies;

    if (!visibleCompanies.some(company => company.id === selectedCompanyId) && visibleCompanies[0]) {
      setSelectedCompanyId(visibleCompanies[0].id);
    }
  }, [companies, selectedCompanyId, currentUserId]);

  useEffect(() => {
    const companyProperties = properties.filter(property => property.companyId === selectedCompanyId);
    const visibleCompanyProperties = currentUser && !canAccessOwnerConsole(currentUser)
      ? companyProperties.filter(property => currentUser.propertyIds.includes(property.id))
      : companyProperties;

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

  const requestPasswordReset = async (contact: string, deliveryMethod: 'Email' | 'Phone') => {
    const normalizedContact = contact.trim().toLowerCase();
    const user = systemUsers.find(item =>
      item.email.toLowerCase() === normalizedContact ||
      item.phone?.replace(/\s+/g, '') === contact.replace(/\s+/g, '')
    );

    if (!user) return null;

    const token = `rst-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const resetUrl = `${window.location.origin}/login?resetToken=${token}`;
    const request: PasswordResetRequest = {
      id: `pr-${Date.now()}`,
      userId: user.id,
      contact,
      deliveryMethod,
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

  const addCompany = (company: Company) => setCompanies(current => [...current, company]);
  const updateCompany = (id: string, updates: Partial<Company>) =>
    setCompanies(current => current.map(company => company.id === id ? { ...company, ...updates } : company));
  const deleteCompany = (id: string) => {
    setCompanies(current => current.filter(company => company.id !== id));
    setProperties(current => current.filter(property => property.companyId !== id));
    setSystemUsers(current => current.filter(user => user.companyId !== id || user.ownerConsoleAccess || user.id === ROOT_OWNER_ID));
  };

  const addProperty = (property: Property) => {
    setProperties(current => [...current, property]);
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

  const addClient = (c: Client) => setClients(current => [...current, c]);
  const updateClient = (id: string, updates: Partial<Client>) =>
    setClients(current => current.map(c => c.id === id ? { ...c, ...updates } : c));
  const deleteClient = (id: string) =>
    setClients(current => current.filter(c => c.id !== id));

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

  return (
    <AppContext.Provider value={{
      currentUser, login, logout,
      profileDefinitions,
      passwordResetRequests, credentialSyncStatus, requestPasswordReset, resetPassword,
      canAccessOwnerConsole, isRootOwner, canManageOwnerUsers,
      companies, addCompany, updateCompany, deleteCompany,
      properties, selectedCompanyId, setSelectedCompanyId, selectedPropertyId, setSelectedPropertyId, addProperty, updateProperty, deleteProperty,
      systemUsers, addSystemUser, updateSystemUser, deleteSystemUser,
      notifications, addNotification, updateNotification, deleteNotification,
      clients, addClient, updateClient, deleteClient,
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
