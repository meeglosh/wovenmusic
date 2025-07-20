import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { X, Play, Pause, MessageSquare, Send } from "lucide-react";
import { Track, Comment } from "@/types/music";
import { useComments, useAddComment } from "@/hooks/useComments";
import Waveform from "./Waveform";
import { useToast } from "@/hooks/use-toast";

interface FullScreenPlayerProps {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  audioRef: React.RefObject<HTMLAudioElement>;
  onClose: () => void;
  onTogglePlayPause: () => void;
  onSeek: (time: number) => void;
  formatTime: (time: number) => string;
}

const FullScreenPlayer = ({
  track,
  isPlaying,
  currentTime,
  duration,
  audioRef,
  onClose,
  onTogglePlayPause,
  onSeek,
  formatTime
}: FullScreenPlayerProps) => {
  const [showCommentForm, setShowCommentForm] = useState(false);
  const [commentTime, setCommentTime] = useState(0);
  const [commentContent, setCommentContent] = useState("");
  
  const { data: comments = [], isLoading } = useComments(track.id);
  const addCommentMutation = useAddComment();
  const { toast } = useToast();

  const handleAddComment = (timestampSeconds: number) => {
    setCommentTime(timestampSeconds);
    setShowCommentForm(true);
  };

  const handleSubmitComment = async () => {
    if (!commentContent.trim()) return;

    try {
      await addCommentMutation.mutateAsync({
        trackId: track.id,
        userId: "", // Will be set by the mutation
        content: commentContent,
        timestampSeconds: commentTime
      });
      
      setCommentContent("");
      setShowCommentForm(false);
      toast({
        title: "Comment added",
        description: `Comment added at ${formatTime(commentTime)}`
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
    onSeek(timestamp);
  };

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-auto">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-primary">{track.title}</h1>
            <p className="text-muted-foreground">{track.artist}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Main Player */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Waveform */}
            <Waveform
              audioRef={audioRef}
              currentTime={currentTime}
              duration={duration}
              onSeek={onSeek}
              comments={comments}
              onAddComment={handleAddComment}
            />

            {/* Controls */}
            <div className="flex items-center justify-center space-x-4">
              <Button
                variant="default"
                size="lg"
                className="w-12 h-12 rounded-full"
                onClick={onTogglePlayPause}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current" />
                )}
              </Button>
            </div>

            {/* Time Display */}
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Comment Form */}
            {showCommentForm && (
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        Add comment at {formatTime(commentTime)}
                      </span>
                    </div>
                    <Textarea
                      placeholder="Enter your comment..."
                      value={commentContent}
                      onChange={(e) => setCommentContent(e.target.value)}
                      rows={3}
                    />
                    <div className="flex space-x-2">
                      <Button onClick={handleSubmitComment} disabled={addCommentMutation.isPending}>
                        <Send className="w-4 h-4 mr-2" />
                        Add Comment
                      </Button>
                      <Button variant="ghost" onClick={() => setShowCommentForm(false)} className="text-primary">
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Comments Sidebar */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-primary">Comments</h2>
            
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No comments yet. Shift+click on the waveform to add one!
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {comments.map((comment) => (
                  <Card key={comment.id} className="cursor-pointer hover:bg-muted/50">
                    <CardContent className="p-3" onClick={() => jumpToComment(comment.timestampSeconds)}>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground mb-1">
                        <span>{formatTime(comment.timestampSeconds)}</span>
                        <span>•</span>
                        <span>{comment.createdAt.toLocaleDateString()}</span>
                      </div>
                      <p className="text-sm">{comment.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FullScreenPlayer;