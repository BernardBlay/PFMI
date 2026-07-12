/**
 * Simple authentication utilities for PFMI
 * Uses localStorage mock authentication
 */

export interface MockUser {
  id: string;
  email: string;
  user_metadata: {
    role: string;
    full_name: string;
  };
}

/**
 * Check if user is authenticated (client-side only)
 */
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  
  const mockUserStr = localStorage.getItem("pfmi-mock-user");
  return !!mockUserStr;
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): MockUser | null {
  if (typeof window === "undefined") return null;
  
  const mockUserStr = localStorage.getItem("pfmi-mock-user");
  if (!mockUserStr) return null;
  
  try {
    return JSON.parse(mockUserStr);
  } catch {
    return null;
  }
}

/**
 * Logout user
 */
export function logout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("pfmi-mock-user");
}
