import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { resolveImageUrl } from "@/services/cdn";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useBandMembers } from "@/hooks/useBandMembers";

interface MentionAutocompleteProps {
  inputValue: string;
  onMentionSelect: (mention: string) => void;
  cursorPosition: number;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export const MentionAutocomplete = ({
  inputValue,
  onMentionSelect,
  cursorPosition,
  textareaRef,
}: MentionAutocompleteProps) => {
  const { data: bandMembers = [] } = useBandMembers();
  const [isVisible, setIsVisible] = useState(false);
  const [filteredMembers, setFilteredMembers] = useState<typeof bandMembers>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  const [searchTerm, setSearchTerm] = useState("");
  const autocompleteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Find if cursor is after an @ symbol
    const textBeforeCursor = inputValue.slice(0, cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex === -1) {
      setIsVisible(false);
      return;
    }

    // Check if there's a space between @ and cursor (which would end the mention)
    const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
    if (textAfterAt.includes(" ") || textAfterAt.includes("\n")) {
      setIsVisible(false);
      return;
    }

    setMentionStart(lastAtIndex);
    setSearchTerm(textAfterAt);
    
    // Filter band members based on search term
    const filtered = bandMembers.filter(member => {
      const name = member.full_name || member.email || "";
      return name.toLowerCase().includes(textAfterAt.toLowerCase());
    });

    setFilteredMembers(filtered);
    setIsVisible(filtered.length > 0);
    setSelectedIndex(0);
  }, [inputValue, cursorPosition, bandMembers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isVisible) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredMembers.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredMembers.length - 1
          );
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          if (filteredMembers[selectedIndex]) {
            handleMentionSelect(filteredMembers[selectedIndex]);
          }
          break;
        case "Escape":
          setIsVisible(false);
          break;
      }
    };

    if (isVisible && textareaRef.current) {
      textareaRef.current.addEventListener("keydown", handleKeyDown);
      return () => {
        textareaRef.current?.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [isVisible, selectedIndex, filteredMembers, textareaRef]);

  const handleMentionSelect = (member: typeof bandMembers[0]) => {
    const name = member.full_name || member.email || "";
    const beforeMention = inputValue.slice(0, mentionStart);
    const afterCursor = inputValue.slice(cursorPosition);
    const newValue = `${beforeMention}@${name} ${afterCursor}`;
    
    onMentionSelect(newValue);
    setIsVisible(false);
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

  if (!isVisible || filteredMembers.length === 0) {
    return null;
  }

  return (
    <div
      ref={autocompleteRef}
      className="absolute z-50 mt-1 w-64 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-y-auto"
      style={{
        top: "100%",
        left: 0,
      }}
    >
      <div className="p-2">
        <div className="text-xs text-muted-foreground mb-2">
          Band members
        </div>
        {filteredMembers.map((member, index) => (
          <Button
            key={member.id}
            variant={index === selectedIndex ? "secondary" : "ghost"}
            className="w-full justify-start p-2 h-auto gap-3"
            onClick={() => handleMentionSelect(member)}
          >
            <Avatar className="h-6 w-6">
              <AvatarImage src={resolveImageUrl(member.avatar_url)} />
              <AvatarFallback className="text-xs bg-primary/20 text-primary">
                {getInitials(member.full_name, member.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-sm font-medium">
                {member.full_name || member.email}
              </span>
              {member.full_name && (
                <span className="text-xs text-muted-foreground">
                  {member.email}
                </span>
              )}
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};