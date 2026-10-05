"""Medición local reproducible. No envía datos a proveedores externos."""
import ast, csv, json, time, urllib.request, argparse, statistics
from pathlib import Path
from datetime import datetime, timezone
ROOT = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument("--model", default="llama3.2:latest")
p.add_argument("--repeticiones", type=int, default=3)
args = p.parse_args()
tree = ast.parse((ROOT / "voice-chat-server/main.py").read_text(encoding="utf-8"))
system = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "SYSTEM_PROMPT" for t in n.targets))
cases = json.loads((ROOT / "datos/casos.json").read_text(encoding="utf-8"))
rows = []
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
for repeat in range(args.repeticiones):
 for case in cases:
  payload = {"model":args.model,"messages":[{"role":"system","content":system},{"role":"user","content":case["prompt"]}],"stream":True,"options":{"num_ctx":4096,"num_predict":256,"temperature":0.4}}
  started = time.perf_counter(); first = None; answer = ""; final = {}
  req = urllib.request.Request("http://127.0.0.1:11434/api/chat", data=json.dumps(payload).encode(), headers={"Content-Type":"application/json"})
  with opener.open(req,timeout=180) as response:
   for line in response:
    item=json.loads(line); content=item.get("message",{}).get("content", "")
    if content and first is None: first=time.perf_counter()-started
    answer+=content
    if item.get("done"): final=item
  if not final: raise RuntimeError("Stream incompleto")
  row={"caso":case["id"],"repeticion":repeat+1,"modelo":args.model,"ttft_s":round(first or 0,4),"total_s":round(time.perf_counter()-started,4),"carga_s":round(final.get("load_duration",0)/1e9,4),"entrada_tokens":final.get("prompt_eval_count",0),"salida_tokens":final.get("eval_count",0),"tokens_s":round(final.get("eval_count",0)/(final.get("eval_duration",1)/1e9),2),"fin":final.get("done_reason"),"respuesta":answer}
  rows.append(row); print(case["id"],repeat+1,row["total_s"],row["fin"],flush=True)
(ROOT/"evidencias").mkdir(exist_ok=True)
(ROOT/"evidencias/mediciones.json").write_text(json.dumps({"fecha_utc":datetime.now(timezone.utc).isoformat(),"alcance":"Ollama directo; no mide STT/TTS ni navegador; primera solicitud con estado previo no controlado", "resultados":rows},ensure_ascii=False,indent=2),encoding="utf-8")
with (ROOT/"evidencias/mediciones.csv").open("w",newline="",encoding="utf-8") as f:
 w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
print("Mediana total:",statistics.median(x["total_s"] for x in rows))
