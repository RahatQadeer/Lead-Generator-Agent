import type { OpenAITestResult } from "@/types/openai-settings";

const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";

export async function testOpenAIConnection(
  apiKey: string,
  model: string
): Promise<OpenAITestResult> {
  try {
    const response = await fetch(OPENAI_MODELS_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (response.status === 401) {
      return { success: false, message: "Invalid API key." };
    }

    if (!response.ok) {
      return {
        success: false,
        message: `OpenAI API returned status ${response.status}.`,
      };
    }

    return {
      success: true,
      message: `Connection successful. Model "${model}" is configured.`,
      model,
    };
  } catch {
    return {
      success: false,
      message: "Failed to reach OpenAI API. Check your network connection.",
    };
  }
}
