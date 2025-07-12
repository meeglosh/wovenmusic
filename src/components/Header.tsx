
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Upload, Users, Settings, Shield, LogOut, Palette, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, THEMES, type Theme } from "@/hooks/useTheme";
import UploadModal from "./UploadModal";
import MobileNav from "./MobileNav";
import { Playlist } from "@/types/music";

interface HeaderProps {
  playlists?: Playlist[];
  currentView?: "library" | "playlist";
  onViewChange?: (view: "library" | "playlist") => void;
  onPlaylistSelect?: (playlist: Playlist) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

const Header = ({ playlists = [], currentView = "library", onViewChange, onPlaylistSelect, searchTerm = "", onSearchChange }: HeaderProps) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const [showUploadModal, setShowUploadModal] = useState(false);

  const currentThemeLabel = themes.find(t => t.value === theme)?.label || 'Theme';

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
          
          <h1 className="text-lg sm:text-2xl font-rem font-thin text-primary">
            Wovenmusic
          </h1>
        </div>

        {/* Search - Hidden on mobile, shown on larger screens */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Search tracks, playlists..." 
              className="pl-10 bg-muted/30 border border-border text-primary"
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-primary">
                <Palette className="w-4 h-4 mr-2" />
                {currentThemeLabel}
                <ChevronDown className="w-3 h-3 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-2 border-border shadow-lg" style={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}}>
              {themes.map((themeOption) => (
                <DropdownMenuItem
                  key={themeOption.value}
                  onClick={() => setTheme(themeOption.value as Theme)}
                  className={theme === themeOption.value ? "bg-primary/50" : ""}
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-primary">{themeOption.label}</span>
                    <span className="text-xs text-muted-foreground">{themeOption.description}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={() => setShowUploadModal(true)} className="text-primary">
            <Upload className="w-4 h-4 mr-2" />
            Upload
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-primary">
                <Settings className="w-4 h-4 mr-2" />
                Settings
                <ChevronDown className="w-3 h-3 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-card border-2 border-border shadow-lg" style={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}}>
              <DropdownMenuItem onClick={() => navigate("/members")} className="text-primary">
                <Users className="w-4 h-4 mr-2" />
                Members
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/privacy-settings")} className="text-primary">
                <Shield className="w-4 h-4 mr-2" />
                Privacy
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-primary">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Actions - Icon only buttons */}
        <div className="flex lg:hidden items-center space-x-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Palette className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 bg-card border-2 border-border shadow-lg" style={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}}>
              {themes.map((themeOption) => (
                <DropdownMenuItem
                  key={themeOption.value}
                  onClick={() => setTheme(themeOption.value as Theme)}
                  className={theme === themeOption.value ? "bg-primary/50" : ""}
                >
                  <span className="font-medium text-sm text-primary">{themeOption.label}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" onClick={() => setShowUploadModal(true)}>
            <Upload className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 bg-card border-2 border-border shadow-lg" style={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}}>
              <DropdownMenuItem onClick={() => navigate("/members")} className="text-primary">
                <Users className="w-4 h-4 mr-2" />
                <span className="text-sm">Members</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/privacy-settings")} className="text-primary">
                <Shield className="w-4 h-4 mr-2" />
                <span className="text-sm">Privacy</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-primary">
                <LogOut className="w-4 h-4 mr-2" />
                <span className="text-sm">Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <UploadModal open={showUploadModal} onOpenChange={setShowUploadModal} />
    </header>
  );
};

export default Header;
