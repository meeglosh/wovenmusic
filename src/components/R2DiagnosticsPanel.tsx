import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';

interface DiagnosticResult {
  test: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details?: any;
  timestamp: string;
}

interface TrackUrlResult {
  ok: boolean;
  url?: string;
  kind?: string;
  error?: string;
  debug_info?: any;
  comprehensive_debug?: any;
  paths_tried?: string[];
  error_summary?: any;
}

export const R2DiagnosticsPanel: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [trackTestId, setTrackTestId] = useState('fb3dfe48-a610-4796-a31b-b500bfedf979');
  const [trackUrlResult, setTrackUrlResult] = useState<TrackUrlResult | null>(null);
  const [customTrackIds, setCustomTrackIds] = useState('');

  const runDiagnostics = async (action: 'connectivity' | 'tracks' | 'full' = 'full') => {
    setLoading(true);
    try {
      const trackIds = customTrackIds.split(',').map(id => id.trim()).filter(Boolean);
      const params = new URLSearchParams({ action });
      if (trackIds.length > 0) {
        params.set('trackIds', trackIds.join(','));
      }
      
      const { data, error } = await supabase.functions.invoke('r2-diagnostics', {
        method: 'GET'
      });

      if (error) throw error;
      
      setDiagnostics(data.results || []);
    } catch (error) {
      console.error('Diagnostics failed:', error);
      setDiagnostics([{
        test: 'Diagnostics Error',
        status: 'error',
        message: `Failed to run diagnostics: ${error.message}`,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const testTrackUrl = async (trackId: string, withDebug = true) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ id: trackId });
      if (withDebug) params.set('debug', '1');
      
      const supabaseUrl = "https://woakvdhlpludrttjixxq.supabase.co";
      const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvYWt2ZGhscGx1ZHJ0dGppeHhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTExMjMwODEsImV4cCI6MjA2NjY5OTA4MX0.TklesWo8b-lZW2SsE39icrcC0Y8ho5xzGUdj9MZg-Xg";
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/track-url?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const result = await response.json();
      setTrackUrlResult(result);
    } catch (error) {
      console.error('Track URL test failed:', error);
      setTrackUrlResult({
        ok: false,
        error: `Request failed: ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            R2 Storage Diagnostics
          </CardTitle>
          <CardDescription>
            Debug and diagnose R2 storage connectivity and file access issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="diagnostics" className="w-full">
            <TabsList>
              <TabsTrigger value="diagnostics">System Diagnostics</TabsTrigger>
              <TabsTrigger value="track-test">Track URL Testing</TabsTrigger>
            </TabsList>
            
            <TabsContent value="diagnostics" className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Button 
                  onClick={() => runDiagnostics('connectivity')}
                  disabled={loading}
                  variant="outline"
                >
                  Test Connectivity
                </Button>
                <Button 
                  onClick={() => runDiagnostics('tracks')}
                  disabled={loading}
                  variant="outline"
                >
                  Verify Track Files
                </Button>
                <Button 
                  onClick={() => runDiagnostics('full')}
                  disabled={loading}
                >
                  Full Diagnostics
                </Button>
              </div>
              
              <div>
                <label className="text-sm font-medium">Custom Track IDs (comma-separated):</label>
                <Textarea
                  placeholder="fb3dfe48-a610-4796-a31b-b500bfedf979, another-id..."
                  value={customTrackIds}
                  onChange={(e) => setCustomTrackIds(e.target.value)}
                  className="mt-1"
                  rows={2}
                />
              </div>
              
              {diagnostics.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Diagnostic Results</h3>
                  {diagnostics.map((result, index) => (
                    <Card key={index} className="border-l-4 border-l-gray-300">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(result.status)}
                          <span className="font-medium">{result.test}</span>
                          <Badge className={getStatusColor(result.status)}>
                            {result.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{result.message}</p>
                        {result.details && (
                          <details className="text-xs">
                            <summary className="cursor-pointer font-medium">Details</summary>
                            <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                              {JSON.stringify(result.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="track-test" className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium">Track ID:</label>
                  <Input
                    value={trackTestId}
                    onChange={(e) => setTrackTestId(e.target.value)}
                    placeholder="Enter track ID to test"
                    className="mt-1"
                  />
                </div>
                <Button 
                  onClick={() => testTrackUrl(trackTestId, true)}
                  disabled={loading || !trackTestId}
                >
                  Test with Debug
                </Button>
                <Button 
                  onClick={() => testTrackUrl(trackTestId, false)}
                  disabled={loading || !trackTestId}
                  variant="outline"
                >
                  Test Normal
                </Button>
              </div>
              
              {trackUrlResult && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getStatusIcon(trackUrlResult.ok ? 'success' : 'error')}
                      Track URL Test Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <span className="font-medium">Status: </span>
                        <Badge className={trackUrlResult.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {trackUrlResult.ok ? 'Success' : 'Failed'}
                        </Badge>
                      </div>
                      
                      {trackUrlResult.error && (
                        <div>
                          <span className="font-medium">Error: </span>
                          <span className="text-red-600">{trackUrlResult.error}</span>
                        </div>
                      )}
                      
                      {trackUrlResult.url && (
                        <div>
                          <span className="font-medium">URL Generated: </span>
                          <span className="text-green-600">✓ ({trackUrlResult.kind})</span>
                        </div>
                      )}
                      
                      {trackUrlResult.paths_tried && (
                        <details>
                          <summary className="cursor-pointer font-medium">
                            Paths Tried ({trackUrlResult.paths_tried.length})
                          </summary>
                          <div className="mt-2 space-y-1">
                            {trackUrlResult.paths_tried.map((path, idx) => (
                              <div key={idx} className="text-sm font-mono bg-gray-100 p-1 rounded">
                                {path}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                      
                      {trackUrlResult.error_summary && (
                        <details>
                          <summary className="cursor-pointer font-medium">Error Summary</summary>
                          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                            {JSON.stringify(trackUrlResult.error_summary, null, 2)}
                          </pre>
                        </details>
                      )}
                      
                      {trackUrlResult.comprehensive_debug && (
                        <details>
                          <summary className="cursor-pointer font-medium">Comprehensive Debug Info</summary>
                          <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-96">
                            {JSON.stringify(trackUrlResult.comprehensive_debug, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};