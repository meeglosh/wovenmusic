import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCustomRoles } from "@/hooks/useBandMembers";
import { useToast } from "@/hooks/use-toast";
import { Plus, X } from "lucide-react";

interface MultiRoleSelectorProps {
  selectedRoles: string[];
  onRolesChange: (roles: string[]) => void;
}

const DEFAULT_ROLES = [
  "Vocalist", "Guitarist", "Bassist", "Drummer", "Keyboardist", 
  "Producer", "Sound Engineer", "Manager", "Songwriter"
];

export const MultiRoleSelector = ({ selectedRoles, onRolesChange }: MultiRoleSelectorProps) => {
  const { toast } = useToast();
  const { data: customRoles = [], createRole } = useCustomRoles();
  const [showCreateRole, setShowCreateRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  const allRoles = [...DEFAULT_ROLES, ...customRoles.map(r => r.name)];

  const handleRoleToggle = (role: string) => {
    if (selectedRoles.includes(role)) {
      onRolesChange(selectedRoles.filter(r => r !== role));
    } else {
      onRolesChange([...selectedRoles, role]);
    }
  };

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a role name",
        variant: "destructive"
      });
      return;
    }

    try {
      await createRole.mutateAsync(newRoleName.trim());
      setNewRoleName("");
      setShowCreateRole(false);
      toast({
        title: "Role created",
        description: `${newRoleName} role has been created`
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message.includes("duplicate") ? "This role already exists" : "Failed to create role",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
        <Label className="text-sm sm:text-base">Roles *</Label>
        <Dialog open={showCreateRole} onOpenChange={setShowCreateRole}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs sm:text-sm">
              <Plus className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add Custom Role</span>
              <span className="sm:hidden">Add Role</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="mx-4 w-[calc(100vw-2rem)] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Custom Role</DialogTitle>
              <DialogDescription>
                Add a new role that can be used by band members.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="roleName">Role Name</Label>
                <Input
                  id="roleName"
                  placeholder="Enter role name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateRole(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRole} disabled={createRole.isPending}>
                {createRole.isPending ? "Creating..." : "Create Role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {allRoles.map((role) => (
          <Button
            key={role}
            type="button"
            variant={selectedRoles.includes(role) ? "default" : "outline"}
            size="sm"
            onClick={() => handleRoleToggle(role)}
            className="justify-start text-xs sm:text-sm h-8 sm:h-9"
          >
            {role}
          </Button>
        ))}
      </div>

      {selectedRoles.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">Selected roles:</Label>
          <div className="flex flex-wrap gap-2">
            {selectedRoles.map((role) => (
              <Badge key={role} variant="secondary" className="gap-1">
                {role}
                <button
                  type="button"
                  onClick={() => handleRoleToggle(role)}
                  className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};