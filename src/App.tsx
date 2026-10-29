import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProjectsProvider } from './components/ProjectsContext';
import { ToastProvider } from './components/Toast';
import { Dashboard } from './pages/Dashboard';
import { Projects } from './pages/Projects';
import { ProjectForm } from './pages/ProjectForm';
import { ProjectDetails } from './pages/ProjectDetails';
import { CharterBuilder } from './pages/CharterBuilder';
import { Charters } from './pages/Charters';

const router = createBrowserRouter([
  {
    element: <Layout />,
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
      <ProjectsProvider>
        <RouterProvider router={router} />
      </ProjectsProvider>
    </ToastProvider>
  );
}
