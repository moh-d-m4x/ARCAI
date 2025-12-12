import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { db } from "../db";

// Get the current AI provider configuration
async function getAIConfig() {
    const settings = await db.settings.toArray();
    console.log('AI Service: Settings found:', settings);

    if (!settings || settings.length === 0) {
        throw new Error("No settings found. Please configure AI provider in Settings.");
    }

    const config = settings[0];
    const provider = config.aiProvider || 'gemini';

    return { provider, config };
}

// Initialize Gemini AI
export async function getGeminiModel() {
    const settings = await db.settings.toArray();
    const apiKey = settings[0]?.geminiApiKey;

    if (!apiKey) {
        throw new Error("Gemini API Key is not set in Settings.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = settings[0]?.selectedModel || "gemini-1.5-flash";
    console.log('AI Service: Using Gemini Model:', modelName);
    return genAI.getGenerativeModel({ model: modelName });
}

// Initialize OpenAI
async function getOpenAIClient() {
    const settings = await db.settings.toArray();
    const apiKey = settings[0]?.openaiApiKey;

    if (!apiKey) {
        throw new Error("OpenAI API Key is not set in Settings.");
    }

    console.log('AI Service: Using OpenAI');
    return new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Required for browser usage
    });
}

// Initialize LLM7.io (OpenAI-compatible)
async function getLLM7Client() {
    const settings = await db.settings.toArray();
    const apiKey = settings[0]?.llm7ApiKey;

    if (!apiKey) {
        throw new Error("LLM7.io API Key is not set in Settings.");
    }

    console.log('AI Service: Using LLM7.io');
    return new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://api.llm7.io/v1', // LLM7.io API endpoint
        dangerouslyAllowBrowser: true
    });
}

export async function checkConnection(apiKey: string) {
    try {
        // Use direct REST API call to list available models (Gemini only)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            throw new Error(`API Check Failed: ${response.statusText}`);
        }
        const data = await response.json();
        return data.models || [];
    } catch (error) {
        console.error("Connection Check Failed:", error);
        throw error;
    }
}

export async function checkOpenAIConnection(apiKey: string) {
    try {
        const client = new OpenAI({
            apiKey: apiKey,
            dangerouslyAllowBrowser: true
        });

        // List available models
        const response = await client.models.list();
        const models = response.data || [];

        // Filter to only show vision-capable models
        const visionModels = models.filter((m: any) =>
            m.id.includes('gpt-4') || m.id.includes('vision')
        );

        return visionModels.length > 0 ? visionModels : models;
    } catch (error) {
        console.error("OpenAI Connection Check Failed:", error);
        throw error;
    }
}

export async function checkLLM7Connection(apiKey: string) {
    try {
        console.log('Initializing LLM7 client with API key...');
        const client = new OpenAI({
            apiKey: apiKey,
            baseURL: 'https://api.llm7.io/v1',
            dangerouslyAllowBrowser: true
        });

        console.log('Fetching models from LLM7...');
        // List available models
        const response = await client.models.list();
        console.log('LLM7 API Response:', response);

        const models = response.data || [];
        console.log('LLM7 Models count:', models.length);
        console.log('LLM7 Models:', models);

        // LLM7 might not return models list via the API endpoint
        // Provide a fallback list of common LLM7 models
        if (models.length === 0) {
            console.warn('No models returned from LLM7 API, using fallback model list');

            // Return common LLM7 models
            return [
                { id: 'gpt-4o', object: 'model' },
                { id: 'gpt-4o-mini', object: 'model' },
                { id: 'gpt-4-turbo', object: 'model' },
                { id: 'gpt-4', object: 'model' },
                { id: 'gpt-3.5-turbo', object: 'model' },
            ];
        }

        return models;
    } catch (error) {
        console.error("LLM7 Connection Check Failed:", error);
        throw error;
    }
}

// Analyze document using Gemini
async function analyzeWithGemini(imageBlob: Blob) {
    const model = await getGeminiModel();

    // Convert Blob to Base64
    const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
    });

    const prompt = `
      Analyze this image of a document (archival paper). 
      Extract the following information into a JSON object. 
      If a field is missing, use null or an empty string.
      
      Fields required:
      - type: "Incoming" or "Outgoing" (Infer from context)
      - document_date: The date written on the document header.
      - reference_number: Ref No. / Number.
      - sender: The entity sending the document (Simple String, not an object).
      - sender_signatory: The name/title of the person signing it.
      - receiver: The entity receiving it (Simple String, not an object).
      - subject: The subject line.
      - attachments_desc: "Al-Murfaqat" or attachments description.
      - cc_distribution: "Copy to" / "Nuskha" list.
      - content_summary: A brief summary of what the document is about (in English or Arabic as per document language, preferably Arabic if document is Arabic).
      - raw_text: OCR all text on the page.
      - structured_data_json: Any tabular data found (names, quantities, supply lists) or form fields.

      Output ONLY valid JSON.
    `;

    const result = await model.generateContent([
        prompt,
        {
            inlineData: {
                data: base64Data,
                mimeType: imageBlob.type || "image/jpeg",
            },
        },
    ]);

    const response = await result.response;
    const text = response.text();
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
}

// Analyze document using OpenAI or LLM7.io
async function analyzeWithOpenAI(imageBlob: Blob, provider: 'openai' | 'llm7') {
    const client = provider === 'openai' ? await getOpenAIClient() : await getLLM7Client();

    // Convert Blob to Base64
    const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result); // Keep the full data URL for OpenAI
        };
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
    });

    const prompt = `
    Analyze this image of a document (archival paper). 
      Extract the following information into a JSON object. 
      If a field is missing, use null or an empty string.
      
      Fields required:
      - type: "Incoming" or "Outgoing" (Infer from context)
      - document_date: The date written on the document header.
      - reference_number: Ref No. / Number.
      - sender: The entity sending the document (Simple String, not an object).
      - sender_signatory: The name/title of the person signing it.
      - receiver: The entity receiving it (Simple String, not an object).
      - subject: The subject line.
      - attachments_desc: "Al-Murfaqat" or attachments description.
      - cc_distribution: "Copy to" / "Nuskha" list.
      - content_summary: A brief summary of what the document is about (in English or Arabic as per document language, preferably Arabic if document is Arabic).
      - raw_text: OCR all text on the page.
      - structured_data_json: Any tabular data found (names, quantities, supply lists) or form fields.

      Output ONLY valid JSON.
      `;

    // Get selected model from settings, or use defaults
    const settings = await db.settings.toArray();
    const selectedModel = settings[0]?.selectedModel;

    // Use selected model if available AND compatible with current provider
    let model = 'gpt-4o';

    if (selectedModel) {
        // Check if the selected model is compatible with the current provider
        const isGeminiModel = selectedModel.includes('gemini') || selectedModel.includes('models/');
        const isGPTModel = selectedModel.includes('gpt') || selectedModel.includes('o1');

        if (provider === 'llm7') {
            // For LLM7, use the selected model if it's a GPT model, otherwise default to gpt-4o-mini
            model = isGPTModel ? selectedModel : 'gpt-4o-mini';
        } else if (provider === 'openai') {
            // For OpenAI, use the selected model if it's a GPT model, otherwise default to gpt-4o
            model = isGPTModel ? selectedModel : 'gpt-4o';
        }
    } else if (provider === 'llm7') {
        model = 'gpt-4o-mini'; // Default for LLM7
    }

    console.log(`Using model: ${model} for provider: ${provider}`);

    const response = await client.chat.completions.create({
        model: model,
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    {
                        type: "image_url",
                        image_url: {
                            url: base64Data,
                        },
                    },
                ],
            },
        ],
        max_tokens: 1500,
    });

    const text = response.choices[0].message.content || '';
    console.log('OpenAI/LLM7 Raw Response:', text);

    // Try to extract JSON from response
    try {
        // First, try the simple cleanup
        let jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

        // If parsing fails, try to find JSON object in the text
        try {
            return JSON.parse(jsonStr);
        } catch {
            // Look for JSON object pattern in the text
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonStr = jsonMatch[0];
                return JSON.parse(jsonStr);
            }
            throw new Error('No valid JSON found in response');
        }
    } catch (parseError) {
        console.error('Failed to parse JSON from response:', text);
        throw new Error(`AI returned invalid JSON. Response: ${text.substring(0, 200)}...`);
    }
}

// Main document analysis function - routes to appropriate provider
export async function analyzeDocumentImage(imageBlob: Blob) {
    try {
        const { provider } = await getAIConfig();
        console.log('Analyzing document with provider:', provider);

        let result;
        if (provider === 'gemini') {
            result = await analyzeWithGemini(imageBlob);
        } else if (provider === 'openai' || provider === 'llm7') {
            result = await analyzeWithOpenAI(imageBlob, provider);
        } else {
            throw new Error(`Unsupported AI provider: ${provider}`);
        }

        return result;
    } catch (error) {
        console.error("AI Analysis Failed:", error);
        throw error;
    }
}

// Intelligent search - currently only supports Gemini
export async function intelligentSearch(query: string, documents: any[]): Promise<number[]> {
    try {
        const model = await getGeminiModel();

        // Create a summary of all documents for the AI
        const docSummaries = documents.map((doc, idx) => ({
            index: idx,
            id: doc.id,
            subject: doc.subject || 'No subject',
            sender: doc.sender || 'Unknown',
            receiver: doc.receiver || 'Unknown',
            summary: doc.content_summary || 'No summary',
            text: doc.raw_text ? doc.raw_text.substring(0, 500) : 'No text',
            type: doc.type,
            date: doc.document_date || doc.created_date
        }));

        const prompt = `
You are an intelligent document search assistant for a bilingual (in Arabic) document management system.

User's search query: "${query}"

Available documents:
${JSON.stringify(docSummaries, null, 2)}

Analyze this image of a document (archival paper). 
      Extract the following information into a JSON object. 
      If a field is missing, use null or an empty string.
      
      Fields required:
      - type: "Incoming" or "Outgoing" (Infer from context)
      - document_date: The date written on the document header.
      - reference_number: Ref No. / Number.
      - sender: The entity sending the document (Simple String, not an object).
      - sender_signatory: The name/title of the person signing it.
      - receiver: The entity receiving it (Simple String, not an object).
      - subject: The subject line.
      - attachments_desc: "Al-Murfaqat" or attachments description.
      - cc_distribution: "Copy to" / "Nuskha" list.
      - content_summary: A brief summary of what the document is about (in Arabic).
      - raw_text: OCR all text on the page.
      - structured_data_json: Any tabular data found (names, quantities, supply lists) or form fields.

      Output ONLY valid JSON.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean up markdown code blocks if present
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const relevantIndices = JSON.parse(jsonStr);
        console.log('AI Search Results - Relevant document indices:', relevantIndices);
        return relevantIndices;
    } catch (error) {
        console.error("AI Search Failed:", error);
        // Fallback: return all indices
        return documents.map((_, idx) => idx);
    }
}
