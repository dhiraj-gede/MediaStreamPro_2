import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Files from "@/pages/Files";
import Videos from "@/pages/Videos";
import Video from "@/pages/Video";
import Jobs from "@/pages/Jobs";
import Storage from "@/pages/Storage";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { queryClient } from "./lib/queryClient";

// AuthGuard component
export function AuthGuard({ children }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return children;
}

// Login page
const Login = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center p-4">
      <div className="max-w-md space-y-6 text-center">
        <h1 className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
          Content Delivery System
        </h1>
        <p className="text-lg text-muted-foreground">
          Securely manage, process, and deliver your media content with our
          powerful platform.
        </p>
        <div className="pt-4">{/* Add login form or button here */}</div>
      </div>
    </div>
  );
};

// Protected routes component
const ProtectedRoutes = () => {
  return (
    <AuthGuard>
      <Layout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard">
            <Redirect to="/" />
          </Route>
          <Route path="/files" component={Files} />
          <Route path="/videos" component={Videos} />
          <Route path="/video/:id" component={Video} />
          <Route path="/jobs" component={Jobs} />
          <Route path="/storage" component={Storage} />
        </Switch>
      </Layout>
    </AuthGuard>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Switch>
            <Route path="/login" component={Login} />
            <Route path="/:rest*" component={ProtectedRoutes} />
          </Switch>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;