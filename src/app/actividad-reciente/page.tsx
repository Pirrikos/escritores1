"use client";

import SocialNowFeed from "@/components/ui/SocialNowFeed";
import { AppHeader } from "@/components/ui";

export default function ActividadRecientePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <AppHeader className="mb-6" />
      <h1 className="text-2xl font-bold text-slate-800">Actividad reciente</h1>
      <p className="text-sm text-slate-600 mt-1">
        Lo que otros están leyendo ahora mismo.
      </p>
      <div className="mt-4">
        <SocialNowFeed className="mt-2" />
      </div>
    </div>
  );
}