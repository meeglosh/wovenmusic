import { Switch } from "@/components/ui/switch";
import { Volume2 } from "lucide-react";

interface ConversionQualitySelectorProps {
  value: string;
  onChange: (value: string) => void;
  size?: "default" | "mobile";
}

const ConversionQualitySelector = ({ value, onChange, size = "default" }: ConversionQualitySelectorProps) => {
  const isMobile = size === "mobile";
  const isHighQuality = value === "aac-320";

  const handleToggle = (checked: boolean) => {
    onChange(checked ? "aac-320" : "mp3-320");
  };

  return (
    <div className="px-2 py-1.5">
      <div className={`flex items-center justify-between ${isMobile ? "mb-1" : "mb-2"}`}>
        <div className="flex items-center">
          <Volume2 className={`${isMobile ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2"} text-primary`} />
          <span className={`${isMobile ? "text-xs" : "text-sm"} font-medium text-primary`}>
            Conversion Quality:
          </span>
        </div>
      </div>
      <div className={`flex items-center justify-between ${isMobile ? "ml-4" : "ml-6"}`}>
        <span className={`${isMobile ? "text-xs" : "text-sm"} text-muted-foreground`}>
          {isHighQuality ? "High Quality" : "Good Quality"}
        </span>
        <Switch
          checked={isHighQuality}
          onCheckedChange={handleToggle}
        />
      </div>
    </div>
  );
};

export default ConversionQualitySelector;