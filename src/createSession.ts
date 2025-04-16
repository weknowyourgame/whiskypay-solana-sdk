/**
 * Creates a payment session with the specified merchant, customer and plan information
 * Includes retry logic, input validation, and advanced error handling
 * 
 * @param saasId - The merchant's unique identifier
 * @param email - Customer's email address 
 * @param plan - Subscription plan identifier
 * @param apiUrl - Optional API URL override (default: detected from window.location)
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @returns Session ID string or null if creation failed
 */
export async function createSession(
    saasId: string, 
    email: string, 
    plan: string,
    apiUrl?: string,
    maxRetries: number = 3
): Promise<string | null> {
    let attempts = 0;
    
    // Input validation
    if (!saasId || typeof saasId !== 'string') {
        console.error("Invalid merchant ID");
        return null;
    }
    
    if (!email || typeof email !== 'string' || !validateEmail(email)) {
        console.error("Invalid email address");
        return null;
    }
    
    if (!plan || typeof plan !== 'string') {
        console.error("Invalid plan");
        return null;
    }
    
    // Determine API URL - if not provided, try to detect from current location
    const baseUrl = apiUrl || (typeof window !== 'undefined' ? 
        `${window.location.protocol}//${window.location.host}` : 
        "https://pay.whiskeypeak.com");
    
    // Sanitize inputs
    const sanitizedSaasId = sanitizeInput(saasId);
    const sanitizedEmail = sanitizeInput(email);
    const sanitizedPlan = sanitizeInput(plan);
    
    while (attempts < maxRetries) {
        try {
            // Add timeout to fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            // Try both endpoints - first with /api prefix
            let res;
            try {
                res = await fetch(`${baseUrl}/api/session`, {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "X-Client-Version": "1.0.0",
                        "X-Request-ID": `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
                    },
                    body: JSON.stringify({ 
                        saasId: sanitizedSaasId, 
                        email: sanitizedEmail, 
                        plan: sanitizedPlan,
                        timestamp: Date.now()
                    }),
                    signal: controller.signal
                });
                
                // If API endpoint returns 404, try the non-API endpoint
                if (!res.ok && res.status === 404) {
                    res = await fetch(`${baseUrl}/session`, {
                        method: "POST",
                        headers: { 
                            "Content-Type": "application/json",
                            "X-Client-Version": "1.0.0",
                            "X-Request-ID": `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
                        },
                        body: JSON.stringify({ 
                            saasId: sanitizedSaasId, 
                            email: sanitizedEmail, 
                            plan: sanitizedPlan,
                            timestamp: Date.now()
                        }),
                        signal: controller.signal
                    });
                }
            } catch (error) {
                // If first attempt fails, try the non-API endpoint
                res = await fetch(`${baseUrl}/session`, {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "X-Client-Version": "1.0.0",
                        "X-Request-ID": `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
                    },
                    body: JSON.stringify({ 
                        saasId: sanitizedSaasId, 
                        email: sanitizedEmail, 
                        plan: sanitizedPlan,
                        timestamp: Date.now()
                    }),
                    signal: controller.signal
                });
            }
            
            // Clear the timeout
            clearTimeout(timeoutId);
            
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
                console.error(`Failed to create session: ${res.status} - ${errorData.message || res.statusText}`);
                
                // Retry on server errors or rate limiting
                if (res.status >= 500 || res.status === 429) {
                    attempts++;
                    if (attempts < maxRetries) {
                        // Exponential backoff with jitter
                        const backoffTime = Math.min(1000 * Math.pow(2, attempts) + Math.random() * 1000, 10000);
                        console.log(`Retrying session creation in ${Math.round(backoffTime)}ms (attempt ${attempts + 1}/${maxRetries})`);
                        await new Promise(resolve => setTimeout(resolve, backoffTime));
                        continue;
                    }
                }
                
                return null;
            }
            
            // Parse and validate response
            const data = await res.json().catch(error => {
                console.error("Error parsing session response:", error);
                return null;
            });
            
            if (!data || !data.sessionId) {
                console.error("Invalid response format - missing sessionId");
                return null;
            }
            
            return data.sessionId;
        } catch (error) {
            attempts++;
            
            // Handle timeout errors differently
            if (error instanceof DOMException && error.name === 'AbortError') {
                console.error("Session creation timed out");
            } else {
                console.error("Error creating session:", error);
            }
            
            // Retry with backoff if we have attempts left
            if (attempts < maxRetries) {
                const backoffTime = Math.min(1000 * Math.pow(2, attempts) + Math.random() * 1000, 10000);
                console.log(`Retrying session creation in ${Math.round(backoffTime)}ms (attempt ${attempts + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
                continue;
            }
            
            return null;
        }
    }
    
    return null;
}

/**
 * Validates email format
 * @param email Email address to validate
 * @returns True if email format is valid
 */
function validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
}

/**
 * Sanitizes input string to prevent injection attacks
 * @param input String to sanitize
 * @returns Sanitized string
 */
function sanitizeInput(input: string): string {
    // Basic sanitization - removes HTML/script tags and trims whitespace
    return input.replace(/<[^>]*>?/gm, '').trim();
}
