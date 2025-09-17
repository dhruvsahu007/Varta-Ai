import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// Initialize AWS Bedrock with proper error handling
let bedrockClient: BedrockRuntimeClient;
try {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";
  
  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS credentials are not configured in environment variables");
  }
  
  bedrockClient = new BedrockRuntimeClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  console.log("[Bedrock] Successfully initialized with AWS credentials");
} catch (error) {
  console.error("[Bedrock] Initialization error:", error);
  throw error;
}

const MODEL_ID = process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-sonnet-20240229-v1:0";

// Helper function to invoke Bedrock model
async function invokeBedrockModel(messages: Array<{role: string, content: string}>, temperature: number = 0.7): Promise<string> {
  try {
    // For Claude, we need to properly format the conversation
    // If there's a system message, we'll incorporate it into the first user message
    let systemPrompt = "";
    let conversationMessages = [];
    
    for (const msg of messages) {
      if (msg.role === "system") {
        systemPrompt = msg.content;
      } else {
        conversationMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }
    
    // If we have a system prompt, prepend it to the first user message
    if (systemPrompt && conversationMessages.length > 0 && conversationMessages[0].role === "user") {
      conversationMessages[0].content = `${systemPrompt}\n\n${conversationMessages[0].content}`;
    }
    
    // Ensure we have at least one user message
    if (conversationMessages.length === 0) {
      conversationMessages.push({
        role: "user",
        content: systemPrompt || "Please provide a response."
      });
    }

    const input = {
      modelId: MODEL_ID,
      contentType: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 4000,
        temperature,
        messages: conversationMessages
      })
    };

    console.log("[Bedrock] Sending request with messages:", JSON.stringify(conversationMessages, null, 2));

    const command = new InvokeModelCommand(input);
    const response = await bedrockClient.send(command);
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    return responseBody.content[0].text;
  } catch (error) {
    console.error("[Bedrock] Error invoking model:", error);
    throw error;
  }
}

export interface ToneAnalysis {
  tone: string;
  impact: string;
  clarity: string;
  confidence: number;
  suggestions?: string[];
  suggestedTones: string[];
  explanation: string;
}

export interface ReplyGeneration {
  suggestions: Array<{
    suggestedReply: string;
    confidence: number;
    reasoning: string;
  }>;
}

export interface OrgMemoryQuery {
  query: string;
  summary: string;
  sources: Array<{
    channelName: string;
    messageCount: number;
    lastUpdate: string;
  }>;
  keyPoints: string[];
}

export interface MeetingNotesGeneration {
  title: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  participants: string[];
  decisions: string[];
}

export async function analyzeTone(content: string): Promise<ToneAnalysis> {
  try {
    console.log("[AI] Starting tone analysis for content:", content.substring(0, 50) + "...");
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error("Content is required and cannot be empty");
    }

    const systemPrompt = `You are an expert communication analyst. Analyze the tone, impact, and clarity of messages and provide improvement suggestions.
Your analysis should be thorough and include:
1. Current tone identification
2. Impact assessment
3. Clarity evaluation
4. Specific suggestions for improvement
5. Alternative tone suggestions that would be more appropriate

Respond with JSON in this format: 
{ 
  "tone": "string (professional, casual, urgent, friendly, aggressive, etc.)", 
  "impact": "string (high, medium, low)",
  "clarity": "string (clear, somewhat clear, needs clarity)",
  "confidence": number (0-100),
  "suggestions": ["array of improvement suggestions"],
  "suggestedTones": ["array of 2-3 alternative tones that might be more appropriate"],
  "explanation": "string explaining why these tones would be better"
}`;

    const userPrompt = `Analyze this message: "${content}"`;

    const response = await invokeBedrockModel([
      {
        role: "user",
        content: `${systemPrompt}\n\n${userPrompt}`
      }
    ], 0.7);

    console.log("[AI] Received response from Bedrock for tone analysis");

    if (!response) {
      throw new Error("Empty response from Bedrock");
    }

    try {
      // Extract JSON from response that might contain extra text
      let jsonResponse = response.trim();
      
      // Look for JSON object in the response
      const jsonStart = jsonResponse.indexOf('{');
      const jsonEnd = jsonResponse.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonResponse = jsonResponse.substring(jsonStart, jsonEnd + 1);
      }
      
      const result = JSON.parse(jsonResponse);
      console.log("[AI] Successfully parsed tone analysis response");
      
      return {
        tone: result.tone || "neutral",
        impact: result.impact || "medium",
        clarity: result.clarity || "clear",
        confidence: Math.max(0, Math.min(100, result.confidence || 70)),
        suggestions: result.suggestions || [],
        suggestedTones: result.suggestedTones || [],
        explanation: result.explanation || ""
      };
    } catch (parseError) {
      console.error("[AI] Failed to parse tone analysis response:", parseError);
      console.error("[AI] Raw response:", response);
      throw new Error("Failed to parse AI response");
    }
  } catch (error) {
    console.error("[AI] Failed to analyze tone:", error);
    
    // Return a fallback response instead of throwing for better UX
    return {
      tone: "neutral",
      impact: "medium", 
      clarity: "clear",
      confidence: 0,
      suggestions: ["Unable to analyze tone at this time. Please try again."],
      suggestedTones: [],
      explanation: error instanceof Error ? error.message : "Analysis failed"
    };
  }
}

export async function generateReply(
  messageContent: string, 
  threadContext: string[], 
  orgContext: string,
  generateMultiple: boolean = false
): Promise<ReplyGeneration> {
  try {
    console.log("[AI Reply] Generating reply with:", {
      messageContent,
      threadContext,
      orgContext,
      generateMultiple
    });

    // Build context based on available information
    let contextPrompt = "";
    
    if (threadContext && threadContext.length > 0) {
      contextPrompt += `Recent conversation context:\n${threadContext.join('\n')}\n\n`;
    }
    
    if (orgContext && orgContext !== "AI Assistant modal conversation") {
      contextPrompt += `${orgContext}\n\n`;
    }
    
    contextPrompt += `Message to reply to: "${messageContent}"`;

    console.log("[AI Reply] Making Bedrock API request...");
    try {
      const systemPrompt = `You are an AI assistant helping to compose professional, contextually appropriate replies to messages.

When generating replies:
1. Read and understand the message you're replying to
2. Consider any conversation context provided
3. Generate helpful, relevant, and appropriate responses
4. Match the tone and style appropriate for the context
5. Be concise but informative
6. Provide different approaches/tones in multiple suggestions

You must respond with valid JSON only in this exact format:
{
  "suggestions": [
    {
      "suggestedReply": "string (the suggested response)",
      "confidence": number (0-100),
      "reasoning": "string (why this message is appropriate)"
    }
    // Generate ${generateMultiple ? "3 different" : "1"} suggestions with varying tones and approaches
  ]
}
Do not include any other text or explanation outside the JSON.`;

      const userPrompt = `Generate ${generateMultiple ? "3 different reply" : "1 reply"} suggestion(s) for:\n\n${contextPrompt}`;

      const response = await invokeBedrockModel([
        {
          role: "user",
          content: `${systemPrompt}\n\n${userPrompt}`
        }
      ], 0.7);

      console.log("[AI Reply] Received Bedrock response");
      
      try {
        if (!response) {
          throw new Error("Empty response from Bedrock");
        }
        
        // Extract JSON from response that might contain extra text
        let jsonResponse = response.trim();
        
        // Look for JSON object in the response
        const jsonStart = jsonResponse.indexOf('{');
        const jsonEnd = jsonResponse.lastIndexOf('}');
        
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonResponse = jsonResponse.substring(jsonStart, jsonEnd + 1);
        }
        
        const result = JSON.parse(jsonResponse);
        console.log("[AI Reply] Parsed response:", result);

        if (!Array.isArray(result.suggestions)) {
          throw new Error("Bedrock response did not include suggestions array");
        }

        return {
          suggestions: result.suggestions.map((suggestion: any) => ({
            suggestedReply: suggestion.suggestedReply,
            confidence: Math.max(0, Math.min(100, suggestion.confidence || 70)),
            reasoning: suggestion.reasoning || "Standard professional response"
          }))
        };
      } catch (parseError) {
        console.error("[AI Reply] Failed to parse Bedrock response:", parseError);
        console.error("[AI Reply] Raw response:", response);
        throw new Error("Failed to parse AI response");
      }
    } catch (apiError) {
      console.error("[AI Reply] Bedrock API error:", apiError);
      if (apiError instanceof Error) {
        if (apiError.message.includes('credentials')) {
          throw new Error("Invalid AWS credentials");
        }
        throw new Error(`Bedrock API error: ${apiError.message}`);
      }
      throw new Error("Failed to communicate with Bedrock API");
    }
  } catch (error) {
    console.error("[AI Reply] Error details:", error);
    throw error;
  }
}

export async function queryOrgMemory(
  query: string,
  relevantMessages: Array<{ content: string; channelName: string; authorName: string; timestamp: string }>
): Promise<OrgMemoryQuery> {
  try {
    console.log("[AI] Processing org memory query:", query);
    console.log("[AI] Processing", relevantMessages.length, "relevant messages");

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error("Query is required and cannot be empty");
    }

    if (!relevantMessages || relevantMessages.length === 0) {
      return {
        query,
        summary: "No relevant messages found for your query. Try using different keywords or check if there are messages in the channels.",
        sources: [],
        keyPoints: []
      };
    }

    const messagesContext = relevantMessages.map(msg => 
      `[${msg.channelName}] ${msg.authorName} (${msg.timestamp}): ${msg.content}`
    ).join('\n');

    console.log("[AI] Prepared context with", messagesContext.length, "characters");

    const systemPrompt = `You are an AI organizational memory assistant. Analyze relevant messages and provide comprehensive summaries.
IMPORTANT: Your response must be a valid JSON object with no additional text or explanations.
Required JSON format:
{
  "query": "string (the original query)",
  "summary": "string (comprehensive summary)",
  "sources": [{"channelName": "string", "messageCount": number, "lastUpdate": "string"}],
  "keyPoints": ["array of key points"]
}`;

    const userPrompt = `Query: "${query}"\n\nRelevant messages:\n${messagesContext.substring(0, 8000)}`;

    const response = await invokeBedrockModel([
      {
        role: "user",
        content: `${systemPrompt}\n\n${userPrompt}`
      }
    ], 0.7);

    if (!response) {
      throw new Error("Empty response from Bedrock");
    }

    try {
      // Extract JSON from response that might contain extra text
      let jsonResponse = response.trim();
      
      // Look for JSON object in the response
      const jsonStart = jsonResponse.indexOf('{');
      const jsonEnd = jsonResponse.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonResponse = jsonResponse.substring(jsonStart, jsonEnd + 1);
      }
      
      const result = JSON.parse(jsonResponse);
      console.log("[AI] Successfully parsed org memory response");
      
      // Process sources from actual messages
      const sourceChannels = new Map();
      relevantMessages.forEach(msg => {
        if (!sourceChannels.has(msg.channelName)) {
          sourceChannels.set(msg.channelName, { count: 0, lastUpdate: msg.timestamp });
        }
        sourceChannels.get(msg.channelName).count++;
        if (msg.timestamp > sourceChannels.get(msg.channelName).lastUpdate) {
          sourceChannels.get(msg.channelName).lastUpdate = msg.timestamp;
        }
      });

      const sources = Array.from(sourceChannels.entries()).map(([name, data]) => ({
        channelName: name,
        messageCount: data.count,
        lastUpdate: data.lastUpdate
      }));

      return {
        query,
        summary: result.summary || "No relevant information found in the messages.",
        sources,
        keyPoints: result.keyPoints || []
      };
    } catch (parseError) {
      console.error("[AI] Failed to parse Bedrock response:", parseError);
      console.error("[AI] Raw response:", response);
      
      // Return a fallback response
      const sourceChannels = new Map();
      relevantMessages.forEach(msg => {
        if (!sourceChannels.has(msg.channelName)) {
          sourceChannels.set(msg.channelName, { count: 0, lastUpdate: msg.timestamp });
        }
        sourceChannels.get(msg.channelName).count++;
      });

      const sources = Array.from(sourceChannels.entries()).map(([name, data]) => ({
        channelName: name,
        messageCount: data.count,
        lastUpdate: data.lastUpdate
      }));

      return {
        query,
        summary: `Found ${relevantMessages.length} relevant messages, but couldn't generate detailed analysis. Raw search results are available.`,
        sources,
        keyPoints: ["Analysis temporarily unavailable"]
      };
    }
  } catch (error) {
    console.error("[AI] Failed to query org memory:", error);
    if (error instanceof Error) {
      console.error("[AI] Error details:", error.message);
    }
    
    // Return an error response instead of throwing
    return {
      query,
      summary: `Error occurred while searching: ${error instanceof Error ? error.message : "Unknown error"}`,
      sources: [],
      keyPoints: []
    };
  }
}

export async function generateMeetingNotes(
  messages: Array<{ content: string; authorName: string; timestamp: string }>,
  channelName: string
): Promise<MeetingNotesGeneration> {
  try {
    console.log("[AI] Generating meeting notes for channel:", channelName);
    console.log("[AI] Processing", messages.length, "messages");

    if (!messages.length) {
      console.warn("[AI] No messages provided for meeting notes generation");
      throw new Error("No messages available to generate notes from");
    }

    const messagesText = messages.map(msg => 
      `${msg.authorName} (${msg.timestamp}): ${msg.content}`
    ).join('\n');

    console.log("[AI] Calling Bedrock API for meeting notes generation");
    
    const systemPrompt = `You are an AI meeting notes generator. Analyze the following conversation thread and extract key information.
IMPORTANT: Your response must be a valid JSON object with no additional text or explanations.
Required JSON format:
{
  "title": "string (meeting title)",
  "summary": "string (brief summary)",
  "keyPoints": ["array of key discussion points"],
  "actionItems": ["array of action items"],
  "participants": ["array of participant names"],
  "decisions": ["array of decisions made"]
}`;

    const userPrompt = `Generate structured meeting notes from this ${channelName} conversation:\n\n${messagesText}`;

    const response = await invokeBedrockModel([
      {
        role: "user",
        content: `${systemPrompt}\n\n${userPrompt}`
      }
    ], 0.7);

    console.log("[AI] Successfully received response from Bedrock");
    
    if (!response) {
      console.error("[AI] Empty response from Bedrock");
      throw new Error("Failed to generate meeting notes: Empty response from AI");
    }

    try {
      // Extract JSON from response that might contain extra text
      let jsonResponse = response.trim();
      
      // Look for JSON object in the response
      const jsonStart = jsonResponse.indexOf('{');
      const jsonEnd = jsonResponse.lastIndexOf('}');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonResponse = jsonResponse.substring(jsonStart, jsonEnd + 1);
      }
      
      const result = JSON.parse(jsonResponse);
      console.log("[AI] Successfully parsed response:", result);

      if (!result.title || !result.summary) {
        throw new Error("Invalid response format from Bedrock");
      }

      return {
        title: result.title,
        summary: result.summary,
        keyPoints: result.keyPoints || [],
        actionItems: result.actionItems || [],
        participants: result.participants || [],
        decisions: result.decisions || []
      };
    } catch (parseError) {
      console.error("[AI] Failed to parse Bedrock response:", parseError);
      console.error("[AI] Raw response:", response);
      throw new Error("Failed to parse AI response. Please try again.");
    }
  } catch (error) {
    console.error("[AI] Failed to generate meeting notes:", error);
    if (error instanceof Error) {
      console.error("[AI] Error details:", error.message);
      console.error("[AI] Error stack:", error.stack);
    }
    throw error; // Re-throw to let the route handler handle the error
  }
}
