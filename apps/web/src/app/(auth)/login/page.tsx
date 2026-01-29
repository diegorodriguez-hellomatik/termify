'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Terminal, Github, AlertTriangle, Lock } from 'lucide-react';
import { signIn } from 'next-auth/react';
import { useTheme } from '@/context/ThemeContext';

export default function LoginPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setWarning('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Check if it's a rate limit error
        if (result.error.includes('Too many') || result.error.includes('locked')) {
          setError(result.error);
        } else if (result.error.includes('Warning:') || result.error.includes('attempt')) {
          setWarning(result.error);
          setError('Invalid email or password');
        } else {
          setError('Invalid email or password');
        }
      } else {
        router.push('/terminals');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = (provider: string) => {
    signIn(provider, { callbackUrl: '/terminals' });
  };

  return (
    <div
      className="slide-up"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="scale-in"
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
          borderRadius: '16px',
          border: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
          boxShadow: isDark
            ? '0 8px 32px rgba(0, 0, 0, 0.4)'
            : '0 8px 32px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          transition: 'background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
        }}
      >
        {/* Header */}
        <div style={{ padding: '32px 24px 24px', textAlign: 'center' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                backgroundColor: isDark ? '#2563eb' : '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.3s ease',
              }}
            >
              <Terminal size={32} color="#fff" />
            </div>
          </div>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: '700',
              marginBottom: '8px',
              color: isDark ? '#fff' : '#1a1a1a',
            }}
          >
            Welcome back
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: isDark ? '#888' : '#666',
            }}
          >
            Sign in to your Termify account
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '0 24px 24px' }}>
          {/* OAuth buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <button
              onClick={() => handleOAuthSignIn('github')}
              type="button"
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                backgroundColor: 'transparent',
                color: isDark ? '#fff' : '#1a1a1a',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease, border-color 0.2s ease',
              }}
            >
              <Github size={18} />
              GitHub
            </button>
            <button
              onClick={() => handleOAuthSignIn('google')}
              type="button"
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                backgroundColor: 'transparent',
                color: isDark ? '#fff' : '#1a1a1a',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease, border-color 0.2s ease',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>
          </div>

          {/* Divider */}
          <div style={{ position: 'relative', marginBottom: '24px' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  width: '100%',
                  borderTop: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                }}
              />
            </div>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <span
                style={{
                  backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
                  padding: '0 12px',
                  fontSize: '12px',
                  color: isDark ? '#666' : '#888',
                  textTransform: 'uppercase',
                }}
              >
                Or continue with
              </span>
            </div>
          </div>

          {/* Credentials form */}
          <form onSubmit={handleSubmit}>
            {/* Rate limit error (locked) */}
            {error && error.includes('Too many') && (
              <div
                className="fade-in"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px',
                  marginBottom: '16px',
                  borderRadius: '8px',
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`,
                }}
              >
                <Lock size={20} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <p style={{ fontSize: '14px', color: '#ef4444', fontWeight: '500' }}>
                    Account Temporarily Locked
                  </p>
                  <p style={{ fontSize: '13px', color: isDark ? '#f87171' : '#dc2626', marginTop: '4px' }}>
                    {error}
                  </p>
                </div>
              </div>
            )}

            {/* Regular error */}
            {error && !error.includes('Too many') && (
              <div
                className="fade-in"
                style={{
                  padding: '12px',
                  marginBottom: '16px',
                  borderRadius: '8px',
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)'}`,
                  fontSize: '14px',
                  color: '#ef4444',
                }}
              >
                {error}
              </div>
            )}

            {/* Warning about remaining attempts */}
            {warning && (
              <div
                className="fade-in"
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px',
                  marginBottom: '16px',
                  borderRadius: '8px',
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                  border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)'}`,
                }}
              >
                <AlertTriangle size={20} style={{ color: '#f59e0b', flexShrink: 0, marginTop: '2px' }} />
                <p style={{ fontSize: '13px', color: isDark ? '#fbbf24' : '#d97706' }}>
                  {warning}
                </p>
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '6px',
                  color: isDark ? '#ccc' : '#444',
                }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                  backgroundColor: isDark ? '#0a0a0a' : '#f9f9f9',
                  color: isDark ? '#fff' : '#1a1a1a',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label
                htmlFor="password"
                style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '500',
                  marginBottom: '6px',
                  color: isDark ? '#ccc' : '#444',
                }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${isDark ? '#444' : '#ddd'}`,
                  backgroundColor: isDark ? '#0a0a0a' : '#f9f9f9',
                  color: isDark ? '#fff' : '#1a1a1a',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: isDark ? '#fff' : '#1a1a1a',
                color: isDark ? '#000' : '#fff',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: '14px',
              color: isDark ? '#888' : '#666',
            }}
          >
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              style={{
                color: isDark ? '#60a5fa' : '#2563eb',
                textDecoration: 'none',
                fontWeight: '500',
              }}
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
