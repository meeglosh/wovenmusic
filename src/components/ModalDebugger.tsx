import { useEffect, useState } from "react";

interface ModalState {
  bodyOverflow: string;
  bodyPointerEvents: string;
  bodyInert: boolean;
  radixOverlays: number;
  radixContents: number;
  timestamp: string;
}

export const ModalDebugger = () => {
  const [modalStates, setModalStates] = useState<ModalState[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkModalState = () => {
      const state: ModalState = {
        bodyOverflow: document.body.style.overflow || 'default',
        bodyPointerEvents: document.body.style.pointerEvents || 'default',
        bodyInert: document.body.hasAttribute('inert'),
        radixOverlays: document.querySelectorAll('[data-radix-dialog-overlay]').length,
        radixContents: document.querySelectorAll('[data-radix-dialog-content]').length,
        timestamp: new Date().toLocaleTimeString()
      };

      setModalStates(prev => [...prev.slice(-4), state]); // Keep last 5 states
    };

    // Check state every 500ms
    const interval = setInterval(checkModalState, 500);
    
    // Initial check
    checkModalState();

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-red-500 text-white px-3 py-1 rounded text-xs z-[9999]"
      >
        Show Modal Debug
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg text-xs max-w-md z-[9999] font-mono">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Modal Debug</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-red-400 hover:text-red-300"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {modalStates.map((state, i) => (
          <div key={i} className={`p-2 rounded ${i === modalStates.length - 1 ? 'bg-blue-900' : 'bg-gray-800'}`}>
            <div className="text-gray-300">{state.timestamp}</div>
            <div>Overflow: <span className={state.bodyOverflow !== 'default' ? 'text-red-400' : 'text-green-400'}>{state.bodyOverflow}</span></div>
            <div>PointerEvents: <span className={state.bodyPointerEvents !== 'default' ? 'text-red-400' : 'text-green-400'}>{state.bodyPointerEvents}</span></div>
            <div>Inert: <span className={state.bodyInert ? 'text-red-400' : 'text-green-400'}>{state.bodyInert.toString()}</span></div>
            <div>Overlays: <span className={state.radixOverlays > 0 ? 'text-yellow-400' : 'text-green-400'}>{state.radixOverlays}</span></div>
            <div>Contents: <span className={state.radixContents > 0 ? 'text-yellow-400' : 'text-green-400'}>{state.radixContents}</span></div>
          </div>
        ))}
      </div>
      
      <button
        onClick={() => {
          console.log('Force cleaning body styles...');
          document.body.style.overflow = '';
          document.body.style.pointerEvents = '';
          if (document.body.hasAttribute('inert')) {
            document.body.removeAttribute('inert');
          }
          // Remove any lingering Radix overlays
          document.querySelectorAll('[data-radix-dialog-overlay]').forEach(el => el.remove());
          document.querySelectorAll('[data-radix-dialog-content]').forEach(el => el.remove());
        }}
        className="mt-2 bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs w-full"
      >
        Force Clean
      </button>
    </div>
  );
};