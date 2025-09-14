import Anthropic from '@anthropic-ai/sdk';

// Document type detection patterns
const DOCUMENT_TYPE_PATTERNS = {
  'legal_agreement': /agreement|contract|terms|parties|whereas|hereby|shall|party|clause|provision/i,
  'financial_report': /revenue|profit|financial|quarter|fiscal|earnings|balance|income|cash flow/i,
  'policy_document': /policy|procedure|guidelines|compliance|standard|regulation|requirement/i,
  'technical_spec': /specification|requirements|architecture|design|implementation|technical|system/i,
  'employment_contract': /employment|employee|employer|salary|benefits|termination|duties|responsibilities/i,
  'lease_agreement': /lease|rental|tenant|landlord|property|premises|rent|security deposit/i
};

// Color schemes for different document types
const DOCUMENT_COLOR_SCHEMES = {
  'legal_agreement': {
    primary: '#4f46e5',
    gradient: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    favorable: '#10b981',
    risky: '#ef4444',
    attention: '#f59e0b',
    neutral: '#64748b'
  },
  'financial_report': {
    primary: '#0891b2',
    gradient: 'linear-gradient(135deg, #0891b2 0%, #1e40af 100%)',
    favorable: '#059669',
    risky: '#dc2626',
    attention: '#d97706',
    neutral: '#6b7280'
  },
  'policy_document': {
    primary: '#7c2d12',
    gradient: 'linear-gradient(135deg, #7c2d12 0%, #92400e 100%)',
    favorable: '#16a34a',
    risky: '#dc2626',
    attention: '#ea580c',
    neutral: '#78716c'
  },
  'employment_contract': {
    primary: '#be185d',
    gradient: 'linear-gradient(135deg, #be185d 0%, #c2410c 100%)',
    favorable: '#16a34a',
    risky: '#dc2626',
    attention: '#d97706',
    neutral: '#6b7280'
  },
  'lease_agreement': {
    primary: '#7c3aed',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #a21caf 100%)',
    favorable: '#059669',
    risky: '#dc2626',
    attention: '#ea580c',
    neutral: '#64748b'
  },
  'technical_spec': {
    primary: '#0f766e',
    gradient: 'linear-gradient(135deg, #0f766e 0%, #065f46 100%)',
    favorable: '#10b981',
    risky: '#ef4444',
    attention: '#f59e0b',
    neutral: '#6b7280'
  }
};

export interface DocumentHighlight {
  start: number;
  end: number;
  type: 'favorable' | 'risky' | 'attention' | 'neutral';
  confidence: number;
  reason: string;
  category: string;
}

export interface DocumentIssue {
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  location: number; // 0-100% through document
  visual_priority: number; // 1-10
  action_required: boolean;
  compliance_issue: boolean;
  icon: string;
  color: string;
}

export interface DynamicAnalysisResult {
  structured_text: string;
  document_type: string;
  highlights: DocumentHighlight[];
  issues: DocumentIssue[];
  summary: {
    overall_risk: 'low' | 'medium' | 'high';
    key_points: string[];
    recommendations: string[];
    word_count: number;
    processing_time: number;
  };
  visual_config: {
    color_scheme: any;
    layout: any;
  };
}

export class DynamicDocumentAnalyzer {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
      dangerouslyAllowBrowser: true,
    });
  }

  // Detect document type using pattern matching + AI
  public detectDocumentType(text: string, filename: string): string {
    // Score each type based on pattern matches
    const scores: Record<string, number> = {};
    
    for (const [type, pattern] of Object.entries(DOCUMENT_TYPE_PATTERNS)) {
      const matches = text.match(new RegExp(pattern.source, 'gi')) || [];
      scores[type] = matches.length;
      
      // Boost score if filename suggests type
      if (filename.toLowerCase().includes(type.replace('_', ''))) {
        scores[type] += 5;
      }
    }
    
    // Return type with highest score
    const bestType = Object.keys(scores).reduce((a, b) => 
      scores[a] > scores[b] ? a : b
    );
    
    return bestType || 'legal_agreement';
  }

  // Generate color scheme for document type
  public generateColorScheme(documentType: string, riskLevel: string): any {
    const baseScheme = DOCUMENT_COLOR_SCHEMES[documentType as keyof typeof DOCUMENT_COLOR_SCHEMES] || DOCUMENT_COLOR_SCHEMES['legal_agreement'];
    
    // Adjust colors based on risk level
    if (riskLevel === 'high') {
      return {
        ...baseScheme,
        primary: '#dc2626',
        gradient: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
      };
    }
    
    return baseScheme;
  }

  // Generate dynamic layout configuration
  public generateLayout(documentStats: any, analysisData: any): any {
    const complexity = this.calculateComplexity(documentStats);
    
    return {
      sidebarWidth: complexity > 0.7 ? '320px' : '280px',
      mainContentCols: complexity > 0.8 ? 2 : 1,
      showMiniMap: documentStats.pageCount > 5,
      navigationStyle: complexity > 0.6 ? 'detailed' : 'simple',
      highlightDensity: analysisData.highlights?.length > 50 ? 'compact' : 'spacious'
    };
  }

  private calculateComplexity(stats: any): number {
    let complexity = 0;
    
    // Factor in document length
    if (stats.wordCount > 5000) complexity += 0.3;
    if (stats.wordCount > 10000) complexity += 0.2;
    
    // Factor in page count
    if (stats.pageCount > 10) complexity += 0.2;
    if (stats.pageCount > 20) complexity += 0.2;
    
    // Factor in structure
    if (stats.paragraphs > 50) complexity += 0.1;
    
    return Math.min(complexity, 1.0);
  }

  // Main analysis method using Claude
  public async analyzeDocument(
    documentText: string, 
    documentType: string,
    structuredText?: any
  ): Promise<DynamicAnalysisResult> {
    const startTime = Date.now();
    
    // Smart truncation: send meaningful portion to Claude but keep full text for highlighting
    const maxAnalysisLength = 15000;
    const truncatedForAnalysis = documentText.length > maxAnalysisLength 
      ? documentText.substring(0, maxAnalysisLength)
      : documentText;
    
    const analysisPrompt = `
Analyze this ${documentType.replace('_', ' ')} document and return ONLY a valid JSON response. Do not include any text before or after the JSON.

CRITICAL: Return ONLY valid JSON with this exact structure:

{
  "structured_text": "USE_ORIGINAL_TEXT",
  "highlights": [
    {
      "start": 0,
      "end": 50,
      "type": "favorable",
      "confidence": 0.92,
      "reason": "Detailed explanation",
      "category": "Category name"
    }
  ],
  "issues": [
    {
      "severity": "warning",
      "title": "Brief title",
      "description": "One sentence explanation",
      "location": 75,
      "visual_priority": 8,
      "action_required": true,
      "compliance_issue": false,
      "icon": "alert-triangle",
      "color": "#f59e0b"
    }
  ],
  "summary": {
    "overall_risk": "medium",
    "key_points": ["Point 1", "Point 2"],
    "recommendations": ["Rec 1", "Rec 2"],
    "word_count": ${documentText.split(' ').length}
  }
}

RULES:
- For structured_text field, use exactly "USE_ORIGINAL_TEXT" - do not include actual text
- Create 3-8 highlights covering 50-200 character spans
- Use types: favorable, risky, attention, neutral
- Ensure all JSON strings are properly escaped
- Do not include any markdown formatting or code blocks

Document to analyze: ${truncatedForAnalysis}
`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: analysisPrompt
        }]
      });

      const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';
      let analysisData;
      
      try {
        // Clean the response text before parsing
        let cleanedResponse = responseText.trim();
        
        // Remove any markdown code block markers if present
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Try to extract JSON from response if it contains extra text
        const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          cleanedResponse = jsonMatch[0];
        }
        
        // Handle case where Claude puts actual document text in structured_text field
        // This breaks JSON parsing due to unescaped quotes and newlines
        if (cleanedResponse.includes('"structured_text":') && !cleanedResponse.includes('"USE_ORIGINAL_TEXT"')) {
          // Find the structured_text field and replace its content
          const structuredTextStart = cleanedResponse.indexOf('"structured_text":');
          if (structuredTextStart !== -1) {
            const valueStart = cleanedResponse.indexOf('"', structuredTextStart + 18) + 1;
            let valueEnd = valueStart;
            let braceCount = 0;
            
            // Find the end of the structured_text value, accounting for nested quotes
            for (let i = valueStart; i < cleanedResponse.length; i++) {
              if (cleanedResponse[i] === '"' && cleanedResponse[i-1] !== '\\') {
                if (braceCount === 0) {
                  valueEnd = i;
                  break;
                }
              } else if (cleanedResponse[i] === '{') {
                braceCount++;
              } else if (cleanedResponse[i] === '}') {
                braceCount--;
              }
            }
            
            if (valueEnd > valueStart) {
              cleanedResponse = cleanedResponse.substring(0, valueStart) + 
                              'USE_ORIGINAL_TEXT' + 
                              cleanedResponse.substring(valueEnd);
            }
          }
        }
        
        // Try to parse JSON response
        analysisData = JSON.parse(cleanedResponse);
        
        // Validate and fix required fields
        if (!analysisData.structured_text || analysisData.structured_text === "USE_ORIGINAL_TEXT") {
          analysisData.structured_text = documentText;
        }
        if (!analysisData.highlights || !Array.isArray(analysisData.highlights)) {
          analysisData.highlights = [];
        }
        if (!analysisData.issues || !Array.isArray(analysisData.issues)) {
          analysisData.issues = [];
        }
        if (!analysisData.summary || typeof analysisData.summary !== 'object') {
          analysisData.summary = {
            overall_risk: 'medium',
            key_points: [],
            recommendations: [],
            word_count: documentText.split(' ').length
          };
        }
        
        // Ensure summary has all required fields
        if (!analysisData.summary.overall_risk) {
          analysisData.summary.overall_risk = 'medium';
        }
        if (!analysisData.summary.key_points) {
          analysisData.summary.key_points = [];
        }
        if (!analysisData.summary.recommendations) {
          analysisData.summary.recommendations = [];
        }
        if (!analysisData.summary.word_count) {
          analysisData.summary.word_count = documentText.split(' ').length;
        }
        
      } catch (parseError) {
        console.error('Failed to parse Claude response as JSON:', parseError);
        console.error('Raw response:', responseText.substring(0, 500));
        
        // Try to extract any valid JSON parts from the response
        try {
          // Look for individual JSON properties we can salvage
          const highlightsMatch = responseText.match(/"highlights":\s*\[([\s\S]*?)\]/);
          const issuesMatch = responseText.match(/"issues":\s*\[([\s\S]*?)\]/);
          const summaryMatch = responseText.match(/"summary":\s*\{([\s\S]*?)\}/);
          
          analysisData = {
            structured_text: documentText,
            highlights: highlightsMatch ? this.parsePartialArray(highlightsMatch[1]) : [],
            issues: issuesMatch ? this.parsePartialArray(issuesMatch[1]) : [],
            summary: summaryMatch ? this.parsePartialObject(summaryMatch[1]) : {
              overall_risk: 'medium',
              key_points: ['Document analyzed with partial response'],
              recommendations: ['Manual review recommended'],
              word_count: documentText.split(' ').length
            }
          };
          
          console.log('Recovered partial analysis from malformed JSON');
        } catch (recoveryError) {
          console.error('Could not recover partial analysis:', recoveryError);
          // Final fallback to pattern-based analysis
          analysisData = this.generateFallbackAnalysis(documentText, documentType);
        }
      }

      const processingTime = Date.now() - startTime;
      const colorScheme = this.generateColorScheme(documentType, analysisData.summary?.overall_risk || 'medium');
      
      // Generate layout configuration
      const documentStats = {
        wordCount: documentText.split(' ').length,
        pageCount: structuredText?.pages?.length || 1,
        paragraphs: structuredText?.pages?.reduce((total: number, page: any) => 
          total + (page.paragraphs?.length || 0), 0) || 10
      };
      
      const layout = this.generateLayout(documentStats, analysisData);

      // Ensure we always use full document text for highlighting, not Claude's potentially truncated version
      const claudeStructuredText = analysisData.structured_text || '';
      const useFullText = claudeStructuredText.length < documentText.length * 0.8 ? documentText : claudeStructuredText;
      
      return {
        structured_text: useFullText,
        document_type: documentType,
        highlights: analysisData.highlights || [],
        issues: analysisData.issues || [],
        summary: {
          ...analysisData.summary,
          processing_time: processingTime
        },
        visual_config: {
          color_scheme: colorScheme,
          layout: layout
        }
      };
      
    } catch (error) {
      console.error('Error analyzing document with Claude:', error);
      
      // Fallback analysis
      const fallbackData = this.generateFallbackAnalysis(documentText, documentType);
      const processingTime = Date.now() - startTime;
      
      const fallbackSummary = {
        overall_risk: 'medium' as const,
        key_points: ['Document analyzed using pattern matching'],
        recommendations: ['Consider manual review for complete analysis'],
        word_count: documentText.split(' ').length,
        processing_time: processingTime
      };

      return {
        ...fallbackData,
        structured_text: documentText, // Always use full text for display
        summary: fallbackSummary,
        visual_config: {
          color_scheme: this.generateColorScheme(documentType, 'medium'),
          layout: this.generateLayout({ wordCount: documentText.split(' ').length, pageCount: 1, paragraphs: 10 }, fallbackData)
        }
      };
    }
  }

  private generateFallbackAnalysis(text: string, documentType: string): Omit<DynamicAnalysisResult, 'summary' | 'visual_config'> {
    // Enhanced pattern-based analysis with sentence-level highlighting
    const riskPatterns = [
      { pattern: /automatic renewal|auto-renew/i, type: 'risky', reason: 'Automatic renewal clause', expand: true },
      { pattern: /non-refundable|no refund/i, type: 'risky', reason: 'Non-refundable terms', expand: true },
      { pattern: /indemnif|hold harmless/i, type: 'attention', reason: 'Indemnification clause', expand: true },
      { pattern: /force majeure/i, type: 'neutral', reason: 'Force majeure provision', expand: true },
      { pattern: /cancellation|terminate/i, type: 'attention', reason: 'Termination terms', expand: true },
      { pattern: /liability.*limit|limit.*liability/i, type: 'attention', reason: 'Liability limitation clause', expand: true },
      { pattern: /confidential|non-disclosure/i, type: 'favorable', reason: 'Confidentiality protection', expand: true },
      { pattern: /payment.*due|due.*payment/i, type: 'attention', reason: 'Payment terms', expand: true }
    ];

    const highlights: DocumentHighlight[] = [];
    const issues: DocumentIssue[] = [];

    riskPatterns.forEach(({ pattern, type, reason, expand }) => {
      const matches = [...text.matchAll(new RegExp(pattern.source, 'gi'))];
      matches.forEach(match => {
        if (match.index !== undefined) {
          let start = match.index;
          let end = match.index + match[0].length;
          
          if (expand) {
            // Expand to include the full sentence or clause
            const expandedRange = this.expandToSentence(text, start, end);
            start = expandedRange.start;
            end = expandedRange.end;
          }
          
          highlights.push({
            start,
            end,
            type: type as any,
            confidence: 0.7,
            reason: reason,
            category: 'Pattern Analysis'
          });
        }
      });
    });

    // Generate basic issues
    if (highlights.filter(h => h.type === 'risky').length > 0) {
      issues.push({
        severity: 'warning',
        title: 'Potentially Risky Clauses Detected',
        description: 'Found clauses that may be unfavorable to you.',
        location: 50,
        visual_priority: 8,
        action_required: true,
        compliance_issue: false,
        icon: 'alert-triangle',
        color: '#f59e0b'
      });
    }

    return {
      structured_text: text,
      document_type: documentType,
      highlights,
      issues,
    };
  }

  // Helper method to expand highlights to full sentences or clauses
  private expandToSentence(text: string, start: number, end: number): { start: number; end: number } {
    // Find sentence boundaries
    const sentenceEnders = /[.!?;]\s+/g;
    const clauseMarkers = /[,]\s+/g;
    
    // Expand backwards to find sentence start
    let expandedStart = start;
    for (let i = start - 1; i >= 0; i--) {
      const char = text[i];
      if (char.match(/[.!?]/)) {
        // Found sentence boundary, move past it
        expandedStart = i + 1;
        // Skip whitespace
        while (expandedStart < text.length && text[expandedStart].match(/\s/)) {
          expandedStart++;
        }
        break;
      }
      if (i === 0) {
        expandedStart = 0;
      }
    }
    
    // Expand forward to find sentence end
    let expandedEnd = end;
    for (let i = end; i < text.length; i++) {
      const char = text[i];
      if (char.match(/[.!?]/)) {
        // Found sentence boundary
        expandedEnd = i + 1;
        break;
      }
      if (i === text.length - 1) {
        expandedEnd = text.length;
      }
    }
    
    // Ensure minimum highlight length of 50 characters
    if (expandedEnd - expandedStart < 50 && expandedEnd < text.length) {
      // Try to expand further
      const remainingText = text.length - expandedEnd;
      const expandBy = Math.min(50 - (expandedEnd - expandedStart), remainingText);
      expandedEnd += expandBy;
    }
    
    // Ensure maximum highlight length of 500 characters for readability
    if (expandedEnd - expandedStart > 500) {
      expandedEnd = expandedStart + 500;
      // Try to end at a word boundary
      while (expandedEnd > expandedStart + 400 && !text[expandedEnd].match(/\s/)) {
        expandedEnd--;
      }
    }
    
    return { start: expandedStart, end: expandedEnd };
  }

  // Helper methods for parsing partial JSON responses
  private parsePartialArray(arrayContent: string): any[] {
    try {
      return JSON.parse(`[${arrayContent}]`);
    } catch {
      return [];
    }
  }

  private parsePartialObject(objectContent: string): any {
    try {
      return JSON.parse(`{${objectContent}}`);
    } catch {
      return {
        overall_risk: 'medium',
        key_points: [],
        recommendations: [],
        word_count: 0
      };
    }
  }
}

export const dynamicAnalyzer = new DynamicDocumentAnalyzer();
