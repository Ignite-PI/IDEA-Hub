import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AuthProvider, RequireAuth } from './components/Auth';
import { Layout } from './components/Layout';
import { ProjectsProvider } from './components/ProjectsContext';
import { ToastProvider } from './components/Toast';
import { AiStatusProvider } from './components/ai/AiContext';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
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
import { ManagerProjects } from './managers/ManagerProjects';

const router = createBrowserRouter([
  { path: '/login', element: <SignIn /> },
  {
    // Senior Manager savings module — MANAGERS account only
    path: '/managers',
    element: (
      <RequireAuth role="managers">
        <ProjectsProvider>
          <SavingsProvider>
            <ManagerLayout />
          </SavingsProvider>
        </ProjectsProvider>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <SavingsDashboard /> },
      { path: 'input', element: <ManagerInput /> },
      { path: 'input/:id', element: <InitiativeEditor /> },
      { path: 'storyboard', element: <StoryboardPage /> },
      { path: 'instructions', element: <InstructionsPage /> },
      { path: 'projects', element: <ManagerProjects /> },
      { path: 'projects/:id', element: <ProjectDetails readOnly /> },
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
