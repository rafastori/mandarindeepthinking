// Estilos para PDF (invisível na tela)
export const PDF_STYLES = {
    container: {
        position: 'fixed' as const,
        top: '-9999px',
        left: '-9999px',
        width: '210mm', // A4
        minHeight: '297mm',
        backgroundColor: 'white',
        padding: '20mm',
        color: 'black',
        fontFamily: 'Arial, sans-serif',
        zIndex: -50
    },
    header: {
        borderBottom: '2px solid #333',
        marginBottom: '20px',
        paddingBottom: '10px'
    },
    title: {
        fontSize: '24px',
        fontWeight: 'bold',
        marginBottom: '5px'
    },
    date: {
        fontSize: '14px',
        color: '#666'
    },
    item: {
        marginBottom: '15px',
        pageBreakInside: 'avoid' as const
    },
    chinese: {
        fontSize: '18px',
        marginBottom: '5px',
        lineHeight: 1.5
    },
    translation: {
        fontSize: '14px',
        color: '#444',
        fontStyle: 'italic'
    },
    divider: {
        borderBottom: '1px solid #eee',
        marginTop: '15px'
    }
};
