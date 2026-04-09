"use client";

import Image from "next/image";
import { useState } from "react";

type Props = {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  fallback?: React.ReactNode;
};

export default function ImageWithFallback({ src, alt, fill, className, fallback }: Props) {
  const [error, setError] = useState(false);

  if (error) return <>{fallback ?? null}</>;

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      onError={() => setError(true)}
    />
  );
}
