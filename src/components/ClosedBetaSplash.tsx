import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const ClosedBetaSplash = () => {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleEarlyAccessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('early_access_emails')
        .insert([{ email }]);

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Already registered",
            description: "This email is already on our early access list!",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Success!",
          description: "You've been added to our early access list. We'll notify you when spots open up!",
        });
        setEmail("");
      }
    } catch (error) {
      console.error('Early access submission error:', error);
      toast({
        title: "Something went wrong",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        {/* Logo/Branding */}
        <div className="space-y-4">
          <div className="w-16 h-16 flex items-center justify-center mx-auto">
            <img src="/lovable-uploads/3d40f12c-991e-4011-ab75-298ff325bf8a.png" alt="Wovenmusic" className="w-full h-full object-contain" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-primary">Wovenmusic</h1>
            <p className="text-muted-foreground text-sm">Collaborative Music Platform</p>
          </div>
        </div>

        {/* Closed Beta Message */}
        <div className="space-y-4">
          <div className="inline-block bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
            🔒 Closed Beta
          </div>
          <h2 className="text-xl font-semibold">We're invite-only right now</h2>
          <p className="text-muted-foreground">
            Wovenmusic is currently in closed beta as we refine the experience with select users. 
            Join our early access list to be notified when we open up!
          </p>
        </div>

        {/* Early Access Form */}
        <form onSubmit={handleEarlyAccessSubmit} className="space-y-4">
          <div className="space-y-2">
            <Input
              type="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="text-center"
            />
          </div>
          <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Joining waitlist...
              </>
            ) : (
              "Request Early Access"
            )}
          </Button>
        </form>

        {/* Value Proposition */}
        <div className="pt-4 border-t space-y-3">
          <h3 className="font-medium">What makes Wovenmusic special?</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Curating sonic offerings in the shared chamber</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Instant ripple-casting across the sonic weave</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-primary rounded-full"></div>
              <span>Dropbox, folded invisibly into the lattice</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ClosedBetaSplash;