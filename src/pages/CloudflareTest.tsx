import { CloudflareIntegrationTest } from '@/components/CloudflareIntegrationTest';

const CloudflareTest = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-4">Cloudflare Integration Verification</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            This tool verifies that your Cloudflare Functions are properly configured and responding. 
            Run the tests to ensure your audio uploads, image processing, and streaming capabilities are working.
          </p>
        </div>
        
        <CloudflareIntegrationTest />
        
        <div className="mt-8 max-w-2xl mx-auto">
          <div className="bg-muted p-6 rounded-lg">
            <h3 className="font-semibold mb-3">What's Being Tested:</h3>
            <ul className="space-y-2 text-sm">
              <li><strong>Ping Test:</strong> Verifies basic Cloudflare Functions connectivity</li>
              <li><strong>Image Upload:</strong> Tests playlist/profile image upload to R2 storage</li>
              <li><strong>Track URL:</strong> Verifies authentication and track URL resolution</li>
              <li><strong>Audio Upload:</strong> Tests music file upload and processing pipeline</li>
              <li><strong>Track Stream:</strong> Verifies audio streaming with Range header support</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CloudflareTest;