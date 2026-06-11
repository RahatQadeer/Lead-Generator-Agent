const EMAIL_SYNTAX_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function extractEmailDomain(email: string): string | null {
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === email.length - 1) return null;
  return email.slice(atIndex + 1).toLowerCase();
}

export function validateEmailSyntax(email: string): {
  valid: boolean;
  normalized: string;
  message: string | null;
} {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return { valid: false, normalized, message: "Email is empty." };
  }

  if (normalized.length > 254) {
    return { valid: false, normalized, message: "Email exceeds maximum length." };
  }

  if (!EMAIL_SYNTAX_PATTERN.test(normalized)) {
    return { valid: false, normalized, message: "Email format is invalid." };
  }

  const domain = extractEmailDomain(normalized);
  if (!domain || !domain.includes(".")) {
    return { valid: false, normalized, message: "Email domain is invalid." };
  }

  return { valid: true, normalized, message: null };
}
