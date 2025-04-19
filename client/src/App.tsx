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

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/files" component={Files} />
        <Route path="/videos" component={Videos} />
        <Route path="/video/:id" component={Video} />
        <Route path="/jobs" component={Jobs} />
        <Route path="/storage" component={Storage} />
        {/* Fallback to 404 */}
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
