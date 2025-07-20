import { useState, useEffect } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle } from "lucide-react";

const AuthVerify = () => {
  const { user, setPassword, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'verified' | 'create-password' | 'complete'>('verified');

  // Check if user is authenticated and verified
  useEffect(() => {
    if (!loading && user) {
      // User is logged in via magic link, show password creation
      setStep('create-password');
    } else if (!loading && !user) {
      // No user found, redirect to auth
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  const handleCreatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;
    
    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    const { error } = await setPassword(password);
    
    if (error) {
      toast({
        title: "Error setting password",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setStep('complete');
      toast({
        title: "Password created successfully!",
        description: "You can now access your music library.",
      });
      
      // Redirect to library after a short delay
      setTimeout(() => {
        navigate('/');
      }, 2000);
    }
    
    setIsLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <p className="text-muted-foreground">Verifying your account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 left-4 z-10 text-primary hover:text-primary/80"
        onClick={() => navigate('/auth')}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      
      <Card className="w-full max-w-sm sm:max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">W</span>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-rem font-thin bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            {step === 'create-password' && 'Create Your Password'}
            {step === 'complete' && 'Welcome to Wovenmusic!'}
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            {step === 'create-password' && 'Complete your account setup by creating a secure password.'}
            {step === 'complete' && 'Your account has been successfully created. Redirecting to your library...'}
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {step === 'create-password' && (
            <form onSubmit={handleCreatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Create a secure password"
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Creating password..." : "Create Password & Continue"}
              </Button>
            </form>
          )}
          
          {step === 'complete' && (
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <p className="text-muted-foreground">
                You'll be redirected to your music library in a moment...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthVerify;