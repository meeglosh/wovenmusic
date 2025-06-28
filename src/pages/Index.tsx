
import { useState } from "react";
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import MusicLibrary from "@/components/MusicLibrary";
import PlaylistView from "@/components/PlaylistView";
import Player from "@/components/Player";
import { Track, Playlist } from "@/types/music";

const Index = () => {
  const [currentView, setCurrentView] = useState<"library" | "playlist">("library");
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Mock data for demo
  const [tracks] = useState<Track[]>([
    {
      id: "1",
      title: "Intro Riff v2",
      artist: "The Band",
      duration: "2:34",
      fileUrl: "#",
      addedAt: new Date(),
    },
    {
      id: "2", 
      title: "Chorus Harmony",
      artist: "The Band",
      duration: "1:47",
      fileUrl: "#",
      addedAt: new Date(),
    },
    {
      id: "3",
      title: "Bridge Experiment",
      artist: "The Band", 
      duration: "3:12",
      fileUrl: "#",
      addedAt: new Date(),
    },
  ]);

  const [playlists] = useState<Playlist[]>([
    {
      id: "1",
      name: "New Song Ideas",
      trackIds: ["1", "2"],
      createdAt: new Date(),
      sharedWith: ["john@band.com"],
    },
    {
      id: "2",
      name: "Album Demos",
      trackIds: ["2", "3"],
      createdAt: new Date(),
      sharedWith: [],
    },
  ]);

  const handlePlayTrack = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const handleViewPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setCurrentView("playlist");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          playlists={playlists}
          currentView={currentView}
          onViewChange={setCurrentView}
          onPlaylistSelect={handleViewPlaylist}
        />
        
        <main className="flex-1 overflow-auto">
          {currentView === "library" ? (
            <MusicLibrary 
              tracks={tracks} 
              onPlayTrack={handlePlayTrack}
            />
          ) : (
            <PlaylistView 
              playlist={selectedPlaylist}
              tracks={tracks}
              onPlayTrack={handlePlayTrack}
              onBack={() => setCurrentView("library")}
            />
          )}
        </main>
      </div>

      {currentTrack && (
        <Player 
          track={currentTrack}
          isPlaying={isPlaying}
          onPlayPause={() => setIsPlaying(!isPlaying)}
        />
      )}
    </div>
  );
};

export default Index;
