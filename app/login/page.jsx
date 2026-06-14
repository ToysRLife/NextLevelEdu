'use client';
import { useEffect, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const authErrorMessages = {
  CredentialsSignin: 'Invalid email or password. Please try again.',
  AccessDenied: 'Access denied. Please sign in with a permitted account.',
  OAuthAccountNotLinked: 'This account is already linked with another sign-in method.',
  default: 'Authentication failed. Please try again.',
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role) {
      if (session.user.role === 'ADMIN') {
        router.replace('/admin');
      } else if (session.user.role === 'PARENT') {
        router.replace('/parent');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [status, session, router]);

  useEffect(() => {
    const authErrorMessages = {
      CredentialsSignin: 'Invalid email or password. Please try again.',
      AccessDenied: 'Access denied. Please sign in with a permitted account.',
      OAuthAccountNotLinked: 'This account is already linked with another sign-in method.',
      default: 'Authentication failed. Please try again.',
    };
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(authErrorMessages[errorParam] ?? authErrorMessages.default);
    }
  }, [searchParams]);

  async function handleCredentials(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const res = await signIn('credentials', {
      redirect: false,
      email,
      password,
    });

    setIsSubmitting(false);

    if (res?.error) {
      setError('Invalid email or password. Please try again.');
      return;
    }

    // On success, keep the login page until session updates and redirects by role.
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 sm:px-6">
        <p className="text-slate-300">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 sm:px-6">
      <Card className="w-full max-w-lg space-y-6 border-slate-800/70 bg-slate-900/95 p-8 shadow-2xl shadow-slate-950/50">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-3xl bg-sky-500/10 text-2xl text-sky-300">
            L
          </div>
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to continue learning with your personalized student dashboard.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              Fast login
            </p>
            <Button
              type="button"
              onClick={() => signIn('google')}
              className="w-full justify-center bg-white text-slate-950 hover:bg-slate-100"
            >
              Continue with Google
            </Button>
          </div>

          <div className="relative py-2 text-center text-xs uppercase text-slate-500">
            <span className="bg-slate-900 px-3">or use email</span>
          </div>

          <form className="space-y-4" onSubmit={handleCredentials}>
            <label className="block text-sm font-medium text-slate-200">
              Email address
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Password
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </label>
            {error ? <p className="text-sm text-rose-400">{error}</p> : null}
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
          <span>Need help? </span>
          <Badge>Contact support</Badge>
        </div>
      </Card>
    </div>
  );
}
