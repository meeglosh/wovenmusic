import { Button } from "@/components/ui/button";
import { Volume2 } from "lucide-react";

interface ConversionQualitySelectorProps {
  value: string;
  onChange: (value: string) => void;
  size?: "default" | "mobile";
}

const ConversionQualitySelector = ({ value, onChange, size = "default" }: ConversionQualitySelectorProps) => {
  const options = [
    { value: "mp3-320", label: size === "mobile" ? "Good (MP3)" : "Good (MP3)" },
    { value: "aac-320", label: size === "mobile" ? "Better (AAC)" : "Better (AAC)" },
    { value: "lossless", label: size === "mobile" ? "Best (Lossless)" : "Best (Lossless)" },
  ];

  const isMobile = size === "mobile";

  return (
    <div className="px-2 py-1.5">
      <div className={`flex items-center ${isMobile ? "mb-1" : "mb-2"}`}>
        <Volume2 className={`${isMobile ? "w-3 h-3 mr-1" : "w-4 h-4 mr-2"} text-primary`} />
        <span className={`${isMobile ? "text-xs" : "text-sm"} font-medium text-primary`}>
          Conversion Quality:
        </span>
      </div>
      <div className={`flex flex-col space-y-1 ${isMobile ? "ml-4" : "ml-6"}`}>
        {options.map((option) => (
          <Button
            key={option.value}
            variant={value === option.value ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onChange(option.value)}
            className={`${isMobile ? "text-xs h-6 px-2" : "text-sm h-7 px-3"} justify-start`}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default ConversionQualitySelector;