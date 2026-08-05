/**
 * =============================================================================
 * INNOVA TENANT PROVIDER - React 19 Context for Multi-Tenant Theming
 * =============================================================================
 * 
 * This provider manages the multi-tenant state and dynamically swaps visual
 * branding using Tailwind v4's CSS variable system (@theme).
 * 
 * When the user navigates from StreamShare to Kreation, the underlying React
 * components remain the same, but the UI instantly injects Kreation's specific
 * color palette and typography using CSS variables.
 * 
 * Architecture:
 * - TenantContext: Provides tenant state to all descendants
 * - TenantProvider: Manages tenant switching and CSS variable injection
 * - useTenant: Hook for accessing tenant state in components
 * 
 * CSS Variables Injected:
 * - --tenant-primary: Primary brand color
 * - --tenant-secondary: Secondary brand color
 * - --tenant-accent: Accent/highlight color
 * - --tenant-font-family: Brand-specific typography
 * - --tenant-border-radius: Component border radius
 * =============================================================================
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';

// =============================================================================
// TENANT TYPE DEFINITIONS
// =============================================================================

/**
 * Tenant branding configuration
 * Matches the server-side TenantConfig.branding structure
 */
export interface TenantBranding {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  borderRadius: string;
}

/**
 * Complete tenant configuration
 */
export interface Tenant {
  id: string;
  name: string;
  description: string;
  branding: TenantBranding;
}

/**
 * Known tenant definitions
 * In production, this would be fetched from the API
 */
export const TENANTS: Record<string, Tenant> = {
  MVN: {
    id: 'MVN',
    name: 'Music Video Network',
    description: 'Music and premium video routing',
    branding: {
      primaryColor: '#F43F5E',    // Rose-500
      secondaryColor: '#E11D48',  // Rose-600
      accentColor: '#FB7185',     // Rose-400
      fontFamily: 'Inter, sans-serif',
      borderRadius: '0.5rem',
    },
  },
  StreamShare: {
    id: 'StreamShare',
    name: 'StreamShare',
    description: 'Decentralized social content and short-form media',
    branding: {
      primaryColor: '#F59E0B',    // Amber-500
      secondaryColor: '#D97706',  // Amber-600
      accentColor: '#FBBF24',     // Amber-400
      fontFamily: 'Inter, sans-serif',
      borderRadius: '0.75rem',
    },
  },
  ArcHaven: {
    id: 'ArcHaven',
    name: 'ArcHaven',
    description: 'Exclusive creator content and sanctuary media',
    branding: {
      primaryColor: '#6366F1',    // Indigo-500
      secondaryColor: '#4F46E5',  // Indigo-600
      accentColor: '#818CF8',     // Indigo-400
      fontFamily: 'Inter, sans-serif',
      borderRadius: '1rem',
    },
  },
  HekticTV: {
    id: 'HekticTV',
    name: 'Hektic TV',
    description: 'Live broadcasting and high-bandwidth streaming',
    branding: {
      primaryColor: '#84CC16',    // Lime-500
      secondaryColor: '#65A30D',  // Lime-600
      accentColor: '#A3E635',     // Lime-400
      fontFamily: 'JetBrains Mono, monospace',
      borderRadius: '0.25rem',
    },
  },
  Kreation: {
    id: 'Kreation',
    name: 'Kreation',
    description: 'Interactive, high-performance gaming and world-building platform',
    branding: {
      primaryColor: '#06B6D4',    // Cyan-500
      secondaryColor: '#0891B2',  // Cyan-600
      accentColor: '#22D3EE',     // Cyan-400
      fontFamily: 'JetBrains Mono, monospace',
      borderRadius: '0.375rem',
    },
  },
};

/**
 * List of all tenant IDs for iteration
 */
export const TENANT_IDS = Object.keys(TENANTS);

// =============================================================================
// CONTEXT TYPE DEFINITIONS
// =============================================================================

/**
 * Tenant context state shape
 */
interface TenantContextType {
  /** Current active tenant */
  currentTenant: Tenant | null;
  
  /** Tenant ID string */
  tenantId: string | null;
  
  /** Switch to a different tenant */
  setTenant: (tenantId: string) => void;
  
  /** Get tenant headers for API requests */
  getTenantHeaders: () => Record<string, string>;
  
  /** Check if a specific tenant is active */
  isTenant: (tenantId: string) => boolean;
  
  /** All available tenants */
  availableTenants: Tenant[];
  
  /** Whether the tenant has been loaded */
  isLoaded: boolean;
}

// =============================================================================
// CONTEXT CREATION
// =============================================================================

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// =============================================================================
// PROVIDER PROPS
// =============================================================================

interface TenantProviderProps {
  children: ReactNode;
  /** Default tenant to use if none specified */
  defaultTenant?: string;
  /** Whether to persist tenant selection in localStorage */
  persistTenant?: boolean;
}

// =============================================================================
// TENANT PROVIDER COMPONENT
// =============================================================================

/**
 * TenantProvider - Multi-tenant context provider with dynamic theming
 * 
 * Features:
 * - Injects CSS variables for dynamic theming
 * - Persists tenant selection to localStorage
 * - Provides tenant-aware API headers
 * - Supports tenant switching with smooth transitions
 * 
 * @param props - Provider configuration
 */
export function TenantProvider({ 
  children, 
  defaultTenant = 'MVN', 
  persistTenant = true 
}: TenantProviderProps) {
  // State for current tenant
  const [tenantId, setTenantIdState] = useState<string | null>(() => {
    // Try to restore from localStorage
    if (persistTenant) {
      const saved = localStorage.getItem('innova-tenant');
      if (saved && TENANTS[saved]) {
        return saved;
      }
    }
    // Check URL hash for tenant
    const hashTenant = window.location.hash.replace('#/', '');
    if (hashTenant && TENANTS[hashTenant]) {
      return hashTenant;
    }
    return defaultTenant;
  });

  const [isLoaded, setIsLoaded] = useState(false);

  // Get current tenant object
  const currentTenant = useMemo(() => {
    return tenantId ? TENANTS[tenantId] || null : null;
  }, [tenantId]);

  // Apply CSS variables when tenant changes
  useEffect(() => {
    if (!currentTenant) return;

    const { branding } = currentTenant;
    const root = document.documentElement;

    // Set CSS variables for Tailwind v4 dynamic theming
    // These variables are used by the @theme directive in index.css
    root.style.setProperty('--tenant-primary', branding.primaryColor);
    root.style.setProperty('--tenant-secondary', branding.secondaryColor);
    root.style.setProperty('--tenant-accent', branding.accentColor);
    root.style.setProperty('--tenant-font-family', branding.fontFamily);
    root.style.setProperty('--tenant-border-radius', branding.borderRadius);

    // Set data attribute for CSS selectors
    root.setAttribute('data-tenant', currentTenant.id);
    root.setAttribute('data-tenant-name', currentTenant.name.toLowerCase().replace(/\s+/g, '-'));

    // Add transition for smooth theme switching
    root.style.transition = '--tenant-primary 0.3s ease, --tenant-secondary 0.3s ease, --tenant-accent 0.3s ease';

    console.log(`[TENANT] Switched to ${currentTenant.name} (${currentTenant.id})`);
    setIsLoaded(true);
  }, [currentTenant]);

  // Persist tenant selection
  useEffect(() => {
    if (persistTenant && tenantId) {
      localStorage.setItem('innova-tenant', tenantId);
    }
  }, [tenantId, persistTenant]);

  // Handle tenant switching
  const setTenant = useCallback((newTenantId: string) => {
    if (!TENANTS[newTenantId]) {
      console.warn(`[TENANT] Unknown tenant: ${newTenantId}`);
      return;
    }
    
    setTenantIdState(newTenantId);
    
    // Update URL hash for deep linking
    window.location.hash = `#/${newTenantId}`;
  }, []);

  // Generate headers for API requests
  const getTenantHeaders = useCallback((): Record<string, string> => {
    if (!tenantId) return {};
    return {
      'x-tenant-id': tenantId,
    };
  }, [tenantId]);

  // Check if specific tenant is active
  const isTenant = useCallback((checkTenantId: string): boolean => {
    return tenantId === checkTenantId;
  }, [tenantId]);

  // Get all available tenants
  const availableTenants = useMemo((): Tenant[] => {
    return Object.values(TENANTS);
  }, []);

  // Context value memoized for performance
  const contextValue = useMemo((): TenantContextType => ({
    currentTenant,
    tenantId,
    setTenant,
    getTenantHeaders,
    isTenant,
    availableTenants,
    isLoaded,
  }), [currentTenant, tenantId, setTenant, getTenantHeaders, isTenant, availableTenants, isLoaded]);

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  );
}

// =============================================================================
// CUSTOM HOOK: useTenant
// =============================================================================

/**
 * useTenant - Access tenant context from any component
 * 
 * Must be used within a TenantProvider.
 * 
 * @returns Tenant context value
 * @throws Error if used outside TenantProvider
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { currentTenant, setTenant, isTenant } = useTenant();
 *   
 *   return (
 *     <div>
 *       <h1>{currentTenant?.name}</h1>
 *       <button onClick={() => setTenant('Kreation')}>
 *         Switch to Kreation
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  
  return context;
}

// =============================================================================
// CUSTOM HOOK: useTenantBranding
// =============================================================================

/**
 * useTenantBranding - Access current tenant's branding values
 * 
 * Convenience hook that returns just the branding configuration.
 * 
 * @returns Current tenant branding or null
 */
export function useTenantBranding(): TenantBranding | null {
  const { currentTenant } = useTenant();
  return currentTenant?.branding || null;
}

// =============================================================================
// CUSTOM HOOK: useTenantSwitcher
// =============================================================================

/**
 * useTenantSwitcher - Hook for building tenant switcher UI
 * 
 * Provides utilities for switching between tenants with validation.
 * 
 * @returns Tenant switching utilities
 */
export function useTenantSwitcher() {
  const { tenantId, setTenant, availableTenants, isTenant, currentTenant } = useTenant();

  // Get next tenant in the list (for cycling)
  const getNextTenant = useCallback((): string => {
    const currentIndex = TENANT_IDS.indexOf(tenantId || '');
    const nextIndex = (currentIndex + 1) % TENANT_IDS.length;
    return TENANT_IDS[nextIndex];
  }, [tenantId]);

  // Cycle to next tenant
  const cycleTenant = useCallback(() => {
    setTenant(getNextTenant());
  }, [setTenant, getNextTenant]);

  // Check if can switch to a tenant
  const canSwitchTo = useCallback((targetTenant: string): boolean => {
    return !!TENANTS[targetTenant];
  }, []);

  return {
    currentTenant,
    tenantId,
    setTenant,
    isTenant,
    availableTenants,
    getNextTenant,
    cycleTenant,
    canSwitchTo,
  };
}

// =============================================================================
// COMPONENT: TenantSwitcher
// =============================================================================

/**
 * TenantSwitcher - Pre-built UI component for switching tenants
 * 
 * Renders a dropdown or button group for selecting tenants.
 */
export interface TenantSwitcherProps {
  /** Render as dropdown (true) or button group (false) */
  asDropdown?: boolean;
  /** Custom className */
  className?: string;
  /** Show tenant descriptions */
  showDescriptions?: boolean;
}

export function TenantSwitcher({ 
  asDropdown = false, 
  className = '', 
  showDescriptions = false 
}: TenantSwitcherProps) {
  const { tenantId, setTenant, isTenant, availableTenants } = useTenantSwitcher();

  if (asDropdown) {
    return (
      <select
        value={tenantId || ''}
        onChange={(e) => setTenant(e.target.value)}
        className={`tenant-switcher-dropdown ${className}`}
        aria-label="Select tenant platform"
      >
        {availableTenants.map((tenant) => (
          <option key={tenant.id} value={tenant.id}>
            {tenant.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className={`tenant-switcher-buttons flex gap-2 ${className}`} role="group" aria-label="Tenant platforms">
      {availableTenants.map((tenant) => (
        <button
          key={tenant.id}
          onClick={() => setTenant(tenant.id)}
          className={`
            tenant-switcher-btn px-4 py-2 rounded font-medium transition-all
            ${isTenant(tenant.id) 
              ? 'bg-[var(--tenant-primary)] text-white' 
              : 'bg-white/10 text-white/60 hover:bg-white/20'}
          `}
          aria-pressed={isTenant(tenant.id)}
          title={tenant.description}
        >
          {tenant.name}
        </button>
      ))}
    </div>
  );
}

export default TenantProvider;