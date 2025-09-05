import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface DiagnosticResult {
  test: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
  timestamp: string;
}

interface DiagnosticResponse {
  ok: boolean;
  summary: {
    totalTests: number;
    successful: number;
    warnings: number;
    errors: number;
  };
  results: DiagnosticResult[];
  timestamp: string;
}

export const R2DiagnosticsTest: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runDiagnostics = async (action: 'connectivity' | 'tracks' | 'full') => {
    setIsRunning(true);
    setError(null);
    setResults(null);

    try {
      const trackId = 'fb3dfe48-a610-4796-a31b-b500bfedf979'; // The problematic track
      const { data, error } = await supabase.functions.invoke('r2-diagnostics', {
        body: { action, trackIds: [trackId] }
      });

      if (error) throw error;

      setResults(data);
    } catch (err) {
      console.error('Diagnostics error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>R2 Storage Diagnostics</CardTitle>
        <CardDescription>
          Test R2 configuration and file accessibility for audio playback debugging
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => runDiagnostics('connectivity')}
            disabled={isRunning}
            variant="outline"
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Test Connectivity
          </Button>
          <Button
            onClick={() => runDiagnostics('tracks')}
            disabled={isRunning}
            variant="outline"
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Test Problem Track
          </Button>
          <Button
            onClick={() => runDiagnostics('full')}
            disabled={isRunning}
          >
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Full Diagnostics
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {results && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{results.summary.successful}</div>
                <div className="text-gray-500">Success</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{results.summary.warnings}</div>
                <div className="text-gray-500">Warnings</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{results.summary.errors}</div>
                <div className="text-gray-500">Errors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{results.summary.totalTests}</div>
                <div className="text-gray-500">Total Tests</div>
              </div>
            </div>

            <div className="space-y-3">
              {results.results.map((result, index) => (
                <Card key={index} className="p-4">
                  <div className="flex items-start gap-3">
                    {getStatusIcon(result.status)}
                    <div className="flex-1">
                      <div className="font-semibold">{result.test}</div>
                      <div className="text-sm text-gray-600 mb-2">{result.message}</div>
                      {result.details && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                            View Details
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};