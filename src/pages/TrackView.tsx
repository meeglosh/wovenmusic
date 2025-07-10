import { useParams, useNavigate } from "react-router-dom";
import { useTracks } from "@/hooks/useTracks";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Play, Pause, MessageSquare, Send, ArrowLeft, LogIn } from "lucide-react";
import { useComments, useAddComment } from "@/hooks/useComments";
import Waveform from "@/components/Waveform";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";

const TrackView = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const { data: tracks, isLoading } = useTracks();
  const audioPlayer = useAudioPlayer();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentTime, setCommentTime] = useState(0);
  const [commentContent, setCommentContent] = useState("");

  const track = tracks?.find(t => t.id === trackId);
  const { data: comments = [] } = useComments(track?.id || "");
  const addCommentMutation = useAddComment();

  // Auto-play the track when the component mounts
  useEffect(() => {
    if (track && audioPlayer.currentTrack?.id !== track.id) {
      audioPlayer.playTrack(track);
    }
  }, [track, audioPlayer]);

  const handleAddComment = (timestampSeconds: number) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to add comments to tracks.",
        action: (
          <Button size="sm" onClick={() => navigate('/auth')}>
            <LogIn className="w-4 h-4 mr-2" />
            Login
          </Button>
        ),
      });
      return;
    }
    setCommentTime(timestampSeconds);
    setShowCommentForm(true);
  };

  const handleSubmitComment = async () => {
    if (!commentContent.trim()) return;

    try {
      await addCommentMutation.mutateAsync({
        trackId: track!.id,
        userId: "",
        content: commentContent,
        timestampSeconds: commentTime
      });
      
      setCommentContent("");
      setShowCommentForm(false);
      toast({
        title: "Comment added",
        description: `Comment added at ${audioPlayer.formatTime(commentTime)}`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const jumpToComment = (timestamp: number) => {
    audioPlayer.seekTo(timestamp);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading track...</p>
        </div>
      </div>
    );
  }

  if (!track) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Track not found</h1>
          <p className="text-muted-foreground mb-4">The track you're looking for doesn't exist.</p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Library
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Hidden audio element */}
      <audio ref={audioPlayer.audioRef} className="hidden" />
      
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Library
            </Button>
            <div className="text-center">
              <h1 className="text-xl font-bold">{track.title}</h1>
              <p className="text-sm text-muted-foreground">{track.artist}</p>
            </div>
            <div className="w-24" /> {/* Spacer for centering */}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Large Waveform - SoundCloud Style */}
          <div className="mb-8">
            <Waveform
              audioRef={audioPlayer.audioRef}
              currentTime={audioPlayer.currentTime}
              duration={audioPlayer.duration}
              onSeek={audioPlayer.seekTo}
              comments={comments}
              onAddComment={handleAddComment}
              isAuthenticated={!!user}
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center mb-6">
            <Button
              variant="default"
              size="lg"
              className="w-16 h-16 rounded-full"
              onClick={audioPlayer.togglePlayPause}
            >
              {audioPlayer.isPlaying ? (
                <Pause className="w-8 h-8 fill-current" />
              ) : (
                <Play className="w-8 h-8 fill-current ml-1" />
              )}
            </Button>
          </div>

          {/* Time Display */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-4 text-sm">
              <span className="font-mono">{audioPlayer.formatTime(audioPlayer.currentTime)}</span>
              <span className="text-muted-foreground">/</span>
              <span className="font-mono text-muted-foreground">{audioPlayer.formatTime(audioPlayer.duration)}</span>
            </div>
          </div>

          {/* Comment Form */}
          {showCommentForm && (
            <Card className="mb-8">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5" />
                    <span className="font-medium">
                      Add comment at {audioPlayer.formatTime(commentTime)}
                    </span>
                  </div>
                  <Textarea
                    placeholder="What's happening at this moment in the track?"
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex space-x-3">
                    <Button onClick={handleSubmitComment} disabled={addCommentMutation.isPending}>
                      <Send className="w-4 h-4 mr-2" />
                      Add Comment
                    </Button>
                    <Button variant="outline" onClick={() => setShowCommentForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Comments ({comments.length})</h2>
              
              {comments.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {user 
                        ? "No comments yet. Shift+click on the waveform to add the first one!" 
                        : "No comments yet. Log in to add comments!"
                      }
                    </p>
                    {!user && (
                      <Button className="mt-4" onClick={() => navigate('/auth')}>
                        <LogIn className="w-4 h-4 mr-2" />
                        Login to Comment
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <Card key={comment.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4" onClick={() => jumpToComment(comment.timestampSeconds)}>
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground mb-2">
                          <span className="font-mono">{audioPlayer.formatTime(comment.timestampSeconds)}</span>
                          <span>•</span>
                          <span>{comment.createdAt.toLocaleDateString()}</span>
                        </div>
                        <p className="text-sm leading-relaxed">{comment.content}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            {/* Track Info */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Track Info</h2>
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-1">{track.title}</h3>
                      <p className="text-sm text-muted-foreground">{track.artist}</p>
                    </div>
                    <div className="text-sm">
                      <p><span className="font-medium">Duration:</span> {track.duration}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackView;