import { Navigate, RouterProvider, createBrowserRouter, useParams } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './components/Auth';
import { Layout } from './components/Layout';
import { ProjectsProvider } from './components/ProjectsContext';
import { ToastProvider } from './components/Toast';
import { AiStatusProvider } from './components/ai/AiContext';
import { Dashboard } from './pages/Dashboard';
import { ProjectForm } from './pages/ProjectForm';
import { ProjectDetails } from './pages/ProjectDetails';
import { CharterBuilder } from './pages/CharterBuilder';
import { Charters } from './pages/Charters';
import { SignIn } from './pages/SignIn';
import { SavingsProvider } from './managers/SavingsContext';
import { ManagerLayout } from './managers/ManagerLayout';
import { SavingsDashboard } from './managers/SavingsDashboard';
import { ManagerInput } from './managers/ManagerInput';
import { InitiativeEditor } from './managers/InitiativeEditor';
import { InstructionsPage } from './managers/InstructionsPage';
import { StoryboardPage } from './managers/StoryboardPage';
import { BasePathProvider } from './components/BasePath';
import { Projects, type Portfolio } from './pages/Projects';

/** /managers/portfolio/:bf → all | clinical | sbf (anything else falls back to all). */
function PortfolioRoute() {
  const { bf } = useParams();
  const portfolio: Portfolio = bf === 'clinical' || bf === 'sbf' ? bf : 'all';
  return <Projects key={portfolio} portfolio={portfolio} />;
}
import { GridView } from './managers/GridView';

const router = createBrowserRouter([
  { path: '/login', element: <SignIn /> },
  {
    // Senior Manager savings module — MANAGERS account only
    path: '/managers',
    element: (
      <RequireAuth role="managers">
        <AiStatusProvider>
          <ProjectsProvider>
            <SavingsProvider>
              <BasePathProvider base="/managers">
                <ManagerLayout />
              </BasePathProvider>
            </SavingsProvider>
          </ProjectsProvider>
        </AiStatusProvider>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <SavingsDashboard /> },
      { path: 'input', element: <ManagerInput /> },
      { path: 'input/:id', element: <InitiativeEditor /> },
      { path: 'grid', element: <GridView /> },
      { path: 'storyboard', element: <StoryboardPage /> },
      { path: 'instructions', element: <InstructionsPage /> },
      // Clinical Tower Projects — the SAME project records IGNITE uses (view + edit)
      { path: 'projects', element: <Navigate to="/managers/portfolio/all" replace /> },
      { path: 'portfolio', element: <Navigate to="/managers/portfolio/all" replace /> },
      { path: 'portfolio/:bf', element: <PortfolioRoute /> },
      { path: 'new', element: <ProjectForm /> },
      { path: 'projects/:id', element: <ProjectDetails /> },
      { path: 'projects/:id/edit', element: <ProjectForm /> },
      { path: 'projects/:id/charter', element: <CharterBuilder /> },
      { path: '*', element: <Navigate to="/managers" replace /> },
    ],
  },
  {
    // Project hub — IGNITE account; data providers mount only after sign-in
    element: (
      <RequireAuth role="ignite">
        <AiStatusProvider>
          <ProjectsProvider>
            <Layout />
          </ProjectsProvider>
        </AiStatusProvider>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'projects', element: <Projects /> },
      { path: 'new', element: <ProjectForm /> },
      { path: 'projects/:id', element: <ProjectDetails /> },
      { path: 'projects/:id/edit', element: <ProjectForm /> },
      { path: 'projects/:id/charter', element: <CharterBuilder /> },
      { path: 'charters', element: <Charters /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ToastProvider>
  );
}
