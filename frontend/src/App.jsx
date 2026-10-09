import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import ProtectedRoute from './components/common/ProtectedRoute';

// Portal Authentication Screens
import CitizenAuthPage from './pages/CitizenAuthPage';
import MunicipalLoginPage from './pages/municipal/MunicipalLoginPage';
import FieldWorkerLoginPage from './pages/worker/FieldWorkerLoginPage';

// Citizen Mode Components & Pages
import CitizenLayout from './components/citizen/CitizenLayout';
import CitizenHomePage from './pages/citizen/CitizenHomePage';
import ReportProblemPage from './pages/citizen/ReportProblemPage';
import MyReportsPage from './pages/citizen/MyReportsPage';
import NotificationsPage from './pages/citizen/NotificationsPage';
import CitizenProfilePage from './pages/citizen/CitizenProfilePage';

// Municipal Mode Components & Pages (Clean Officer Interface)
import MunicipalLayout from './components/municipal/MunicipalLayout';
import CitizenReportsPage from './pages/municipal/CitizenReportsPage';

// Field Worker Mode
import FieldWorkerPage from './pages/worker/FieldWorkerPage';

// Role & Auth Context
import { RoleProvider } from './context/RoleContext';

export default function App() {
  return (
    <BrowserRouter>
      <RoleProvider>
        <div className="app-container">
          <Navbar />
          <Routes>
            {/* 1. Landing Screen directly opens Citizen Authentication per Requirement 1 */}
            <Route path="/" element={<CitizenAuthPage />} />

            {/* Role-Specific Direct Login Portals per Requirement 2 */}
            <Route path="/municipal/login" element={<MunicipalLoginPage />} />
            <Route path="/worker/login" element={<FieldWorkerLoginPage />} />

            {/* Citizen Mode Routes - Protected for Citizen */}
            <Route
              path="/citizen"
              element={
                <ProtectedRoute allowedRole="citizen">
                  <CitizenLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CitizenHomePage />} />
              <Route path="report" element={<ReportProblemPage />} />
              <Route path="my-reports" element={<MyReportsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="profile" element={<CitizenProfilePage />} />
            </Route>

            {/* Municipal Mode Routes - Single Focused Section: Citizen Reports */}
            <Route
              path="/municipal"
              element={
                <ProtectedRoute allowedRole="officer">
                  <MunicipalLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CitizenReportsPage />} />
              <Route path="reports" element={<CitizenReportsPage />} />
              <Route path="*" element={<Navigate to="/municipal" replace />} />
            </Route>

            {/* Field Worker Mode Routes - Protected for Field Operatives */}
            <Route
              path="/worker"
              element={
                <ProtectedRoute allowedRole="field_worker">
                  <FieldWorkerPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/field-worker"
              element={
                <ProtectedRoute allowedRole="field_worker">
                  <FieldWorkerPage />
                </ProtectedRoute>
              }
            />

            {/* Fallback Route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Footer />
        </div>
      </RoleProvider>
    </BrowserRouter>
  );
}