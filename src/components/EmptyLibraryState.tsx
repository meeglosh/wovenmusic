import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Music, Users } from "lucide-react";
import DropboxIcon from "./icons/DropboxIcon";
import UploadModal from "./UploadModal";
import { DropboxConnectModal } from "./DropboxConnectModal";
import { useNavigate } from "react-router-dom";

interface EmptyLibraryStateProps {
  onDropboxConnected?: () => void;
}

const EmptyLibraryState = ({ onDropboxConnected }: EmptyLibraryStateProps) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDropboxModal, setShowDropboxModal] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center max-w-2xl mx-auto space-y-8">
          <div>
            <div className="w-24 h-24 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Music className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-3 text-primary font-rem">Welcome to Your Music Library</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Your vessel hums with potential. Seed it with sound or summon your co-dreamers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors cursor-pointer"
                  onClick={() => setShowUploadModal(true)}>
              <CardHeader className="text-center pb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Upload Music</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription>
                  Upload your audio files directly from your device. Supports MP3, WAV, and other formats.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors cursor-pointer"
                  onClick={() => setShowDropboxModal(true)}>
              <CardHeader className="text-center pb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <DropboxIcon className="w-6 h-6 fill-primary" />
                </div>
                <CardTitle className="text-lg">Sync Dropbox</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription>
                  Connect your Dropbox account to automatically sync your music folder.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-2 border-dashed border-primary/20 hover:border-primary/40 transition-colors cursor-pointer"
                  onClick={() => navigate('/members')}>
              <CardHeader className="text-center pb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg">Invite Collaborators</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <CardDescription>
                  Invite band members and collaborators to share and work on music together.
                </CardDescription>
              </CardContent>
            </Card>
          </div>

          <div className="pt-4">
            <p className="text-sm text-muted-foreground">
              Need help getting started? Check out our{" "}
              <a href="#" className="text-primary hover:underline">quick start guide</a>
            </p>
          </div>
        </div>
      </div>

      <UploadModal 
        open={showUploadModal} 
        onOpenChange={setShowUploadModal} 
      />
      
      <DropboxConnectModal
        open={showDropboxModal}
        onOpenChange={setShowDropboxModal}
        onSuccess={() => {
          setShowDropboxModal(false);
          onDropboxConnected?.();
        }}
      />
    </>
  );
};

export default EmptyLibraryState;