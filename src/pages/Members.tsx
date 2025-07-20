import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Mail, UserCheck, Trash2, Send, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBandMembers, useInvitations, useCustomRoles, useCurrentUserProfile } from "@/hooks/useBandMembers";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const Members = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { data: allMembers = [], isLoading, inviteUser, removeMember, updateProfile, refetch } = useBandMembers();
  const { data: invitations = [] } = useInvitations();
  const { data: currentUserProfile } = useCurrentUserProfile();
  
  const isAdmin = currentUserProfile?.is_admin || false;
  
  
  // Filter out admin members and users with Admin role from the display
  const members = allMembers.filter(member => 
    !member.is_admin && 
    member.role !== "Admin" && 
    !member.roles?.includes("Admin")
  );
  
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newInvitation, setNewInvitation] = useState({
    email: "",
    role: ""
  });

  const handleInviteUser = async () => {
    if (!newInvitation.email || !newInvitation.role) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    try {
      await inviteUser.mutateAsync(newInvitation);
      setNewInvitation({ email: "", role: "" });
      setShowInviteModal(false);
      toast({
        title: "Invitation sent",
        description: `Invitation sent to ${newInvitation.email}`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive"
      });
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    try {
      await removeMember.mutateAsync(memberId);
      toast({
        title: "Member removed",
        description: `${memberName} has been removed from the band`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive"
      });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'producer':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'musician':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'vocalist':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'songwriter':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <p className="text-muted-foreground">Loading members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-1 sm:mr-2 text-primary" />
              <span className="hidden sm:inline text-primary">Back</span>
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-primary">Band Members</h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Shape the hive of your collective resonance.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <Button variant="outline" size="sm" className="text-xs sm:text-sm" onClick={() => navigate("/profile-setup")}>
              <Settings className="w-4 h-4 mr-1 sm:mr-2 text-primary" />
              <span className="hidden sm:inline text-primary">Edit Profile</span>
              <span className="sm:hidden text-primary">Edit</span>
            </Button>
            <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
              <DialogTrigger asChild>
                <Button size="sm" className="text-xs sm:text-sm">
                  <Send className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Invite Member</span>
                  <span className="sm:hidden">Invite</span>
                </Button>
              </DialogTrigger>
            <DialogContent className="mx-4 w-[calc(100vw-2rem)] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Invite Band Member</DialogTitle>
                <DialogDescription>
                  Invite a new node into your sonic mesh. They'll receive coordinates to shape their vessel.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter member's email"
                    value={newInvitation.email}
                    onChange={(e) => setNewInvitation(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={newInvitation.role} onValueChange={(value) => setNewInvitation(prev => ({ ...prev, role: value }))}>
                    <SelectTrigger className="border-2 border-border text-primary [&>svg]:text-primary">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Producer">Producer</SelectItem>
                      <SelectItem value="Musician">Musician</SelectItem>
                      <SelectItem value="Vocalist">Vocalist</SelectItem>
                      <SelectItem value="Songwriter">Songwriter</SelectItem>
                      <SelectItem value="Sound Engineer">Sound Engineer</SelectItem>
                      <SelectItem value="Manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" className="text-primary" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleInviteUser} disabled={inviteUser.isPending}>
                  {inviteUser.isPending ? "Sending..." : "Send Invitation"}
                </Button>
              </DialogFooter>
            </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {members.length === 0 ? (
          <div className="text-center py-8 sm:py-12 px-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
            </div>
            <h3 className="text-base sm:text-lg font-medium mb-2 text-primary">No band members yet</h3>
            <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">Invite your first band member to start collaborating</p>
            <Button onClick={() => setShowInviteModal(true)} size="sm" className="text-sm">
              <Send className="w-4 h-4 mr-2" />
              Send First Invitation
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {members.map((member) => (
              <Card key={member.id} className="group hover:shadow-md transition-shadow relative">
                <CardHeader className="pb-3">
                  <div className="flex flex-col items-center text-center space-y-3">
                    <Avatar className="w-[70px] h-[70px]">
                      <AvatarImage src={member.avatar_url || ''} alt={member.full_name || member.email || 'User'} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white text-xl font-medium">
                        {(member.full_name || member.email || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <CardTitle className="text-base">{member.full_name || member.email}</CardTitle>
                      <div className="flex flex-wrap gap-1 justify-center">
                        {(member.roles && member.roles.length > 0 ? member.roles : [member.role]).filter(Boolean).map((role) => (
                          <Badge key={role} variant="secondary" className={`${getRoleColor(role)} pointer-events-none`}>
                            {role}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* Action buttons in bottom right */}
                  <div className="absolute bottom-3 right-3 flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => navigate(`/profile-setup?userId=${member.id}`)}
                    >
                      <Settings className="w-4 h-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => handleRemoveMember(member.id, member.full_name || member.email || 'Unknown')}
                      disabled={member.id === user?.id || (!isAdmin && member.id !== user?.id)}
                      title={member.id === user?.id ? "Cannot delete your own profile" : !isAdmin ? "Only admins can delete other profiles" : "Delete member"}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0 text-center pb-16">
                  <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <a 
                      href={`mailto:${member.email}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="truncate hover:text-primary transition-colors"
                    >
                      {member.email}
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Members;