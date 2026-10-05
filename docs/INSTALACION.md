# Instalación y operación

## Requisitos

Windows, Python 3.12, Node.js 22, npm y Ollama. Chrome o Edge con WebGPU y permiso de micrófono para voz. La referencia probada usa RTX 3090 24 GiB y 32 GB de RAM; no se ha validado un mínimo universal. Se necesitan varios GB adicionales de disco para dependencias y modelos; los pesos no están incluidos.

## Preparación con internet

Desde la raíz del repositorio:

```powershell
ollama pull llama3.2:latest
cd voice-chat-server
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu126
.\.venv\Scripts\python.exe -m pip install -r requirements-core.txt
cd ..\Voxtral-Realtime-WebGPU
npm.cmd ci
```

`requirements-core.txt` instala el flujo actual de texto y Kokoro. `requirements.txt` conserva las dependencias históricas y Chatterbox; no es necesario instalarlo para la demo básica. La instalación limpia de todas las dependencias no se volvió a ejecutar en otro equipo: si existen conflictos, consultar `evidencias/versiones-python.txt` como referencia del entorno original.

## Ejecutar

Abrir Ollama desde Windows. Si no se ejecuta como aplicación, `ollama serve` en otra terminal. No abrir dos servidores en el mismo puerto.

Terminal 1 desde la raíz:

```powershell
cd voice-chat-server
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Terminal 2 desde la raíz:

```powershell
cd Voxtral-Realtime-WebGPU
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Abrir http://127.0.0.1:5173. Seleccionar Llama 3.2, crear un chat y pegar un caso de `datos/casos.json`. Cada chat recuerda su modelo; crear una rama copia el historial hasta la respuesta elegida.

Para voz, pulsar Iniciar voz, esperar la preparación y hablar. La barra muestra entrada de micrófono, no confirma reconocimiento. En modo continuo, Enviar turno solicita la respuesta; en Ajustes se puede habilitar envío por pausas. Detener voz cierra la sesión de voz. Los pesos de Voxtral se obtienen de Hugging Face durante la primera preparación; Kokoro puede descargar pesos y recursos en su primera utilización. Ensayar ambas funciones antes de desconectar la red.

## Verificación

```powershell
ollama ps
curl.exe http://127.0.0.1:8000/api/health
curl.exe http://127.0.0.1:8000/api/models
```

Si se corta una respuesta, revisar el límite de 256 tokens. Si se demora la voz, revisar memoria GPU y los tiempos separados de reconocimiento y síntesis. El código heredado de Kokoro ejecuta trabajo síncrono dentro de una ruta async; es una limitación de concurrencia pendiente de corregir. No prometer tiempo real basándose solo en el tiempo del LLM.

## Medir

Desde la raíz:

```powershell
python scripts/medir.py --model llama3.2:latest --repeticiones 3
python scripts/calcular_costos.py
```

El primer comando reemplaza los archivos de medición de la carpeta `evidencias`; guardar una copia si se quiere preservar la ejecución original. El segundo imprime los costos recalculados con esos tokens. No realiza llamadas externas.

## Detener

Ctrl+C en ambas terminales. `ollama stop llama3.2:latest` libera ese modelo de memoria sin borrarlo. El historial permanece en el almacenamiento del navegador; usar un perfil de demostración sin conversaciones personales.
