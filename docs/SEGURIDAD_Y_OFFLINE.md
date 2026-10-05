# Seguridad y evidencia sin internet

## Estado de la evidencia

**Pendiente de ejecutar y grabar la prueba integral sin conexión.** No se desconectó la red del equipo durante la elaboración documental. Las mediciones de Ollama usan loopback, pero el equipo tenía conectividad; eso no demuestra ausencia de tráfico de otros procesos.

## Inventario revisado

| Componente | Flujo observado en código | Límite de la afirmación |
|---|---|---|
| Chat | Navegador → `/api/chat/stream` → Ollama en 127.0.0.1:11434 | URL configurable; fijar loopback y modelos locales aprobados |
| Modelos disponibles | Backend → `/api/tags` de Ollama | Listado no filtra necesariamente variantes cloud |
| Voxtral | Audio procesado por WebGPU en navegador | `from_pretrained` usa repositorio de Hugging Face; caché puede faltar o consultarse |
| Kokoro | Texto enviado al backend local; WAV vuelve al navegador | Primera carga puede descargar modelos y recursos lingüísticos |
| Voz rápida | API de síntesis del navegador | Puede seleccionar voz no local si no encuentra una local; excluir de la demo privada |
| Historial | localStorage | No tiene cifrado propio ni control multiusuario |
| Dependencias | npm, PyPI y repositorios de modelos | Preparación conectada; no se auditaron todas sus comunicaciones |
| Telemetría | Sin SDK explícito encontrado en código propio | No prueba ausencia en librerías, navegador o sistema operativo |

No se incluyen tokens, claves, historial personal, cachés ni grabaciones en este repositorio. La aplicación no tiene funciones de acceso automático a documentos empresariales. Todo ejemplo publicado es ficticio.

## Procedimiento reproducible de demostración

1. Preparar las dependencias con internet. Descargar el LLM, iniciar la web, completar la carga de Voxtral y reproducir una respuesta Kokoro. Registrar versiones.
2. Usar un perfil de navegador exclusivo para la demo. Elegir Kokoro, no Voz rápida. Cerrar aplicaciones que puedan aportar resultados externos al experimento.
3. Iniciar grabación mostrando fecha, `ollama ps`, la URL local y la pestaña Network del navegador con Preserve log. Limpiar el registro de red antes de la prueba.
4. Desconectar Wi-Fi y Ethernet manualmente. Mantener loopback. Mostrar un intento fallido de acceso a una página externa y el estado desconectado de los adaptadores. El fallo de una sola URL no basta por sí mismo para demostrar aislamiento.
5. Recargar la web local, abrir un chat nuevo y pegar RH01. Mostrar la respuesta completa. Preguntar «¿Qué plazos incumplió?» para demostrar continuidad del contexto.
6. Iniciar voz y pronunciar una pregunta distinta; mostrar micrófono, palabras parciales y respuesta hablada. Si falla una carga, registrar el fallo: no declarar aprobado el modo de voz.
7. Inspeccionar las peticiones del navegador. Registrar solicitudes externas intentadas, incluso bloqueadas. Complementar con captura de tráfico de los procesos Python, Ollama y navegador: la pestaña Network no ve todo el backend.
8. Guardar captura o grabación y una tabla con fecha, versiones, caso, resultado, intento de conexión externa y observaciones. Publicar únicamente evidencia sin datos reales ni direcciones personales.
9. Restaurar la conectividad y añadir enlace y marcas de tiempo a VIDEO.md.

## Criterio de aceptación

Texto y voz deben funcionar después de reiniciar/recargar en condiciones offline y usar artefactos locales completos. Para afirmar «cero dependencia externa en ejecución» también hay que eliminar o bloquear las rutas de descarga, servir ONNX/WASM localmente, establecer una lista de destinos y verificar conexiones. Una respuesta servida desde un proceso previamente cargado demuestra menos que un reinicio completo.

## Estado frente al requisito estricto del curso

La configuración actual **no es arquitectónicamente incapaz de enviar datos a terceros**: tiene URL configurable, descarga de recursos y voz del navegador opcional. El repositorio documenta esta brecha; no la presenta como resuelta. Un despliegue con salida de red denegada, artefactos internos y verificación dinámica debe preceder a cualquier afirmación empresarial de aislamiento.

## Protección empresarial propuesta

Red interna con salida denegada, proveedores locales permitidos, TLS, autenticación corporativa, permisos por documento, cifrado en reposo, política de retención, consentimiento de micrófono, control de exportaciones y pruebas de inyección de instrucciones. El modelo no debe ser quien decida la autorización de acceso: debe hacerlo el backend antes de entregarle información.
