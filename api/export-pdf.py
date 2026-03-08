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
            
            if not data:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Nenhum dado recebido'}).encode())
                return
            
            if export_type == 'stats':
                stats_data = data.get('data', {})
                if not stats_data:
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'error': 'Dados de estatística não encontrados'}).encode())
                    return
                pdf_bytes = generate_stats_pdf(stats_data)
                self.send_response(200)
                self.send_header('Content-Type', 'application/pdf')
                self.send_header('Content-Disposition', f'attachment; filename="{filename}.pdf"')
                self.send_header('Content-Length', str(len(pdf_bytes)))
                self.end_headers()
                self.wfile.write(pdf_bytes)
                return

            items = data.get('items', [])
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
    
    # Posiciona após o cabeçalho (47mm = header height)
    pdf.set_y(60)
    
    # ════════════════════════════════════════════════════════════
    # ITENS (Layout simples)
    # ════════════════════════════════════════════════════════════
    
    for i, item in enumerate(items):
        text = item.get('text', '')
        translation = item.get('translation', '')
        
        # Verifica se precisa de nova página
        if pdf.get_y() > 250:
            pdf.add_page()
            pdf.set_y(20)
        
        # IMPORTANTE: Reset X para margem esquerda antes de cada célula
        pdf.set_x(LEFT_MARGIN)
        
        # Texto em Chinês
        pdf.set_font(font, size=14)
        pdf.set_text_color(17, 24, 39)  # Gray-900
        pdf.multi_cell(CONTENT_WIDTH, 7, txt=text)
        
        # Reset X novamente para a tradução
        pdf.set_x(LEFT_MARGIN)
        
        # Tradução
        pdf.set_font(font, size=11)
        pdf.set_text_color(75, 85, 99)  # Gray-600
        pdf.multi_cell(CONTENT_WIDTH, 6, txt=translation)
        
        pdf.ln(8)
    
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


def generate_stats_pdf(data: dict) -> bytes:
    """
    Gera PDF de estatísticas (Overview, Heatmap representation, Difficult Words, etc.)
    """
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=25)
    
    # Margens
    LEFT_MARGIN = 20
    RIGHT_MARGIN = 20
    pdf.set_left_margin(LEFT_MARGIN)
    pdf.set_right_margin(RIGHT_MARGIN)
    PAGE_WIDTH = 210
    
    # Fonte
    font_dir = os.path.join(os.path.dirname(__file__), 'fonts')
    font_path = os.path.join(font_dir, 'NotoSansSC-Regular.ttf')
    
    if os.path.exists(font_path):
        pdf.add_font('NotoSans', '', font_path)
        font = 'NotoSans'
    else:
        font = 'Helvetica'
        
    pdf.add_page()
    
    # HEADER
    pdf.set_fill_color(22, 101, 52)  # Green-700
    pdf.rect(0, 0, 210, 45, 'F')
    pdf.set_fill_color(234, 179, 8)  # Yellow-500
    pdf.rect(0, 45, 210, 2, 'F')
    
    pdf.set_y(10)
    pdf.set_font(font, size=24)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(0, 12, txt="Relatório de Desempenho", ln=True, align='C')
    pdf.set_font(font, size=11)
    pdf.set_text_color(187, 247, 208)
    pdf.cell(0, 7, txt="MemorizaTudo", ln=True, align='C')
    
    date_str = datetime.now().strftime('%d/%m/%Y')
    pdf.set_font(font, size=9)
    pdf.set_text_color(209, 250, 229)
    pdf.cell(0, 5, txt=f"Exportado em {date_str}", ln=True, align='C')
    
    pdf.set_y(55)
    
    overview = data.get('overview', {})
    
    # --- VISÃO GERAL ---
    pdf.set_font(font, size=16)
    pdf.set_text_color(17, 24, 39)
    pdf.cell(0, 10, txt="Visão Geral", ln=True)
    pdf.ln(2)
    
    pdf.set_font(font, size=12)
    pdf.set_text_color(55, 65, 81)
    
    total_mins = overview.get('totalTimeMinutes', 0)
    time_str = f"{total_mins//60}h {total_mins%60}m" if total_mins > 60 else f"{total_mins}m"
    pdf.cell(0, 8, txt=f"• Tempo Total de Estudo: {time_str}", ln=True)
    pdf.cell(0, 8, txt=f"• Precisão Média Global: {overview.get('globalAccuracy', 0)}%", ln=True)
    pdf.cell(0, 8, txt=f"• Total de Sessões: {overview.get('totalSessions', 0)}", ln=True)
    pdf.cell(0, 8, txt=f"• Meta Diária Atingida (média): {overview.get('dailyGoalPercent', 0)}%", ln=True)
    
    pdf.ln(10)
    
    # --- PALAVRAS MAIS ERRADAS ---
    difficult_words = data.get('difficultWords', [])
    if difficult_words:
        pdf.set_font(font, size=16)
        pdf.set_text_color(17, 24, 39)
        pdf.cell(0, 10, txt="Top Palavras com Maior Taxa de Erro", ln=True)
        pdf.ln(2)
        
        # Table Header
        pdf.set_fill_color(243, 244, 246) # Gray-100
        pdf.set_font(font, size=11)
        pdf.set_text_color(31, 41, 55)
        pdf.cell(90, 8, txt="Palavra", border=1, fill=True)
        pdf.cell(40, 8, txt="Total de Erros", border=1, fill=True, align='C')
        pdf.ln(8)
        
        pdf.set_font(font, size=12)
        for dw in difficult_words:
            pdf.cell(90, 8, txt=dw.get('word', ''), border=1)
            pdf.cell(40, 8, txt=str(dw.get('errorCount', 0)), border=1, align='C')
            pdf.ln(8)
            
        pdf.ln(10)
        
    # --- HISTÓRICO DE SESSÕES ---
    sessions = data.get('sessions', [])
    if sessions:
        if pdf.get_y() > 220:
            pdf.add_page()
            
        pdf.set_font(font, size=16)
        pdf.set_text_color(17, 24, 39)
        pdf.cell(0, 10, txt="Histórico de Sessões Recentes", ln=True)
        pdf.set_draw_color(209, 213, 219)
        pdf.line(LEFT_MARGIN, pdf.get_y(), PAGE_WIDTH - RIGHT_MARGIN, pdf.get_y())
        pdf.ln(5)
        
        for s in sessions[:30]: # Limita as ultimas 30 sessoes exportadas
            if pdf.get_y() > 250:
                pdf.add_page()
            
            pdf.set_font(font, size=12)
            pdf.set_text_color(31, 41, 55)
            
            # Formats: YYYY-MM-DD -> DD/MM/YYYY
            raw_date = s.get('date', '')
            try:
                date_fmt = datetime.strptime(raw_date, '%Y-%m-%d').strftime('%d/%m/%Y')
            except:
                date_fmt = raw_date
                
            mins = s.get('totalMinutes', 0)
            correct = s.get('correct', 0)
            wrong = s.get('wrong', 0)
            
            pdf.set_fill_color(249, 250, 251)
            pdf.cell(0, 8, txt=f"Data: {date_fmt}   |   Tempo: {mins} minutos   |   Acertos: {correct}   |   Erros: {wrong}", fill=True, ln=True)
            pdf.ln(2)

    # --- RODAPÉ ---
    pdf.set_y(-20)
    pdf.set_draw_color(22, 163, 74) 
    pdf.set_line_width(0.5)
    pdf.line(LEFT_MARGIN, pdf.get_y(), PAGE_WIDTH - RIGHT_MARGIN, pdf.get_y())
    pdf.ln(5)
    pdf.set_font(font, size=8)
    pdf.set_text_color(156, 163, 175)
    pdf.cell(0, 4, txt="Documento Analítico Gerado por MemorizaTudo", ln=True, align='C')

    return pdf.output()
