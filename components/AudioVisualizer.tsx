import React, { useRef, useEffect } from 'react';

interface AudioVisualizerProps {
    analyserNode: AnalyserNode | null;
    isActive: boolean;
    width?: number;
    height?: number;
    barColor?: string;
    backgroundColor?: string;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
    analyserNode,
    isActive,
    width = 200,
    height = 60,
    barColor = '#22c55e',
    backgroundColor = '#f1f5f9'
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        if (!canvasRef.current || !analyserNode || !isActive) {
            // Clear canvas when not active
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = backgroundColor;
                    ctx.fillRect(0, 0, width, height);
                }
            }
            return;
        }

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = analyserNode.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            analyserNode.getByteFrequencyData(dataArray);

            ctx.fillStyle = backgroundColor;
            ctx.fillRect(0, 0, width, height);

            const barWidth = (width / bufferLength) * 2.5;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (dataArray[i] / 255) * height;

                // Gradient effect
                const gradient = ctx.createLinearGradient(0, height - barHeight, 0, height);
                gradient.addColorStop(0, barColor);
                gradient.addColorStop(1, `${barColor}88`);

                ctx.fillStyle = gradient;
                ctx.fillRect(x, height - barHeight, barWidth, barHeight);

                x += barWidth + 1;
            }

            animationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [analyserNode, isActive, width, height, barColor, backgroundColor]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="rounded-lg shadow-inner"
            style={{ width: '100%', maxWidth: width, height: height }}
        />
    );
};

export default AudioVisualizer;
