// src/lib/claude.ts (renamed from groq.ts)
import Anthropic from '@anthropic-ai/sdk';

if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
  console.warn("VITE_ANTHROPIC_API_KEY environment variable is not set");
}

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

export async function sendMessageToClaude(
  message: string,
  conversationHistory: ClaudeMessage[] = [],
  options: { temperature?: number; maxTokens?: number; documentContext?: string } = {}
) {
  console.log('🤖 Claude API call initiated');
  console.log('Environment check:', {
    hasApiKey: !!import.meta.env.VITE_ANTHROPIC_API_KEY,
    keyLength: import.meta.env.VITE_ANTHROPIC_API_KEY?.length || 0,
    keyPrefix: import.meta.env.VITE_ANTHROPIC_API_KEY?.substring(0, 10) || 'none'
  });

  try {
    // Sanitize the input message by removing null bytes and invalid Unicode escapes
    const sanitizedMessage = message
      .replace(/\u0000/g, "")
      .replace(/\\u[0-9a-fA-F]{4}/g, "");

    // Sanitize conversation history
    const sanitizedHistory = conversationHistory.map((msg) => ({
      ...msg,
      content: msg.content
        .replace(/\u0000/g, "")
        .replace(/\\u[0-9a-fA-F]{4}/g, ""),
    }));

    // Prepare messages for Claude format
    const messages = [
      ...sanitizedHistory,
      {
        role: "user" as const,
        content: sanitizedMessage,
      },
    ];

    let systemMessage = `You are an expert legal AI assistant powered by Claude (Anthropic's advanced language model).
                 Provide accurate, clear, and concise legal information and analysis.
                 Focus on helping users understand complex legal concepts and documents.
                 Always maintain professional tone and cite relevant legal precedents when applicable.`;

    // Add document context if available
    if (options.documentContext && options.documentContext.trim().length > 0) {
      systemMessage += `\n\nYou have access to the user's uploaded legal documents below. Reference them when relevant to answer questions:\n\n${options.documentContext}`;
    }

    console.log('📋 Request parameters:', {
      model: "claude-sonnet-4-20250514",
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature || 0.7,
      messageCount: messages.length,
      hasDocumentContext: !!(options.documentContext && options.documentContext.trim().length > 0),
      contextLength: options.documentContext?.length || 0
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: options.maxTokens || 1024,
      temperature: options.temperature || 0.7,
      system: systemMessage,
      messages: messages,
    });

    console.log('✅ Claude API call successful');

    return response.content[0]?.type === 'text' ? response.content[0].text : "";
  } catch (error) {
    console.error("Error calling Claude API:", error);
    if (error instanceof Error) {
      throw new Error(`Claude API Error: ${error.message}`);
    }
    throw new Error("An unknown error occurred while calling Claude API");
  }
}
