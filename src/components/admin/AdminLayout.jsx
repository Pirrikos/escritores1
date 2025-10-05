'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseBrowserClient } from '@/lib/supabaseClient';
import { Icon, Icons, Button, Card, CardBody } from '@/components/ui';

export default function AdminLayout({ children, activeTab = 'dashboard' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleTabClick = (tabId) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      router.push(tab.href);
    }
  };

  const tabs = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      href: '/admin', 
      icon: Icons.dashboard
    },
    { 
      id: 'library', 
      label: 'Library', 
      href: '/library', 
      icon: Icons.library
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <Card className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-40 transition-all duration-300 rounded-none">
        <CardBody className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 lg:hidden"
              >
                <Icon path={Icons.menu} size="lg" />
              </Button>
              
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg">
                  <Icon path={Icons.dashboard} size="lg" className="text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Página Secundaria</h1>
                </div>
                {/* Botón Inicio */}
                <Link
                  href="/home"
                  className="ml-2 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 backdrop-blur px-3 py-2 text-sm text-slate-700 hover:bg-white transition-colors"
                  aria-label="Volver a inicio"
                  title="Inicio"
                >
                  <Icon path={Icons.dashboard} size="sm" />
                  <span>Inicio</span>
                </Link>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all duration-200"
              >
                <Icon path={Icons.logout} size="md" />
                <span>Cerrar Sesión</span>
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex">
        {/* Sidebar */}
        <Card className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-64 bg-white/95 backdrop-blur-md border-r border-slate-200/60 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 rounded-none`}>
          <CardBody className="flex flex-col h-full pt-20 lg:pt-6">
            <nav className="flex-1 px-6 pb-4 space-y-2">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "primary" : "ghost"}
                  size="lg"
                  onClick={() => handleTabClick(tab.id)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 text-left rounded-2xl font-medium transition-all duration-300 group ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/25 transform scale-[1.02]'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:scale-[1.01]'
                  }`}
                >
                  <div className={`p-2 rounded-xl transition-all duration-300 ${
                    activeTab === tab.id
                      ? 'bg-white/20'
                      : 'bg-slate-100 group-hover:bg-slate-200'
                  }`}>
                    <Icon 
                      path={tab.icon} 
                      size="md" 
                      className={`transition-all duration-300 ${
                        activeTab === tab.id ? 'text-white' : 'text-slate-600 group-hover:text-slate-700'
                      }`} 
                    />
                  </div>
                  <span className="group-hover:translate-x-1 transition-transform duration-200">{tab.label}</span>
                  {activeTab === tab.id && (
                    <div className="ml-auto">
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    </div>
                  )}
                </Button>
              ))}
            </nav>

            <div className="px-6 pb-6">
              {/* Sidebar footer vacío */}
            </div>
          </CardBody>
        </Card>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 lg:ml-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="animate-fadeIn">
              {children}
            </div>
          </div>
        </main>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
