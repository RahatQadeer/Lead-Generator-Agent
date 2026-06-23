import {
  buildSystemPrompt,
  buildUserPrompt,
} from "@/lib/email-generation/build-prompt";
import { EmailGenerationError } from "@/lib/email-generation/errors";
import { parseEmailJson } from "@/lib/email-generation/parse-response";
import type { EmailGenerationProvider } from "@/lib/email-generation/types";
import type {
  EmailGenerationContext,
  GeneratedEmail,
} from "@/types/email-generation";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_FREE_MODEL = "meta-llama/llama-3.1-8b-instruct:free";

interface OpenRouterChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
    code?: string;
  };
}

function parseOpenRouterError(
  status: number,
  body: OpenRouterChatResponse
): EmailGenerationError {
  const message = body.error?.message ?? `OpenRouter API returned status ${status}`;

  if (status === 401) {
    return new EmailGenerationError("AUTH_ERROR", message, {
      statusCode: 401,
      retryable: false,
    });
  }

  if (status === 429) {
    return new EmailGenerationError("RATE_LIMIT", message, {
      statusCode: 429,
      retryable: true,
    });
  }

  if (status >= 500) {
    return new EmailGenerationError("PROVIDER_ERROR", message, {
      statusCode: status,
      retryable: true,
    });
  }

  return new EmailGenerationError("PROVIDER_ERROR", message, {
    statusCode: status,
    retryable: false,
  });
}

export class OpenRouterEmailGenerationProvider implements EmailGenerationProvider {
  readonly name = "openrouter";

  constructor(
    private readonly apiKey: string,
    readonly model: string
  ) {}

  async generate(context: EmailGenerationContext): Promise<GeneratedEmail> {
    let response: Response;

    try {
      response = await fetch(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          // "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
          "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "https://lead-generator-agent-iota.vercel.app",
          "X-Title": "LeadForge Lead Generator",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.7,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: buildUserPrompt(context) },
          ],
        }),
      });
    } catch (error) {
      throw new EmailGenerationError(
        "NETWORK_ERROR",
        "Failed to reach OpenRouter API. Check your network connection.",
        { retryable: true, cause: error }
      );
    }

    let body: OpenRouterChatResponse = {};
    try {
      body = (await response.json()) as OpenRouterChatResponse;
    } catch {
      throw new EmailGenerationError(
        "PROVIDER_ERROR",
        "OpenRouter returned an invalid response.",
        { statusCode: response.status, retryable: false }
      );
    }

    if (!response.ok) {
      throw parseOpenRouterError(response.status, body);
    }

    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new EmailGenerationError(
        "PROVIDER_ERROR",
        "OpenRouter returned an empty completion.",
        { retryable: false }
      );
    }

    let parsed: { subject: string; body: string };
    try {
      parsed = parseEmailJson(content);
    } catch (error) {
      throw new EmailGenerationError(
        "PROVIDER_ERROR",
        error instanceof Error ? error.message : "Failed to parse OpenRouter output.",
        { retryable: false }
      );
    }

    return {
      subject: parsed.subject,
      body: parsed.body,
      provider: this.name,
      model: this.model,
      generatedAt: new Date().toISOString(),
      personalization: {
        leadName: context.leadName,
        leadRole: context.leadRole,
        leadCompany: context.leadCompany,
        industry: context.industry,
        painPoints: context.painPoints,
        tone: context.tone,
      },
    };
  }
}

export function getDefaultOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_FREE_MODEL;
}
