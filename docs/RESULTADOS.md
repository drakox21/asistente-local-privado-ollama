# Resultados de latencia, calidad y costo

## Medición propia

Ejecución conservada en JSON y CSV. Fecha de elaboración: 5 de octubre de 2026; el JSON registra el instante UTC del equipo para reproducibilidad. Hardware: Intel i5-13400, 32 GB RAM, RTX 3090 24 GiB, controlador 616.92. Llama 3.2 3B Q4_K_M, contexto 4096, generación máxima 256, temperatura 0,4. Tres casos ficticios repetidos tres veces.

| Medida | Resultado |
|---|---:|
| Solicitudes | 9 |
| Mediana tiempo al primer texto | 0.0395 s |
| Mediana tiempo total | 0.4381 s |
| Primera solicitud total | 4.7110 s |
| Carga de primera solicitud, reportada por Ollama | 4.1296 s |
| Mediana total sin primera solicitud | 0.4255 s |
| Media total sin primera solicitud | 0.4479 s |
| Mediana velocidad de generación | 222.14 tokens/s |
| Tokens de entrada medios | 443.67 |
| Tokens de salida medios | 91.00 |
| Solicitudes truncadas por longitud | 0 |

Estos datos son de **Ollama directo por loopback**, no de voz a voz ni del recorrido completo de la web. El tiempo de carga inicial no debe ocultarse ni promediarse sin explicarlo. No hubo control de caché, ensayo de concurrencia ni muestreo energético. La caché de prefijos y la brevedad de los casos pueden favorecer los resultados. No se extrapola esta tasa a documentos largos o modelos 35B.

## Resultados individuales

| Caso | Repetición | Primer texto s | Total s | Entrada tokens | Salida tokens | Fin |
|---|---:|---:|---:|---:|---:|---|
| RH01 | 1 | 4.2768 | 4.711 | 453 | 96 | stop |
| RH02 | 1 | 0.0413 | 0.3874 | 438 | 77 | stop |
| RH03 | 1 | 0.0382 | 0.5884 | 440 | 123 | stop |
| RH01 | 2 | 0.0446 | 0.4647 | 453 | 92 | stop |
| RH02 | 2 | 0.0391 | 0.3593 | 438 | 71 | stop |
| RH03 | 2 | 0.0395 | 0.4381 | 440 | 88 | stop |
| RH01 | 3 | 0.0417 | 0.4057 | 453 | 81 | stop |
| RH02 | 3 | 0.0388 | 0.413 | 438 | 83 | stop |
| RH03 | 3 | 0.0386 | 0.5267 | 440 | 108 | stop |

## Calidad observada

La revisión manual de las respuestas completas encontró errores sustanciales. RH01 repetición 1 identifica correctamente ambos límites de vacaciones. RH02 repetición 1 añade copia del documento de identidad y correo privado, que no estaban en la fuente. RH03 repetición 3 introduce familiares o hermanos como personas autorizadas, lo cual contradice la política ficticia. No se reporta una tasa de exactitud automática ni se seleccionan solo ejemplos favorables.

**Implicación:** el sistema sirve como prototipo de borradores supervisados; no debe decidir accesos ni interpretar políticas con autoridad. Necesita mejor evaluación de fidelidad, referencias a fuentes y controles deterministas.

## Comparación económica

Se compara con **Ministral 3B 3.0 en Amazon Bedrock**, un modelo de la misma clase de tamaño y tareas conversacionales. Precio publicado consultado el 5 de octubre de 2026 para US East N. Virginia y US West Oregon: **USD 0,10 por millón de tokens de entrada y USD 0,10 por millón de salida**. Fuente primaria: [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/), sección Mistral AI.

No es el mismo modelo ni se ha demostrado equivalencia de calidad. Se utiliza como referencia de costo de una API pequeña comparable por clase, no como prueba de que las respuestas sean idénticas. Los tokens propios de Llama se usan como aproximación de facturación; otro tokenizador puede producir conteos diferentes. No se llamó a la API, no se midió su latencia y no se incluyeron STT/TTS gestionados, impuestos, red o integración. Estos límites impiden afirmar una ventaja de velocidad frente a la nube.

Fórmula por solicitud: `(tokens_entrada × tarifa_entrada + tokens_salida × tarifa_salida) / 1.000.000`.

Con el promedio medido: `(443.67 × 0,10 + 91.00 × 0,10) / 1.000.000 = USD 0.00005347` por solicitud.

### Escenario local amortizado

Supuestos explícitos, **no precios pagados ni potencia medida**:

- Equipo imputado a la solución: USD 1.500, vida útil 36 meses, sin valor residual.
- Mantenimiento: 2 horas/mes a USD 15/hora.
- Potencia activa del equipo: 0,35 kW; electricidad USD 0,15/kWh.
- Uso secuencial: media de solicitudes posteriores a la primera; no incluye arranques, reposo, voz ni tiempos humanos.
- Se asigna el 100% del equipo al proyecto, aunque un equipo compartido permitiría otro reparto.

Amortización mensual = `1500 / 36 = USD 41,67`. Mantenimiento = `2 × 15 = USD 30`. Energía activa = `0,35 × (consultas × 0.4479 / 3600) × 0,15`.

| Consultas/mes | API estimada USD | Local escenario USD | Electricidad activa incluida USD |
|---:|---:|---:|---:|
| 1,000 | 0.0535 | 71.67 | 0.0065 |
| 10,000 | 0.5347 | 71.73 | 0.0653 |
| 100,000 | 5.3467 | 72.32 | 0.6532 |

La cifra pequeña de electricidad corresponde solo a segundos de inferencia activa. Si el equipo permanece encendido o ejecuta Voxtral y Kokoro, el consumo será mayor. Como sensibilidad, 0,35 kW constantes durante 8 horas × 22 días representarían USD 9,24/mes; tampoco es una medición real. Se entrega `scripts/calcular_costos.py` para recalcular con otra tarifa o volumen.

## Decisión

Con estos supuestos, comprar hardware solo para pocas consultas no se justifica por ahorro frente a una API pequeña. Si la organización exige no enviar el contenido a un proveedor, la inferencia local puede justificarse por control, aceptando costos de operación y validación. Antes de producción hay que demostrar aislamiento offline, corregir los errores de fidelidad y medir el recorrido completo de voz. No se declara victoria económica ni equivalencia de calidad.
