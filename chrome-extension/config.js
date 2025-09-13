// Extension config
const CONFIG = {
  // API Endpoints - Using same Vercel deployment for frontend/backend
  API_BASE_URL: 'https://fineprint.vercel.app', // Your Vercel deployment handles both frontend and API
  API_FALLBACK_URL: 'http://localhost:8000', // Development fallback (only for local dev)
  
  // Frontend URLs
  FRONTEND_URL: 'https://fineprint.vercel.app',
  
  // Groq AI setup
  GROQ_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
  GROQ_API_KEY: '', // Set via Chrome storage API or extension options
  
  // Security
  ALLOW_HTTP_LOCALHOST: false, // Set to true only for local development
  REQUIRE_HTTPS: true,
  
  // Rate Limiting
  MAX_REQUESTS_PER_MINUTE: 10,
  
  // Content Security
  ALLOWED_DOMAINS: [
    'docusign.com',
    'adobe.com', 
    'legalzoom.com',
    'rocket-lawyer.com',
    'lawdepot.com',
    'nolo.com',
    'findlaw.com',
    'justia.com',
    'fineprint.vercel.app'  // Allow analysis of our own site
  ]
};

// Environment detection
const isDevelopment = () => {
  return chrome?.runtime?.getManifest?.()?.version?.includes('dev') || 
         location.hostname === 'localhost';
};

// Get secure API URL
const getApiUrl = () => {
  if (isDevelopment() && CONFIG.ALLOW_HTTP_LOCALHOST) {
    return CONFIG.API_FALLBACK_URL;
  }
  return CONFIG.API_BASE_URL;
};

// Validate URL security
const isSecureUrl = (url) => {
  if (!url) return false;
  
  try {
    const parsed = new URL(url);
    
    // Allow localhost only in development
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      return isDevelopment() && CONFIG.ALLOW_HTTP_LOCALHOST;
    }
    
    // Require HTTPS for all other domains
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

// Check if domain is allowed for analysis
const isDomainAllowed = (url) => {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return CONFIG.ALLOWED_DOMAINS.some(domain => 
      hostname.includes(domain) || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
};

// Export config
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, getApiUrl, isSecureUrl, isDomainAllowed, isDevelopment };
} else {
  window.FineprintConfig = { CONFIG, getApiUrl, isSecureUrl, isDomainAllowed, isDevelopment };
} 