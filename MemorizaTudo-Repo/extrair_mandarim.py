#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extrai as falas em mandarim dos PDFs do ChinesePod e gera/atualiza
os arquivos .txt correspondentes na pasta "Chines".

Padrao de entrada : chinesepod_C2403.pdf / chinesepod_D2404.pdf  ->  2403.txt / 2404.txt
Cada PDF contem o dialogo (chines + pinyin + ingles). Aqui mantemos
apenas as falas em chines, no mesmo formato dos .txt ja existentes:

    A: <fala em mandarim>
    B: <fala em mandarim>

Uso:
    python extrair_mandarim.py                      # usa os caminhos padrao abaixo
    python extrair_mandarim.py <pasta_pdfs> <pasta_saida>
"""

import re
import sys
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    sys.exit("Falta a biblioteca pdfplumber. Instale com: pip install pdfplumber")

# Caminhos padrao (podem ser sobrescritos por argumentos da linha de comando)
PASTA_PDFS_PADRAO = r"D:\Chinesepod-DVD12\4 Upper Intermediate\D2401-D2500"
PASTA_SAIDA_PADRAO = r"C:\Projetos\mandarindeepthinking\MemorizaTudo-Repo\Chines"

# So processa o PDF principal da licao: chinesepod_<LETRA>####.pdf
# (ex.: chinesepod_C2403.pdf, chinesepod_D2404.pdf). Ignora *_ex.pdf, *.html, *.mp3.
# A letra do prefixo (C/D/...) e descartada no nome de saida -> 2403.txt, 2404.txt.
PADRAO_ARQUIVO = re.compile(r"^chinesepod_[A-Z](\d+)\.pdf$", re.IGNORECASE)

HAN = re.compile(r"[一-鿿]")          # ideogramas chineses
LATIN = re.compile(r"[a-zA-Z]")               # letras latinas (pinyin / ingles)
SPEAKER = re.compile(r"^[A-Z]\s*[:：]")   # inicio de fala: "A:", "B:", etc.


def eh_rodape(linha):
    return (
        "Visit the Online Review" in linha
        or "ChinesePod" in linha
        or "Powered by TCPDF" in linha
    )


def extrair_dialogo(texto):
    """Recebe o texto completo do PDF e retorna apenas as falas em mandarim."""
    linhas = [l.rstrip() for l in texto.split("\n")]

    # Corta tudo a partir de "Key Vocabulary" (vocabulario nao faz parte do dialogo)
    uteis = []
    for l in linhas:
        if l.strip().startswith("Key Vocabulary"):
            break
        uteis.append(l)

    linhas = [l for l in uteis if l.strip() and not eh_rodape(l)]

    resultado = []
    i, n = 0, len(linhas)
    while i < n:
        linha = linhas[i]
        # Inicio de uma fala: prefixo de locutor + contem chines
        if SPEAKER.match(linha) and HAN.search(linha):
            chines = [linha]
            i += 1
            # Acumula linhas de continuacao em chines ate aparecer o pinyin
            while i < n:
                prox = linhas[i]
                if SPEAKER.match(prox) and HAN.search(prox):
                    break
                han = len(HAN.findall(prox))
                lat = len(LATIN.findall(prox))
                # linha de pinyin/ingles (latim sem ideogramas) encerra a fala
                if han == 0 and lat > 0:
                    break
                # ideogramas, ou pontuacao chinesa solta -> continua a fala
                chines.append(prox)
                i += 1
            resultado.append("".join(chines))
        else:
            i += 1

    return "\n".join(resultado)


def main():
    pasta_pdfs = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(PASTA_PDFS_PADRAO)
    pasta_saida = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(PASTA_SAIDA_PADRAO)

    if not pasta_pdfs.is_dir():
        sys.exit("Pasta de PDFs nao encontrada: %s" % pasta_pdfs)
    pasta_saida.mkdir(parents=True, exist_ok=True)

    pdfs = sorted(p for p in pasta_pdfs.iterdir() if PADRAO_ARQUIVO.match(p.name))
    if not pdfs:
        sys.exit("Nenhum PDF no padrao chinesepod_<LETRA>####.pdf em: %s" % pasta_pdfs)

    print("Encontrados %d PDFs. Saida: %s\n" % (len(pdfs), pasta_saida))

    gerados = 0
    for pdf_path in pdfs:
        licao = PADRAO_ARQUIVO.match(pdf_path.name).group(1)  # ex.: "2403"
        try:
            with pdfplumber.open(pdf_path) as pdf:
                texto = "\n".join((pg.extract_text() or "") for pg in pdf.pages)
        except Exception as e:
            print("  ERRO ao ler %s: %s" % (pdf_path.name, e))
            continue

        dialogo = extrair_dialogo(texto)
        if not dialogo.strip():
            print("  AVISO: nenhuma fala extraida de %s" % pdf_path.name)
            continue

        destino = pasta_saida / ("%s.txt" % licao)
        destino.write_text(dialogo + "\n", encoding="utf-8")
        gerados += 1
        print("  %s  ->  %s  (%d falas)" % (pdf_path.name, destino.name, len(dialogo.splitlines())))

    print("\nConcluido. %d arquivo(s) gerado(s)/atualizado(s)." % gerados)


if __name__ == "__main__":
    main()
