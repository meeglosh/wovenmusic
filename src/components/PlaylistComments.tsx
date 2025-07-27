import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, Send, Edit2, Trash2, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useBandMembers } from "@/hooks/useBandMembers";
import {
  usePlaylistComments,
  useAddPlaylistComment,
  useUpdatePlaylistComment,
  useDeletePlaylistComment,
  type PlaylistComment,
} from "@/hooks/usePlaylistComments";

interface PlaylistCommentsProps {
  playlistId: string;
  playlistName: string;
}

export const PlaylistComments = ({ playlistId, playlistName }: PlaylistCommentsProps) => {
  const { user } = useAuth();
  const { data: bandMembers } = useBandMembers();
  const { data: comments = [], isLoading } = usePlaylistComments(playlistId);
  const addComment = useAddPlaylistComment();
  const updateComment = useUpdatePlaylistComment();
  const deleteComment = useDeletePlaylistComment();

  const [newComment, setNewComment] = useState("");
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;

    await addComment.mutateAsync({
      playlistId,
      userId: user.id,
      content: newComment.trim(),
      userEmail: user.email,
      userFullName: "",
    });

    setNewComment("");
  };

  const handleEditComment = (comment: PlaylistComment) => {
    setEditingComment(comment.id);
    setEditContent(comment.content);
  };

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim()) return;

    await updateComment.mutateAsync({
      commentId,
      content: editContent.trim(),
      playlistId,
    });

    setEditingComment(null);
    setEditContent("");
  };

  const handleDeleteComment = async (commentId: string) => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      await deleteComment.mutateAsync({ commentId, playlistId });
    }
  };

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  // Parse @mentions in content and highlight them
  const parseContent = (content: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        // This is a mention
        return (
          <span key={index} className="text-primary font-medium bg-primary/10 px-1 rounded">
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  if (!user) {
    return (
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Please sign in to view and post comments.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-8" id="comments">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new comment */}
        <div className="space-y-4">
          <Textarea
            placeholder={`Add a comment about ${playlistName}... (Use @username to mention band members)`}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[100px]"
          />
          <Button 
            onClick={handleSubmitComment}
            disabled={!newComment.trim() || addComment.isPending}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {addComment.isPending ? "Posting..." : "Post Comment"}
          </Button>
        </div>

        {/* Comments list */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 group">
                <Avatar className="h-8 w-8 mt-1">
                  <AvatarFallback className="text-xs">
                    {getInitials(comment.userFullName, comment.userEmail)}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {comment.userFullName || comment.userEmail || "Unknown User"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                    </span>
                    {comment.userId === user.id && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditComment(comment)}
                          className="h-6 w-6 p-0"
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {editingComment === comment.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUpdateComment(comment.id)}
                          disabled={!editContent.trim() || updateComment.isPending}
                        >
                          {updateComment.isPending ? "Saving..." : "Save"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingComment(null);
                            setEditContent("");
                          }}
                        >
                          <X className="h-4 w-4" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm bg-muted/50 rounded-lg p-3">
                      {parseContent(comment.content)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};