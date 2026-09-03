import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { Layout } from './components/Layout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { InventoryPage } from './pages/InventoryPage.js';
import { WorkOrdersPage } from './pages/WorkOrdersPage.js';
import { InternalTransfersPage } from './pages/InternalTransfersPage.js';
import { CustomerOrdersPage } from './pages/CustomerOrdersPage.js';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="work-orders" element={<WorkOrdersPage />} />
            <Route path="transfers" element={<InternalTransfersPage />} />
            <Route path="orders" element={<CustomerOrdersPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};
