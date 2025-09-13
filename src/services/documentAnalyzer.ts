// Import Groq API for document analysis
import type { Document } from "../pages/DocumentLibrary";

class MockGroqAI {
  async createCompletion() {
    return {
      choices: [{
        message: {
          content: "This is a fallback analysis when Groq API is not available.",
          tool_calls: null
        }
      }]
    };
  }
}

export interface DocumentAnalysis {
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  keyTerms: ExtractedTerm[];
  clauses: Array<{
    text: string;
    riskLevel: 'low' | 'medium' | 'high';
    analysis: string;
    type: string;
    content: string;
    riskFactors: string[];
  }>;
  redFlags: string[];
  recommendations: string[];
}

export interface ExtractedTerm {
  term: string;
  definition: string;
  riskLevel: 'low' | 'medium' | 'high';
  category: string;
  type: string;
  value: string;
  confidence: number;
  riskFactors: string[];
}

// Use Groq API for analysis
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

async function callGroqAPI(messages: any[]) {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Groq API error:', error);
    throw error;
  }
}

export async function analyzeDocument(document: Document): Promise<DocumentAnalysis> {
  if (!document.content) {
    throw new Error("Document content is required for analysis");
  }

  try {
    const analysisPrompt = `Analyze this legal document and provide:
1. A brief summary
2. Risk level (low/medium/high)
3. Key terms and their definitions
4. Red flags or concerning clauses
5. Recommendations for the user

Document content:
${document.content.substring(0, 8000)}`;

    const messages = [
      {
        role: 'system',
        content: 'You are a legal document analyzer. Provide clear, structured analysis in JSON format.'
      },
      {
        role: 'user', 
        content: analysisPrompt
      }
    ];

    const response = await callGroqAPI(messages);
    
    // Try to parse JSON response, fallback to basic analysis if needed
    try {
      const parsed = JSON.parse(response);
      return {
        summary: parsed.summary || 'Analysis completed',
        riskLevel: parsed.riskLevel || 'medium',
        riskScore: parsed.riskScore || 50,
        keyTerms: parsed.keyTerms || parsed.terms || [],
        clauses: parsed.clauses || [],
        redFlags: parsed.redFlags || [],
        recommendations: parsed.recommendations || []
      };
    } catch (parseError) {
      // Fallback to basic analysis if JSON parsing fails
      return generateFallbackAnalysis(document.content);
    }

  } catch (error) {
    console.error('Error analyzing document with Groq:', error);
    return generateFallbackAnalysis(document.content);
  }
}

function generateFallbackAnalysis(content: string): DocumentAnalysis {
  // Basic pattern-based analysis as fallback
  const riskPatterns = [
    'automatic renewal',
    'non-refundable',
    'liquidated damages',
    'binding arbitration',
    'class action waiver'
  ];

  const redFlags = riskPatterns.filter(pattern => 
    content.toLowerCase().includes(pattern)
  );

  const riskLevel = redFlags.length > 2 ? 'high' : redFlags.length > 0 ? 'medium' : 'low';
  const riskScore = redFlags.length > 2 ? 75 : redFlags.length > 0 ? 50 : 25;
  
  return {
    summary: 'Document analyzed using fallback method due to API limitations.',
    riskLevel: riskLevel,
    riskScore: riskScore,
    keyTerms: [
      {
        term: 'Agreement Terms',
        definition: 'Standard legal agreement language detected',
        riskLevel: 'low',
        category: 'General',
        type: 'legal',
        value: 'Standard',
        confidence: 0.8,
        riskFactors: []
      }
    ],
    clauses: [
      {
        text: 'Standard agreement clause detected',
        riskLevel: 'low',
        analysis: 'Basic legal language identified',
        type: 'standard',
        content: 'Standard agreement clause detected',
        riskFactors: []
      }
    ],
    redFlags: redFlags,
    recommendations: [
      'Review all terms carefully before signing',
      'Consider legal consultation for complex agreements'
    ]
  };
}
