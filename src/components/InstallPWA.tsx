import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWA() {
  const [supportsPWA, setSupportsPWA] = useState(false);
  const [promptInstall, setPromptInstall] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setSupportsPWA(true);
      setPromptInstall(e as BeforeInstallPromptEvent);
    };
    
    window.addEventListener('beforeinstallprompt', handler);
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS) {
      setSupportsPWA(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!promptInstall) {
      if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
        setShowIOSInstructions(true);
        return;
      }
      return;
    }

    try {
      await promptInstall.prompt();
      const { outcome } = await promptInstall.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
      }
      
      setPromptInstall(null);
    } catch (error) {
      console.error('Error al intentar instalar la PWA:', error);
    }
  };

  if (!supportsPWA || isInstalled) return null;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={handleInstallClick}
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-600 to-orange-500 text-white rounded-xl shadow-lg hover:from-orange-700 hover:to-orange-600 transition-all"
        >
          <Download className="w-5 h-5" />
          Instalar aplicación
        </button>
      </div>

      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-gray-900 rounded-xl p-6 m-4 max-w-sm border border-gray-800">
            <h3 className="text-lg font-semibold mb-4 text-gray-200">Instalar en iOS</h3>
            <ol className="list-decimal list-inside space-y-2 mb-4 text-gray-300">
              <li>Toca el botón Compartir</li>
              <li>Desplázate y selecciona "Añadir a Pantalla de inicio"</li>
              <li>Toca "Añadir" para completar la instalación</li>
            </ol>
            <button
              onClick={() => setShowIOSInstructions(false)}
              className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}