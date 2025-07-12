import { useParams, useNavigate } from "react-router-dom";
import { useTracks, useUpdateTrack, useIncrementPlayCount } from "@/hooks/useTracks";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Play, Pause, MessageSquare, Send, ArrowLeft, LogIn, Lock, Globe, Settings, Edit, Trash2, Save, User } from "lucide-react";
import { useComments, useAddComment, useUpdateComment, useDeleteComment } from "@/hooks/useComments";
import Waveform from "@/components/Waveform";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useState, useEffect } from "react";
import { Comment } from "@/types/music";

const TrackView = () => {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const { data: tracks, isLoading } = useTracks();
  const audioPlayer = useAudioPlayer();
  const { toast } = useToast();
  const { user } = useAuth();
  const updateTrackMutation = useUpdateTrack();
  const incrementPlayCountMutation = useIncrementPlayCount();
  
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentTime, setCommentTime] = useState(0);
  const [commentContent, setCommentContent] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  const track = tracks?.find(t => t.id === trackId);
  const { data: comments = [] } = useComments(track?.id || "");
  const addCommentMutation = useAddComment();
  const updateCommentMutation = useUpdateComment();
  const deleteCommentMutation = useDeleteComment();

  // Auto-play the track when the component mounts
  useEffect(() => {
    if (track && audioPlayer.currentTrack?.id !== track.id) {
      audioPlayer.playTrack(track);
    }
  }, [track, audioPlayer]);

  // Track play count - increment when track starts playing
  useEffect(() => {
    if (audioPlayer.isPlaying && track && audioPlayer.currentTrack?.id === track.id) {
      // Only increment once per track load
      const hasTrackedPlay = sessionStorage.getItem(`tracked-${track.id}`);
      if (!hasTrackedPlay) {
        incrementPlayCountMutation.mutate(track.id);
        sessionStorage.setItem(`tracked-${track.id}`, 'true');
      }
    }
  }, [audioPlayer.isPlaying, track, audioPlayer.currentTrack, incrementPlayCountMutation]);

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

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editingContent.trim()) return;

    try {
      await updateCommentMutation.mutateAsync({
        commentId,
        content: editingContent.trim(),
        trackId: track!.id
      });
      
      setEditingCommentId(null);
      setEditingContent("");
      toast({
        title: "Comment updated",
        description: "Your comment has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update comment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingCommentId(null);
    setEditingContent("");
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteCommentMutation.mutateAsync({
        commentId,
        trackId: track!.id
      });
      
      toast({
        title: "Comment deleted",
        description: "Your comment has been deleted successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete comment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handlePrivacyChange = async (isPublic: boolean) => {
    try {
      await updateTrackMutation.mutateAsync({
        id: track!.id,
        updates: { is_public: isPublic }
      });
      
      toast({
        title: "Privacy updated",
        description: `Track is now ${isPublic ? 'public' : 'private'}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update track privacy",
        variant: "destructive",
      });
    }
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
    <div className="min-h-screen bg-background">
      {/* Hidden audio element */}
      <audio ref={audioPlayer.audioRef} className="hidden" />
      
      {/* Header with SoundCloud-style gradient */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-border/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-primary hover:text-primary/80 hover:bg-primary/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content with SoundCloud-inspired layout */}
      <div className="container mx-auto px-6 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Hero Section with Large Waveform */}
          <div className="text-center mb-12">
            <div className="mb-8">
              <div className="inline-flex items-center gap-4 mb-6">
                <Button
                  variant="default"
                  size="lg"
                  className="w-20 h-20 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                  onClick={audioPlayer.togglePlayPause}
                >
                  {audioPlayer.isPlaying ? (
                    <Pause className="w-10 h-10 fill-current" />
                  ) : (
                    <Play className="w-10 h-10 fill-current ml-1" />
                  )}
                </Button>
                <div className="text-left">
                  <h2 className="text-xl font-semibold text-primary">{track.title}</h2>
                  <p className="text-primary">{track.artist}</p>
                </div>
              </div>
            </div>
            
            {/* Large Waveform */}
            <div className="mb-8 shadow-2xl rounded-2xl overflow-hidden border-2 border-primary">
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

            {/* Time Display */}
            <div className="flex justify-center items-center space-x-6 text-lg">
              <span className="font-mono text-primary">{audioPlayer.formatTime(audioPlayer.currentTime)}</span>
              <div className="w-48 h-2 bg-muted rounded-full overflow-hidden border border-border">
                <div
                  className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300"
                  style={{ width: `${audioPlayer.duration > 0 ? (audioPlayer.currentTime / audioPlayer.duration) * 100 : 0}%` }}
                />
              </div>
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

          {/* Content Grid - SoundCloud Style */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Comments Section */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-primary">
                <MessageSquare className="w-6 h-6 text-primary" />
                Comments
                <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded-full">
                  {comments.length}
                </span>
              </h2>
              
              {comments.length === 0 ? (
                <Card className="border-dashed border-2">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                      <MessageSquare className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold mb-2">Start the conversation</h3>
                    <p className="text-muted-foreground mb-4">
                      {user 
                        ? "Be the first to comment on this track. Shift+click on the waveform to add a comment at any moment!" 
                        : "Join the conversation by logging in and adding your thoughts!"
                      }
                    </p>
                    {!user && (
                      <Button className="mt-2" onClick={() => navigate('/auth')}>
                        <LogIn className="w-4 h-4 mr-2" />
                        Login to Comment
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <Card key={comment.id} className={`transition-all duration-200 group ${editingCommentId === comment.id ? 'border-primary' : 'hover:shadow-md hover:border-primary/20'}`}>
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold cursor-pointer hover:scale-105 transition-transform"
                              onClick={() => jumpToComment(comment.timestampSeconds)}
                            >
                              {comment.timestampSeconds < 60 ? Math.floor(comment.timestampSeconds) : Math.floor(comment.timestampSeconds / 60)}
                            </div>
                            <div className="flex flex-col space-y-1">
                              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                <span 
                                  className="font-mono bg-muted px-2 py-1 rounded text-xs group-hover:bg-primary/10 transition-colors cursor-pointer"
                                  onClick={() => jumpToComment(comment.timestampSeconds)}
                                >
                                  {audioPlayer.formatTime(comment.timestampSeconds)}
                                </span>
                                <span>•</span>
                                <span>{comment.createdAt.toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                <User className="w-3 h-3" />
                                <span>{comment.userFullName || comment.userEmail || 'Unknown User'}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Edit/Delete buttons - only show for user's own comments */}
                          {user && comment.userId === user.id && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                              {editingCommentId === comment.id ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleSaveEdit(comment.id)}
                                    disabled={updateCommentMutation.isPending}
                                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100"
                                  >
                                    <Save className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditComment(comment)}
                                    className="h-8 w-8 p-0 text-primary hover:text-primary/80"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteComment(comment.id)}
                                    disabled={deleteCommentMutation.isPending}
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive/80"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {editingCommentId === comment.id ? (
                          <div className="pl-11">
                            <Textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              rows={3}
                              className="resize-none text-sm"
                              placeholder="Edit your comment..."
                            />
                          </div>
                        ) : (
                          <div className="pl-11">
                            <p className="text-sm leading-relaxed">{comment.content}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
            
            {/* Sidebar with Track Info */}
            <div className="space-y-6">
              {/* Privacy Settings */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    {track.is_public ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    Privacy Settings
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <Label htmlFor="track-privacy" className="text-sm font-medium">
                          Make track public
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {track.is_public 
                            ? "Anyone can discover and listen to this track" 
                            : "Only you can access this track"
                          }
                        </p>
                      </div>
                      <Switch
                        id="track-privacy"
                        checked={track.is_public || false}
                        onCheckedChange={handlePrivacyChange}
                        disabled={updateTrackMutation.isPending}
                      />
                    </div>
                    <div className="pt-2">
                      <Badge variant={track.is_public ? "default" : "secondary"} className="text-xs">
                        {track.is_public ? (
                          <><Globe className="h-3 w-3 mr-1" />Public</>
                        ) : (
                          <><Lock className="h-3 w-3 mr-1" />Private</>
                        )}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div>
                <h2 className="text-xl font-bold mb-4 text-primary">Track Details</h2>
                <Card className="overflow-hidden">
                  <div className="h-2 bg-gradient-to-r from-primary to-secondary"></div>
                  <CardContent className="p-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-bold text-lg">{track.title}</h3>
                        <p className="text-muted-foreground">{track.artist}</p>
                      </div>
                      <div className="pt-4 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Duration</span>
                          <span className="font-mono">{track.duration}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Statistics */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold mb-4">Statistics</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Plays</span>
                      <span className="font-medium">{track.play_count || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Comments</span>
                      <span className="font-medium">{comments.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Added</span>
                      <span className="font-medium">{track.addedAt.toLocaleDateString()}</span>
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