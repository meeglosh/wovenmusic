import React, { useState } from "react";

interface SafeImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
}

export function SafeImg({ fallback = "/fallbacks/playlist.svg", ...props }: SafeImgProps) {
  const [src, setSrc] = useState(props.src || "");
  
  return (
    <img
      {...props}
      src={src || fallback}
      onError={() => setSrc(fallback)}
      data-debug-src={src || fallback}
    />
  );
}