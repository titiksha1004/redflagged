// Config import for service worker
importScripts('config.js');

// Service worker config
const API_BASE_URL = 'https://api.redflagged-hackmit.vercel.app';
const API_FALLBACK_URL = 'http://localhost:8000'; // Only for development
const ALLOW_HTTP_LOCALHOST = false; // Set to true only for local development

// Get appropriate API URL
function getApiUrl() {
  const isDev = chrome.runtime.getManifest().version.includes('dev');
  if (isDev && ALLOW_HTTP_LOCALHOST) {
    return API_FALLBACK_URL;
  }
  return API_BASE_URL;
}

// Validate URL security
function isSecureUrl(url) {
  try {
    const parsed = new URL(url);
    
    // Allow localhost only in development
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      const isDev = chrome.runtime.getManifest().version.includes('dev');
      return isDev && ALLOW_HTTP_LOCALHOST;
    }
    
    // Require HTTPS for all other domains
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'ANALYZE_CONTRACT') {
    analyzeContract(request.text)
      .then(sendResponse)
      .catch(error => {
        console.error('Error analyzing contract:', error);
        sendResponse({ error: error.message });
      });
    return true; // Keep the message channel open for async response
  }
});

// Function to analyze contract text
async function analyzeContract(text) {
  const apiUrl = getApiUrl();
  const fullUrl = `${apiUrl}/api/analyze`;
  
  // Validate URL security
  if (!isSecureUrl(fullUrl)) {
    throw new Error('Insecure API endpoint detected');
  }
  
  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      text,
      source_url: 'chrome-extension'
    })
  });

  if (!response.ok) {
    throw new Error(`Backend API response not OK: ${response.status}`);
  }

  return response.json();
}

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('redflagged extension installed');
  
  // Log security config
  console.log('API Configuration:', {
    baseUrl: API_BASE_URL,
    currentUrl: getApiUrl(),
    securityValidation: 'enabled'
  });
});