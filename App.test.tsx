
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

declare const test: any;
declare const expect: any;

test('renders main dashboard structure', () => {
  render(<App />);
  
  // Header
  expect(screen.getByText(/SST Metrics Pro/i)).toBeInTheDocument();
  expect(screen.getByText(/Sin archivo cargado/i)).toBeInTheDocument();

  // Tabs
  const rawTab = screen.getByText(/1\) RAW/i);
  const kpiTab = screen.getByText(/3\) KPIs/i);
  expect(rawTab).toBeInTheDocument();
  expect(kpiTab).toBeInTheDocument();

  // Initial State (RAW view)
  // Should show the table header or empty state (depending on seed data)
  // Since we load seed data in storage, we expect some rows potentially, or at least the DataExplorer mounted.
});

test('tab navigation works', () => {
  render(<App />);
  
  // Click KPI tab
  const kpiTab = screen.getByText(/3\) KPIs/i);
  fireEvent.click(kpiTab);
  
  // Check if Dashboard component specific text appears (e.g. "Resumen de Incidentes")
  expect(screen.getByText(/Resumen de Incidentes/i)).toBeInTheDocument();
});
