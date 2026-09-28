# Revisión del Apps Script Form → ClickUp (Digital Colombia)

Los hallazgos van ordenados por gravedad. El commit `Agrega Apps Script original…` contiene el código tal como lo compartieron (solo se quitaron el token y los correos), y el commit siguiente trae las correcciones, así que el diff muestra cada cambio.

## 🔴 Crítico

### 1. El token de ClickUp estaba en el código
`const CLICKUP_TOKEN = "pk_156160640_..."` es un **token personal** que da acceso total a todo lo que ve Santiago en ClickUp, no solo a esta lista. Como el código se copió y se compartió, hay que asumir que el token está expuesto.

- **Acción urgente:** Santiago debe **regenerar el token** en ClickUp (Settings → Apps → API Token → Regenerate) y guardar el nuevo solo en Propiedades del script.
- **Corregido:** ahora el script lo lee de `PropertiesService` (`CLICKUP_TOKEN`).

### 2. Si ClickUp falla, igual se envía "✅ Recibimos tu solicitud"
`crearTareaClickUp` no revisaba el código HTTP. Con un token vencido, un custom field inválido o un 429, ClickUp responde `{"err": ...}`. Ese JSON se parseaba sin problema, `notificarAsignados` no hacía nada (no hay `assignees`) y **el solicitante recibía la confirmación aunque la tarea nunca se creó**. La solicitud se perdía sin que nadie se enterara.

- **Corregido:** ahora se valida `getResponseCode()` y se lanza un error. `onFormSubmit` tiene un `try/catch` que le manda un correo al dueño del script con el error y el correo del solicitante, y deja la ejecución marcada como fallida en Apps Script.

## 🟠 Bugs

### 3. Festivos: `2026-07-13` no es festivo, y la lista se acaba en diciembre
- El 13 de julio de 2026 no es festivo en Colombia (2026 tiene 18 festivos y la lista tenía 19). Ese lunes se trataba como no hábil.
- La lista solo cubría 2026. Desde el 1 de enero de 2027 ningún festivo se habría detectado, sin ningún error visible.
- **Corregido:** los festivos ahora se calculan para cualquier año (Pascua + Ley Emiliani). Se verificó que el resultado coincide con el calendario oficial de 2026 y de 2027.

### 4. Si falta la fecha de entrega o el correo, el script se cae
- Sin fecha, `new Date("T12:00:00-05:00")` da una fecha inválida y `Utilities.formatDate` lanza una excepción. La tarea ya estaba creada, pero el solicitante no recibía ningún correo.
- Sin correo (el Form no recopila emails), `MailApp.sendEmail("")` falla.
- **Corregido:** en ambos casos se registra un aviso y no se envía el correo al solicitante.

### 5. Custom fields vacíos
Se enviaba `value: ""` para Objetivo, Formato o Área que solicita cuando venían vacíos. Según el tipo de campo, ClickUp puede **rechazar la creación de la tarea completa** por un valor inválido.
- **Corregido:** solo se envían los campos que tienen valor.

### 6. Alertas de vencidas: estado "completado" por texto
Una tarea se consideraba completada solo si el nombre de su estado contenía "entreg" o "cerr". Si alguien renombra un estado (por ejemplo "Publicado" o "Done"), esas tareas empiezan a aparecer como vencidas.
- **Corregido:** también se usa `status.type` (`closed` / `done`), que ClickUp mantiene aunque se cambie el nombre del estado.

### 7. Paginación de ClickUp y errores silenciosos
Se asumía que una página con exactamente 100 tareas implicaba que había otra. Además, un error de la API (token inválido) se veía como "✅ No hay tareas vencidas".
- **Corregido:** se usa `last_page` de la respuesta y se lanza un error si el código HTTP no es 200.

## 🟡 Menores / buenas prácticas

- **HTML sin escapar:** el nombre de la tarea (armado con respuestas del Form) y el área se insertaban tal cual en el HTML de los correos. Se agregó `escaparHtml()`.
- **Correos personales en código:** la lista de exentos ahora se lee de la propiedad `CORREOS_EXENTOS`, para que no quede publicada en un repo.
- **Zona horaria:** `getDay()`, `setHours()` y `new Date()` usan la zona del proyecto. Se agregó `appsscript.json` con `America/Bogota`. Si el proyecto estaba en otra zona, las validaciones podían correrse un día.
- **Duplicado:** `nombreTarea` se armaba en dos lugares. Ahora se arma una sola vez y se pasa a `crearTareaClickUp`.
- `esColombia` y `urlTarea` (dentro de `validarYNotificarSolicitante`) se leían pero no se usaban (se quitó la segunda).

## ❓ Para confirmar con Santiago (no se cambió)

**Mínimo de "3 días hábiles":** `calcularFechaMinima(3)` cuenta 3 días hábiles y después **suma uno más**. En la práctica exige 3 días hábiles completos *entre* hoy y la entrega:

| Envío | Fecha mínima aceptada |
|---|---|
| Lunes 28/09/2026 | Viernes 02/10 |
| Viernes 02/10/2026 | Jueves 08/10 |
| Viernes 09/10/2026 (lunes 12 es festivo) | Viernes 16/10 |

Si la intención era que un lunes se pudiera pedir para el jueves, hay que quitar el bloque `fecha.setDate(fecha.getDate() + 1)` que viene después del `while`. Si la regla actual es la correcta, conviene que el texto del correo diga "3 días hábiles completos".

**Otros puntos a revisar:**
- Las áreas se comparan exactas en mayúsculas ("SEO + CONTENT"). Si en el Form la opción se escribe distinto (por ejemplo "SEO+Content"), la tarea cae en el caso por defecto (Santiago) y sin el custom field de Área.
- El token es personal de Santiago: si Santiago sale del equipo, todo deja de funcionar. Conviene usar un usuario de servicio en ClickUp.

## Cómo desplegar la versión corregida

1. Regenerar el token de ClickUp (punto 1).
2. En Apps Script, pegar `src/Codigo.gs` y, en Configuración del proyecto, activar "Mostrar archivo de manifiesto appsscript.json" y copiar `src/appsscript.json`.
3. Crear las propiedades `CLICKUP_TOKEN`, `GCHAT_WEBHOOK_URL` y `CORREOS_EXENTOS`.
4. Los disparadores existentes (`onFormSubmit` y `revisarTareasVencidas`) siguen funcionando porque los nombres de las funciones no cambiaron.
5. Probar enviando el Form con una fecha que caiga en festivo y otra válida.
