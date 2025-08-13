
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Upload, Users, Settings, Shield, LogOut, Palette, ChevronDown, Volume2, HardDrive } from "lucide-react";
import { OfflineStorageManager } from "@/components/OfflineStorageManager";
import { OfflineStatusIndicator } from "@/components/OfflineStatusIndicator";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, THEMES, type Theme } from "@/hooks/useTheme";
import UploadModal from "./UploadModal";
import ConversionQualitySelector from "./ConversionQualitySelector";
import MobileNav from "./MobileNav";
import { Playlist } from "@/types/music";
import { useCurrentUserProfile } from "@/hooks/useBandMembers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface HeaderProps {
  playlists?: Playlist[];
  currentView?: "library" | "playlist";
  onViewChange?: (view: "library" | "playlist") => void;
  onPlaylistSelect?: (playlist: Playlist) => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  tracks?: any[];
}

const Header = ({ playlists = [], currentView = "library", onViewChange, onPlaylistSelect, searchTerm = "", onSearchChange, tracks = [] }: HeaderProps) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  const [audioQuality, setAudioQuality] = useState("mp3-320");
  const { data: userProfile } = useCurrentUserProfile();

  // Load saved conversion quality from localStorage on mount
  useEffect(() => {
    const savedQuality = localStorage.getItem('conversionQuality');
    if (savedQuality) {
      setAudioQuality(savedQuality);
    }
  }, []);

  // Save conversion quality to localStorage when it changes
  const handleQualityChange = (quality: string) => {
    setAudioQuality(quality);
    localStorage.setItem('conversionQuality', quality);
  };

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
              tracks={tracks}
            />
          )}
          
          <div className="flex items-center space-x-2">
            <img 
              src="/lovable-uploads/bce94625-29f4-468a-8445-869ab1fda164.png" 
              alt="Wovenmusic Logo" 
              className="w-6 h-6 sm:w-8 sm:h-8"
            />
            <h1 className="text-lg sm:text-2xl font-rem font-thin text-primary">
              Wovenmusic
            </h1>
          </div>
        </div>

        {/* Search - Hidden on mobile, shown on larger screens */}
        <div className="hidden md:flex flex-1 max-w-md mx-8">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Scour the drift..." 
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
            <DropdownMenuContent align="end" className="w-60 bg-card border-2 border-border shadow-lg" style={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}}>
              {userProfile && (
                <>
                  <div className="flex items-center gap-3 p-3 border-b border-border">
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={userProfile.avatar_url || undefined} alt={userProfile.full_name || ''} />
                      <AvatarFallback className="bg-muted text-muted-foreground">
                        {userProfile.full_name?.charAt(0) || userProfile.email?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium text-primary text-sm truncate">{userProfile.full_name || 'User'}</span>
                      <span className="text-xs text-muted-foreground truncate">{userProfile.email}</span>
                    </div>
                  </div>
                </>
              )}
              <DropdownMenuItem onClick={() => navigate("/members")} className="text-primary">
                <Users className="w-4 h-4 mr-2" />
                Members
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/privacy-settings")} className="text-primary">
                <Shield className="w-4 h-4 mr-2" />
                Privacy
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowOfflineManager(true)} className="text-primary">
                <HardDrive className="w-4 h-4 mr-2" />
                Offline Storage
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <ConversionQualitySelector 
                value={audioQuality} 
                onChange={handleQualityChange} 
                size="default"
              />
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
              <Button variant="ghost" size="sm" className="text-primary">
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
          <Button variant="ghost" size="sm" onClick={() => setShowUploadModal(true)} className="text-primary">
            <Upload className="w-4 h-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-primary">
                <Settings className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-card border-2 border-border shadow-lg" style={{backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))'}}>
              {userProfile && (
                <>
                  <div className="flex items-center gap-2 p-3 border-b border-border">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={userProfile.avatar_url || undefined} alt={userProfile.full_name || ''} />
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {userProfile.full_name?.charAt(0) || userProfile.email?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium text-primary text-xs truncate">{userProfile.full_name || 'User'}</span>
                      <span className="text-xs text-muted-foreground truncate">{userProfile.email}</span>
                    </div>
                  </div>
                </>
              )}
              <DropdownMenuItem onClick={() => navigate("/members")} className="text-primary">
                <Users className="w-4 h-4 mr-2" />
                <span className="text-sm">Members</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/privacy-settings")} className="text-primary">
                <Shield className="w-4 h-4 mr-2" />
                <span className="text-sm">Privacy</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowOfflineManager(true)} className="text-primary">
                <HardDrive className="w-4 h-4 mr-2" />
                <span className="text-sm">Offline Storage</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <ConversionQualitySelector 
                value={audioQuality} 
                onChange={handleQualityChange} 
                size="mobile"
              />
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="text-primary">
                <LogOut className="w-4 h-4 mr-2" />
                <span className="text-sm">Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <UploadModal open={showUploadModal} onOpenChange={setShowUploadModal} audioQuality={audioQuality} />
      <OfflineStorageManager open={showOfflineManager} onOpenChange={setShowOfflineManager} />
    </header>
  );
};

export default Header;
