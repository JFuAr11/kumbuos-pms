import type { SystemUser } from "../context/AppContext";

const HASH_ALGORITHM = "SHA-256";
const PASSWORD_HISTORY_LIMIT = 5;

export type PasswordValidationResult = {
  valid: boolean;
  errors: string[];
};

export type PasswordUpdateResult =
  | { ok: true; user: SystemUser }
  | { ok: false; error: string };

export function validatePasswordPolicy(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 8) errors.push("Password must be at least 8 characters long.");
  if (!/[A-Z]/.test(password)) errors.push("Password must include at least one uppercase letter.");
  if (!/[a-z]/.test(password)) errors.push("Password must include at least one lowercase letter.");
  if (!/\d/.test(password)) errors.push("Password must include at least one number.");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("Password must include at least one special character, for example @, /, !, # or ?.");

  return { valid: errors.length === 0, errors };
}

export async function verifyUserPassword(user: SystemUser, password: string) {
  if (user.passwordSalt && user.passwordHash) {
    return await hashPassword(password, user.passwordSalt) === user.passwordHash;
  }

  return Boolean(user.password && user.password === password);
}

export async function prepareUserWithPassword(user: SystemUser, plainPassword: string): Promise<PasswordUpdateResult> {
  const policy = validatePasswordPolicy(plainPassword);
  if (!policy.valid) return { ok: false, error: policy.errors.join(" ") };

  const salt = generateSalt();
  const passwordHash = await hashPassword(plainPassword, salt);
  const previousHashes = buildComparablePasswordHistory(user);
  const historyKey = toHistoryKey(salt, passwordHash);

  if (previousHashes.includes(historyKey) || await matchesHistoricalPassword(plainPassword, user)) {
    return {
      ok: false,
      error: "This password has already been used recently. Please set a different password.",
    };
  }

  return {
    ok: true,
    user: {
      ...user,
      password: "",
      passwordSalt: salt,
      passwordHash,
      passwordHistory: [historyKey, ...previousHashes].slice(0, PASSWORD_HISTORY_LIMIT),
      passwordUpdatedAt: new Date().toISOString(),
      mustChangePassword: false,
    },
  };
}

export async function migrateLegacyUserPassword(user: SystemUser): Promise<SystemUser> {
  if (user.passwordHash || !user.password) return user;

  const salt = generateSalt();
  const passwordHash = await hashPassword(user.password, salt);
  return {
    ...user,
    password: "",
    passwordSalt: salt,
    passwordHash,
    passwordHistory: [toHistoryKey(salt, passwordHash), ...(user.passwordHistory || [])].slice(0, PASSWORD_HISTORY_LIMIT),
    passwordUpdatedAt: user.passwordUpdatedAt || new Date().toISOString(),
  };
}

export function redactCredentialForStorage(user: SystemUser): SystemUser {
  return {
    ...user,
    password: "",
  };
}

async function matchesHistoricalPassword(plainPassword: string, user: SystemUser) {
  const historicalHashes = user.passwordHistory || [];
  if (!historicalHashes.length) return false;

  for (const item of historicalHashes) {
    const [salt, hash] = item.includes(":") ? item.split(":") : [user.passwordSalt || "", item];
    if (!salt || !hash) continue;
    if (await hashPassword(plainPassword, salt) === hash) return true;
  }
  return false;
}

function buildComparablePasswordHistory(user: SystemUser) {
  return [
    user.passwordSalt && user.passwordHash ? toHistoryKey(user.passwordSalt, user.passwordHash) : "",
    ...(user.passwordHistory || []),
  ].filter(Boolean);
}

function toHistoryKey(salt: string, passwordHash: string) {
  return `${salt}:${passwordHash}`;
}

function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string, salt: string) {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest(HASH_ALGORITHM, encoder.encode(`${salt}:${password}`));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
