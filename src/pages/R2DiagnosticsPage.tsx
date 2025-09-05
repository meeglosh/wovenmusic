import React from 'react';
import { R2DiagnosticsTest } from '@/components/R2DiagnosticsTest';

export const R2DiagnosticsPage: React.FC = () => {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4">R2 Storage Diagnostics</h1>
        <p className="text-muted-foreground">
          This page helps diagnose R2 storage connectivity issues that are preventing audio playback.
          Run the diagnostics to identify configuration problems.
        </p>
      </div>
      
      <R2DiagnosticsTest />
    </div>
  );
};