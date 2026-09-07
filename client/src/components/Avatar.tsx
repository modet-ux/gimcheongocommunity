import React from "react";

interface Props {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  fallback?: React.ReactNode;
}

const sizeMap = {
  sm: { w: 32, h: 32, fontSize: 12 },
  md: { w: 40, h: 40, fontSize: 14 },
  lg: { w: 48, h: 48, fontSize: 16 },
};

export function Avatar({ src, name, size = "md", className = "", fallback }: Props) {
  const { w, h, fontSize } = sizeMap[size];
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (src) {
    return (
      <div
        className={["rounded-full overflow-hidden object-cover flex-shrink-0", className].join(" ")}
        style={{ width: w, height: h }}
      >
        <img src={src} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={[
        "flex items-center justify-center rounded-full bg-primary/10 text-primary font-medium",
        "flex-shrink-0",
        className,
      ].join(" ")}
      style={{ width: w, height: h }}
    >
      {fallback ?? <span style={{ fontSize }}>{initials}</span>}
    </div>
  );
}
