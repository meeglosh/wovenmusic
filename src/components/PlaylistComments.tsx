import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, Send, Edit2, Trash2, X, Reply } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { useBandMembers } from "@/hooks/useBandMembers";
import { MentionAutocomplete } from "@/components/MentionAutocomplete";
import { resolveImageUrl } from "@/services/cdn";
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
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [replyCursorPosition, setReplyCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;

    await addComment.mutateAsync({
      playlistId,
      userId: user.id,
      content: newComment.trim(),
      userEmail: user.email || "",
      userFullName: "",
      parentId: null,
    });

    setNewComment("");
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim() || !user) return;

    await addComment.mutateAsync({
      playlistId,
      userId: user.id,
      content: replyContent.trim(),
      userEmail: user.email || "",
      userFullName: "",
      parentId,
    });

    setReplyContent("");
    setReplyingTo(null);
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

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const handleTextareaChange = (value: string) => {
    setNewComment(value);
    if (textareaRef.current) {
      setCursorPosition(textareaRef.current.selectionStart);
    }
  };

  const handleMentionSelect = (newValue: string) => {
    setNewComment(newValue);
    // Focus back to textarea and set cursor position after the mention
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = newValue.indexOf(" ", newValue.lastIndexOf("@")) + 1;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        setCursorPosition(newCursorPos);
      }
    }, 0);
  };

  const handleReplyMentionSelect = (newValue: string) => {
    setReplyContent(newValue);
    // Focus back to textarea and set cursor position after the mention
    setTimeout(() => {
      if (replyTextareaRef.current) {
        const newCursorPos = newValue.indexOf(" ", newValue.lastIndexOf("@")) + 1;
        replyTextareaRef.current.focus();
        replyTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        setReplyCursorPosition(newCursorPos);
      }
    }, 0);
  };

  const handleReplyTextareaChange = (value: string) => {
    setReplyContent(value);
    if (replyTextareaRef.current) {
      setReplyCursorPosition(replyTextareaRef.current.selectionStart);
    }
  };

  // Get user profile from band members for avatar
  const getUserProfile = (userId: string) => {
    return bandMembers?.find(member => member.id === userId);
  };

  // Parse @mentions in content and highlight them
  const parseContent = (content: string) => {
    // Updated regex to match mentions with spaces and special characters
    const mentionRegex = /@([^@\s]+(?:\s+[^@\s]+)*)/g;
    const parts = content.split(mentionRegex);
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        // This is a mention - check if it matches a real band member
        const isValidMention = bandMembers?.some(member => 
          (member.full_name && member.full_name.toLowerCase() === part.toLowerCase()) ||
          (member.email && member.email.toLowerCase() === part.toLowerCase())
        );
        
        return (
          <span 
            key={index} 
            className={`font-medium px-1 rounded ${
              isValidMention 
                ? "text-primary bg-primary/10" 
                : "text-muted-foreground bg-muted/50"
            }`}
          >
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  const getReplyToText = (parentComment: PlaylistComment) => {
    const userProfile = getUserProfile(parentComment.userId);
    const displayName = userProfile?.full_name || parentComment.userFullName || userProfile?.email || parentComment.userEmail || "Unknown User";
    return `Replying to @${displayName}`;
  };

  const renderComment = (comment: PlaylistComment, isReply: boolean = false) => {
    const userProfile = getUserProfile(comment.userId);
    
    return (
      <div key={comment.id} className={`flex gap-3 group ${isReply ? 'ml-8 mt-4 pl-4 bg-primary/10 rounded-lg border-l-2 border-primary/25' : ''}`}>
        <Avatar className="h-8 w-8 mt-1">
          <AvatarImage src={resolveImageUrl(userProfile?.avatar_url)} />
          <AvatarFallback className="text-xs bg-primary/20 text-primary">
            {getInitials(
              userProfile?.full_name || comment.userFullName, 
              userProfile?.email || comment.userEmail
            )}
          </AvatarFallback>
        </Avatar>
      
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {userProfile?.full_name || comment.userFullName || userProfile?.email || comment.userEmail || "Unknown User"}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
            </span>
            {comment.userId === user?.id && (
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
            <>
              <div className="text-sm bg-muted/50 rounded-lg p-3">
                {parseContent(comment.content)}
              </div>
              
              {/* Reply button for top-level comments */}
              {!isReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setReplyingTo(comment.id);
                    setTimeout(() => replyTextareaRef.current?.focus(), 100);
                  }}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Reply className="h-3 w-3 mr-1" />
                  Reply
                </Button>
              )}
              
              {/* Reply form */}
              {replyingTo === comment.id && (
                <div className="space-y-3 mt-4 pl-4 border-l-2 border-muted">
                  <div className="text-xs text-muted-foreground">
                    {getReplyToText(comment)}
                  </div>
                   <div className="relative">
                     <Textarea
                       ref={replyTextareaRef}
                       placeholder={`Reply to ${userProfile?.full_name || comment.userFullName || "this comment"}... (Type @ to mention band members)`}
                       value={replyContent}
                       onChange={(e) => handleReplyTextareaChange(e.target.value)}
                       onSelect={(e) => {
                         const target = e.target as HTMLTextAreaElement;
                         setReplyCursorPosition(target.selectionStart);
                       }}
                       onClick={(e) => {
                         const target = e.target as HTMLTextAreaElement;
                         setReplyCursorPosition(target.selectionStart);
                       }}
                       className="min-h-[80px]"
                     />
                     <MentionAutocomplete
                       inputValue={replyContent}
                       onMentionSelect={handleReplyMentionSelect}
                       cursorPosition={replyCursorPosition}
                       textareaRef={replyTextareaRef}
                     />
                   </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleSubmitReply(comment.id)}
                      disabled={!replyContent.trim() || addComment.isPending}
                      className="gap-1"
                    >
                      <Send className="h-3 w-3" />
                      {addComment.isPending ? "Posting..." : "Reply"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyContent("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
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

  // Calculate total comment count (including replies)
  const totalComments = comments.reduce((total, comment) => {
    return total + 1 + (comment.replies?.length || 0);
  }, 0);

  return (
    <Card className="mt-8" id="comments">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Comments ({totalComments})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new comment */}
        <div className="space-y-4 relative">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              placeholder={`Add a comment about ${playlistName}... (Type @ to mention band members)`}
              value={newComment}
              onChange={(e) => handleTextareaChange(e.target.value)}
              onSelect={(e) => {
                const target = e.target as HTMLTextAreaElement;
                setCursorPosition(target.selectionStart);
              }}
              onClick={(e) => {
                const target = e.target as HTMLTextAreaElement;
                setCursorPosition(target.selectionStart);
              }}
              className="min-h-[100px]"
            />
            <MentionAutocomplete
              inputValue={newComment}
              onMentionSelect={handleMentionSelect}
              cursorPosition={cursorPosition}
              textareaRef={textareaRef}
            />
          </div>
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
          <div className="space-y-8">
            {comments.map((comment) => (
              <div key={comment.id} className="space-y-4">
                {/* Top-level comment */}
                {renderComment(comment)}
                
                {/* Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="space-y-4">
                    {comment.replies.map((reply) => renderComment(reply, true))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};