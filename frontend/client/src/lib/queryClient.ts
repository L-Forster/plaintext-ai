import { QueryClient, QueryFunction, QueryKey } from "@tanstack/react-query";

/**
 * Performs an API request with JSON headers.
 * Simplified for self-hosted version - no authentication required.
 *
 * @param method HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param url The API endpoint URL (relative or absolute)
 * @param body Optional request body for POST/PUT requests
 * @returns Promise<T> The parsed JSON response body
 * @throws Error on network error or non-OK HTTP status
 */
export async function apiRequest<T>(method: string, url: string, body?: any): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const options: RequestInit = {
    method,
    headers,
    credentials: 'include',
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      let errorMessage = `API request failed: ${response.status} ${response.statusText}`;
      try {
        // Attempt to parse error details from the response body
        const errorData = await response.json();
        errorMessage = errorData?.message || errorData?.error || errorMessage;
      } catch (e) {
        // Ignore if error body isn't valid JSON
      }
      console.error(`Error during API request to ${url}:`, errorMessage);
      const error = new Error(errorMessage) as any;
      error.status = response.status; // Attach status code to the error
      throw error;
    }

    // Check if the response has content before trying to parse JSON
    const contentType = response.headers.get("content-type");
    if (response.status === 204 || !contentType || !contentType.includes("application/json")) {
      return null as T;
    }

    // Parse the JSON response body
    const data: T = await response.json();
    return data;

  } catch (error) {
    // Log network errors or errors thrown from !response.ok block
    console.error(`API request error for ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

// Generic query function factory
export const getQueryFn = <T>(options?: {
  on401?: UnauthorizedBehavior;
}): QueryFunction<T, QueryKey> => async ({ queryKey }) => {
  const url = queryKey[0] as string;
  try {
    const data = await apiRequest<T>('GET', url);
    return data;
  } catch (error: any) {
    console.error(`[getQueryFn] Query Error (${url}):`, error);
    if (options?.on401 === "returnNull" && error.status === 401) {
      return null as T;
    }
    throw error;
  }
};

// Initialize React Query client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1 * 60 * 1000, // Cache data for 1 minute by default
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
