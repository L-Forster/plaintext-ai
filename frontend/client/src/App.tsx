import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Research from "@/pages/research";
import { ThemeProvider } from "@/hooks/use-theme";
import { useEffect } from "react";
import Workflow from "@/pages/workflow";

function Router() {
  // Dynamically update document title based on current route
  const [location] = useLocation();
  useEffect(() => {
    const path = location.split('?')[0];
    const titleMap: Record<string, string> = {
      '/': 'Research Agent',
      '/research': 'Research Agent',
      '/research/search': 'Paper Search',
      '/research/pdf': 'PDF Upload',
      '/research/citations': 'Citation Network',
      '/research/contradictions': 'Contradiction Checker',
      '/research/data': 'Data Analysis',
      '/research/gaps': 'Gap Analysis',
      '/research/reading': 'Suggested Reading',
      '/workflow': 'Workflow Builder',
    };
    const pageTitle = titleMap[path] || (path.startsWith('/research') ? 'Research Agent' : 'Page Not Found');
    document.title = `${pageTitle} - Plaintext AI`;
  }, [location]);

  return (
    <Switch>
      <Route path="/">{() => <Redirect to="/research" />}</Route>
      <Route path="/research/:mode?" component={Research} />
      <Route path="/workflow" component={Workflow} />

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <QueryClientProvider client={queryClient}>
        <Router />
        <Toaster />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
