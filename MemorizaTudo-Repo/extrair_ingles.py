#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extrai a TRADUCAO EM INGLES dos PDFs do ChinesePod e gera os .txt
correspondentes na pasta "Ingles", no mesmo formato dos .txt existentes:

    A: <fala em ingles>
    B: <fala em ingles>

Cada bloco do PDF tem: linha(s) em chines (com locutor "A:"), linha(s) de
pinyin, e linha(s) em ingles (traducao). Pegamos so o ingles, herdando o
prefixo de locutor da linha chinesa.

Uso:
    python extrair_ingles.py
    python extrair_ingles.py <pasta_pdfs> <pasta_saida>
"""
import re, sys
from pathlib import Path
try:
    import pdfplumber
except ImportError:
    sys.exit("Falta pdfplumber. Instale com: pip install pdfplumber")

PASTA_PDFS_PADRAO  = r"D:\Chinesepod-DVD12\4 Upper Intermediate\D2401-D2500"
PASTA_SAIDA_PADRAO = r"C:\Projetos\mandarindeepthinking\MemorizaTudo-Repo\Inglês"
PADRAO = re.compile(r"^chinesepod_[A-Z](\d+)\.pdf$", re.IGNORECASE)

HAN  = re.compile(r"[一-鿿]")
LAT  = re.compile(r"[a-zA-Z]")
SPK  = re.compile(r"^[A-Z]\s*[:：]")
# vogais com marca de tom do pinyin
TOM  = set("āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü" + "ĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙ" + "ńňǹ")

def eh_rodape(l):
    return ("Visit the Online Review" in l or "ChinesePod" in l or "Powered by TCPDF" in l)

def tem_tom(l):
    return any(c in TOM for c in l)

CJKP = set("！？。，、；：（）《》「」『』…—·“”‘’")
def tem_cjk_punct(l):
    return any(c in CJKP for c in l)

def extrair_ingles(texto):
    linhas = [l.rstrip() for l in texto.split("\n")]
    uteis = []
    for l in linhas:
        if l.strip().startswith("Key Vocabulary"):
            break
        uteis.append(l)
    linhas = [l for l in uteis if l.strip() and not eh_rodape(l)]

    res = []
    i, n = 0, len(linhas)
    while i < n:
        linha = linhas[i]
        if SPK.match(linha) and HAN.search(linha):
            letra = linha[0].upper()
            i += 1
            # pula continuacao chinesa (Han ou pontuacao chinesa solta)
            while i < n:
                nx = linhas[i]
                if SPK.match(nx) and HAN.search(nx): break
                if HAN.search(nx): i += 1; continue
                if not LAT.search(nx) and not tem_tom(nx): i += 1; continue  # pontuacao solta
                break
            # agora vem pinyin (com tom) e depois ingles (latim, sem tom, sem Han)
            ingles = []
            while i < n:
                nx = linhas[i]
                if SPK.match(nx) and HAN.search(nx): break          # proximo locutor
                if HAN.search(nx): i += 1; continue                  # chines (nao deveria)
                if tem_tom(nx) or tem_cjk_punct(nx): i += 1; continue          # pinyin/chines
                if LAT.search(nx): ingles.append(nx.strip()); i += 1; continue  # ingles
                i += 1                                               # outra coisa
            if ingles:
                res.append(f"{letra}: " + " ".join(ingles))
        else:
            i += 1
    return "\n".join(res)

def main():
    pasta_pdfs  = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(PASTA_PDFS_PADRAO)
    pasta_saida = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(PASTA_SAIDA_PADRAO)
    if not pasta_pdfs.is_dir(): sys.exit("Pasta de PDFs nao encontrada: %s" % pasta_pdfs)
    pasta_saida.mkdir(parents=True, exist_ok=True)
    pdfs = sorted(p for p in pasta_pdfs.iterdir() if PADRAO.match(p.name))
    if not pdfs: sys.exit("Nenhum PDF chinesepod_<LETRA>####.pdf em: %s" % pasta_pdfs)
    print("Encontrados %d PDFs. Saida: %s\n" % (len(pdfs), pasta_saida))
    feitos = 0
    for pdf_path in pdfs:
        licao = PADRAO.match(pdf_path.name).group(1)
        try:
            with pdfplumber.open(pdf_path) as pdf:
                texto = "\n".join((pg.extract_text() or "") for pg in pdf.pages)
        except Exception as e:
            print("  ERRO %s: %s" % (pdf_path.name, e)); continue
        ing = extrair_ingles(texto)
        if not ing.strip():
            print("  AVISO: nada extraido de %s" % pdf_path.name); continue
        dest = pasta_saida / ("%s.txt" % licao)
        dest.write_text(ing + "\n", encoding="utf-8")
        feitos += 1
        print("  %s -> %s (%d falas)" % (pdf_path.name, dest.name, len(ing.splitlines())))
    print("\nConcluido. %d arquivo(s)." % feitos)

if __name__ == "__main__":
    main()
