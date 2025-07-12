
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Github, Mail, X, ArrowLeft } from "lucide-react";

const Auth = () => {
  const { user, signIn, signUp, signInWithProvider, acceptInvitation, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const inviteToken = searchParams.get('token');
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if user is already authenticated
  if (user && !loading) {
    return <Navigate to="/" replace />;
  }

  const handleEmailSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: "Error signing in",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
    }
    
    setIsLoading(false);
  };

  const handleEmailSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;
    
    const { error } = await signUp(email, password, fullName);
    
    if (error) {
      toast({
        title: "Error creating account",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
    }
    
    setIsLoading(false);
  };

  const handleAcceptInvitation = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const fullName = formData.get('fullName') as string;
    
    if (!inviteToken) {
      toast({
        title: "Error",
        description: "Invalid invitation token",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    const { error } = await acceptInvitation(inviteToken, password, fullName);
    
    if (error) {
      toast({
        title: "Error accepting invitation",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome to the band!",
        description: "Please check your email to verify your account.",
      });
    }
    
    setIsLoading(false);
  };

  const handleSocialSignIn = async (provider: 'google' | 'github' | 'twitter') => {
    setIsLoading(true);
    
    const { error } = await signInWithProvider(provider);
    
    if (error) {
      toast({
        title: "Error signing in",
        description: error.message,
        variant: "destructive",
      });
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
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      {/* Back/Close Button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 left-4 z-10 text-primary hover:text-primary/80"
        onClick={() => navigate('/')}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      
      <Card className="w-full max-w-sm sm:max-w-md">
        <CardHeader className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-lg">W</span>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-rem font-thin bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            Welcome to Wovenmusic
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Converge in resonance. Sculpt time from tone. Scatter rhythm into the communal void.
          </CardDescription>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">
              <strong>New user?</strong> Use the Sign Up tab to create your account.<br />
              <strong>Returning user?</strong> Use the Sign In tab with your existing credentials.<br />
              <strong>Invited to join?</strong> Your invitation link will show a special form to get started.
            </p>
          </div>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue={inviteToken ? "invite" : "signin"} className="w-full">
            {!inviteToken && (
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            )}
            
            <TabsContent value="signin" className="space-y-4">
              <form onSubmit={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Enter your password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSocialSignIn('google')}
                  disabled={isLoading}
                >
                  <Mail className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSocialSignIn('github')}
                  disabled={isLoading}
                >
                  <Github className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSocialSignIn('twitter')}
                  disabled={isLoading}
                >
                  <span className="w-4 h-4 flex items-center justify-center font-bold">𝕏</span>
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4">
              <form onSubmit={handleEmailSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Create a password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSocialSignIn('google')}
                  disabled={isLoading}
                >
                  <Mail className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSocialSignIn('github')}
                  disabled={isLoading}
                >
                  <Github className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSocialSignIn('twitter')}
                  disabled={isLoading}
                >
                  <span className="w-4 h-4 flex items-center justify-center font-bold">𝕏</span>
                </Button>
              </div>
            </TabsContent>

            {inviteToken && (
              <TabsContent value="invite" className="space-y-4">
                <form onSubmit={handleAcceptInvitation} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      name="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder="Create a password"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Joining band..." : "Accept Invitation"}
                  </Button>
                </form>
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
