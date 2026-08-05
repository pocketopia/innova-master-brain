/**
 * =============================================================================
 * INNOVA MASTER BRAIN ENGINE - Main Application
 * =============================================================================
 * 
 * This is the main application component that demonstrates the multi-tenant
 * architecture with dynamic theming. It integrates:
 * 
 * 1. TenantProvider - Manages tenant state and CSS variable injection
 * 2. Dynamic Theming - Tailwind v4 CSS variables for instant brand switching
 * 3. Multi-Tenant UI - Components that adapt to current tenant branding
 * 4. API Integration - Communicates with Express backend via tenant headers
 * 
 * The 5 Ecosystem Tenants:
 * - MVN: Music Video Network (Rose theme)
 * - StreamShare: Social content (Amber theme)
 * - ArcHaven: Creator sanctuary (Indigo theme)
 * - HekticTV: Live broadcasting (Lime theme)
 * - Kreation: Gaming platform (Cyan theme)
 * =============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Shield, 
  Activity, 
  Zap, 
  Music, 
  Share2, 
  Cloud, 
  Gamepad2, 
  Tv, 
  Brain as BrainIcon, 
  ChevronRight,
  Monitor,
  Lock,
  Layers,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  FileSearch,
  User,
  LogOut,
  Menu,
  X,
  Radio,
  Cpu,
  Globe,
} from "lucide-react";
import { TenantProvider, useTenant, useTenantSwitcher, TenantSwitcher } from "./context/TenantProvider";

// =============================================================================
// TENANT CONFIGURATION (Client-side reference)
// =============================================================================

const TENANT_ICONS: Record<string, React.ElementType> = {
  MVN: Music,
  StreamShare: Share2,
  ArcHaven: BrainIcon,
  HekticTV: Tv,
  Kreation: Gamepad2,
};

const TENANT_COLORS: Record<string, string> = {
  MVN: "text-rose-500",
  StreamShare: "text-amber-500",
  ArcHaven: "text-indigo-500",
  HekticTV: "text-lime-500",
  Kreation: "text-cyan-500",
};

// =============================================================================
// MOCK DATA FOR DEMONSTRATION
// =============================================================================

interface MockContentItem {
  id?: string;
  title?: string;
  artist?: string;
  rotation_weight?: number;
  isrc?: string;
  duration?: number;
  quality?: string;
  privacy_token?: string;
  chapters?: Array<{ time: string; label: string }>;
  views?: number;
  quality_score?: number;
  url?: string;
  metadata?: Record<string, unknown>;
  current_show?: string;
  next_show?: string;
  schedule?: Array<{ time: string; title: string; type: string }>;
  live_viewers?: number;
  game_files?: string;
  compatibility_score?: number;
  control_mappings?: Record<string, string>;
  active_players?: number;
}

const MOCK_CONTENT: Record<string, MockContentItem[]> = {
  MVN: [
    {
      id: "mvn_video_1",
      title: "Midnight City",
      artist: "SynthWave Pro",
      rotation_weight: 5,
      isrc: "US-ABC-12-34567",
      duration: 245,
      quality: "4K",
    },
    {
      id: "mvn_video_2",
      title: "Neon Dreams",
      artist: "Electric Pulse",
      rotation_weight: 8,
      isrc: "US-DEF-34-56789",
      duration: 198,
      quality: "4K",
    },
  ],
  StreamShare: [
    {
      id: "ss_post_1",
      title: "The Smith Wedding",
      privacy_token: "ss_128bit_unique_token_xyz",
      chapters: [
        { time: "00:00", label: "Intro" },
        { time: "05:12", label: "The Vows" },
      ],
      views: 1247,
    },
  ],
  ArcHaven: [
    {
      id: "ah_film_1",
      title: "The Neon Whisper",
      quality_score: 9.2,
      url: "https://example.com/films/neon_whisper.m3u8",
      metadata: { temporal_consistency: "stable", resolution: "4K", narrative_flow: "excellent" },
    },
    {
      id: "ah_film_2",
      title: "Silicon Dreams",
      quality_score: 8.5,
      url: "https://example.com/films/silicon_dreams.m3u8",
      metadata: { temporal_consistency: "minor_flicker", resolution: "2K", narrative_flow: "good" },
    },
  ],
  HekticTV: [
    {
      current_show: "The Skate Loop",
      next_show: "Live Concert: Neon Nights",
      schedule: [
        { time: "18:00", title: "Skate Loop", type: "loop" },
        { time: "19:00", title: "Neon Nights", type: "concert" },
      ],
      live_viewers: 45231,
    },
  ],
  Kreation: [
    {
      id: "kr_game_1",
      title: "Retro Runner",
      game_files: "https://example.com/games/retro_runner/build.zip",
      compatibility_score: 95,
      control_mappings: {
        roku: "D-Pad + A Button",
        webOS: "Magic Remote + Pointer",
        web: "WASD + Space",
      },
      active_players: 12453,
    },
  ],
};

// =============================================================================
// HEADER COMPONENT
// =============================================================================

function Header() {
  const { currentTenant, tenantId, setTenant } = useTenant();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1440px] mx-auto px-8 h-20 flex items-center justify-between">
        {/* Logo */}
        <div 
          className="flex items-center gap-4 cursor-pointer" 
          onClick={() => setTenant('MVN')}
        >
          <div className="p-2 bg-[var(--tenant-primary)] rounded flex items-center justify-center pulse">
            <Zap className="w-5 h-5 text-black" />
          </div>
          <div className="leading-none">
            <h1 className="bold-display text-4xl">BRAIN<span className="text-[var(--tenant-primary)]">ENGINE</span></h1>
            <p className="brand-label mt-1">System v5.0.4-Master</p>
          </div>
        </div>
        
        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-8 text-[11px] mono uppercase tracking-[0.2em] text-white/30">
          {/* Current Tenant Indicator */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--tenant-primary)] pulse shadow-[0_0_8px_rgba(242,125,38,0.5)]" />
            <span className="text-[var(--tenant-primary)] font-bold">{currentTenant?.name || 'Unknown'}</span>
          </div>
          
          {/* System Status */}
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span className="text-emerald-400">Operational</span>
          </div>
          
          {/* Bridge Status */}
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Bridge: Secure</span>
          </div>
          
          {/* Tenant Quick Switcher */}
          <TenantSwitcher className="!gap-1" />
        </div>
        
        {/* Mobile Menu Toggle */}
        <button 
          className="md:hidden p-2 text-white/60 hover:text-white"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      
      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/10 bg-black/90 backdrop-blur-md"
          >
            <div className="px-8 py-4 space-y-4">
              <TenantSwitcher asDropdown />
              <div className="flex items-center gap-2 text-sm text-white/60">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span>System Operational</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// =============================================================================
// PLATFORM CARD COMPONENT
// =============================================================================

interface PlatformCardProps {
  tenantId: string;
  name: string;
  description: string;
  isActive: boolean;
  onClick: () => void;
}

function PlatformCard({ tenantId, name, description, isActive, onClick }: PlatformCardProps) {
  const Icon = TENANT_ICONS[tenantId] || Zap;
  const colorClass = TENANT_COLORS[tenantId] || "text-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      className={`
        group relative bg-[#111] p-10 min-h-[320px] overflow-hidden cursor-pointer
        transition-all duration-300
        ${isActive 
          ? 'border-l-4 border-[var(--tenant-primary)]' 
          : 'border-l-4 border-transparent hover:border-[var(--tenant-primary)]'}
      `}
    >
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-6">
          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-[var(--tenant-primary)] pulse' : 'bg-white/20 group-hover:bg-[var(--tenant-primary)]'} transition-colors`} />
          <span className={`mono text-[10px] uppercase tracking-widest ${isActive ? 'text-[var(--tenant-primary)]' : 'text-white/20 group-hover:text-white/60'} transition-colors`}>
            {isActive ? 'Active' : 'Standby'}
          </span>
        </div>
        
        <div className="flex items-center gap-4 mb-4">
          <Icon className={`w-8 h-8 ${colorClass}`} />
          <h3 className="text-3xl font-black italic tracking-tighter uppercase">{name}</h3>
        </div>
        
        <p className="text-white/40 text-sm leading-relaxed max-w-[80%]">{description}</p>
        
        <div className="mt-8 flex items-center justify-between">
          <span className={`brand-label ${isActive ? 'text-[var(--tenant-primary)]' : 'text-white/20 group-hover:text-[var(--tenant-primary)]'} transition-colors font-bold`}>
            Access Node
          </span>
          <ChevronRight className="w-5 h-5 text-white/10 group-hover:text-[var(--tenant-primary)] transition-all group-hover:translate-x-2" />
        </div>
      </div>

      <div className="absolute top-0 right-0 p-4 opacity-[0.02] pointer-events-none group-hover:opacity-[0.05] transition-opacity">
        <Icon className="w-48 h-48 translate-x-12 -translate-y-12" />
      </div>
    </motion.div>
  );
}

// =============================================================================
// DASHBOARD COMPONENT (Tenant-specific content view)
// =============================================================================

function Dashboard() {
  const { currentTenant, tenantId, setTenant, isTenant } = useTenant();
  const [platformData, setPlatformData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  // Fetch content when tenant changes
  useEffect(() => {
    if (tenantId) {
      setLoading(true);
      // Simulate API call with mock data
      setTimeout(() => {
        setPlatformData(MOCK_CONTENT[tenantId] || []);
        setLoading(false);
      }, 500);
    }
  }, [tenantId]);

  const tenantDescription = {
    MVN: "Artist distribution & rotation management",
    StreamShare: "Private family & wedding archives",
    ArcHaven: "Curated AI-generated cinema",
    HekticTV: "24/7 linear creator loops",
    Kreation: "Cloud gaming for smart TVs",
  };

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <p className="brand-label mb-2">Displaying</p>
          <h2 className="bold-display text-7xl uppercase text-[var(--tenant-primary)]">{currentTenant?.name}</h2>
        </div>
        <div className="flex gap-4">
          <span className="mono text-[10px] bg-white/5 border border-white/10 p-2 uppercase tracking-widest text-white/40">
            JSON Bridge Ready
          </span>
          <span className="mono text-[10px] bg-[var(--tenant-primary)]/10 border border-[var(--tenant-primary)]/20 p-2 uppercase tracking-widest text-[var(--tenant-primary)] font-bold">
            High Priority
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Sidebar */}
        <div className="lg:w-1/4 space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-[#111] border-l-4 border-[var(--tenant-primary)] p-8"
          >
            <div className="mb-8">
              <div className="brand-label mb-4">Inspecting Node</div>
              <div className="flex items-center gap-4">
                {currentTenant && (() => {
                  const Icon = TENANT_ICONS[currentTenant.id];
                  return Icon ? <Icon className={`w-8 h-8 ${TENANT_COLORS[currentTenant.id]}`} /> : null;
                })()}
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">{tenantId}</h2>
              </div>
            </div>

            <div className="space-y-6 pt-6 border-t border-white/10">
              <div className="space-y-1">
                <p className="brand-label">Description</p>
                <p className="text-sm text-white/50 leading-relaxed">
                  {tenantDescription[tenantId as keyof typeof tenantDescription] || 'Unknown tenant'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="brand-label">Cores</p>
                  <p className="mono font-bold text-white/80">8x ARMv9</p>
                </div>
                <div className="space-y-1">
                  <p className="brand-label">Edge Cache</p>
                  <p className="mono font-bold text-white/80">Active</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* AI Analysis Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-indigo-600/10 border border-indigo-500/20 p-8 rounded-2xl relative overflow-hidden"
          >
            <div className="relative z-10 text-left">
              <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-widest mb-4">
                <Sparkles className="w-4 h-4" /> The Brain (AI)
              </div>
              
              <h4 className="text-lg font-bold mb-2">Automated Quality Control</h4>
              <p className="text-white/50 text-sm mb-4">Gemini analyzes every upload for safety, metadata, and brand-specific benchmarks.</p>
              
              <button className="w-full py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold text-sm transition-colors cursor-pointer">
                Run AI Analysis
              </button>
            </div>
            <BrainIcon className="absolute -bottom-8 -right-8 w-40 h-40 text-indigo-500/10" />
          </motion.div>
        </div>

        {/* Main Content Display */}
        <div className="lg:flex-1">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 flex flex-col shadow-2xl shadow-black min-h-[600px] overflow-hidden"
          >
            <div className="border-b border-white/10 p-6 flex justify-between items-center bg-white/[0.02]">
              <h3 className="brand-label">
                <Layers className="w-4 h-4 text-[var(--tenant-primary)] inline mr-2" /> 
                Unified Platform Assets
              </h3>
            </div>

            <div className="p-8 flex-1 overflow-auto">
              {loading ? (
                <div className="grid place-items-center h-[400px]">
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-16 h-16 border-4 border-white/5 border-t-[var(--tenant-primary)] rounded-full animate-spin" />
                    <span className="mono text-xs text-white/20 uppercase tracking-[0.3em]">Decoding API Bridge...</span>
                  </div>
                </div>
              ) : Array.isArray(platformData) && platformData.length > 0 ? (
                <div className="space-y-8">
                  {platformData.map((item: MockContentItem, i: number) => (
                    <motion.div 
                      key={String(item.id)}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="group p-8 bg-black/40 border-l-4 border-transparent hover:border-[var(--tenant-primary)] transition-all"
                    >
                      <div className="flex justify-between items-start mb-8 border-b border-white/5 pb-8">
                        <div>
                          <p className="brand-label mb-2 text-[var(--tenant-primary)]">Asset ID: {item.id}</p>
                          <h4 className="bold-display text-4xl uppercase tracking-tighter group-hover:text-[var(--tenant-primary)] transition-colors">
                            {item.title}
                          </h4>
                        </div>
                        {item.quality_score && (
                          <div className="text-right">
                            <p className="brand-label mb-1">Quality</p>
                            <div className="mono text-4xl font-black">{item.quality_score}</div>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
                        {Object.entries(item).map(([key, val]) => {
                          if (['id', 'title', 'url'].includes(key)) return null;
                          if (typeof val === 'object' && val !== null) return null;
                          if (val === undefined || val === null) return null;
                          return (
                            <div key={key} className="space-y-1">
                              <p className="brand-label text-white/20">{key}</p>
                              <p className="mono text-sm text-white/70 font-bold truncate">{String(val)}</p>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="flex gap-4">
                        <button className="flex-1 py-4 bg-[#E4E3E0] text-black rounded font-black text-xs uppercase tracking-widest hover:bg-[var(--tenant-primary)] transition-colors flex items-center justify-center gap-3">
                          <Monitor className="w-4 h-4" /> Start Broadcast
                        </button>
                        <button className="w-14 h-14 border border-white/10 flex items-center justify-center group-hover:border-[var(--tenant-primary)]/30 transition-all">
                          <Lock className="w-4 h-4 text-white/30 group-hover:text-[var(--tenant-primary)]" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : platformData && !Array.isArray(platformData) ? (
                // HekticTV special display
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-black/60 p-10 border-l-4 border-[var(--tenant-primary)]"
                >
                  <div className="flex items-center gap-6 mb-12">
                    <div className="w-20 h-20 border-2 border-white/10 rounded-full flex items-center justify-center">
                      <div className="w-12 h-12 bg-[var(--tenant-primary)] rounded-full pulse" />
                    </div>
                    <div>
                      <h4 className="bold-display text-5xl uppercase italic tracking-tighter">Linear Active</h4>
                      <p className="brand-label text-[var(--tenant-primary)] mt-2">Streaming Transcoder API v2.4</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-white/5 p-6 border border-white/10">
                      <p className="brand-label mb-3">Live Feed</p>
                      <p className="mono text-2xl font-black uppercase text-[var(--tenant-primary)]">
                        {(platformData as { current_show?: string }).current_show || 'N/A'}
                      </p>
                    </div>
                    <div className="bg-white/5 p-6 border border-white/10 opacity-50">
                      <p className="brand-label mb-3">Buffer Sync</p>
                      <p className="mono text-2xl font-black uppercase">
                        {(platformData as { next_show?: string }).next_show || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4 font-mono text-[11px] text-white/30 uppercase tracking-[0.2em]">
                    <p className="text-white font-bold opacity-100 mb-6 border-b border-white/10 pb-4">Schedule Manifest log</p>
                    {((platformData as { schedule?: Array<{ time: string; title: string; type: string }> }).schedule || []).map((item, i) => (
                      <div key={i} className="flex justify-between items-center bg-white/[0.02] p-3 hover:bg-white/[0.05] transition-colors">
                        <span className="text-[var(--tenant-primary)] font-bold">{item.time}</span>
                        <span className="text-white/60 font-bold">{item.title}</span>
                        <span className="opacity-50">{item.type}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="p-20 text-center border-2 border-dashed border-white/10 flex flex-col items-center gap-6">
                  <Activity className="w-12 h-12 text-white/10" />
                  <span className="brand-label">No assets detected on platform bridge</span>
                </div>
              )}
            </div>
            
            <footer className="border-t border-white/10 p-6 bg-black/40 flex justify-between items-center mono text-[10px] text-white/20 uppercase tracking-[0.3em]">
              <div className="flex gap-8 italic">
                <span>LG webOS: OK</span>
                <span>ROKU: OK</span>
                <span>WEB_BRIDGE: OK</span>
              </div>
              <div>LATENCY: 42MS</div>
            </footer>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// HOME COMPONENT (Tenant selection)
// =============================================================================

function Home() {
  const { setTenant, tenantId } = useTenant();

  const platforms = [
    { id: "MVN", name: "Music Video Network", desc: "Artist distribution & rotation management" },
    { id: "StreamShare", name: "StreamShare", desc: "Private family & wedding archives" },
    { id: "ArcHaven", name: "ArcHaven", desc: "Curated AI-generated cinema" },
    { id: "HekticTV", name: "Hektic TV", desc: "24/7 linear creator loops" },
    { id: "Kreation", name: "Kreation", desc: "Cloud gaming for smart TVs" },
  ];

  return (
    <div className="space-y-20">
      <header className="max-w-4xl">
        <motion.h1 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bold-display text-[8rem] uppercase"
        >
          Unified <br /> Platforms.
        </motion.h1>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8 flex flex-col md:flex-row md:items-center gap-8"
        >
          <div className="brand-label border-l-2 border-[var(--tenant-primary)] pl-4 max-w-sm">
            Decentralized multi-tenant backbone powering five distribution brands through a single JSON-Bridge architecture.
          </div>
          <div className="flex gap-4">
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl min-w-[120px]">
              <p className="brand-label mb-1">Latency</p>
              <p className="mono text-xl font-bold">42ms</p>
            </div>
            <div className="p-4 bg-white/5 border border-white/10 rounded-xl min-w-[120px]">
              <p className="brand-label mb-1">Uptime</p>
              <p className="mono text-xl font-bold">99.8%</p>
            </div>
          </div>
        </motion.div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {platforms.map((platform, idx) => (
          <PlatformCard
            key={platform.id}
            tenantId={platform.id}
            name={platform.name}
            description={platform.desc}
            isActive={tenantId === platform.id}
            onClick={() => setTenant(platform.id)}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// FOOTER COMPONENT
// =============================================================================

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black py-16 mt-20">
      <div className="max-w-[1440px] mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-12">
        <div className="flex items-center gap-6">
          <Zap className="w-8 h-8 text-[var(--tenant-primary)] grayscale opacity-50" />
          <div className="bold-display text-3xl opacity-20 tracking-tighter uppercase grayscale">BRAIN ENGINE OS</div>
        </div>
        <div className="flex gap-12 text-[10px] mono font-bold uppercase tracking-[0.3em] text-white/20">
          <div className="space-y-2">
            <p className="text-white/40">Core Version</p>
            <p>v5.0.4-MASTER</p>
          </div>
          <div className="space-y-2">
            <p className="text-white/40">Architecture</p>
            <p>MULTI-TENANT-JSON</p>
          </div>
          <div className="space-y-2">
            <p className="text-white/40">Region</p>
            <p>GLOBAL-RUN-US</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// =============================================================================
// BACKGROUND GRID PATTERN
// =============================================================================

function BackgroundGrid() {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 opacity-[0.03] overflow-hidden">
      <div 
        className="absolute inset-0" 
        style={{ 
          backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }} 
      />
    </div>
  );
}

// =============================================================================
// MAIN APP CONTENT (wrapped with TenantProvider)
// =============================================================================

function AppContent() {
  const { tenantId } = useTenant();
  const [view, setView] = useState<'home' | 'dashboard'>('home');

  // Show dashboard when a tenant is selected
  useEffect(() => {
    if (tenantId && tenantId !== 'home') {
      setView('dashboard');
    } else {
      setView('home');
    }
  }, [tenantId]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#E4E3E0] font-sans selection:bg-[var(--tenant-primary)]/30">
      <BackgroundGrid />
      <Header />
      
      <main className="max-w-[1440px] mx-auto px-8 py-12">
        {view === 'home' ? <Home /> : <Dashboard />}
      </main>
      
      <Footer />
    </div>
  );
}

// =============================================================================
// ROOT APP COMPONENT
// =============================================================================

/**
 * Main App component wrapped with TenantProvider
 * 
 * The TenantProvider:
 * 1. Manages current tenant state
 * 2. Injects CSS variables for dynamic theming
 * 3. Persists tenant selection to localStorage
 * 4. Provides tenant context to all child components
 */
export default function App() {
  return (
    <TenantProvider defaultTenant="MVN" persistTenant={true}>
      <AppContent />
    </TenantProvider>
  );
}