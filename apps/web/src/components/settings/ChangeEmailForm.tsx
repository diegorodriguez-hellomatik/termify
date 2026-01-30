'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, Check, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authApi } from '@/lib/api';

interface ChangeEmailFormProps {
  currentEmail: string;
  token: string | null;
}

export function ChangeEmailForm({ currentEmail, token }: ChangeEmailFormProps) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError(null);
    setSuccess(false);

    // Validate email is different
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setError('New email must be different from current email');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authApi.changeEmail(newEmail, password, token);

      if (response.success) {
        setSuccess(true);
        setNewEmail('');
        setPassword('');
      } else {
        setError(
          typeof response.error === 'string'
            ? response.error
            : 'Failed to request email change'
        );
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Current Email (read-only) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Current Email</label>
        <Input value={currentEmail} disabled className="bg-muted" />
      </div>

      {/* New Email */}
      <div className="space-y-2">
        <label className="text-sm font-medium">New Email</label>
        <Input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="Enter your new email"
          required
        />
      </div>

      {/* Password for confirmation */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Password</label>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password to confirm"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          We need your password to confirm this change
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
            <Check size={16} />
            Confirmation email sent!
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Please check your new email inbox and click the confirmation link.
          </p>
        </div>
      )}

      {/* Submit Button */}
      <Button type="submit" disabled={isLoading} className="gap-2">
        {isLoading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Mail size={16} />
            Change Email
          </>
        )}
      </Button>
    </form>
  );
}
