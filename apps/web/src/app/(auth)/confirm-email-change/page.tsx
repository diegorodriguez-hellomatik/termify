'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api';

type ConfirmState = 'confirming' | 'success' | 'error';

function ConfirmEmailChangeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<ConfirmState>('confirming');
  const [error, setError] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setState('error');
      setError('No token provided');
      return;
    }

    const confirmEmailChange = async () => {
      try {
        const response = await authApi.confirmEmailChange(token);

        if (response.success && response.data) {
          setState('success');
          setNewEmail(response.data.newEmail);
        } else {
          setState('error');
          setError(
            typeof response.error === 'string'
              ? response.error
              : 'Failed to confirm email change'
          );
        }
      } catch (err) {
        setState('error');
        setError('An unexpected error occurred');
      }
    };

    confirmEmailChange();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border rounded-lg shadow-lg p-8">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">&gt;_</span>
            </div>
          </div>

          {state === 'confirming' && (
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
              <h1 className="text-2xl font-bold">Confirming Email Change</h1>
              <p className="text-muted-foreground">
                Please wait while we confirm your new email address...
              </p>
            </div>
          )}

          {state === 'success' && (
            <div className="text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
              <h1 className="text-2xl font-bold">Email Changed!</h1>
              <p className="text-muted-foreground">
                Your email has been successfully changed to:
              </p>
              <p className="font-medium text-foreground">{newEmail}</p>
              <p className="text-sm text-muted-foreground">
                Please log in again with your new email address.
              </p>
              <Button asChild className="w-full mt-4">
                <Link href="/login">Go to Login</Link>
              </Button>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center space-y-4">
              <XCircle className="w-12 h-12 text-destructive mx-auto" />
              <h1 className="text-2xl font-bold">Confirmation Failed</h1>
              <p className="text-muted-foreground">{error}</p>
              <div className="space-y-2 pt-4">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/settings">Back to Settings</Link>
                </Button>
                <Button asChild className="w-full">
                  <Link href="/login">Go to Login</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConfirmEmailChangePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <ConfirmEmailChangeContent />
    </Suspense>
  );
}
