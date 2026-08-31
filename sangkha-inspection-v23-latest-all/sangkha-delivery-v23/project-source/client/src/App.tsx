/* Civic Signal: one guarded shell for Inspector, Supervisor and Admin; every role has an escape route and a mobile-first surface. */
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Route, Switch, Redirect } from "wouter";
import Login from "./pages/Login";
import Inspector from "./pages/Inspector";
import Supervisor from "./pages/Supervisor";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import type { Role } from "./lib/api";

function readSession() {
  const raw = sessionStorage.getItem("sangkha_session") || localStorage.getItem("sangkha_session");
  if (!raw) return null;
  try { return JSON.parse(raw) as { sessionId?: string; user?: { Role?: string } }; } catch { return null; }
}

function ProtectedRoute({ role, component: Component }: { role: Role; component: React.ComponentType }) {
  const session = readSession();
  const actualRole = String(session?.user?.Role || "").trim().toLowerCase();
  if (!session?.sessionId || actualRole !== role) return <Redirect to="/login" />;
  return <Component />;
}

function Router() {
  return <Switch>
    <Route path="/" component={Login} />
    <Route path="/login" component={Login} />
    <Route path="/inspector">{() => <ProtectedRoute role="inspector" component={Inspector} />}</Route>
    <Route path="/supervisor">{() => <ProtectedRoute role="supervisor" component={Supervisor} />}</Route>
    <Route path="/admin">{() => <ProtectedRoute role="admin" component={Admin} />}</Route>
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
