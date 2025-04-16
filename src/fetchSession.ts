type SessionType = {
    _id: string;
    saasId: string;
    saasName: string;
    time: string;
    email: string;
    address: string;
    logoUrl: string;
    plan: string;
    price: number;
};

/**
 * Maps API response fields to our standard SessionType format
 * Handles different field naming conventions from various API implementations
 */
function mapResponseToSessionType(data: any): SessionType | null {
    if (!data) return null;
    
    console.log("Mapping response data:", data);
    
    // Check for common response formats
    const session: Partial<SessionType> = {
        // Try different field naming conventions
        _id: data._id || data.id || data.sessionId || data.session_id || null,
        saasId: data.saasId || data.saas_id || data.merchantId || data.merchant_id || null,
        saasName: data.saasName || data.saas_name || data.merchantName || data.merchant_name || null,
        time: data.time || data.created_at || data.createdAt || data.timestamp || null,
        email: data.email || data.customerEmail || data.customer_email || null,
        address: data.address || data.walletAddress || data.wallet_address || data.merchantAddress || data.merchant_address || null,
        logoUrl: data.logoUrl || data.logo_url || data.logo || null,
        plan: data.plan || data.planName || data.plan_name || null,
        price: typeof data.price === 'number' ? data.price : 
               (typeof data.amount === 'number' ? data.amount : 
               (typeof data.planPrice === 'number' ? data.planPrice : 
               (typeof data.plan_price === 'number' ? data.plan_price : null)))
    };
    
    console.log("Mapped session data:", session);
    
    // Check if all required fields are present and valid
    const requiredFields: (keyof SessionType)[] = [
        '_id', 'saasId', 'email', 'address', 'plan', 'price'
    ];
    
    for (const field of requiredFields) {
        if (session[field] === null || session[field] === undefined) {
            console.error(`Missing required field in mapped session data: ${field}`);
            return null;
        }
    }
    
    // Ensure price is a number
    if (typeof session.price !== 'number' || session.price <= 0) {
        console.error(`Invalid price in session data: ${session.price}`);
        return null;
    }
    
    // If time is not present, generate a current timestamp
    if (!session.time) {
        session.time = new Date().toISOString();
    }
    
    // Use a default name if saasName is not present
    if (!session.saasName) {
        session.saasName = "Merchant";
    }
    
    // Use a default logo if logoUrl is not present
    if (!session.logoUrl) {
        session.logoUrl = "";
    }
    
    return session as SessionType;
}

/**
 * Fetches a payment session with retry logic, timeouts, and validation
 * @param sessionId The session ID to fetch
 * @param apiUrl Optional API URL override (default: detected from window.location)
 * @param maxRetries Maximum number of retry attempts
 * @returns Session data or null if unavailable
 */
export async function fetchSession(
    sessionId: string,
    apiUrl?: string,
    maxRetries: number = 3
): Promise<SessionType | null> {
    let attempts = 0;
    
    // Input validation
    if (!sessionId || typeof sessionId !== 'string') {
        console.error("Invalid session ID");
        return null;
    }
    
    // Sanitize sessionId to prevent injection attacks
    const sanitizedSessionId = sessionId.replace(/[^a-zA-Z0-9-_]/g, '');
    if (sanitizedSessionId !== sessionId) {
        console.error("Session ID contained invalid characters");
        return null;
    }
    
    // Determine API URL - if not provided, try to detect from current location
    const baseUrl = apiUrl || (typeof window !== 'undefined' ? 
        `${window.location.protocol}//${window.location.host}` : 
        "https://pay.whiskeypeak.com");
    
    console.log(`Fetching session ${sessionId} from ${baseUrl}`);
    
    while (attempts < maxRetries) {
        try {
            // Add timeout to fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            // Try both endpoints - first with /api prefix then without
            let res;
            let endpointUsed = '';
            
            try {
                // First try with API prefix
                endpointUsed = `${baseUrl}/api/session/${sanitizedSessionId}`;
                console.log(`Attempting to fetch from: ${endpointUsed}`);
                
                res = await fetch(endpointUsed, {
                    headers: {
                        "Accept": "application/json",
                        "X-Client-Version": "1.0.0",
                        "X-Request-ID": `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
                    },
                    signal: controller.signal
                });
                
                if (!res.ok && res.status === 404) {
                    // Fall back to non-API version
                    endpointUsed = `${baseUrl}/session/${sanitizedSessionId}`;
                    console.log(`Got 404, trying alternate endpoint: ${endpointUsed}`);
                    
                    res = await fetch(endpointUsed, {
                        headers: {
                            "Accept": "application/json",
                            "X-Client-Version": "1.0.0",
                            "X-Request-ID": `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
                        },
                        signal: controller.signal
                    });
                }
            } catch (error) {
                // If first attempt fails, try the second endpoint
                endpointUsed = `${baseUrl}/session/${sanitizedSessionId}`;
                console.log(`Error with API endpoint, trying fallback: ${endpointUsed}`);
                
                res = await fetch(endpointUsed, {
                    headers: {
                        "Accept": "application/json",
                        "X-Client-Version": "1.0.0",
                        "X-Request-ID": `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
                    },
                    signal: controller.signal
                });
            }
            
            // Clear the timeout
            clearTimeout(timeoutId);
            
            console.log(`Response from ${endpointUsed}: Status ${res.status}`);
            
            if (!res.ok) {
                if (res.status === 404) {
                    console.error("Session not found");
                    return null; // Don't retry for 404s
                }
                
                // Retry on server errors or rate limiting
                if (res.status >= 500 || res.status === 429) {
                    attempts++;
                    if (attempts < maxRetries) {
                        // Exponential backoff with jitter
                        const backoffTime = Math.min(1000 * Math.pow(2, attempts) + Math.random() * 1000, 8000);
                        console.log(`Retrying session fetch in ${Math.round(backoffTime)}ms (attempt ${attempts + 1}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, backoffTime));
                        continue;
                    }
                }
                
                console.error(`Failed to fetch session: ${res.status} ${res.statusText}`);
                return null;
            }
            
            // Parse response
            let responseData;
            try {
                responseData = await res.json();
                console.log("Raw session data received:", responseData);
            } catch (e) {
                console.error("Failed to parse session response:", e);
                return null;
            }
            
            if (!responseData) {
                console.error("Empty response from server");
                return null;
            }
            
            // Map the response to our SessionType format
            const sessionData = mapResponseToSessionType(responseData);
            
            if (!sessionData) {
                console.error("Failed to map response data to session format");
                return null;
            }
            
            return sessionData;
        } catch (error) {
            attempts++;
            
            // Handle timeout differently from other errors
            if (error instanceof DOMException && error.name === 'AbortError') {
                console.error("Session fetch timed out");
            } else {
                console.error("Error fetching session:", error);
            }
            
            // Retry with backoff if we have attempts left
            if (attempts < maxRetries) {
                const backoffTime = Math.min(1000 * Math.pow(2, attempts) + Math.random() * 1000, 8000);
                console.log(`Retrying session fetch in ${Math.round(backoffTime)}ms (attempt ${attempts + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
                continue;
            }
            
            return null;
        }
    }
    
    return null;
}
