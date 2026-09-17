import React from 'react';
import ColorCorrectionBanner from './ColorCorrectionBanner';
import { useColorCorrectionJob } from '../hooks/useColorCorrectionJob';

/** Fica acima do App para o job continuar visível em qualquer aba/pasta. */
const ColorCorrectionRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { job } = useColorCorrectionJob();
    return (
        <>
            <div className="sticky top-0 z-[60] bg-transparent">
                <ColorCorrectionBanner job={job} />
            </div>
            {children}
        </>
    );
};

export default ColorCorrectionRoot;
