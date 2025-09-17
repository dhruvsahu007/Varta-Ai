import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import { config } from "dotenv";

config();

const bedrockClient = new BedrockRuntimeClient({
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

async function testBedrock() {
  try {
    console.log("Testing Bedrock connection...");
    console.log("AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID ? "Set" : "Not set");
    console.log("AWS_SECRET_ACCESS_KEY:", process.env.AWS_SECRET_ACCESS_KEY ? "Set" : "Not set");
    
    const input = {
      modelId: "anthropic.claude-3-sonnet-20240229-v1:0",
      contentType: "application/json",
      body: JSON.stringify({
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 100,
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: "Hello, can you respond with just 'Test successful'?"
          }
        ]
      })
    };

    const command = new InvokeModelCommand(input);
    const response = await bedrockClient.send(command);
    
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    console.log("Response:", responseBody.content[0].text);
    console.log("✅ Bedrock test successful!");
  } catch (error) {
    console.error("❌ Bedrock test failed:", error);
    console.error("Error details:", error.message);
  }
}

testBedrock();



