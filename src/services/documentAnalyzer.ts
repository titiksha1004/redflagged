// Import Claude API for document analysis
import type { Document } from "../pages/DocumentLibrary";

class MockClaudeAI {
  async createCompletion() {
    return {
      choices: [{
        message: {
          content: "This is a fallback analysis when Claude API is not available.",
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

// Use Claude API for analysis
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true,
});

async function callClaudeAPI(messages: any[]) {
  try {
    // Convert messages format for Claude
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');

    const response = await anthropic.messages.create({
      model: 'claude-4-20250101',
      max_tokens: 1000,
      temperature: 0.1,
      system: systemMessage,
      messages: userMessages
    });

    return response.content[0]?.type === 'text' ? response.content[0].text : '';
  } catch (error) {
    console.error('Claude API error:', error);
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

    const response = await callClaudeAPI(messages);
    
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
    console.error('Error analyzing document with Claude:', error);
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
