#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gera as licoes NOVAS (D-series) das outras linguas A PARTIR DO INGLES.

Para cada lingua (menos Ingles e Mandarim) e cada licao nova que ainda NAO
existe em <Lingua>-Import, cria:
  - <Lingua>-Import/<id>.json  : tokenizacao (mesmo schema das licoes antigas)
  - <Lingua>/<id>.txt          : dialogo traduzido naquela lingua

Cada fala em ingles e enviada a Qwen local, que devolve:
  { "text": "<fala traduzida na lingua-alvo>",
    "translation": "<traducao em portugues>",
    "keywords": [ {"word":"<palavra na lingua-alvo>","meaning":"<significado em PT>"} ] }

Os tokens sao gerados localmente (regex p/ linguas ocidentais e coreano;
janome p/ japones). O campo pinyin fica "" (vazio), como nas linguas existentes.

NUNCA sobrescreve um .json que ja existe (a menos de --overwrite).

RODE NA SUA MAQUINA (precisa do localhost:8080).
Uso:
  python traduzir_linguas.py                       # todas as linguas, tudo
  python traduzir_linguas.py --lang Espanhol       # so uma lingua
  python traduzir_linguas.py --only 2404 --limit 2 # teste rapido (nao salva)
  python traduzir_linguas.py --dry-run --only 2404 # sem LLM (texto fake)
"""
import argparse, json, re, sys, os, time, urllib.request
from pathlib import Path

BASE = Path(os.path.dirname(os.path.abspath(__file__)))
ING_DIR   = BASE / "Inglês"
PDFS_PADRAO = r"D:\Chinesepod-DVD12\4 Upper Intermediate\D2401-D2500"

# (pasta no repo, nome do idioma para o prompt)
LANGS = [("Alemão","alemão"), ("Coreano","coreano"), ("Espanhol","espanhol"),
         ("Francês","francês"), ("Italiano","italiano"), ("Japonês","japonês")]

SPK = re.compile(r"^([A-Za-z])\s*[:：]\s*")
PDF_RE = re.compile(r"^chinesepod_[A-Z](\d+)\.pdf$", re.IGNORECASE)

# ---------- tokenizacao ----------
_WTOK = re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*|\d+|[^\w\s]", re.UNICODE)
def tok_western(text):
    return _WTOK.findall(text)

_jt = None
def tok_japanese(text):
    global _jt
    if _jt is None:
        try:
            from janome.tokenizer import Tokenizer
            _jt = Tokenizer()
        except ImportError:
            sys.exit("Para japones instale o segmentador:  pip install janome")
    return [t.surface for t in _jt.tokenize(text)]

def tokenize(lang_pt, text, letra="A"):
    toks = tok_japanese(text) if lang_pt == "Japonês" else tok_western(text)
    return [f"{letra}:"] + toks    # prefixo do locutor correto como 1o token

# ---------- LLM local ----------
class LLM:
    def __init__(self, url, model, debug=False, timeout=180):
        self.url = url.rstrip("/") + "/v1/chat/completions"
        self.model = model; self.debug = debug; self.timeout = timeout

    def _call(self, eng, lang_nome):
        sysm = ("Você é tradutor profissional e responde SOMENTE com JSON válido, "
                "sem markdown, sem comentários, sem texto fora do JSON. /no_think")
        usr = (
            f"Frase em inglês:\n{eng}\n\n"
            f"Traduza para o {lang_nome.upper()} e devolva exatamente este JSON:\n"
            "{\n"
            f'  "text": "<a frase traduzida para {lang_nome}, natural e fluente>",\n'
            '  "translation": "<a mesma frase traduzida para o PORTUGUÊS do Brasil>",\n'
            f'  "keywords": [{{"word":"<palavra ou expressão em {lang_nome} que apareça EXATAMENTE no campo text>",'
            '"meaning":"<significado curto em português>"}]\n'
            "}\n"
            f"Regras: 3 a 8 keywords, palavras importantes que REALMENTE aparecem no text em {lang_nome}; "
            "'word' deve ser substring literal do 'text'; significados curtos em português."
        )
        payload = {
            "model": self.model,
            "messages": [{"role":"system","content":sysm},
                         {"role":"user","content":usr + "\n/no_think"}],
            "temperature": 0.2, "max_tokens": 768,
            "response_format": {"type":"json_object"},
            "cache_prompt": True,
            "chat_template_kwargs": {"enable_thinking": False},
            "enable_thinking": False,
        }
        req = urllib.request.Request(self.url, data=json.dumps(payload).encode("utf-8"),
                                     headers={"Content-Type":"application/json"})
        with urllib.request.urlopen(req, timeout=self.timeout) as r:
            resp = json.load(r)
        msg = resp["choices"][0]["message"]
        return msg.get("content") or msg.get("reasoning_content") or ""

    def traduzir(self, eng, lang_nome, tentativas=3):
        last = ""
        core = SPK.sub("", eng)
        for _ in range(tentativas):
            try:
                raw = self._call(core, lang_nome)
            except Exception as e:
                last = f"rede: {e}"; time.sleep(1); continue
            if self.debug:
                print("\n--- CRU ---\n"+raw+"\n-----------\n")
            raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.S)
            raw = re.sub(r"<think>.*$", "", raw, flags=re.S)
            obj = _json(raw)
            if obj and isinstance(obj.get("text"),str) and isinstance(obj.get("translation"),str) \
               and isinstance(obj.get("keywords"),list):
                text = SPK.sub("", obj["text"]).strip()
                pt   = SPK.sub("", obj["translation"]).strip()
                kws = [(k.get("word","").strip(), k.get("meaning","").strip())
                       for k in obj["keywords"]
                       if k.get("word","").strip() and k.get("meaning","").strip()
                       and k["word"].strip() in text]
                if text and pt and kws:
                    return text, pt, kws
                last = "campos/keywords invalidos"
            else:
                last = "json invalido"
        raise RuntimeError(f"LLM falhou ({lang_nome}) para {eng!r}: {last}")

def _json(txt):
    txt = txt.strip()
    m = re.search(r"```(?:json)?\s*(.+?)```", txt, flags=re.S)
    if m: txt = m.group(1).strip()
    try: return json.loads(txt)
    except Exception: pass
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

def traduzir_mock(eng, lang_nome):
    core = SPK.sub("", eng)
    palavras = [w for w in re.findall(r"[^\W\d_]+", core)][:4]
    return f"[{lang_nome}] {core}", f"[pt] {core}", [(w, "sig") for w in palavras]

# ---------- montagem ----------
def ids_novos(pdfs_dir):
    p = Path(pdfs_dir)
    ids = set()
    if p.is_dir():
        for f in p.iterdir():
            m = PDF_RE.match(f.name)
            if m: ids.add(m.group(1))
    return sorted(ids)

def linhas(path):
    return [l.rstrip("\n").strip() for l in open(path, encoding="utf-8") if l.strip()]

def processa_licao(lang_pt, lang_nome, lid, traduzir, limit=None):
    eng_lines = linhas(ING_DIR / f"{lid}.txt")
    if limit: eng_lines = eng_lines[:limit]
    ts = int(time.time()*1000)
    objs, txt_lines = [], []
    for idx, eng in enumerate(eng_lines):
        m = SPK.match(eng)
        letra = (m.group(1).upper() if m else "A")
        text, pt, kws = traduzir(eng, lang_nome)
        objs.append({
            "chinese": f"{letra}: {text}",
            "pinyin": "",
            "translation": f"{letra}: {pt}",
            "tokens": tokenize(lang_pt, text, letra),
            "keywords": [{"id": i+1, "word": w, "pinyin": "", "meaning": mng}
                         for i,(w,mng) in enumerate(kws)],
            "id": f"local-{ts}-{idx}",
            "language": lang_pt,
        })
        txt_lines.append(f"{letra}: {text}")
    return objs, txt_lines

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-url", default="http://localhost:8080")
    ap.add_argument("--model", default="local")
    ap.add_argument("--pdfs", default=PDFS_PADRAO, help="pasta dos PDFs p/ descobrir as licoes novas")
    ap.add_argument("--lang", default=None, help="processa so esta lingua (ex.: Espanhol)")
    ap.add_argument("--only", default=None, help="processa so esta licao (ex.: 2404)")
    ap.add_argument("--limit", type=int, default=None, help="so N falas por licao (teste, nao salva)")
    ap.add_argument("--dry-run", action="store_true", help="sem LLM (texto fake)")
    ap.add_argument("--overwrite", action="store_true", help="regenera mesmo se o .json ja existir")
    ap.add_argument("--debug", action="store_true")
    args = ap.parse_args()

    novos = ids_novos(args.pdfs)
    if args.only: novos = [x for x in novos if x == args.only]
    if not novos: sys.exit("Nenhuma licao nova encontrada (confira --pdfs / --only).")

    langs = [(p,n) for (p,n) in LANGS if (not args.lang or p == args.lang)]
    if not langs: sys.exit("Lingua nao reconhecida. Opcoes: " + ", ".join(p for p,_ in LANGS))

    traduzir = traduzir_mock if args.dry_run else LLM(args.api_url, args.model, args.debug).traduzir
    if not args.dry_run: print("LLM:", args.api_url, "| modelo:", args.model)
    print("Licoes novas:", ", ".join(novos))
    print("Linguas:", ", ".join(p for p,_ in langs), "\n")

    total_feitos = total_pulados = total_falhas = 0
    for lang_pt, lang_nome in langs:
        imp = BASE / f"{lang_pt}-Import"; imp.mkdir(exist_ok=True)
        txtd = BASE / lang_pt; txtd.mkdir(exist_ok=True)
        print(f"=== {lang_pt} ===")
        for lid in novos:
            dest = imp / f"{lid}.json"
            if dest.exists() and not args.overwrite and not args.limit and not args.dry_run:
                print(f"  pular {lid}: ja existe"); total_pulados += 1; continue
            try:
                objs, txt_lines = processa_licao(lang_pt, lang_nome, lid, traduzir, args.limit)
            except Exception as e:
                print(f"  ERRO {lid}: {e}"); total_falhas += 1; continue
            if not args.limit and not args.dry_run:
                with open(dest, "w", encoding="utf-8") as fh:
                    json.dump(objs, fh, ensure_ascii=False, indent=2)
                (txtd / f"{lid}.txt").write_text("\n".join(txt_lines) + "\n", encoding="utf-8")
            marca = " (teste: nao salvo)" if (args.limit or args.dry_run) else ""
            print(f"  OK {lid}: {len(objs)} falas{marca}")
            total_feitos += 1
    print(f"\nConcluido. {total_feitos} gerada(s), {total_pulados} pulada(s), {total_falhas} falha(s).")

if __name__ == "__main__":
    main()
