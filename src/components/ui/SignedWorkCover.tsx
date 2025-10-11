"use client";
import { useEffect, useState } from "react";
import { getSignedFileUrl } from "@/lib/fileUtils";

export default function SignedWorkCover({ coverPath, title }: { coverPath: string; title: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!coverPath) {
          if (!cancelled) setSrc(null);
          return;
        }
        if (/^https?:\/\//.test(coverPath)) {
          if (!cancelled) setSrc(coverPath);
          return;
        }
        try {
          const signed = await getSignedFileUrl(coverPath, 3600, 'works');
          if (!cancelled) setSrc(signed || null);
        } catch (e) {
          console.warn('Firma de portada fallida en Mis Lecturas:', e);
          if (!cancelled) setSrc(null);
        }
      } catch (e) {
        console.warn('Error inesperado firmando portada:', e);
        if (!cancelled) setSrc(null);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [coverPath]);
  if (!src) {
    return (
      <div className="w-full h-full bg-gray-200 rounded overflow-hidden" />
    );
  }
  return (
    <img
      src={src}
      alt={`Portada de ${title}`}
      width={180}
      height={270}
      className="w-full h-full object-cover"
    />
  );
}