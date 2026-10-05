# Voz Local — Asistente privado con Ollama y Voxtral

Proyecto final · BSG · Fundamentos de Arquitectura LLM · Opción 7

**Autor:** Carlos Alberto Upson Galvez · **Entrega documental:** 4 de octubre de 2026

Portal de conversación por texto y voz que ejecuta la inferencia en el equipo del usuario. Combina Ollama para responder, Voxtral WebGPU para transcribir y Kokoro para generar voz. Su propósito es explorar una alternativa local para información interna empresarial, sin depender de una API conversacional gestionada.

> **Estado:** prototipo académico funcional de chat local. No constituye una certificación de seguridad ni una solución empresarial terminada. La demostración completa sin internet y el video están pendientes; la fluidez de voz sigue en validación.

## Video de presentación

**Enlace pendiente de grabación.** Añadir la URL en [docs/VIDEO.md](docs/VIDEO.md) y en esta sección cuando esté disponible. Duración máxima: 30 minutos.

## Ruta de lectura para el profesor

1. [Informe académico](docs/INFORME.md): problema, objetivos, arquitectura, resultados y conclusión.
2. [Instalación y uso](docs/INSTALACION.md).
3. [Resultados y análisis de costos](docs/RESULTADOS.md), con [CSV](evidencias/mediciones.csv) y [respuestas completas](evidencias/mediciones.json).
4. [Seguridad y prueba sin internet](docs/SEGURIDAD_Y_OFFLINE.md).
5. [Matriz de evaluación](docs/RUBRICA.md).
6. [Guion de exposición](docs/GUION_PRESENTACION.md): qué decir y qué mostrar.

## Funcionalidades implementadas

- Chat escrito y respuestas progresivas desde Ollama.
- Conversaciones independientes guardadas en el navegador y modelo recordado por chat.
- Consulta de los modelos instalados en Ollama.
- Voz iniciada explícitamente; transcripción continua con Voxtral en WebGPU.
- Envío manual del turno y envío por pausas opcional.
- Kokoro para voz natural e interrupción por voz.
- Copiar respuestas, abrir una rama, leer en voz alta y exportar el chat.
- Indicador de nivel y nombre del micrófono.

El reconocimiento progresivo está implementado, pero su latencia no está acreditada con una medición de extremo a extremo. No se promete equivalencia funcional o de calidad con un servicio comercial.

## Inicio rápido

Instalar dependencias una vez siguiendo [la guía](docs/INSTALACION.md), abrir Ollama y ejecutar en dos terminales:

```powershell
cd voice-chat-server
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

```powershell
cd Voxtral-Realtime-WebGPU
npm.cmd run dev -- --host 127.0.0.1 --port 5173
```

Abrir http://127.0.0.1:5173 y seleccionar `llama3.2:latest` para reproducir las mediciones.

## Caso de uso

Asistencia supervisada para consultas sobre políticas internas de RR. HH. Se proporcionan exclusivamente documentos y solicitudes ficticias en [datos/casos.json](datos/casos.json). El usuario pega el contexto en el chat: no existe todavía indexación documental ni RAG.

## Estructura

```text
Voxtral-Realtime-WebGPU/  Interfaz y reconocimiento en navegador
voice-chat-server/       API de conversación y voz
chatterbox/              Dependencia heredada, no es la voz predeterminada
scripts/                Medición y comprobaciones reproducibles
datos/                  Casos ficticios
evidencias/             Resultados obtenidos en el equipo real
docs/                   Informe, manuales y guion
```

Los pesos, entornos virtuales, conversaciones personales, credenciales y archivos de audio no se incluyen. Consultar [atribuciones](THIRD_PARTY_NOTICES.md).
