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

const router = createBrowserRouter([
  { path: '/login', element: <SignIn /> },
  {
    // Every application page sits behind the sign-in check; data providers mount only after sign-in
    element: (
      <RequireAuth>
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
