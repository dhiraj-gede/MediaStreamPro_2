
import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/useAuth";
import { AuthGuard } from "./components/AuthGuard";
import { Layout } from "@/components/Layout";

// Pages
import Dashboard from "@/pages/Dashboard";
import Files from "@/pages/Files";
import Videos from "@/pages/Videos";
import Video from "@/pages/Video";
import Jobs from "@/pages/Jobs";
import Storage from "@/pages/Storage";
import NotFound from "@/pages/not-found";

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

const ProtectedRoutes = () => {
  return (
    <AuthGuard>
      <Layout>
        <Switch>
          <Route path="/">
            <Dashboard />
          </Route>
          <Route path="/dashboard">
            <Dashboard />
          </Route>
          <Route path="/files">
            <Files />
          </Route>
          <Route path="/videos">
            <Videos />
          </Route>
          <Route path="/video/:id">
            {(params) => <Video id={params.id} />}
          </Route>
          <Route path="/jobs">
            <Jobs />
          </Route>
          <Route path="/storage">
            <Storage />
          </Route>
          <Route>
            <NotFound />
          </Route>
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
