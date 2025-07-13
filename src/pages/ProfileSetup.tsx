import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, User, ArrowLeft, X } from "lucide-react";
import { MultiRoleSelector } from "@/components/MultiRoleSelector";
import { useCurrentUserProfile } from "@/hooks/useBandMembers";
import { Switch } from "@/components/ui/switch";

const ProfileSetup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(user?.user_metadata?.avatar_url || "");
  const [profileData, setProfileData] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isAdminToggled, setIsAdminToggled] = useState(false);
  
  const { data: currentUserProfile } = useCurrentUserProfile();
  const editingUserId = searchParams.get('userId');
  const isEditingOtherUser = editingUserId && editingUserId !== user?.id;
  const canEditAdmin = currentUserProfile?.is_admin && isEditingOtherUser;

  useEffect(() => {
    const loadProfile = async () => {
      if (editingUserId) {
        setIsEditing(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', editingUserId)
            .single();
          
          if (error && error.code !== 'PGRST116') throw error;
          
          if (data) {
            setProfileData(data);
            setAvatarUrl(data.avatar_url || "");
            // Set selected roles from existing data
            if (data.roles && data.roles.length > 0) {
              setSelectedRoles(data.roles);
            } else if (data.role) {
              setSelectedRoles([data.role]);
            }
            // Set admin toggle state
            setIsAdminToggled(data.is_admin || false);
          }
        } catch (error: any) {
          toast({
            title: "Error loading profile",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        // For new profiles, set default from invitation if available
        const invitationRole = user?.user_metadata?.invitation_role;
        if (invitationRole) {
          setSelectedRoles([invitationRole]);
        }
      }
    };

    loadProfile();
  }, [editingUserId, toast, user?.user_metadata?.invitation_role]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const fullName = formData.get('fullName') as string;
    const bio = formData.get('bio') as string;

    if (selectedRoles.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one role",
        variant: "destructive"
      });
      setIsLoading(false);
      return;
    }

    try {
      const targetUserId = editingUserId || user.id;
      
      // Update or create the user profile
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: targetUserId,
          full_name: fullName,
          bio: bio,
          roles: selectedRoles,
          role: selectedRoles[0], // Keep the first role for backward compatibility
          email: profileData?.email || user.email,
          avatar_url: avatarUrl,
          is_band_member: true,
          is_admin: canEditAdmin ? isAdminToggled : (profileData?.is_admin || false)
        });

      if (error) throw error;

      toast({
        title: isEditing ? "Profile updated!" : "Profile created!",
        description: isEditing 
          ? "Profile has been updated successfully." 
          : "Welcome to Wovenmusic. You can now access all features.",
      });

      navigate(isEditing ? '/members' : '/');
    } catch (error: any) {
      toast({
        title: isEditing ? "Error updating profile" : "Error creating profile",
        description: error.message,
        variant: "destructive",
      });
    }
    
    setIsLoading(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsLoading(true);
      
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar-${user.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data } = await supabase.storage
        .from('audio-files')
        .upload(`avatars/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('audio-files')
        .getPublicUrl(`avatars/${fileName}`);

      setAvatarUrl(publicUrl);
      
      toast({
        title: "Avatar uploaded",
        description: "Your profile picture has been uploaded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Back Button */}
      {isEditing && (
        <div className="p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/members")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Members
          </Button>
        </div>
      )}
      
      <div className="flex items-center justify-center p-4 min-h-screen">
        <Card className="w-full max-w-sm sm:max-w-md">
          <CardHeader className="text-center relative">
            {isEditing && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate("/members")}
                className="absolute top-0 right-0 p-2"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            <CardTitle className="text-xl sm:text-2xl font-rem font-thin bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              {isEditing ? "Edit Profile" : "Complete Your Profile"}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {isEditing ? "Molt your metadata - become again" : "Tell us a bit about yourself to get started"}
            </CardDescription>
          </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Avatar Upload */}
            <div className="flex flex-col items-center space-y-4">
              <Avatar className="w-20 h-20">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback>
                  <User className="w-8 h-8" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-center">
                <Label htmlFor="avatar" className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload Photo
                    </span>
                  </Button>
                </Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Enter your full name"
                defaultValue={profileData?.full_name || user?.user_metadata?.full_name || ""}
                required
              />
            </div>

            {/* Roles */}
            <MultiRoleSelector 
              selectedRoles={selectedRoles}
              onRolesChange={setSelectedRoles}
            />

            {/* Admin Toggle - Only for admins editing other users */}
            {canEditAdmin && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin">Administrator</Label>
                  <Switch
                    id="admin"
                    checked={isAdminToggled}
                    onCheckedChange={setIsAdminToggled}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Administrators can delete any profile and manage all band members.
                </p>
              </div>
            )}

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                name="bio"
                placeholder="Tell us about yourself and your musical background..."
                rows={3}
                defaultValue={profileData?.bio || ""}
                className="border-2 border-input"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (isEditing ? "Updating Profile..." : "Creating Profile...") : (isEditing ? "Update Profile" : "Complete Setup")}
            </Button>
          </form>
        </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfileSetup;