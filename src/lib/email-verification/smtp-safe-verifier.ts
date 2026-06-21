import { resolveMx } from "node:dns/promises";
import net from "node:net";

export type SmtpCheckResult = "verified" | "likely_valid" | "invalid" | "unknown";

const SMTP_TIMEOUT_MS = 4_000;

function readResponse(socket: net.Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("SMTP timeout")), SMTP_TIMEOUT_MS);

    socket.once("data", (chunk) => {
      clearTimeout(timer);
      resolve(chunk.toString());
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function sendCommand(socket: net.Socket, command: string): Promise<string> {
  socket.write(`${command}\r\n`);
  return readResponse(socket);
}

/**
 * Safe SMTP mailbox check: EHLO → MAIL FROM → RCPT TO (no DATA sent).
 * Many servers greylist or block — inconclusive results map to likely_valid/unknown.
 */
export async function verifyEmailSmtpSafe(email: string): Promise<SmtpCheckResult> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return "invalid";

  let mxRecords: { exchange: string; priority: number }[];
  try {
    mxRecords = await resolveMx(domain);
  } catch {
    return "invalid";
  }

  if (!mxRecords?.length) return "invalid";

  const mxHost = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;

  return new Promise((resolve) => {
    const socket = net.createConnection(25, mxHost);
    const finish = (result: SmtpCheckResult) => {
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => finish("unknown"), SMTP_TIMEOUT_MS);

    socket.once("error", () => {
      clearTimeout(timer);
      finish("likely_valid");
    });

    socket.once("connect", async () => {
      try {
        const greeting = await readResponse(socket);
        if (!greeting.startsWith("220")) {
          clearTimeout(timer);
          finish("unknown");
          return;
        }

        const ehlo = await sendCommand(socket, "EHLO leadforge.local");
        if (!ehlo.startsWith("250")) {
          clearTimeout(timer);
          finish("unknown");
          return;
        }

        const mailFrom = await sendCommand(socket, "MAIL FROM:<verify@leadforge.local>");
        if (!mailFrom.startsWith("250")) {
          clearTimeout(timer);
          finish("unknown");
          return;
        }

        const rcpt = await sendCommand(socket, `RCPT TO:<${email}>`);
        clearTimeout(timer);

        if (rcpt.startsWith("250") || rcpt.startsWith("251")) {
          finish("verified");
          return;
        }

        if (/^(550|551|553|554)/.test(rcpt)) {
          finish("invalid");
          return;
        }

        finish("likely_valid");
      } catch {
        clearTimeout(timer);
        finish("likely_valid");
      }
    });
  });
}
