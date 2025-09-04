import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

export const CloudflareIntegrationTest = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const updateResult = (name: string, status: TestResult['status'], message: string, details?: string) => {
    setResults(prev => {
      const existing = prev.findIndex(r => r.name === name);
      const newResult = { name, status, message, details };
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = newResult;
        return updated;
      }
      return [...prev, newResult];
    });
  };

  const testPing = async () => {
    updateResult('Ping Test', 'pending', 'Testing basic connectivity...');
    try {
      const response = await fetch('/api/ping');
      if (response.ok) {
        const data = await response.json();
        updateResult('Ping Test', 'success', 'Cloudflare Functions are responding', 
          `Response: ${JSON.stringify(data)}`);
      } else {
        updateResult('Ping Test', 'error', `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      updateResult('Ping Test', 'error', 'Failed to connect to Cloudflare Functions', 
        error instanceof Error ? error.message : String(error));
    }
  };

  const testImageUpload = async () => {
    updateResult('Image Upload Test', 'pending', 'Testing image upload capabilities...');
    try {
      // Create a small test image blob
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, 100, 100);
      
      canvas.toBlob(async (blob) => {
        if (!blob) {
          updateResult('Image Upload Test', 'error', 'Failed to create test image');
          return;
        }

        const formData = new FormData();
        formData.append('file', blob, 'test.jpg');
        formData.append('entityType', 'playlist');
        formData.append('entityId', 'test-id');

        const response = await fetch('/api/image-upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          updateResult('Image Upload Test', 'success', 'Image upload functionality is working',
            `Uploaded to: ${data.image_key || 'unknown'}`);
        } else {
          const errorText = await response.text().catch(() => response.statusText);
          updateResult('Image Upload Test', 'error', `HTTP ${response.status}`, errorText);
        }
      }, 'image/jpeg', 0.8);
    } catch (error) {
      updateResult('Image Upload Test', 'error', 'Image upload test failed', 
        error instanceof Error ? error.message : String(error));
    }
  };

  const testTrackUrl = async () => {
    updateResult('Track URL Test', 'pending', 'Testing track URL resolution...');
    try {
      const response = await fetch('/api/track-url?id=test-track-id', {
        headers: {
          'Authorization': 'Bearer test-token' // This will fail auth but should show the endpoint is responding
        }
      });
      
      // We expect 401 Unauthorized since we're using a fake token
      if (response.status === 401) {
        updateResult('Track URL Test', 'success', 'Track URL endpoint is responding correctly',
          'Authentication is properly configured (401 for invalid token)');
      } else if (response.status === 400) {
        updateResult('Track URL Test', 'warning', 'Endpoint responding but may need configuration',
          'Got 400 - check if track ID validation is working');
      } else {
        const text = await response.text().catch(() => response.statusText);
        updateResult('Track URL Test', 'warning', `HTTP ${response.status}`, text);
      }
    } catch (error) {
      updateResult('Track URL Test', 'error', 'Track URL test failed', 
        error instanceof Error ? error.message : String(error));
    }
  };

  const testAudioUpload = async () => {
    updateResult('Audio Upload Test', 'pending', 'Testing audio upload capabilities...');
    try {
      const formData = new FormData();
      // Create a small dummy file
      const dummyFile = new File(['dummy audio content'], 'test.mp3', { type: 'audio/mpeg' });
      formData.append('audio', dummyFile);
      formData.append('visibility', 'private');
      formData.append('fileName', 'test.mp3');

      const response = await fetch('/api/process-upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        updateResult('Audio Upload Test', 'success', 'Audio upload functionality is working',
          `Storage key: ${data.storage_key || 'unknown'}`);
      } else {
        const errorText = await response.text().catch(() => response.statusText);
        updateResult('Audio Upload Test', 'error', `HTTP ${response.status}`, errorText);
      }
    } catch (error) {
      updateResult('Audio Upload Test', 'error', 'Audio upload test failed', 
        error instanceof Error ? error.message : String(error));
    }
  };

  const testTrackStream = async () => {
    updateResult('Track Stream Test', 'pending', 'Testing audio streaming...');
    try {
      const response = await fetch('/api/track-stream?id=test-track-id');
      
      // We expect 404 or 401 since we're using a fake track ID
      if (response.status === 404) {
        updateResult('Track Stream Test', 'success', 'Track streaming endpoint is responding correctly',
          'Got expected 404 for non-existent track');
      } else if (response.status === 401) {
        updateResult('Track Stream Test', 'success', 'Track streaming endpoint requires authentication',
          'Authentication is properly configured');
      } else {
        const text = await response.text().catch(() => response.statusText);
        updateResult('Track Stream Test', 'warning', `HTTP ${response.status}`, text);
      }
    } catch (error) {
      updateResult('Track Stream Test', 'error', 'Track streaming test failed', 
        error instanceof Error ? error.message : String(error));
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);

    try {
      await testPing();
      await testImageUpload();
      await testTrackUrl();
      await testAudioUpload();
      await testTrackStream();
    } catch (error) {
      console.error('Test suite error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    const colors = {
      success: 'bg-green-500',
      error: 'bg-red-500',
      warning: 'bg-yellow-500',
      pending: 'bg-blue-500'
    };
    return <Badge className={colors[status]}>{status}</Badge>;
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Cloudflare Integration Test
          <Button 
            onClick={runAllTests} 
            disabled={isRunning}
            className="ml-4"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Running Tests...
              </>
            ) : (
              'Run Tests'
            )}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {results.length === 0 && !isRunning && (
          <p className="text-muted-foreground text-center py-8">
            Click "Run Tests" to verify your Cloudflare Functions integration
          </p>
        )}
        
        {results.map((result) => (
          <div key={result.name} className="flex items-start space-x-3 p-3 border rounded-lg">
            {getStatusIcon(result.status)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">{result.name}</h4>
                {getStatusBadge(result.status)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
              {result.details && (
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">
                    View Details
                  </summary>
                  <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-auto">
                    {result.details}
                  </pre>
                </details>
              )}
            </div>
          </div>
        ))}
        
        {results.length > 0 && !isRunning && (
          <div className="pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span>
                Passed: {results.filter(r => r.status === 'success').length}
              </span>
              <span>
                Warnings: {results.filter(r => r.status === 'warning').length}
              </span>
              <span>
                Failed: {results.filter(r => r.status === 'error').length}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};