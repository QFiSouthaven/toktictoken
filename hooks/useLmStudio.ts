
import { useState, useEffect, useCallback } from 'react';

const PROXY_URL = "http://127.0.0.1:1234";

export const useLmStudio = (enabled: boolean, autoConnect: boolean) => {
  const [isConnected, setIsConnected] = useState(false);
  const [modelId, setModelId] = useState(""); 
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:1234"); // UI State (What user sees)
  const [error, setError] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    let validUrl: URL;
    try {
        validUrl = new URL(baseUrl);
    } catch (e) {
        return; 
    }

    // --- Dynamic Proxy Configuration Strategy ---
    // If the user entered a custom URL (e.g. http://localhost:5000) that is NOT the proxy,
    // we attempt to configure the Proxy to point to that new URL.
    // If configuration succeeds, we continue using the Proxy as our gateway.
    
    const isProxyAddress = validUrl.port === '1234'; // Simple check for default proxy port
    let effectiveEndpoint = baseUrl; // Default to Direct Mode

    if (!isProxyAddress) {
        try {
            // Attempt to tell Proxy to switch targets
            const configRes = await fetch(`${PROXY_URL}/config/upstream`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: baseUrl })
            });

            if (configRes.ok) {
                // If proxy accepted the config, we use the PROXY as the endpoint
                effectiveEndpoint = PROXY_URL;
                // Note: We don't update 'baseUrl' state because we want the UI 
                // to still show the user's custom URL (e.g. :5000), not flip back to :1234
            }
        } catch (e) {
            // Proxy is likely down. We will fall back to 'effectiveEndpoint = baseUrl' (Direct Connection)
            console.warn("Proxy configuration failed, falling back to direct connection.", e);
        }
    }

    const logPrefix = `[LM Studio][${effectiveEndpoint}]`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); 

      // Normalize URL
      const cleanUrl = effectiveEndpoint.replace(/\/$/, '');

      const res = await fetch(`${cleanUrl}/v1/models`, {
        method: 'GET',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (!isConnected) console.log(`${logPrefix} Connected.`);
        
        setIsConnected(true);
        setError(null);
        
        if (data?.data?.[0]?.id) {
          setModelId(data.data[0].id);
        }
      } else {
        console.warn(`${logPrefix} Error: ${res.status}`);
        setIsConnected(false);
        setError(`Server Error: ${res.status}`);
      }
    } catch (e: any) {
      setIsConnected(false);
      
      if (e.name === 'AbortError') {
        setError("Timeout: Server took too long to respond.");
      } else if (e instanceof TypeError && e.message.includes('Failed to fetch')) {
        setError(isProxyAddress 
            ? "Connection Refused. Is 'node proxy.js' running?" 
            : "Connection Refused. Check URL or CORS settings."
        );
      } else {
        setError(e.message);
      }
    }
  }, [baseUrl, isConnected]);

  useEffect(() => {
    let intervalId: any;

    if (enabled && autoConnect) {
      checkConnection();
      intervalId = setInterval(checkConnection, 5000);
    } else if (!enabled) {
      setIsConnected(false);
      setError(null);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [enabled, autoConnect, checkConnection]);
  
  return {
    isConnected,
    modelId,
    baseUrl, // Return the UI state so input field works
    setBaseUrl,
    setModelId,
    error,
    retryConnection: checkConnection
  };
};
