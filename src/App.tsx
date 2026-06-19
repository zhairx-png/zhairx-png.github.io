import React, { useState } from 'react';
import MuseumExhibition from './components/MuseumExhibition';
import WaterMirror from './components/WaterMirror';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [view, setView] = useState<'museum' | 'mirror'>('museum');

  return (
    <div className="w-screen min-h-screen bg-[#061118] text-[#e5dec9] selection:bg-[#c9af7f] selection:text-black overflow-hidden relative">
      <AnimatePresence mode="wait">
        {view === 'museum' ? (
          <motion.div
            key="museum"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.97, filter: 'blur(8px)' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full"
          >
            <MuseumExhibition onEnterMirror={() => setView('mirror')} />
          </motion.div>
        ) : (
          <motion.div
            key="mirror"
            initial={{ opacity: 0, scale: 1.03, filter: 'blur(8px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="w-full h-full"
          >
            <WaterMirror onBack={() => setView('museum')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
