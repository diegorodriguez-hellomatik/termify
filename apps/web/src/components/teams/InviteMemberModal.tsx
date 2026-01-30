'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Shield, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface InviteMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (email: string, role?: 'ADMIN' | 'MEMBER') => Promise<any>;
}

export function InviteMemberModal({
  open,
  onOpenChange,
  onInvite,
}: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'MEMBER'>('MEMBER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await onInvite(email.trim(), role);
      if (result) {
        setEmail('');
        setRole('MEMBER');
        onOpenChange(false);
      } else {
        setError('Failed to invite member');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to invite member');
    } finally {
      setLoading(false);
    }
  };

  if (!open || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative bg-background border rounded-lg shadow-xl w-full max-w-md p-6 z-[101] animate-in fade-in zoom-in-95 duration-200">
        <h2 className="text-lg font-semibold mb-4">Invite Team Member</h2>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                Email Address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@example.com"
                disabled={loading}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Role
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors',
                    role === 'MEMBER'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted hover:border-muted-foreground'
                  )}
                  onClick={() => setRole('MEMBER')}
                  disabled={loading}
                >
                  <User className="h-4 w-4" />
                  <span className="text-sm font-medium">Member</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors',
                    role === 'ADMIN'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-muted hover:border-muted-foreground'
                  )}
                  onClick={() => setRole('ADMIN')}
                  disabled={loading}
                >
                  <Shield className="h-4 w-4" />
                  <span className="text-sm font-medium">Admin</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {role === 'ADMIN'
                  ? 'Admins can manage members and tasks.'
                  : 'Members can view and work on tasks.'}
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send Invite
            </Button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
