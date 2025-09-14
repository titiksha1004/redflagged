import { DocumentHighlight } from './dynamicDocumentAnalyzer';

export interface HighlightStyle {
  background: string;
  borderLeft: string;
  boxShadow: string;
  borderRadius?: string;
  animation?: string;
  padding?: string;
}

export class HighlightingEngine {
  // Generate CSS styles for different highlight types (matching the beautiful example)
  public generateHighlightCSS(type: string, color: string): HighlightStyle {
    const styles: Record<string, HighlightStyle> = {
      favorable: {
        background: 'linear-gradient(120deg, #d1fae5 0%, #a7f3d0 100%)',
        borderLeft: '3px solid #10b981',
        boxShadow: '0 2px 4px rgba(16, 185, 129, 0.1)',
        borderRadius: '4px',
        padding: '3px 6px'
      },
      risky: {
        background: 'linear-gradient(120deg, #fef2f2 0%, #fecaca 100%)',
        borderLeft: '3px solid #ef4444',
        boxShadow: '0 2px 4px rgba(239, 68, 68, 0.1)',
        borderRadius: '4px',
        padding: '3px 6px'
      },
      attention: {
        background: 'linear-gradient(120deg, #fefce8 0%, #fde68a 100%)',
        borderLeft: '3px solid #f59e0b',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(245, 158, 11, 0.1)',
        padding: '3px 6px'
      },
      neutral: {
        background: 'linear-gradient(120deg, #f1f5f9 0%, #e2e8f0 100%)',
        borderLeft: '3px solid #64748b',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(100, 116, 139, 0.1)',
        padding: '3px 6px'
      }
    };
    
    return styles[type] || styles.neutral;
  }

  // Apply highlighting to text with tooltips and confidence badges
  public applyHighlighting(text: string, highlights: DocumentHighlight[], colorScheme: any): string {
    if (!highlights.length) return text;
    
    // Filter out invalid highlights and ensure they're within text bounds
    const validHighlights = highlights.filter(h => 
      h.start >= 0 && 
      h.end <= text.length && 
      h.start < h.end &&
      text.substring(h.start, h.end).trim().length > 0
    );
    
    if (!validHighlights.length) return text;
    
    // Sort highlights by position (reverse order for processing)
    const sortedHighlights = [...validHighlights].sort((a, b) => b.start - a.start);

    let result = text;

    for (const highlight of sortedHighlights) {
      const { start, end, type, confidence, reason, category } = highlight;
      
      const originalText = result.substring(start, end);
      if (!originalText.trim()) continue; // Skip empty highlights
      
      const color = colorScheme[type] || colorScheme.neutral;
      const style = this.generateHighlightCSS(type, color);
      
      const highlightedText = `<span class="highlight-${type}" 
              style="
                background: ${style.background};
                border-left: ${style.borderLeft};
                box-shadow: ${style.boxShadow};
                border-radius: ${style.borderRadius || '4px'};
                padding: ${style.padding || '3px 6px'};
                position: relative;
                cursor: help;
                transition: all 0.2s ease;
                display: inline;
              "
              onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0, 0, 0, 0.15)';"
              onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='${style.boxShadow}';">
          ${originalText}<div class="tooltip" style="
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: #1e293b;
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 12px;
            white-space: normal;
            opacity: 0;
            visibility: hidden;
            transition: all 0.2s ease;
            z-index: 1000;
            pointer-events: none;
            max-width: 250px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          ">
            <div style="font-weight: 600; margin-bottom: 4px;">${category}</div>
            <div style="margin-bottom: 4px;">${reason}</div>
            <div style="font-size: 10px; opacity: 0.8;">Confidence: ${Math.round(confidence * 100)}%</div>
            <div style="
              position: absolute;
              top: 100%;
              left: 50%;
              transform: translateX(-50%);
              border: 4px solid transparent;
              border-top-color: #1e293b;
            "></div>
          </div><span class="confidence-badge" style="
            background: rgba(0, 0, 0, 0.8);
            color: white;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 10px;
            margin-left: 6px;
            font-weight: 600;
          ">${Math.round(confidence * 100)}%</span>
        </span>`;

      // Process from end to start to avoid position shifting
      result = result.substring(0, start) + highlightedText + result.substring(end);
    }

    return result;
  }

  // Generate CSS keyframes for animations and hover effects
  public generateAnimationCSS(): string {
    return `
      <style>
        .highlight-favorable:hover .tooltip,
        .highlight-risky:hover .tooltip,
        .highlight-attention:hover .tooltip,
        .highlight-neutral:hover .tooltip {
          opacity: 1 !important;
          visibility: visible !important;
        }
        
        .highlight-favorable,
        .highlight-risky,
        .highlight-attention,
        .highlight-neutral {
          display: inline;
          position: relative;
        }
        
        .highlight-favorable:hover,
        .highlight-risky:hover,
        .highlight-attention:hover,
        .highlight-neutral:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        /* Ensure full document highlighting */
        .document-content {
          line-height: 1.7;
          font-size: 14px;
        }
        
        .document-content .highlight-favorable,
        .document-content .highlight-risky,
        .document-content .highlight-attention,
        .document-content .highlight-neutral {
          margin: 1px 0;
          display: inline;
        }
      </style>
    `;
  }

  // Convert structured text to HTML with section headers
  public formatStructuredText(structuredText: any, documentType: string, colorScheme: any): string {
    if (!structuredText || typeof structuredText === 'string') {
      return structuredText || '';
    }

    let formattedHTML = '';
    
    if (structuredText.pages) {
      structuredText.pages.forEach((page: any, pageIndex: number) => {
        if (structuredText.pages.length > 1) {
          formattedHTML += `<div class="page-header" style="
            font-size: 14px;
            font-weight: 600;
            color: ${colorScheme.primary};
            margin: 20px 0 10px 0;
            padding: 8px 0;
            border-bottom: 1px solid ${colorScheme.primary}20;
          ">Page ${pageIndex + 1}</div>`;
        }
        
        if (page.paragraphs) {
          page.paragraphs.forEach((paragraph: any, paragraphIndex: number) => {
            const isFirstParagraph = paragraphIndex === 0;
            const headerStyle = this.generateSectionHeader(
              `Section ${paragraphIndex + 1}`, 
              isFirstParagraph ? 1 : 2, 
              documentType,
              colorScheme
            );
            
            if (paragraph.text && paragraph.text.length > 50) { // Only show substantial paragraphs
              formattedHTML += `
                <div class="document-paragraph" style="margin-bottom: 16px;">
                  <div class="paragraph-content" style="
                    line-height: 1.6;
                    margin-bottom: 12px;
                    color: #374151;
                  ">${paragraph.text}</div>
                </div>
              `;
            }
          });
        }
      });
    }
    
    return formattedHTML || structuredText.toString();
  }

  // Generate beautiful section headers
  private generateSectionHeader(title: string, level: number, documentType: string, colorScheme: any): any {
    return {
      fontSize: level === 1 ? '20px' : '16px',
      color: colorScheme.primary,
      borderBottom: level === 1 ? `2px solid ${colorScheme.primary}` : `1px solid ${colorScheme.primary}40`,
      fontWeight: level === 1 ? '700' : '600',
      marginBottom: level === 1 ? '24px' : '16px',
      paddingBottom: '8px',
      marginTop: level === 1 ? '32px' : '20px'
    };
  }
}

export const highlightingEngine = new HighlightingEngine();
