import { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, login } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 p-4">
        <div className="max-w-lg text-center">
          <h1 className="mb-4 text-3xl font-bold">Authentication Required</h1>
          <p className="mb-8 text-muted-foreground">
            You need to sign in to access this content. Please login with your GitHub account to continue.
          </p>
          <Button onClick={login} size="lg">
            Sign in with GitHub
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}