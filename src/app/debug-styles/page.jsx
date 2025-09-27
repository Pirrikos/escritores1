"use client";

export default function DebugStylesPage() {
  return (
    <main className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Debug de Estilos</h1>
      
      {/* Test básico de Tailwind */}
      <div className="bg-blue-100 border border-blue-300 text-blue-800 p-4 rounded-lg">
        <p>Si ves este texto con fondo azul claro, Tailwind está funcionando.</p>
      </div>
      
      {/* Test de Card simulada */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="border-b border-gray-200 pb-4 mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Card de Prueba</h2>
        </div>
        <div className="space-y-4">
          <input 
            type="text" 
            placeholder="Input de prueba"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
            Botón de Prueba
          </button>
        </div>
      </div>
      
      {/* Test de colores */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-500 text-white p-4 rounded">Rojo</div>
        <div className="bg-green-500 text-white p-4 rounded">Verde</div>
        <div className="bg-blue-500 text-white p-4 rounded">Azul</div>
      </div>
    </main>
  );
}