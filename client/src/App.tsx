import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
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
import { AuthProvider } from "./hooks/useAuth";
import { AuthGuard } from "./components/AuthGuard";

// Login page component
const Login = () => {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center p-4">
      <div className="max-w-md space-y-6 text-center">
        <h1 className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
          Content Delivery System
        </h1>
        <p className="text-lg text-muted-foreground">
          Securely manage, process, and deliver your media content with our powerful platform.
        </p>
        <div className="pt-4">
          <AuthGuard>
            <p className="text-green-500">You are authenticated!</p>
          </AuthGuard>
        </div>
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
          <Route path="/files" component={Files} />
          <Route path="/videos" component={Videos} />
          <Route path="/video/:id" component={Video} />
          <Route path="/jobs" component={Jobs} />
          <Route path="/storage" component={Storage} />
          <Route component={NotFound} />
        </Switch>
      </Layout>
    </AuthGuard>
  );
};

// Main router
function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/:rest*" component={ProtectedRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
