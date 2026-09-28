# formulario-buk

Apps Script del equipo **Digital Colombia (Buk)** que conecta un Google Form de solicitudes con ClickUp.

## Qué hace

| Función | Disparador | Qué hace |
|---|---|---|
| `onFormSubmit(e)` | Instalable, "Al enviar formulario" (en el Form) | Lee la respuesta, crea la tarea en la lista de ClickUp con asignados y custom fields, avisa por correo a los asignados y al solicitante. |
| `validarYNotificarSolicitante` | (llamada por la anterior) | Envía **un solo** correo al solicitante: confirmación, o aviso de ajuste si la fecha cae en fin de semana/festivo o no respeta el mínimo de días hábiles. |
| `revisarTareasVencidas()` | Temporizador diario (8–9 am) | Revisa la lista en ClickUp y manda a Google Chat un resumen de tareas vencidas y que vencen hoy, agrupado por persona. |

Asignación por área: SEO → Luisa · SEM → Santiago · Content → Nikolle + Valentina · SEO + Content → los tres · otro → Santiago.

## Configuración (Propiedades del script)

En Apps Script → ⚙️ Configuración del proyecto → **Propiedades del script**:

| Propiedad | Valor |
|---|---|
| `CLICKUP_TOKEN` | Token personal de ClickUp (`pk_...`) |
| `GCHAT_WEBHOOK_URL` | Webhook del espacio de Google Chat |
| `CORREOS_EXENTOS` | Correos sin mínimo de días, separados por coma |

Además:
- El Form debe tener activado **Recopilar direcciones de correo**.
- La zona horaria del proyecto debe ser `America/Bogota` (ver `src/appsscript.json`); todo el cálculo de días hábiles depende de eso.

## Archivos

- `src/Codigo.gs` — el script.
- `src/appsscript.json` — manifiesto (zona horaria, runtime V8).
- `REVISION.md` — revisión del código y cambios aplicados.
