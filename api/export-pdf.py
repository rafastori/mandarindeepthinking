from http.server import BaseHTTPRequestHandler
import json
import os
from fpdf import FPDF
from datetime import datetime

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            # Lê o corpo da requisição
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            items = data.get('items', [])
            filename = data.get('filename', 'exportacao')
            export_type = data.get('type', 'pdf')  # 'pdf' ou 'txt'
            
            if not items:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Nenhum item para exportar'}).encode())
                return
            
            if export_type == 'txt':
                # Gera TXT
                content = generate_txt(items)
                self.send_response(200)
                self.send_header('Content-Type', 'text/plain; charset=utf-8')
                self.send_header('Content-Disposition', f'attachment; filename="{filename}.txt"')
                self.end_headers()
                # BOM UTF-8 para garantir encoding correto em editores
                self.wfile.write(b'\xef\xbb\xbf' + content.encode('utf-8'))
            else:
                # Gera PDF
                pdf_bytes = generate_pdf(items)
                self.send_response(200)
                self.send_header('Content-Type', 'application/pdf')
                self.send_header('Content-Disposition', f'attachment; filename="{filename}.pdf"')
                self.send_header('Content-Length', str(len(pdf_bytes)))
                self.end_headers()
                self.wfile.write(pdf_bytes)
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()


def generate_txt(items: list) -> str:
    """Gera conteúdo TXT limpo."""
    lines = []
    for item in items:
        text = item.get('text', '')
        translation = item.get('translation', '')
        lines.append(text)
        lines.append(translation)
        lines.append('')  # Linha em branco
    return '\n'.join(lines)


def generate_pdf(items: list) -> bytes:
    """
    Gera PDF profissional com layout limpo.
    """
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=25)
    
    # Margens
    LEFT_MARGIN = 20
    RIGHT_MARGIN = 20
    pdf.set_left_margin(LEFT_MARGIN)
    pdf.set_right_margin(RIGHT_MARGIN)
    
    PAGE_WIDTH = 210
    CONTENT_WIDTH = PAGE_WIDTH - LEFT_MARGIN - RIGHT_MARGIN
    
    # Fonte
    font_dir = os.path.join(os.path.dirname(__file__), 'fonts')
    font_path = os.path.join(font_dir, 'NotoSansSC-Regular.ttf')
    
    if os.path.exists(font_path):
        pdf.add_font('NotoSans', '', font_path)
        font = 'NotoSans'
    else:
        font = 'Helvetica'
    
    pdf.add_page()
    
    # ════════════════════════════════════════════════════════════
    # CABEÇALHO
    # ════════════════════════════════════════════════════════════
    
    # Fundo verde escuro
    pdf.set_fill_color(22, 101, 52)  # Green-700
    pdf.rect(0, 0, 210, 45, 'F')
    
    # Detalhe decorativo (linha dourada)
    pdf.set_fill_color(234, 179, 8)  # Yellow-500
    pdf.rect(0, 45, 210, 2, 'F')
    
    # Logo/Título
    pdf.set_y(10)
    pdf.set_font(font, size=26)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 12, txt="MemorizaTudo", ln=True, align='C')
    
    # Subtítulo
    pdf.set_font(font, size=12)
    pdf.set_text_color(187, 247, 208)  # Green-200
    pdf.cell(0, 7, txt="Material de Estudo", ln=True, align='C')
    
    # Data
    pdf.set_font(font, size=9)
    pdf.set_text_color(209, 250, 229)  # Green-100
    date_str = datetime.now().strftime('%d/%m/%Y')
    pdf.cell(0, 5, txt=f"Exportado em {date_str}", ln=True, align='C')
    
    pdf.ln(15)
    
    # ════════════════════════════════════════════════════════════
    # ITENS (Layout simples)
    # ════════════════════════════════════════════════════════════
    
    for i, item in enumerate(items):
        text = item.get('text', '')
        translation = item.get('translation', '')
        
        # Verifica se precisa de nova página
        if pdf.get_y() > 250:
            pdf.add_page()
            pdf.ln(10)
        
        # Texto em Chinês
        pdf.set_font(font, size=15)
        pdf.set_text_color(17, 24, 39)  # Gray-900
        pdf.multi_cell(CONTENT_WIDTH, 8, txt=text)
        
        # Tradução
        pdf.set_font(font, size=11)
        pdf.set_text_color(75, 85, 99)  # Gray-600
        pdf.multi_cell(CONTENT_WIDTH, 6, txt=translation)
        
        pdf.ln(10)
    
    # ════════════════════════════════════════════════════════════
    # RODAPÉ
    # ════════════════════════════════════════════════════════════
    
    pdf.set_y(-25)
    
    # Linha decorativa
    pdf.set_draw_color(22, 163, 74)  # Green-600
    pdf.set_line_width(0.5)
    pdf.line(LEFT_MARGIN, pdf.get_y(), PAGE_WIDTH - RIGHT_MARGIN, pdf.get_y())
    
    pdf.ln(5)
    pdf.set_font(font, size=9)
    pdf.set_text_color(107, 114, 128)  # Gray-500
    pdf.cell(0, 5, txt=f"{len(items)} textos para estudo", ln=True, align='C')
    
    pdf.set_font(font, size=8)
    pdf.set_text_color(156, 163, 175)  # Gray-400
    pdf.cell(0, 4, txt="Gerado por MemorizaTudo", ln=True, align='C')
    
    return pdf.output()
