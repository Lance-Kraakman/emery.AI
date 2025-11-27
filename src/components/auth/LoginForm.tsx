'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Github, Mail } from 'lucide-react';

export interface LoginFormProps {
  title?: string;
  subtitle?: string;
  callbackUrl?: string;
  showOAuthProviders?: boolean;
  showEmailPassword?: boolean;
  variant?: 'platform' | 'public-app';
}

export function LoginForm({
  title = "Sign in to your account",
  subtitle = "Access your account to continue",
  callbackUrl,
  showOAuthProviders = true,
  showEmailPassword = true,
  variant = 'platform'
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        callbackUrl: callbackUrl || '/',
        redirect: true,
      });

      if (result?.error) {
        setError('Invalid email or password');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'github' | 'google') => {
    setIsLoading(true);
    await signIn(provider, { callbackUrl: callbackUrl || '/' });
  };

  const handleEmailMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await signIn('email', {
        email,
        callbackUrl: callbackUrl || '/',
        redirect: false,
      });

      if (result?.error) {
        setError('Failed to send magic link');
      } else {
        setError(null);
        // Show success message (email provider will show instruction)
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-6 p-8 bg-white rounded-lg shadow">
      <div className="text-center">
        <h2 className="text-3xl font-bold">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{subtitle}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {showOAuthProviders && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              onClick={() => handleOAuthSignIn('github')}
              disabled={isLoading}
              className="w-full"
            >
              <Github size={16} className="mr-2" />
              GitHub
            </Button>

            <Button
              variant="outline"
              onClick={() => handleOAuthSignIn('google')}
              disabled={isLoading}
              className="w-full"
            >
              <Mail size={16} className="mr-2" />
              Google
            </Button>
          </div>

          {showEmailPassword && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or continue with email</span>
              </div>
            </div>
          )}
        </>
      )}

      {showEmailPassword && (
        <form onSubmit={handleEmailMagicLink} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !email}
          >
            {isLoading ? 'Sending...' : 'Sign in with Email'}
          </Button>

          <p className="text-xs text-center text-gray-600">
            Check your email for a sign-in link
          </p>
        </form>
      )}

      {variant === 'public-app' && (
        <div className="text-center text-sm">
          <span className="text-gray-600">New to this app? </span>
          <span className="text-gray-400">
            Sign in with OAuth to create an account
          </span>
        </div>
      )}
    </div>
  );
}
