# Guion de presentación de Voz Local

**Autor:** Alberto Upson. **Duración prevista:** 15–18 minutos, incluyendo demostraciones. No leer las instrucciones «Mostrar»; son indicaciones de producción. Ensayar antes de grabar y no afirmar que una prueba pasó si falla en la toma.

## Preparación antes de grabar

Abrir el repositorio, README, diagrama, RESULTADOS.md y la web. Usar un perfil de demostración sin historial personal. Tener Ollama y ambos servicios encendidos, seleccionar Llama 3.2 y descargar previamente Voxtral y Kokoro. Preparar los tres casos ficticios. Cerrar correo, mensajería y datos sensibles. Tener visible el panel de red del sistema y Network del navegador. No mostrar tokens ni credenciales. El único paso que falta después de grabar es poner la URL en VIDEO.md y README.

## 00:00 a 02:00 — Presentación y problema

**Mostrar:** portada del repositorio y título del proyecto.

**Decir:**

«Hola, soy Alberto Upson. Presento Voz Local, mi proyecto final de Fundamentos de Arquitectura LLM. El objetivo es contar con un portal de conversación por texto y voz que ejecute sus modelos en el equipo, en lugar de enviar las preguntas a una API conversacional externa.

El caso que elegí es una mesa de ayuda interna de recursos humanos. Las consultas pueden contener información que una organización quiere mantener dentro de su infraestructura. Para esta demostración uso políticas y empleados ficticios. No estoy publicando datos de una empresa real.

La pregunta del proyecto no es solamente si puedo instalar un modelo. Es si una solución local tiene sentido cuando considero privacidad, calidad, velocidad y costo. Voy a mostrar qué funciona, qué medí y qué falta antes de usarlo en una empresa.»

## 02:00 a 04:00 — Arquitectura

**Mostrar:** diagrama de INFORME.md. Señalar navegador, backend, Ollama y voz.

**Decir:**

«La interfaz está hecha con React y TypeScript. El navegador envía las preguntas a FastAPI, y FastAPI consulta Ollama en la misma máquina. El modelo de conversación se puede cambiar sin reemplazar la interfaz.

Para la voz utilizo Voxtral mediante WebGPU: el audio del micrófono se procesa en el navegador. Kokoro transforma la respuesta en audio local. Son tres responsabilidades distintas: escuchar, responder y hablar.

El historial se guarda en el navegador. Cada chat recuerda su modelo y envía una parte de su contexto en cada pregunta. El modelo no tiene memoria ilimitada. Tampoco puede acceder por sí solo a los archivos de una empresa: en esta versión el contexto se proporciona manualmente.

Las dependencias y los pesos se descargan durante la preparación. Que la inferencia sea local no implica automáticamente que toda dependencia deje de hacer conexiones. Por eso la prueba sin internet y la revisión de tráfico son importantes.»

## 04:00 a 07:00 — Demostración funcional

**Mostrar y hacer:** crear un chat, seleccionar Llama 3.2, pegar RH01 de datos/casos.json, enviar y esperar la respuesta completa. Después preguntar «¿Qué plazos incumplió?». Abrir un chat distinto y mostrar que no hereda los mensajes. Volver al primero, copiar y crear una rama. No dedicar tiempo a detalles cosméticos.

**Decir:**

«Esta política ficticia exige quince días de anticipación y permite diez días consecutivos. La solicitud pide doce días con ocho de anticipación. El asistente debe identificar esas diferencias sin aprobar ni rechazar la solicitud por su cuenta.

Ahora hago una pregunta de seguimiento para comprobar que conserva el tema. También puedo separar conversaciones, copiar respuestas y abrir una rama con el historial hasta un punto determinado. Son funciones útiles, pero no sustituyen permisos empresariales: dos chats distintos no equivalen a dos usuarios aislados.»

**Mostrar y hacer:** iniciar voz, pronunciar una frase, mostrar la barra y el texto parcial si aparece. Pulsar Enviar turno y reproducir Kokoro. Si existe demora, dejarla visible.

**Decir:**

«La entrada de voz es una extensión del chat. La barra confirma que entra audio; el texto confirma que hubo reconocimiento. La latencia de voz todavía requiere una evaluación específica y no voy a confundirla con la velocidad del modelo de texto.»

## 07:00 a 11:00 — Demostración sin internet

**Mostrar y hacer:** seguir SEGURIDAD_Y_OFFLINE.md. Desconectar Wi-Fi y Ethernet, mostrar su estado, recargar la web local y realizar una consulta nueva. Mostrar un intento fallido de conexión externa. Probar además voz y revisar Network. Grabar sin cortes que oculten la desconexión.

**Decir antes de probar:**

«Voy a desconectar la conexión externa y mantener los servicios locales. La prueba consiste en formular una pregunta nueva, no en mostrar una respuesta que ya estaba guardada. Primero demostraré texto; después comprobaré voz porque utiliza otros artefactos.»

**Si funciona:**

«En esta ejecución el caso mostrado respondió sin conectividad externa. La evidencia corresponde a este equipo, estas versiones y estas funciones. Eso no certifica por sí solo toda la cadena de dependencias: para un entorno empresarial también bloquearía la salida de red y serviría los recursos desde almacenamiento interno.»

**Si falla:**

«Esta prueba detectó una dependencia que aún no está preparada para funcionar offline. La registraré como pendiente y no afirmaré que la solución completa cumple el aislamiento. El siguiente paso es identificar el recurso faltante y repetir el ensayo.»

No leer ambas alternativas. Antes de publicar el video, reflejar el resultado real en VIDEO.md y la matriz de evaluación.

## 11:00 a 14:00 — Latencia y costo

**Mostrar:** CSV, una respuesta completa y tabla de RESULTADOS.md.

**Decir:**

«Ejecuté tres casos ficticios tres veces: nueve solicitudes locales. Conservé los resultados completos, no solo una cifra seleccionada. La mediana de respuesta fue de cero coma cuarenta y cuatro segundos. La primera solicitud tardó cuatro coma setenta y uno segundos e incluyó carga del modelo. La mediana de las posteriores fue aproximadamente cero coma cuarenta y tres segundos.

Estas cifras corresponden a Ollama directo, no al tiempo de voz a voz. No medí latencia de una API externa. Para comparar costos utilicé los tokens de mis pruebas y el precio publicado de una API de un modelo de tres mil millones de parámetros. Es una comparación por clase de tamaño, no una demostración de calidad idéntica.

En el escenario de diez mil consultas, la API estimada cuesta alrededor de cincuenta y tres centavos de dólar por inferencia de texto. El escenario local ronda setenta y dos dólares mensuales al imputar hardware y mantenimiento. La electricidad calculada considera únicamente inferencia activa: no es una medición de consumo del equipo y no incluye voz o reposo.

La conclusión económica es que local no significa gratis. Para cargas pequeñas, la API puede ser más barata. La razón para elegir local sería un requisito de control de datos, no prometer un ahorro que estas cifras no sostienen.»

## 14:00 a 16:00 — Calidad, límites y conclusión

**Mostrar:** resultados RH02 y RH03, sección de limitaciones y hoja de ruta.

**Decir:**

«La prueba también reveló errores. En algunas respuestas el modelo inventó documentos necesarios o personas autorizadas para ver evaluaciones. Eso sería inaceptable si el asistente tuviera autoridad para decidir. En este proyecto actúa como generador de borradores supervisados.

Para llevarlo a una empresa incorporaría autenticación, permisos por documento, cifrado y retención del historial, fuentes verificables y evaluación de fidelidad. También completaría la medición de voz y el aislamiento de red. El backend debe controlar los permisos; no debemos delegar esa decisión al modelo.

Mi conclusión es que la arquitectura local es viable y puede ser conveniente cuando la custodia de datos es obligatoria. El prototipo demuestra conversación local y aporta números propios, pero no lo presento como una solución empresarial terminada. El repositorio incluye el código, la metodología, los resultados y los pendientes para que el trabajo sea revisable y reproducible. Gracias.»

## Cierre de entrega

Mostrar el enlace público del repositorio. Después de subir el video, actualizar VIDEO.md y README con URL y marcas de tiempo reales. No decir «cero filtraciones», «más rápido que la nube» o «listo para cualquier empresa»: esas afirmaciones no están demostradas.
