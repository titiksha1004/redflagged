"""
Dynamic Document Analysis API
Replaces the old DeBERTa/Legal-BERT approach with Claude API integration
"""

from fastapi import FastAPI, HTTPException, Depends, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
import asyncio
import time
import logging
import re
from datetime import datetime
import anthropic
import os
from pathlib import Path
import PyPDF2
import docx
from io import BytesIO

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Anthropic client
anthropic_client = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY")
)

# Pydantic models
class DocumentHighlight(BaseModel):
    start: int
    end: int
    type: str = Field(..., description="favorable, risky, attention, or neutral")
    confidence: float = Field(..., ge=0.0, le=1.0)
    reason: str
    category: str

class DocumentIssue(BaseModel):
    severity: str = Field(..., description="critical, warning, or info")
    title: str
    description: str
    location: float = Field(..., ge=0.0, le=100.0)
    visual_priority: int = Field(..., ge=1, le=10)
    action_required: bool
    compliance_issue: bool
    icon: str
    color: str

class AnalysisSummary(BaseModel):
    overall_risk: str = Field(..., description="low, medium, or high")
    key_points: List[str]
    recommendations: List[str]
    word_count: int
    processing_time: int

class VisualConfig(BaseModel):
    color_scheme: Dict[str, Any]
    layout: Dict[str, Any]

class DynamicAnalysisResponse(BaseModel):
    structured_text: str
    document_type: str
    highlights: List[DocumentHighlight]
    issues: List[DocumentIssue]
    summary: AnalysisSummary
    visual_config: VisualConfig

class AnalyzeRequest(BaseModel):
    text: str = Field(..., max_length=500000)
    filename: Optional[str] = None
    document_type: Optional[str] = None

# Document type detection patterns
DOCUMENT_TYPE_PATTERNS = {
    'legal_agreement': r'agreement|contract|terms|parties|whereas|hereby|shall|party|clause|provision',
    'financial_report': r'revenue|profit|financial|quarter|fiscal|earnings|balance|income|cash flow',
    'policy_document': r'policy|procedure|guidelines|compliance|standard|regulation|requirement',
    'technical_spec': r'specification|requirements|architecture|design|implementation|technical|system',
    'employment_contract': r'employment|employee|employer|salary|benefits|termination|duties|responsibilities',
    'lease_agreement': r'lease|rental|tenant|landlord|property|premises|rent|security deposit'
}

# Color schemes for different document types
DOCUMENT_COLOR_SCHEMES = {
    'legal_agreement': {
        'primary': '#4f46e5',
        'gradient': 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
        'favorable': '#10b981',
        'risky': '#ef4444',
        'attention': '#f59e0b',
        'neutral': '#64748b'
    },
    'financial_report': {
        'primary': '#0891b2',
        'gradient': 'linear-gradient(135deg, #0891b2 0%, #1e40af 100%)',
        'favorable': '#059669',
        'risky': '#dc2626',
        'attention': '#d97706',
        'neutral': '#6b7280'
    },
    'employment_contract': {
        'primary': '#be185d',
        'gradient': 'linear-gradient(135deg, #be185d 0%, #c2410c 100%)',
        'favorable': '#16a34a',
        'risky': '#dc2626',
        'attention': '#d97706',
        'neutral': '#6b7280'
    }
}

class DynamicDocumentAnalyzer:
    """Main analyzer class using Claude API"""
    
    def __init__(self):
        self.client = anthropic_client
    
    def detect_document_type(self, text: str, filename: str = "") -> str:
        """Detect document type using pattern matching"""
        scores = {}
        
        for doc_type, pattern in DOCUMENT_TYPE_PATTERNS.items():
            matches = len(re.findall(pattern, text, re.IGNORECASE))
            scores[doc_type] = matches
            
            # Boost score if filename suggests type
            if filename and doc_type.replace('_', '') in filename.lower():
                scores[doc_type] += 5
        
        # Return type with highest score
        best_type = max(scores, key=scores.get) if scores else 'legal_agreement'
        return best_type
    
    def generate_color_scheme(self, document_type: str, risk_level: str) -> dict:
        """Generate color scheme for document type"""
        base_scheme = DOCUMENT_COLOR_SCHEMES.get(document_type, DOCUMENT_COLOR_SCHEMES['legal_agreement'])
        
        # Adjust colors based on risk level
        if risk_level == 'high':
            return {
                **base_scheme,
                'primary': '#dc2626',
                'gradient': 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)'
            }
        
        return base_scheme
    
    def generate_layout(self, word_count: int, highlights_count: int) -> dict:
        """Generate dynamic layout configuration"""
        complexity = 0
        
        # Factor in document length
        if word_count > 5000:
            complexity += 0.3
        if word_count > 10000:
            complexity += 0.2
        
        # Factor in highlights
        if highlights_count > 50:
            complexity += 0.2
        
        complexity = min(complexity, 1.0)
        
        return {
            'sidebarWidth': '320px' if complexity > 0.7 else '280px',
            'mainContentCols': 2 if complexity > 0.8 else 1,
            'showMiniMap': word_count > 3000,
            'navigationStyle': 'detailed' if complexity > 0.6 else 'simple',
            'highlightDensity': 'compact' if highlights_count > 50 else 'spacious'
        }
    
    async def analyze_document(self, text: str, document_type: str, filename: str = "") -> DynamicAnalysisResponse:
        """Main analysis method using Claude"""
        start_time = time.time()
        
        analysis_prompt = f"""
Analyze this {document_type.replace('_', ' ')} document and return a JSON response with the following structure:

{{
  "structured_text": "Text broken into proper paragraphs and sections with preserved formatting",
  "highlights": [
    {{
      "start": 0,
      "end": 50,
      "type": "favorable|risky|attention|neutral",
      "confidence": 0.92,
      "reason": "Detailed explanation of why this section is highlighted",
      "category": "Category name (e.g., 'Client Protection', 'Payment Terms')"
    }}
  ],
  "issues": [
    {{
      "severity": "critical|warning|info",
      "title": "Brief descriptive title",
      "description": "One sentence explanation",
      "location": 75,
      "visual_priority": 10,
      "action_required": true,
      "compliance_issue": true,
      "icon": "alert-triangle",
      "color": "#dc2626"
    }}
  ],
  "summary": {{
    "overall_risk": "low|medium|high",
    "key_points": ["Point 1", "Point 2"],
    "recommendations": ["Recommendation 1", "Recommendation 2"],
    "word_count": {len(text.split())}
  }}
}}

Focus on:
1. Identifying favorable clauses (green highlights)
2. Spotting risky or concerning sections (red highlights) 
3. Noting items requiring attention (yellow highlights)
4. Providing actionable insights and recommendations
5. Detecting compliance issues and legal risks

Document text: {text[:15000]}
"""

        try:
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: self.client.messages.create(
                    model='claude-3-5-sonnet-20241022',
                    max_tokens=4000,
                    temperature=0.1,
                    messages=[{
                        'role': 'user',
                        'content': analysis_prompt
                    }]
                )
            )
            
            response_text = response.content[0].text if response.content else ""
            
            try:
                # Parse JSON response
                import json
                analysis_data = json.loads(response_text)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse Claude response as JSON: {response_text[:500]}")
                analysis_data = self._generate_fallback_analysis(text, document_type)
            
            processing_time = int((time.time() - start_time) * 1000)
            word_count = len(text.split())
            
            # Generate visual configuration
            color_scheme = self.generate_color_scheme(
                document_type, 
                analysis_data.get('summary', {}).get('overall_risk', 'medium')
            )
            layout = self.generate_layout(word_count, len(analysis_data.get('highlights', [])))
            
            # Construct response
            return DynamicAnalysisResponse(
                structured_text=analysis_data.get('structured_text', text),
                document_type=document_type,
                highlights=[DocumentHighlight(**h) for h in analysis_data.get('highlights', [])],
                issues=[DocumentIssue(**i) for i in analysis_data.get('issues', [])],
                summary=AnalysisSummary(
                    **analysis_data.get('summary', {}),
                    processing_time=processing_time
                ),
                visual_config=VisualConfig(
                    color_scheme=color_scheme,
                    layout=layout
                )
            )
            
        except Exception as e:
            logger.error(f"Error analyzing document with Claude: {e}")
            
            # Fallback analysis
            fallback_data = self._generate_fallback_analysis(text, document_type)
            processing_time = int((time.time() - start_time) * 1000)
            
            return DynamicAnalysisResponse(
                structured_text=text,
                document_type=document_type,
                highlights=[],
                issues=[],
                summary=AnalysisSummary(
                    overall_risk='medium',
                    key_points=[],
                    recommendations=[],
                    word_count=len(text.split()),
                    processing_time=processing_time
                ),
                visual_config=VisualConfig(
                    color_scheme=self.generate_color_scheme(document_type, 'medium'),
                    layout=self.generate_layout(len(text.split()), 0)
                )
            )
    
    def _generate_fallback_analysis(self, text: str, document_type: str) -> dict:
        """Pattern-based fallback analysis"""
        risk_patterns = [
            {'pattern': r'automatic renewal|auto-renew', 'type': 'risky', 'reason': 'Automatic renewal clause'},
            {'pattern': r'non-refundable|no refund', 'type': 'risky', 'reason': 'Non-refundable terms'},
            {'pattern': r'indemnif|hold harmless', 'type': 'attention', 'reason': 'Indemnification clause'},
            {'pattern': r'force majeure', 'type': 'neutral', 'reason': 'Force majeure provision'},
            {'pattern': r'cancellation|terminate', 'type': 'attention', 'reason': 'Termination terms'}
        ]
        
        highlights = []
        for pattern_info in risk_patterns:
            matches = list(re.finditer(pattern_info['pattern'], text, re.IGNORECASE))
            for match in matches:
                highlights.append({
                    'start': match.start(),
                    'end': match.end(),
                    'type': pattern_info['type'],
                    'confidence': 0.7,
                    'reason': pattern_info['reason'],
                    'category': 'Pattern Match'
                })
        
        issues = []
        if any(h['type'] == 'risky' for h in highlights):
            issues.append({
                'severity': 'warning',
                'title': 'Potentially Risky Clauses Detected',
                'description': 'Found clauses that may be unfavorable to you.',
                'location': 50.0,
                'visual_priority': 8,
                'action_required': True,
                'compliance_issue': False,
                'icon': 'alert-triangle',
                'color': '#f59e0b'
            })
        
        return {
            'structured_text': text,
            'highlights': highlights,
            'issues': issues,
            'summary': {
                'overall_risk': 'medium',
                'key_points': ['Document analyzed using pattern matching'],
                'recommendations': ['Consider manual review for complete analysis'],
                'word_count': len(text.split())
            }
        }

# Initialize analyzer
analyzer = DynamicDocumentAnalyzer()

# FastAPI app
app = FastAPI(title="Dynamic Document Analyzer API", version="2.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/dynamic-analyze", response_model=DynamicAnalysisResponse)
async def analyze_document_endpoint(request: AnalyzeRequest):
    """Enhanced document analysis endpoint"""
    try:
        # Detect document type if not provided
        document_type = request.document_type
        if not document_type:
            document_type = analyzer.detect_document_type(request.text, request.filename or "")
        
        logger.info(f"Analyzing {document_type} document with {len(request.text.split())} words")
        
        # Perform analysis
        result = await analyzer.analyze_document(
            request.text, 
            document_type, 
            request.filename or ""
        )
        
        logger.info(f"Analysis completed in {result.summary.processing_time}ms")
        return result
        
    except Exception as e:
        logger.error(f"Error in dynamic analysis endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

@app.post("/api/analyze-file")
async def analyze_file_endpoint(file: UploadFile = File(...)):
    """File upload and analysis endpoint"""
    try:
        # Read file content
        content = await file.read()
        
        # Extract text based on file type
        if file.content_type == 'application/pdf':
            text = extract_pdf_text(content)
        elif file.content_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']:
            text = extract_docx_text(content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file type")
        
        # Analyze document
        request = AnalyzeRequest(text=text, filename=file.filename)
        return await analyze_document_endpoint(request)
        
    except Exception as e:
        logger.error(f"Error in file analysis endpoint: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"File analysis failed: {str(e)}"
        )

def extract_pdf_text(content: bytes) -> str:
    """Extract text from PDF content"""
    try:
        pdf_file = BytesIO(content)
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        
        return text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract PDF text: {str(e)}")

def extract_docx_text(content: bytes) -> str:
    """Extract text from DOCX content"""
    try:
        docx_file = BytesIO(content)
        doc = docx.Document(docx_file)
        text = ""
        
        for paragraph in doc.paragraphs:
            text += paragraph.text + "\n"
        
        return text
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to extract DOCX text: {str(e)}")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0",
        "analyzer": "claude-3.5-sonnet"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
