
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Upload, Users, Settings, Shield, LogOut, Palette } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import UploadModal from "./UploadModal";
import MobileNav from "./MobileNav";
import { Playlist } from "@/types/music";

interface HeaderProps {
  playlists?: Playlist[];
  currentView?: "library" | "playlist";
  onViewChange?: (view: "library" | "playlist") => void;
  onPlaylistSelect?: (playlist: Playlist) => void;
}

const Header = ({ playlists = [], currentView = "library", onViewChange, onPlaylistSelect }: HeaderProps) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { toggleTheme } = useTheme();
  const [showUploadModal, setShowUploadModal] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Mobile Navigation */}
          {onViewChange && onPlaylistSelect && (
            <MobileNav 
              playlists={playlists}
              currentView={currentView}
              onViewChange={onViewChange}
              onPlaylistSelect={onPlaylistSelect}
            />
          )}
          
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-primary to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs sm:text-sm">W</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-rem font-thin bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              Wovenmusic
            </h1>
          </div>
        </div>

        {/* Search - Hidden on mobile, shown on larger screens */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Search tracks, playlists..." 
              className="pl-10 bg-muted/30 border-muted"
            />
          </div>
        </div>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={toggleTheme}>
            <Palette className="w-4 h-4 mr-2" />
            Theme
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowUploadModal(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/members")}>
            <Users className="w-4 h-4 mr-2" />
            Members
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/privacy-settings")}>
            <Shield className="w-4 h-4 mr-2" />
            Privacy
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Mobile Actions - Icon only buttons */}
        <div className="flex lg:hidden items-center space-x-1">
          <Button variant="ghost" size="sm" onClick={toggleTheme}>
            <Palette className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowUploadModal(true)}>
            <Upload className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/members")}>
            <Users className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate("/privacy-settings")}>
            <Shield className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <UploadModal open={showUploadModal} onOpenChange={setShowUploadModal} />
    </header>
  );
};

export default Header;
