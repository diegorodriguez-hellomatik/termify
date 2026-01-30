'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Terminal,
  ArrowRight,
  FolderTree,
  Code2,
  ListTodo,
  Key,
  Zap,
  RefreshCw,
  Play,
  Sparkles,
  Check,
  Github,
  Users,
  Clock,
  FileCode,
  MousePointer2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TermifyLogo } from '@/components/ui/TermifyLogo';

// ============================================================================
// HOOKS
// ============================================================================

// Intersection Observer hook for scroll animations
function useInView(options?: IntersectionObserverInit) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true);
        observer.unobserve(element);
      }
    }, { threshold: 0.1, ...options });

    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return { ref, isInView };
}

// Animated counter hook with easing
function useCountUp(end: number, duration: number = 2000, decimals: number = 0) {
  const [count, setCount] = useState(0);
  const { ref, isInView } = useInView();

  useEffect(() => {
    if (!isInView) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);

      if (decimals > 0) {
        setCount(parseFloat((easeOutQuart * end).toFixed(decimals)));
      } else {
        setCount(Math.floor(easeOutQuart * end));
      }

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [isInView, end, duration, decimals]);

  return { count, ref };
}

// ============================================================================
// COMPONENTS
// ============================================================================

// Animated background with floating orbs
function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Main gradient orbs */}
      <div
        className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[800px] rounded-full opacity-30"
        style={{
          background: 'radial-gradient(circle, hsl(var(--primary) / 0.3) 0%, transparent 70%)',
          animation: 'float 20s ease-in-out infinite',
        }}
      />
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[600px] rounded-full opacity-20"
        style={{
          background: 'radial-gradient(circle, hsl(220 70% 50% / 0.3) 0%, transparent 70%)',
          animation: 'float 25s ease-in-out infinite reverse',
        }}
      />
      <div
        className="absolute top-1/2 left-[-10%] w-[600px] h-[600px] rounded-full opacity-15"
        style={{
          background: 'radial-gradient(circle, hsl(280 70% 50% / 0.2) 0%, transparent 70%)',
          animation: 'float 30s ease-in-out infinite',
          animationDelay: '-10s',
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--foreground)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)
          `,
          backgroundSize: '100px 100px',
        }}
      />

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(0) translateX(20px); }
          75% { transform: translateY(20px) translateX(10px); }
        }
      `}</style>
    </div>
  );
}

// Terminal preview with realistic typing animation
function TerminalPreview() {
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [lines, setLines] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const terminalScript = [
    { text: '$ claude', typing: true, delay: 600 },
    { text: '\x1b[32m✓\x1b[0m Claude Code initialized', typing: false, delay: 400 },
    { text: '\x1b[34m>\x1b[0m What would you like to build today?', typing: false, delay: 300 },
    { text: '$ Create a landing page with animations', typing: true, delay: 1000 },
    { text: '\x1b[33m⠋\x1b[0m Analyzing requirements...', typing: false, delay: 500 },
    { text: '\x1b[33m⠙\x1b[0m Designing component structure...', typing: false, delay: 500 },
    { text: '\x1b[33m⠹\x1b[0m Writing React components...', typing: false, delay: 500 },
    { text: '\x1b[32m✓\x1b[0m Created src/components/Hero.tsx', typing: false, delay: 250 },
    { text: '\x1b[32m✓\x1b[0m Created src/components/Features.tsx', typing: false, delay: 250 },
    { text: '\x1b[32m✓\x1b[0m Added smooth scroll animations', typing: false, delay: 250 },
    { text: '\x1b[32m✓\x1b[0m Integrated Tailwind CSS', typing: false, delay: 250 },
    { text: '\x1b[34m>\x1b[0m Landing page ready! 5 files created.', typing: false, delay: 600 },
  ];

  useEffect(() => {
    if (currentLine >= terminalScript.length) {
      const timeout = setTimeout(() => {
        setLines([]);
        setCurrentLine(0);
        setCurrentChar(0);
      }, 5000);
      return () => clearTimeout(timeout);
    }

    const current = terminalScript[currentLine];

    if (current.typing) {
      setIsTyping(true);
      if (currentChar < current.text.length) {
        const timeout = setTimeout(() => {
          setCurrentChar(prev => prev + 1);
        }, 40 + Math.random() * 40);
        return () => clearTimeout(timeout);
      } else {
        setLines(prev => [...prev, current.text]);
        setIsTyping(false);
        const timeout = setTimeout(() => {
          setCurrentLine(prev => prev + 1);
          setCurrentChar(0);
        }, current.delay);
        return () => clearTimeout(timeout);
      }
    } else {
      const timeout = setTimeout(() => {
        setLines(prev => [...prev, current.text]);
        setCurrentLine(prev => prev + 1);
      }, current.delay);
      return () => clearTimeout(timeout);
    }
  }, [currentLine, currentChar]);

  const currentTypingText = currentLine < terminalScript.length && terminalScript[currentLine].typing
    ? terminalScript[currentLine].text.slice(0, currentChar)
    : null;

  const formatLine = (line: string) => {
    return line
      .replace(/\x1b\[32m/g, '<span class="text-green-400">')
      .replace(/\x1b\[33m/g, '<span class="text-yellow-400">')
      .replace(/\x1b\[34m/g, '<span class="text-blue-400">')
      .replace(/\x1b\[0m/g, '</span>');
  };

  return (
    <div className="relative group">
      {/* Glow effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 via-blue-500/50 to-purple-500/50 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-700" />

      <div className="relative bg-[#0d1117] rounded-2xl border border-white/10 overflow-hidden shadow-2xl transform transition-all duration-500 group-hover:scale-[1.01] group-hover:border-white/20">
        {/* Window chrome */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#161b22] border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-[0_0_6px_#ff5f56]" />
              <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-[0_0_6px_#ffbd2e]" />
              <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-[0_0_6px_#27c93f]" />
            </div>
          </div>
          <span className="text-xs text-white/40 font-mono">termify — claude-code — 80×24</span>
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-2 h-2 rounded-full transition-all duration-300",
              isTyping ? "bg-green-400 shadow-[0_0_8px_#4ade80]" : "bg-green-400/30"
            )} />
            <span className="text-[10px] text-white/30 font-mono min-w-[50px]">
              {isTyping ? 'typing...' : 'ready'}
            </span>
          </div>
        </div>

        {/* Terminal content */}
        <div className="p-5 font-mono text-[13px] leading-6 h-[340px] overflow-hidden bg-gradient-to-b from-[#0d1117] to-[#0d1117]/95">
          {lines.map((line, i) => (
            <div
              key={i}
              className="text-[#e6edf3] animate-in fade-in slide-in-from-left-2 duration-200"
              style={{ animationDelay: `${i * 20}ms` }}
              dangerouslySetInnerHTML={{ __html: formatLine(line) }}
            />
          ))}
          {currentTypingText !== null && (
            <div className="text-[#e6edf3]">
              {currentTypingText}
              <span className="inline-block w-[10px] h-[18px] bg-[#58a6ff] ml-0.5 -mb-1 animate-pulse" />
            </div>
          )}
          {!isTyping && currentLine >= terminalScript.length && (
            <div className="text-[#e6edf3]">
              $ <span className="inline-block w-[10px] h-[18px] bg-[#58a6ff] ml-0.5 -mb-1 animate-pulse" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Feature card with stagger animation
function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
}: {
  icon: React.FC<{ className?: string }>;
  title: string;
  description: string;
  index: number;
}) {
  const { ref, isInView } = useInView();

  return (
    <div
      ref={ref}
      className={cn(
        "group relative p-8 rounded-2xl transition-all duration-700 ease-out",
        "bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm",
        "border border-border/50 hover:border-primary/40",
        "hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1",
        isInView
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-12"
      )}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      {/* Hover gradient overlay */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary/20 group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-500">
          <Icon className="h-7 w-7 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-3 group-hover:text-primary transition-colors duration-300">
          {title}
        </h3>
        <p className="text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

// Stats section with animated counters
function Stats() {
  const { ref, isInView } = useInView();
  const terminals = useCountUp(50, 2000);
  const files = useCountUp(10000, 2500);
  const uptime = useCountUp(99.9, 2000, 1);
  const users = useCountUp(500, 2200);

  const stats = [
    {
      value: terminals.count,
      suffix: '+',
      label: 'Active Sessions',
      icon: Terminal,
      ref: terminals.ref
    },
    {
      value: files.count.toLocaleString(),
      suffix: '+',
      label: 'Files Edited',
      icon: FileCode,
      ref: files.ref
    },
    {
      value: uptime.count,
      suffix: '%',
      label: 'Uptime',
      icon: Clock,
      ref: uptime.ref
    },
    {
      value: users.count,
      suffix: '+',
      label: 'Developers',
      icon: Users,
      ref: users.ref
    },
  ];

  return (
    <div
      ref={ref}
      className={cn(
        "grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 py-20 transition-all duration-1000",
        isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      )}
    >
      {stats.map((stat, i) => (
        <div
          key={i}
          ref={stat.ref}
          className="text-center group cursor-default"
          style={{ transitionDelay: `${i * 100}ms` }}
        >
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-4 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
            <stat.icon className="w-5 h-5 text-primary" />
          </div>
          <div className="text-4xl lg:text-5xl font-bold text-primary mb-2 tracking-tight group-hover:scale-105 transition-transform duration-300">
            {stat.value}{stat.suffix}
          </div>
          <div className="text-sm text-muted-foreground font-medium">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// Step component for "How it works" section
function Step({
  step,
  title,
  description,
  icon: Icon,
  index,
  isLast,
}: {
  step: string;
  title: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  index: number;
  isLast?: boolean;
}) {
  const { ref, isInView } = useInView();

  return (
    <div
      ref={ref}
      className={cn(
        "relative transition-all duration-700 ease-out",
        isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      )}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      {/* Connector line */}
      {!isLast && (
        <div className={cn(
          "hidden lg:block absolute top-10 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px transition-all duration-1000 delay-500",
          isInView ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
        )} style={{ transformOrigin: 'left' }}>
          <div className="w-full h-full bg-gradient-to-r from-border via-border to-transparent" />
        </div>
      )}

      <div className="relative bg-gradient-to-br from-card/60 to-card/30 backdrop-blur-sm rounded-2xl p-8 border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-500 group">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
            <Icon className="w-7 h-7 text-primary" />
          </div>
          <span className={cn(
            "text-6xl font-bold text-primary/10 transition-all duration-500",
            isInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
          )} style={{ transitionDelay: `${index * 150 + 200}ms` }}>
            {step}
          </span>
        </div>
        <h3 className="text-xl font-semibold mb-3">{title}</h3>
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// Hero section with entrance animations
function HeroSection() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <section className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-20 pb-32">
      <div className="grid lg:grid-cols-2 gap-16 lg:gap-20 items-center">
        {/* Left content */}
        <div className={cn(
          "transition-all duration-1000 ease-out",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}>
          {/* Badge */}
          <div
            className={cn(
              "inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 transition-all duration-700 ease-out",
              mounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            )}
            style={{ transitionDelay: '100ms' }}
          >
            <Sparkles className="w-4 h-4" />
            Powered by Claude Code
          </div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-8">
            <span
              className={cn(
                "block transition-all duration-700 ease-out",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              )}
              style={{ transitionDelay: '200ms' }}
            >
              Your AI Terminal
            </span>
            <span
              className={cn(
                "block text-primary transition-all duration-700 ease-out",
                mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              )}
              style={{ transitionDelay: '300ms' }}
            >
              Workspace
            </span>
          </h1>

          {/* Description */}
          <p
            className={cn(
              "text-xl text-muted-foreground mb-10 max-w-xl leading-relaxed transition-all duration-700 ease-out",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
            style={{ transitionDelay: '400ms' }}
          >
            Run Claude Code in your browser with a VS Code-like experience.
            File explorer, code editor, task tracking — all in one place.
          </p>

          {/* CTAs */}
          <div
            className={cn(
              "flex flex-wrap items-center gap-4 mb-10 transition-all duration-700 ease-out",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
            style={{ transitionDelay: '500ms' }}
          >
            <Link
              href="/register"
              className="inline-flex items-center gap-2.5 px-8 py-4 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:bg-primary/90 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl hover:shadow-primary/25"
            >
              Start for Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="https://github.com/diegorodriguez-hellomatik/termify"
              className="inline-flex items-center gap-2.5 px-8 py-4 border border-border rounded-xl font-semibold text-lg hover:bg-muted/50 hover:border-primary/30 transition-all duration-300"
            >
              <Github className="w-5 h-5" />
              GitHub
            </Link>
          </div>

          {/* Feature badges */}
          <div
            className={cn(
              "flex flex-wrap gap-6 transition-all duration-700 ease-out",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
            style={{ transitionDelay: '600ms' }}
          >
            {['Multi-terminal', 'File Editor', 'Real-time Sync', 'API Access'].map((f, i) => (
              <span
                key={f}
                className={cn(
                  "flex items-center gap-2 text-sm text-muted-foreground transition-all duration-500",
                  mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}
                style={{ transitionDelay: `${700 + i * 100}ms` }}
              >
                <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-green-500" />
                </div>
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* Right content - Terminal */}
        <div
          className={cn(
            "relative transition-all duration-1000 ease-out",
            mounted ? "opacity-100 translate-x-0" : "opacity-0 translate-x-12"
          )}
          style={{ transitionDelay: '300ms' }}
        >
          <TerminalPreview />

          {/* Floating badge */}
          <div
            className={cn(
              "absolute -bottom-4 -left-4 bg-card border border-border rounded-xl px-4 py-3 shadow-xl transition-all duration-700",
              mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
            style={{ transitionDelay: '800ms' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Check className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium">5 files created</p>
                <p className="text-xs text-muted-foreground">Just now</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div
        className={cn(
          "absolute bottom-8 left-1/2 -translate-x-1/2 transition-all duration-1000",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        )}
        style={{ transitionDelay: '1000ms' }}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
          <MousePointer2 className="w-4 h-4 animate-bounce" />
          <span className="text-xs">Scroll to explore</span>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <AnimatedBackground />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <nav className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 group">
              <TermifyLogo size={40} className="text-foreground group-hover:scale-105 transition-transform duration-300" />
              <span className="text-xl font-bold tracking-tight">Termify</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className="px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 hover:shadow-md hover:shadow-primary/25"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <HeroSection />

      {/* Stats */}
      <section className="border-y border-border/50 bg-gradient-to-b from-muted/30 to-transparent">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <Stats />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-32">
        <div className="text-center mb-20">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6 tracking-tight">
            Everything you need to
            <span className="text-primary"> build faster</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            A complete development environment in your browser. No setup required.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            icon={Terminal}
            title="Multiple Terminals"
            description="Run multiple Claude Code sessions simultaneously. Organize with categories and drag-and-drop reordering."
            index={0}
          />
          <FeatureCard
            icon={FolderTree}
            title="File Explorer"
            description="VS Code-style file browser that updates in real-time. Navigate, preview, and manage files effortlessly."
            index={1}
          />
          <FeatureCard
            icon={Code2}
            title="Code Editor"
            description="Built-in code editor with syntax highlighting. Click any file to view and edit with instant save."
            index={2}
          />
          <FeatureCard
            icon={ListTodo}
            title="Task Tracking"
            description="See Claude's tasks in real-time. Track what's done, in progress, and pending in the sidebar."
            index={3}
          />
          <FeatureCard
            icon={Key}
            title="API Access"
            description="Full REST API with secure key management. Automate and integrate Termify with your workflows."
            index={4}
          />
          <FeatureCard
            icon={RefreshCw}
            title="Real-time Sync"
            description="Everything syncs instantly via WebSocket. File changes, terminal output, task updates — all live."
            index={5}
          />
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-border/50 bg-gradient-to-b from-muted/20 to-transparent">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-32">
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 tracking-tight">
              Get started in <span className="text-primary">seconds</span>
            </h2>
            <p className="text-xl text-muted-foreground">
              No installation. No configuration. Just code.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <Step
              step="01"
              title="Create Account"
              description="Sign up in seconds with email or OAuth. No credit card required."
              icon={Sparkles}
              index={0}
            />
            <Step
              step="02"
              title="Launch Terminal"
              description="Create a new terminal and start Claude Code with one click."
              icon={Play}
              index={1}
            />
            <Step
              step="03"
              title="Build & Ship"
              description="Use the file explorer and editor to manage your code as Claude builds."
              icon={Zap}
              index={2}
              isLast
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-32">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border border-primary/20 p-16 text-center group hover:border-primary/40 transition-all duration-500">
          {/* Animated orbs */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors duration-700" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors duration-700" />

          <div className="relative">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 tracking-tight">
              Ready to supercharge your workflow?
            </h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Join developers who are building faster with Termify.
              Start free, no credit card required.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-3 px-10 py-5 bg-primary text-primary-foreground rounded-xl font-semibold text-lg hover:bg-primary/90 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] hover:shadow-2xl hover:shadow-primary/30"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/20">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-16">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-3 group">
              <TermifyLogo size={40} className="text-foreground group-hover:scale-105 transition-transform duration-300" />
              <span className="text-xl font-bold">Termify</span>
            </div>
            <div className="flex items-center gap-8 text-sm">
              <Link href="/docs/api" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                API Docs
              </Link>
              <Link href="https://github.com/diegorodriguez-hellomatik/termify" className="text-muted-foreground hover:text-foreground transition-colors duration-200 flex items-center gap-2">
                <Github className="w-4 h-4" />
                GitHub
              </Link>
              <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                Sign In
              </Link>
              <Link href="/register" className="text-muted-foreground hover:text-foreground transition-colors duration-200">
                Get Started
              </Link>
            </div>
            <div className="text-sm text-muted-foreground">
              © 2025 Termify. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
