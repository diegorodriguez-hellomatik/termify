'use client';

import Link from 'next/link';
import { Terminal, ArrowRight, Shield, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <>
      {/* Header */}
      <header className="max-w-[1200px] mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="fade-in flex items-center gap-2">
            <Terminal className="w-8 h-8" />
            <span className="text-xl font-bold">Claude Terminal</span>
          </div>
          <div className="fade-in flex items-center gap-4" style={{ animationDelay: '0.1s' }}>
            <Link
              href="/login"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="bg-foreground text-background px-5 py-2.5 rounded-lg font-semibold hover:opacity-90 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Get Started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="max-w-[1200px] mx-auto px-4 py-20">
        <div className="max-w-[800px] mx-auto text-center">
          <h1 className="slide-up text-5xl font-bold mb-6 leading-tight">
            Interactive Claude Code
            <br />
            <span className="text-primary">in Your Browser</span>
          </h1>
          <p className="slide-up text-xl text-muted-foreground mb-8" style={{ animationDelay: '0.1s' }}>
            Run Claude Code terminals directly from your browser with full PTY
            support, session persistence, and real-time collaboration.
          </p>
          <div className="slide-up flex items-center justify-center gap-4" style={{ animationDelay: '0.2s' }}>
            <Link
              href="/register"
              className="bg-foreground text-background px-7 py-3.5 rounded-lg font-semibold flex items-center gap-2 hover:opacity-90 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              Start Free <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              className="border border-border px-7 py-3.5 rounded-lg text-foreground hover:bg-muted transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-24">
          <div className="feature-card slide-up bg-card p-6 rounded-xl border border-border transition-all hover:-translate-y-1 hover:shadow-xl" style={{ animationDelay: '0.3s' }}>
            <Terminal size={40} className="mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Full Terminal</h3>
            <p className="text-muted-foreground">
              True PTY support with xterm.js for a native terminal experience with
              colors, cursor control, and more.
            </p>
          </div>
          <div className="feature-card slide-up bg-card p-6 rounded-xl border border-border transition-all hover:-translate-y-1 hover:shadow-xl" style={{ animationDelay: '0.4s' }}>
            <Zap size={40} className="mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Real-time Streaming</h3>
            <p className="text-muted-foreground">
              WebSocket-powered streaming for instant response display as Claude
              generates output.
            </p>
          </div>
          <div className="feature-card slide-up bg-card p-6 rounded-xl border border-border transition-all hover:-translate-y-1 hover:shadow-xl" style={{ animationDelay: '0.5s' }}>
            <Shield size={40} className="mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Secure Isolation</h3>
            <p className="text-muted-foreground">
              Each terminal runs in an isolated environment with proper security
              boundaries and access control.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
