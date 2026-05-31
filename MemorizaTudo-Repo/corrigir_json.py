#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Corrige/regenera os JSON de tokenizacao da pasta "Chines-Import" usando o
texto novo dos .txt da pasta "Chines".

Modos:
  (padrao)     atualiza os .json JA EXISTENTES em Chines-Import
  --so-novos   cria apenas os .json que FALTAM (licoes novas em Chines sem json)

Campos por fala:
  chinese      : texto do .txt (com prefixo "A:")
  tokens       : jieba
  pinyin       : pypinyin + jieba (tons; maiuscula apos . ? !)
  translation  : LLM local (portugues)
  keywords     : LLM local (palavra + significado PT) + pinyin via pypinyin

RODE NA SUA MAQUINA (precisa do localhost:8080).
Uso:
  python corrigir_json.py --dry-run --only 2403       # teste sem LLM
  python corrigir_json.py --only 2403 --limit 2        # teste com LLM (nao salva)
  python corrigir_json.py                              # atualiza os existentes
  python corrigir_json.py --so-novos                   # cria os que faltam (2404, 2407, ...)
"""
import argparse, json, re, sys, os, time, shutil, urllib.request, urllib.error
from datetime import datetime

try:
    from pypinyin import pinyin, Style
    import jieba
    jieba.setLogLevel(60)
except ImportError:
    sys.exit("Faltam libs. Rode:  pip install pypinyin jieba")

BASE = os.path.dirname(os.path.abspath(__file__))
SRC_DIR    = os.path.join(BASE, "Chinês")
IMPORT_DIR = os.path.join(BASE, "Chinês-Import")

SPK = re.compile(r"^([A-Za-z])\s*[:：]\s*")
HAN = re.compile(r"[一-鿿]")
PUNCT = {"，": ",", "。": ".", "？": "?", "！": "!", "：": ":", "；": ";",
         "、": ",", "（": "(", "）": ")", "《": "<", "》": ">",
         "“": '"', "”": '"', "‘": "'", "’": "'", "…": "."}

# ============ pinyin / tokens (deterministico) ============
def build_pinyin(texto):
    out = []
    for seg in jieba.cut(texto):
        if not seg.strip():
            continue
        if HAN.search(seg):
            syls = pinyin(seg, style=Style.TONE, errors="default")
            out.append("".join(s[0] for s in syls))
        elif all(c in PUNCT for c in seg):
            mapped = "".join(PUNCT[c] for c in seg)
            if out:
                out[-1] = out[-1] + mapped
            else:
                out.append(mapped)
        else:
            out.append(seg)
    s = " ".join(out)
    s = re.sub(r"\s+([,.?!;:])", r"\1", s)
    return _capitalizar_frases(s)

def _capitalizar_frases(s):
    """Maiuscula no inicio e apos . ? ! (estilo do JSON original)."""
    res = []
    cap = True
    for ch in s:
        if cap and ch.isalpha():
            res.append(ch.upper()); cap = False
        else:
            res.append(ch)
            if ch in ".?!":
                cap = True
    return "".join(res)

def tokens_de(texto):
    return [t for t in jieba.cut(texto) if t.strip()]

def py_palavra(w):
    return "".join(s[0] for s in pinyin(w, style=Style.TONE, errors="default"))

# ============ LLM local ============
class LLM:
    def __init__(self, url, model, timeout=180, debug=False):
        self.url = url.rstrip("/") + "/v1/chat/completions"
        self.model = model
        self.timeout = timeout
        self.debug = debug

    def _call(self, chinese):
        sys_msg = ("Você é tradutor e professor de chinês mandarim para estudantes "
                   "brasileiros. Responda SOMENTE com JSON válido, sem comentários, "
                   "sem markdown, sem texto fora do JSON. /no_think")
        user_msg = (
            "Frase em chinês (ignore a letra do locutor como 'A:'/'B:'):\n"
            f"{chinese}\n\n"
            "Devolva exatamente este JSON:\n"
            "{\n"
            '  "translation": "<tradução natural e fluente em português, SEM a letra do locutor>",\n'
            '  "keywords": [{"word":"<palavra ou expressão chinesa EXATAMENTE como aparece na frase>",'
            '"meaning":"<significado curto em português>"}]\n'
            "}\n"
            "Regras: 3 a 8 keywords, as principais palavras de vocabulário que REALMENTE "
            "aparecem na frase, na ordem em que aparecem; 'word' deve ser uma substring "
            "literal da frase; ignore partículas triviais (的, 了, 啊...) se houver muitas; "
            "significados curtos."
        )
        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": sys_msg},
                         {"role": "user", "content": user_msg + "\n/no_think"}],
            "temperature": 0.2,
            "max_tokens": 768,
            "response_format": {"type": "json_object"},
            "cache_prompt": True,
            "chat_template_kwargs": {"enable_thinking": False},
            "enable_thinking": False,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(self.url, data=data,
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=self.timeout) as r:
            resp = json.load(r)
        msg = resp["choices"][0]["message"]
        content = msg.get("content") or ""
        if not content and msg.get("reasoning_content"):
            content = msg["reasoning_content"]
        return content

    def traduzir(self, chinese, tentativas=3):
        last = ""
        for _ in range(tentativas):
            try:
                raw = self._call(chinese)
            except Exception as e:
                last = f"erro de rede: {e}"; time.sleep(1); continue
            if self.debug:
                print("\n----- RESPOSTA CRUA DO LLM -----\n" + raw + "\n--------------------------------\n")
            raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.S)
            raw = re.sub(r"<think>.*$", "", raw, flags=re.S)
            obj = _extrai_json(raw)
            if obj and isinstance(obj.get("translation"), str) and isinstance(obj.get("keywords"), list):
                kws = []
                for k in obj["keywords"]:
                    w = (k.get("word") or "").strip()
                    m = (k.get("meaning") or "").strip()
                    if w and m and w in chinese:
                        kws.append((w, m))
                if kws:
                    return obj["translation"].strip(), kws
                last = "keywords invalidas"
            else:
                last = "json invalido"
        raise RuntimeError(f"LLM falhou para: {chinese!r} ({last})")

def _extrai_json(txt):
    txt = txt.strip()
    m = re.search(r"```(?:json)?\s*(.+?)```", txt, flags=re.S)
    if m:
        txt = m.group(1).strip()
    try:
        return json.loads(txt)
    except Exception:
        pass
    i = txt.find("{")
    if i < 0: return None
    d = 0
    for j in range(i, len(txt)):
        if txt[j] == "{": d += 1
        elif txt[j] == "}":
            d -= 1
            if d == 0:
                try: return json.loads(txt[i:j+1])
                except Exception: return None
    return None

def traduzir_mock(chinese):
    core = SPK.sub("", chinese)
    palavras = [t for t in jieba.cut(core) if HAN.search(t)][:5]
    return "[traducao de teste] " + core, [(w, "[significado de teste]") for w in palavras]

# ============ montagem do JSON ============
def linhas_txt(path):
    return [l.rstrip("\n").strip() for l in open(path, encoding="utf-8") if l.strip()]

def construir_objetos(txt_path, traduzir, limit=None):
    objs = []
    ts = int(time.time() * 1000)
    linhas = linhas_txt(txt_path)
    if limit: linhas = linhas[:limit]
    for idx, linha in enumerate(linhas):
        core = SPK.sub("", linha)
        m = SPK.match(linha)
        prefixo = (m.group(1).upper() + ": ") if m else ""
        traducao, kws = traduzir(linha)
        traducao = SPK.sub("", traducao).strip()
        obj = {
            "chinese": linha,
            "pinyin": build_pinyin(core),
            "translation": prefixo + traducao,
            "tokens": tokens_de(core),
            "keywords": [
                {"id": i + 1, "word": w, "pinyin": py_palavra(w), "meaning": mng}
                for i, (w, mng) in enumerate(kws)
            ],
            "id": f"local-{ts}-{idx}",
            "language": "Chinês",
        }
        objs.append(obj)
    return objs

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-url", default="http://localhost:8080")
    ap.add_argument("--model", default="local")
    ap.add_argument("--src", default=SRC_DIR)
    ap.add_argument("--import-dir", default=IMPORT_DIR)
    ap.add_argument("--only", default=None, help="processa so esta licao (ex.: 2403)")
    ap.add_argument("--limit", type=int, default=None, help="processa so N falas por licao")
    ap.add_argument("--dry-run", action="store_true", help="nao usa LLM (traducao fake)")
    ap.add_argument("--no-backup", action="store_true")
    ap.add_argument("--so-novos", action="store_true",
                    help="cria apenas os .json que faltam (licoes novas em Chines sem json)")
    ap.add_argument("--debug", action="store_true", help="imprime a resposta crua do LLM")
    args = ap.parse_args()

    if not os.path.isdir(args.import_dir):
        sys.exit("Pasta nao encontrada: " + args.import_dir)

    if not args.no_backup and not args.dry_run and not args.limit:
        bdir = args.import_dir + "-backup-" + datetime.now().strftime("%Y%m%d-%H%M%S")
        shutil.copytree(args.import_dir, bdir)
        print("Backup:", bdir)

    traduzir = traduzir_mock if args.dry_run else LLM(args.api_url, args.model, debug=args.debug).traduzir
    if not args.dry_run:
        print("LLM:", args.api_url, "| modelo:", args.model)

    if args.so_novos:
        txt_ids = sorted(f[:-4] for f in os.listdir(args.src) if f.endswith(".txt"))
        ids = [lid for lid in txt_ids
               if not os.path.exists(os.path.join(args.import_dir, lid + ".json"))]
        print("Modo --so-novos. Licoes sem json:", ", ".join(ids) if ids else "(nenhuma)")
    else:
        ids = sorted(f[:-5] for f in os.listdir(args.import_dir) if f.endswith(".json"))
    if args.only:
        ids = [lid for lid in ids if lid == args.only]
    if not ids:
        print("Nada a fazer (nenhuma licao no escopo)."); return

    feitos = falhas = 0
    for lid in ids:
        txt = os.path.join(args.src, lid + ".txt")
        if not os.path.exists(txt):
            print(f"  pular {lid}: sem {lid}.txt"); continue
        try:
            objs = construir_objetos(txt, traduzir, args.limit)
        except Exception as e:
            print(f"  ERRO {lid}: {e}"); falhas += 1; continue
        out = os.path.join(args.import_dir, lid + ".json")
        if not args.limit and not args.dry_run:
            with open(out, "w", encoding="utf-8") as fh:
                json.dump(objs, fh, ensure_ascii=False, indent=2)
        feitos += 1
        marca = " (dry-run/limit: nao salvo)" if (args.limit or args.dry_run) else ""
        print(f"  OK {lid}: {len(objs)} falas" + marca)

    print(f"\nConcluido. {feitos} licao(oes), {falhas} falha(s).")

if __name__ == "__main__":
    main()
