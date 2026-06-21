import {
  buildFollowUpSystemPrompt,
  buildFollowUpUserPrompt,
} from "@/lib/follow-up-generation/build-prompt";
import { EmailGenerationError } from "@/lib/email-generation/errors";
import { parseEmailJson } from "@/lib/email-generation/parse-response";
import type { FollowUpGenerationProvider } from "@/lib/follow-up-generation/types";
import type {
  FollowUpGenerationContext,
  GeneratedFollowUpSuggestion,
} from "@/types/follow-up-suggestion";

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

function parseOpenAIError(
  status: number,
  body: OpenAIChatResponse
): EmailGenerationError {
  const message = body.error?.message ?? `OpenAI API returned status ${status}`;

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

export class OpenAIFollowUpGenerationProvider implements FollowUpGenerationProvider {
  readonly name = "openai";

  constructor(
    private readonly apiKey: string,
    readonly model: string
  ) {}

  async generate(
    context: FollowUpGenerationContext
  ): Promise<GeneratedFollowUpSuggestion> {
    let response: Response;

    try {
      response = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.7,
          messages: [
            { role: "system", content: buildFollowUpSystemPrompt() },
            { role: "user", content: buildFollowUpUserPrompt(context) },
          ],
        }),
      });
    } catch (error) {
      throw new EmailGenerationError(
        "NETWORK_ERROR",
        "Failed to reach OpenAI API. Check your network connection.",
        { retryable: true, cause: error }
      );
    }

    let body: OpenAIChatResponse = {};
    try {
      body = (await response.json()) as OpenAIChatResponse;
    } catch {
      throw new EmailGenerationError(
        "PROVIDER_ERROR",
        "OpenAI returned an invalid response.",
        { statusCode: response.status, retryable: false }
      );
    }

    if (!response.ok) {
      throw parseOpenAIError(response.status, body);
    }

    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new EmailGenerationError(
        "PROVIDER_ERROR",
        "OpenAI returned an empty completion.",
        { retryable: false }
      );
    }

    let parsed: { subject: string; body: string };
    try {
      parsed = parseEmailJson(content);
    } catch (error) {
      throw new EmailGenerationError(
        "PROVIDER_ERROR",
        error instanceof Error ? error.message : "Failed to parse OpenAI output.",
        { retryable: false }
      );
    }

    return {
      subject: parsed.subject,
      body: parsed.body,
      provider: this.name,
      model: this.model,
      generatedAt: new Date().toISOString(),
    };
  }
}
