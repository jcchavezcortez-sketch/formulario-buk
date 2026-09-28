// ===== CONFIGURACIÓN =====
// El token de ClickUp NO va en el código: se guarda en Configuración del proyecto →
// Propiedades del script → CLICKUP_TOKEN.
const CLICKUP_TOKEN = PropertiesService.getScriptProperties().getProperty("CLICKUP_TOKEN");
const LIST_ID = "1000280000010420";


const IDS = {
  SANTIAGO: 156160640,
  NIKOLLE: 216190180,
  VALENTINA: 101706193,
  LUISA: 101706192
};


// ===== TOKENS DE MARCA BUK (Brand Guide junio 2026) =====
const BRAND = {
  azulOscuro: "#061355",
  azul: "#2F4DAA",
  azulMedio: "#1A3B98",
  azulClaro: "#6588DE",
  azulPalido: "#D7E2FB",
  amarillo: "#F9B82C",
  naranjo: "#F59121",
  verde: "#44AA4E",
  fondo: "#F6F8FE"
};


// URL del Portal de Solicitantes (login por correo @buk.co, cada quien ve solo sus solicitudes)
const URL_PORTAL = "https://buk-portal-solicitudes-digital-co.vercel.app";


// ===== FUNCIÓN PRINCIPAL: se activa cuando alguien envía el Form =====
function onFormSubmit(e) {
  try {
    procesarRespuesta(e.response);
  } catch (err) {
    // Sin esto, si ClickUp falla la solicitud se pierde en silencio.
    Logger.log("❌ Error procesando respuesta: " + err + "\n" + err.stack);
    MailApp.sendEmail(
      Session.getEffectiveUser().getEmail(),
      "❌ Error en el formulario de Solicitudes Digital Colombia",
      "No se pudo procesar una respuesta del formulario.\n\n" +
      "Error: " + err + "\n\n" +
      "Correo del solicitante: " + (e.response ? e.response.getRespondentEmail() : "desconocido") + "\n\n" +
      "Revisa las ejecuciones en Apps Script y crea la tarea a mano si es necesario."
    );
    throw err;
  }
}


function procesarRespuesta(formResponse) {
  const itemResponses = formResponse.getItemResponses();


  const respuestas = {};
  itemResponses.forEach(function(itemResponse) {
    const pregunta = itemResponse.getItem().getTitle().trim();
    const respuesta = itemResponse.getResponse();
    respuestas[pregunta] = respuesta;
  });


  const correo = formResponse.getRespondentEmail();
  const areaSolicita = respuestas["Área que solicita"] || "";
  const esColombia = respuestas["Colombia"] || "";
  const tipoSolicitud = respuestas["Tipo de solicitud"] || "";
  const areaDigital = respuestas["¿A qué área está dirigida tu solicitud?"] || "";
  const descripcion = respuestas["Descríbenos tu solicitud"] || "";
  const objetivo = respuestas["Objetivo"] || "";
  const detallesTecnicos = respuestas["Incluye algunos detalles técnicos (en caso de que se requiera)"] || "";
  const formato = respuestas["Formato (Blog, landing, pauta...)"] || "";
  const enlaceExtra = respuestas["Dejar enlace (En caso de se requiera, trello, clikcup...)"] || "";
  const fechaEntrega = respuestas["Fecha de Entrega"] || "";
  const archivoAdjunto = respuestas["Adjuntar archivo  (Drive)"] || respuestas["Adjuntar archivo (Drive)"] || "";


  Logger.log("Correo: " + correo);
  Logger.log("Área que solicita: " + areaSolicita);
  Logger.log("Colombia: " + esColombia);
  Logger.log("Tipo de solicitud: " + tipoSolicitud);
  Logger.log("Área Digital: " + areaDigital);
  Logger.log("Descripción: " + descripcion);
  Logger.log("Objetivo: " + objetivo);
  Logger.log("Detalles técnicos: " + detallesTecnicos);
  Logger.log("Formato: " + formato);
  Logger.log("Enlace extra: " + enlaceExtra);
  Logger.log("Fecha de entrega: " + fechaEntrega);
  Logger.log("Archivo adjunto: " + archivoAdjunto);


  const nombreTarea = "Colombia - " + areaDigital + " - " + tipoSolicitud;


  const tareaCreada = crearTareaClickUp({
    nombreTarea: nombreTarea,
    correo: correo,
    areaSolicita: areaSolicita,
    esColombia: esColombia,
    tipoSolicitud: tipoSolicitud,
    areaDigital: areaDigital,
    descripcion: descripcion,
    objetivo: objetivo,
    detallesTecnicos: detallesTecnicos,
    formato: formato,
    enlaceExtra: enlaceExtra,
    fechaEntrega: fechaEntrega,
    archivoAdjunto: archivoAdjunto
  });


  notificarAsignados(tareaCreada, nombreTarea, areaDigital);
  validarYNotificarSolicitante(fechaEntrega, correo, nombreTarea, tareaCreada, areaDigital);
}


// ===== LÓGICA DE ASIGNACIÓN =====
function obtenerAsignados(areaDigital) {
  const area = areaDigital.trim().toUpperCase();


  if (area === "SEO") {
    return [IDS.LUISA];
  } else if (area === "SEM") {
    return [IDS.SANTIAGO];
  } else if (area === "CONTENT") {
    return [IDS.NIKOLLE, IDS.VALENTINA];
  } else if (area === "SEO + CONTENT") {
    return [IDS.LUISA, IDS.NIKOLLE, IDS.VALENTINA];
  } else {
    return [IDS.SANTIAGO];
  }
}


// ===== MAPEOS PARA CUSTOM FIELDS =====
const AREA_OPTION_IDS = {
  "SEO": "da302e08-094e-44b3-91d8-feabb7981eed",
  "SEM": "9a8045e3-9869-4425-867a-d02b562588da",
  "CONTENT": "3fc2ba02-5363-4307-bc5d-dd465b35b7df",
  "SEO + CONTENT": "9aae1091-b305-4642-82ab-7b30fafd0e29"
};


const CAMPOS = {
  AREA: "71cfe901-c562-4a64-b748-f1483c72b962",
  SOLICITANTE: "3980ee5e-56ed-49e7-814c-481b9c093369",
  OBJETIVO: "6f708cd3-3ada-450d-a185-bfec6b805632",
  FORMATO: "7231cfc2-e363-4912-90a3-9f7e7c3f9ff9",
  AREA_SOLICITA: "3c11058c-214a-4870-a28f-3c132f43f60a"
};


// ===== FUNCIÓN: crea la tarea en ClickUp vía API =====
function crearTareaClickUp(datos) {
  const url = "https://api.clickup.com/api/v2/list/" + LIST_ID + "/task";


  const descripcionCompleta =
    "Descripción: " + datos.descripcion + "\n\n" +
    "Detalles técnicos: " + (datos.detallesTecnicos || "N/A") + "\n\n" +
    "Enlace: " + (datos.enlaceExtra || "N/A") + "\n\n" +
    "Archivo adjunto: " + (datos.archivoAdjunto || "N/A");


  const asignados = obtenerAsignados(datos.areaDigital);
  const areaOptionId = AREA_OPTION_IDS[datos.areaDigital.trim().toUpperCase()] || null;


  // Solo se envían los campos con valor: un valor vacío en un custom field
  // puede hacer que ClickUp rechace la creación de toda la tarea.
  const customFields = [
    { id: CAMPOS.SOLICITANTE, value: datos.correo },
    { id: CAMPOS.OBJETIVO, value: datos.objetivo },
    { id: CAMPOS.FORMATO, value: datos.formato },
    { id: CAMPOS.AREA_SOLICITA, value: datos.areaSolicita },
    { id: CAMPOS.AREA, value: areaOptionId }
  ].filter(function(campo) { return campo.value; });


  const payload = {
    name: datos.nombreTarea,
    description: descripcionCompleta,
    assignees: asignados,
    custom_fields: customFields
  };


  if (datos.fechaEntrega) {
    payload.due_date = new Date(datos.fechaEntrega + "T12:00:00-05:00").getTime();
    payload.due_date_time = false;
  }


  const opciones = {
    method: "post",
    contentType: "application/json",
    headers: { "Authorization": CLICKUP_TOKEN },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };


  const respuesta = UrlFetchApp.fetch(url, opciones);
  const codigo = respuesta.getResponseCode();
  Logger.log("Respuesta de ClickUp (" + codigo + "): " + respuesta.getContentText());

  if (codigo < 200 || codigo >= 300) {
    throw new Error("ClickUp respondió " + codigo + " al crear la tarea: " + respuesta.getContentText());
  }

  return JSON.parse(respuesta.getContentText());
}


// Escapa texto que viene del formulario antes de meterlo en el HTML del correo.
function escaparHtml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


// ===== PLANTILLA HTML BASE (identidad Buk) =====
// Nota: opts.area se escapa aquí; en saludo/mensaje/detalles el texto del formulario
// debe pasarse ya escapado con escaparHtml().
function construirEmailHtml(opts) {
  const pillColors = {
    asignacion: { bg: BRAND.azulPalido, text: BRAND.azulMedio, label: "📋 Nueva asignación" },
    ajuste:     { bg: "#FDECC8",        text: BRAND.naranjo,   label: "⚠️ Requiere ajuste" },
    confirmacion: { bg: BRAND.azulPalido, text: BRAND.azulMedio, label: "✓ Solicitud confirmada" }
  };
  const pill = pillColors[opts.tipo] || pillColors.confirmacion;


  const filasDetalle = opts.detalles.map(function(fila) {
    return '<tr>' +
      '<td style="color:' + BRAND.azulClaro + ';width:120px;font-family:Arial,Helvetica,sans-serif;font-size:13px;padding:4px 0;vertical-align:top;">' + fila.label + '</td>' +
      '<td style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:' + BRAND.azulMedio + ';padding:4px 0;">' + fila.valor + '</td>' +
      '</tr>';
  }).join("");


  const areaTagHtml = opts.area
    ? '<span style="background-color:' + BRAND.azul + ';color:#ffffff;font-size:11px;font-weight:bold;padding:3px 10px;border-radius:20px;">' + escaparHtml(opts.area) + '</span>'
    : "";


  const botonHtml = opts.botonUrl
    ? '<tr><td style="padding:24px 32px 8px;" align="center">' +
        '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="background-color:' + BRAND.amarillo + ';background:linear-gradient(90deg,' + BRAND.amarillo + ',' + BRAND.naranjo + ');border-radius:10px;">' +
        '<a href="' + opts.botonUrl + '" style="display:inline-block;padding:12px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;color:' + BRAND.azulOscuro + ';text-decoration:none;">' + (opts.botonTexto || "Ver en el Portal") + '</a>' +
        '</td></tr></table>' +
      '</td></tr>'
    : "";


  return '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"></head>' +
  '<body style="margin:0;padding:0;background-color:' + BRAND.fondo + ';font-family:Arial,Helvetica,sans-serif;">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:' + BRAND.fondo + ';padding:32px 0;">' +
  '<tr><td align="center">' +
  '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ' + BRAND.azulPalido + ';">' +
    '<tr><td style="background:linear-gradient(120deg,' + BRAND.azulOscuro + ',' + BRAND.azul + ');background-color:' + BRAND.azul + ';padding:28px 32px;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td style="width:40px;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
      '<td width="36" height="36" style="background-color:' + BRAND.amarillo + ';border-radius:9px;text-align:center;vertical-align:middle;font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:16px;color:' + BRAND.azulOscuro + ';">B</td>' +
      '</tr></table></td>' +
      '<td style="padding-left:12px;">' +
      '<span style="font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:#ffffff;">Solicitudes Digital Colombia</span><br>' +
      '<span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:' + BRAND.azulPalido + ';">buk.co</span>' +
      '</td></tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding:28px 32px 0;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="background-color:' + pill.bg + ';border-radius:999px;padding:6px 14px;">' +
    '<span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:bold;color:' + pill.text + ';letter-spacing:0.3px;text-transform:uppercase;">' + pill.label + '</span>' +
    '</td></tr></table>' +
    '</td></tr>' +
    '<tr><td style="padding:18px 32px 8px;">' +
    '<p style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:bold;color:' + BRAND.azulOscuro + ';margin:0 0 12px;">' + opts.saludo + '</p>' +
    '<p style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#334;margin:0 0 20px;">' + opts.mensaje + '</p>' +
    '</td></tr>' +
    '<tr><td style="padding:0 32px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:' + BRAND.fondo + ';border-radius:12px;border:1px solid ' + BRAND.azulPalido + ';">' +
    '<tr><td style="padding:16px 18px;">' +
    (areaTagHtml ? '<div style="margin-bottom:10px;">' + areaTagHtml + '</div>' : '') +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + filasDetalle + '</table>' +
    '</td></tr></table>' +
    '</td></tr>' +
    botonHtml +
    '<tr><td style="padding:24px 32px 32px;">' +
    '<p style="font-family:Arial,Helvetica,sans-serif;font-size:12.5px;color:' + BRAND.azulClaro + ';line-height:1.6;margin:0;">¿Dudas sobre tu solicitud? Escríbenos por Google Chat a Santiago Chamorro.</p>' +
    '</td></tr>' +
  '</table>' +
  '<p style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#9fb1e0;margin-top:16px;">Buk Colombia · Sistema de Solicitudes Digital Colombia</p>' +
  '</td></tr></table></body></html>';
}


// ===== NOTIFICACIÓN A LOS ASIGNADOS =====
function notificarAsignados(tareaCreada, nombreTarea, areaDigital) {
  if (!tareaCreada || !tareaCreada.assignees) return;


  const urlTarea = tareaCreada.url || "";


  tareaCreada.assignees.forEach(function(asignado) {
    const correoAsignado = asignado.email;
    if (!correoAsignado) return;


    const asunto = "📋 Nueva solicitud asignada: " + nombreTarea;


    const htmlBody = construirEmailHtml({
      tipo: "asignacion",
      saludo: "Hola, " + escaparHtml(asignado.username) + "!",
      mensaje: "Se te asignó una nueva solicitud en el tablero de Digital Colombia.",
      area: areaDigital,
      detalles: [
        { label: "Tarea", valor: "<b>" + escaparHtml(nombreTarea) + "</b>" }
      ],
      botonUrl: urlTarea,
      botonTexto: "Ver tarea en ClickUp"
    });


    const cuerpoPlano =
      "Hola " + asignado.username + ",\n\n" +
      "Se te asignó una nueva solicitud en el tablero de Digital Colombia:\n\n" +
      "\"" + nombreTarea + "\"\n\n" +
      "Puedes verla aquí: " + urlTarea + "\n\n" +
      "Equipo Digital Colombia";


    MailApp.sendEmail(correoAsignado, asunto, cuerpoPlano, { htmlBody: htmlBody });
    Logger.log("Notificación de asignación enviada a: " + correoAsignado);
  });
}


// ===== CORREOS EXENTOS DE LA VALIDACIÓN DE FECHA =====
// Se configuran en Propiedades del script → CORREOS_EXENTOS, separados por coma
// (ej: "persona1@buk.co,persona2@buk.co"). Así no quedan publicados en el repo.
function obtenerCorreosExentos() {
  const valor = PropertiesService.getScriptProperties().getProperty("CORREOS_EXENTOS") || "";
  return valor.split(",")
    .map(function(c) { return c.trim().toLowerCase(); })
    .filter(function(c) { return c; });
}


function estaExentoDeMinimoDias(correo) {
  if (!correo) return false;
  return obtenerCorreosExentos().indexOf(correo.trim().toLowerCase()) !== -1;
}


// ===== FESTIVOS OFICIALES DE COLOMBIA (cualquier año) =====
// Se calculan en vez de listarse a mano, para que el script siga funcionando en 2027+.
// Reglas: Ley 51 de 1983 (Ley Emiliani) — algunos festivos se trasladan al lunes siguiente.
const cacheFestivos = {};

// Domingo de Pascua (algoritmo anónimo gregoriano). Devuelve [mes, día].
function calcularPascua(anio) {
  const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return [Math.floor((h + l - 7 * m + 114) / 31), ((h + l - 7 * m + 114) % 31) + 1];
}

function obtenerFestivosColombia(anio) {
  if (cacheFestivos[anio]) return cacheFestivos[anio];

  // Se usa UTC solo como "calendario" para sumar días sin problemas de zona horaria.
  function fecha(mes, dia) { return new Date(Date.UTC(anio, mes - 1, dia)); }
  function sumarDias(f, n) { return new Date(f.getTime() + n * 24 * 60 * 60 * 1000); }
  function aLunes(f) { return sumarDias(f, (8 - f.getUTCDay()) % 7); }
  function texto(f) { return f.toISOString().slice(0, 10); }

  const pascuaMD = calcularPascua(anio);
  const pascua = fecha(pascuaMD[0], pascuaMD[1]);

  const festivos = [
    // Fijos
    fecha(1, 1), fecha(5, 1), fecha(7, 20), fecha(8, 7), fecha(12, 8), fecha(12, 25),
    // Trasladables al lunes
    aLunes(fecha(1, 6)), aLunes(fecha(3, 19)), aLunes(fecha(6, 29)), aLunes(fecha(8, 15)),
    aLunes(fecha(10, 12)), aLunes(fecha(11, 1)), aLunes(fecha(11, 11)),
    // Dependientes de Pascua
    sumarDias(pascua, -3), sumarDias(pascua, -2),   // Jueves y Viernes Santo
    sumarDias(pascua, 43), sumarDias(pascua, 64), sumarDias(pascua, 71) // Ascensión, Corpus, Sagrado Corazón (lunes)
  ];

  cacheFestivos[anio] = festivos.map(texto);
  return cacheFestivos[anio];
}


function esFestivoOFinDeSemana(fecha) {
  const diaSemana = fecha.getDay();
  if (diaSemana === 0 || diaSemana === 6) return true;


  const fechaTexto = Utilities.formatDate(fecha, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return obtenerFestivosColombia(Number(fechaTexto.slice(0, 4))).indexOf(fechaTexto) !== -1;
}


function calcularFechaMinima(diasHabiles) {
  let fecha = new Date();
  let diasContados = 0;


  while (diasContados < diasHabiles) {
    fecha.setDate(fecha.getDate() + 1);
    if (!esFestivoOFinDeSemana(fecha)) {
      diasContados++;
    }
  }


  fecha.setDate(fecha.getDate() + 1);
  while (esFestivoOFinDeSemana(fecha)) {
    fecha.setDate(fecha.getDate() + 1);
  }


  fecha.setHours(0, 0, 0, 0);
  return fecha;
}


function obtenerSiguienteDiaHabil(fecha) {
  let siguiente = new Date(fecha);
  while (esFestivoOFinDeSemana(siguiente)) {
    siguiente.setDate(siguiente.getDate() + 1);
  }
  return siguiente;
}


// ===== VALIDACIÓN ÚNICA DE FECHA: envía SOLO uno de los dos correos posibles =====
function validarYNotificarSolicitante(fechaEntregaTexto, correoSolicitante, nombreTarea, tareaCreada, areaDigital) {
  if (!correoSolicitante) {
    Logger.log("⚠️ La respuesta no trae correo (¿el Form tiene activado \"Recopilar correos\"?). No se notifica al solicitante.");
    return;
  }
  if (!fechaEntregaTexto) {
    // Sin fecha, new Date("T12:00...") es inválida y Utilities.formatDate revienta.
    Logger.log("⚠️ La respuesta no trae fecha de entrega. Se omite la validación de fecha.");
    return;
  }

  const fechaSolicitada = new Date(fechaEntregaTexto + "T12:00:00-05:00");
  fechaSolicitada.setHours(0, 0, 0, 0);


  const fechaMinima = calcularFechaMinima(3);
  const exento = estaExentoDeMinimoDias(correoSolicitante);
  const cayoEnFestivoOFinde = esFestivoOFinDeSemana(fechaSolicitada) && !exento;
  const noCumpleMinimo = (fechaSolicitada < fechaMinima) && !exento;


  if (cayoEnFestivoOFinde || noCumpleMinimo) {
    const candidatoPorFestivo = cayoEnFestivoOFinde
      ? obtenerSiguienteDiaHabil(fechaSolicitada)
      : fechaSolicitada;
    const fechaSugerida = candidatoPorFestivo < fechaMinima ? fechaMinima : candidatoPorFestivo;


    let motivoTexto = "";
    if (cayoEnFestivoOFinde && noCumpleMinimo) {
      motivoTexto = "La fecha que elegiste cae en un día no hábil (fin de semana o festivo en Colombia) y además no cumple el mínimo de 3 días hábiles requeridos.";
    } else if (cayoEnFestivoOFinde) {
      motivoTexto = "La fecha que elegiste cae en un día no hábil (fin de semana o festivo en Colombia).";
    } else {
      motivoTexto = "La fecha de entrega no cumple con el mínimo de 3 días hábiles requeridos.";
    }


    const asunto = "⚠️ Tu solicitud requiere ajuste de fecha - " + nombreTarea;


    const htmlBody = construirEmailHtml({
      tipo: "ajuste",
      saludo: "¡Hola!",
      mensaje: "Recibimos tu solicitud \"" + escaparHtml(nombreTarea) + "\". " + motivoTexto + " Tu solicitud ya fue registrada, pero te contactaremos para ajustar el plazo o revisar la prioridad.",
      area: areaDigital,
      detalles: [
        { label: "Fecha solicitada", valor: Utilities.formatDate(fechaSolicitada, Session.getScriptTimeZone(), "dd/MM/yyyy") },
        { label: "Fecha sugerida", valor: "<b>" + Utilities.formatDate(fechaSugerida, Session.getScriptTimeZone(), "dd/MM/yyyy") + "</b>" }
      ],
      botonUrl: URL_PORTAL,
      botonTexto: "Ver en el Portal"
    });


    const cuerpoPlano =
      "Hola,\n\n" +
      "Recibimos tu solicitud \"" + nombreTarea + "\". " + motivoTexto + "\n\n" +
      "Fecha que solicitaste: " + Utilities.formatDate(fechaSolicitada, Session.getScriptTimeZone(), "dd/MM/yyyy") + "\n" +
      "Fecha sugerida disponible: " + Utilities.formatDate(fechaSugerida, Session.getScriptTimeZone(), "dd/MM/yyyy") + "\n\n" +
      "Tu solicitud ya fue registrada, pero te contactaremos para ajustar el plazo o revisar la prioridad.\n\n" +
      "Consulta el estado de tus solicitudes en el Portal: " + URL_PORTAL + "\n\n" +
      "Equipo Digital Colombia";


    MailApp.sendEmail(correoSolicitante, asunto, cuerpoPlano, { htmlBody: htmlBody });
    Logger.log("Correo de AJUSTE enviado a: " + correoSolicitante);


  } else {
    const asunto = "✅ Recibimos tu solicitud - " + nombreTarea;


    const htmlBody = construirEmailHtml({
      tipo: "confirmacion",
      saludo: "¡Hola!",
      mensaje: "Tu solicitud fue recibida correctamente y ya está siendo gestionada por el equipo Digital Colombia.",
      area: areaDigital,
      detalles: [
        { label: "Tarea", valor: "<b>" + escaparHtml(nombreTarea) + "</b>" },
        { label: "Fecha de entrega", valor: Utilities.formatDate(fechaSolicitada, Session.getScriptTimeZone(), "dd/MM/yyyy") }
      ],
      botonUrl: URL_PORTAL,
      botonTexto: "Ver en el Portal"
    });


    const cuerpoPlano =
      "Hola,\n\n" +
      "Tu solicitud \"" + nombreTarea + "\" fue recibida correctamente y ya está siendo gestionada por el equipo Digital Colombia.\n\n" +
      "Puedes hacer seguimiento aquí: " + URL_PORTAL + "\n\n" +
      "Si tienes dudas, escríbenos por Google Chat a Santiago Chamorro.\n\n" +
      "Equipo Digital Colombia";


    MailApp.sendEmail(correoSolicitante, asunto, cuerpoPlano, { htmlBody: htmlBody });
    Logger.log("Correo de CONFIRMACIÓN enviado a: " + correoSolicitante);
  }
}


// ================================================================
// ===== ALERTAS DE TAREAS VENCIDAS POR GOOGLE CHAT (Fase 6) =====
// ================================================================


const PROPIEDAD_WEBHOOK_GCHAT = "GCHAT_WEBHOOK_URL";


// Calcula el timestamp del inicio del día de hoy (00:00 Bogotá) — NO "ahora mismo".
// Así, una tarea que vence hoy a mediodía no se marca vencida hasta que empiece mañana.
function obtenerInicioDeHoy() {
  const zona = Session.getScriptTimeZone();
  const textoHoy = Utilities.formatDate(new Date(), zona, "yyyy-MM-dd");
  return new Date(textoHoy + "T00:00:00-05:00").getTime();
}


// Calcula el timestamp del inicio de mañana (00:00 Bogotá) — el límite superior del "hoy".
function obtenerInicioDeManana() {
  const inicioHoy = obtenerInicioDeHoy();
  return inicioHoy + 24 * 60 * 60 * 1000;
}


// ===== Función principal: revisa vencidas y "vence hoy", manda UN mensaje agrupado por persona =====
function revisarTareasVencidas() {
  const propiedades = PropertiesService.getScriptProperties();
  const webhookUrl = propiedades.getProperty(PROPIEDAD_WEBHOOK_GCHAT);


  if (!webhookUrl) {
    Logger.log("⚠️ Falta configurar la propiedad GCHAT_WEBHOOK_URL en Script Properties.");
    return;
  }


  const tareas = obtenerTodasLasTareasClickUp();
  const inicioDeHoy = obtenerInicioDeHoy();
  const inicioDeManana = obtenerInicioDeManana();


  const vencidasPorPersona = {};
  const venceHoyPorPersona = {};


  tareas.forEach(function (t) {
    const estado = (t.status && t.status.status ? t.status.status : "").toLowerCase();
    const tipoEstado = t.status && t.status.type ? t.status.type : "";
    // type "closed"/"done" cubre los estados finales aunque se renombren en ClickUp.
    const completada = tipoEstado === "closed" || tipoEstado === "done" ||
      estado.indexOf("entreg") !== -1 || estado.indexOf("cerr") !== -1;
    if (completada) return;
    if (!t.due_date) return;


    const due = Number(t.due_date);
    const esVencida = due < inicioDeHoy; // el día de entrega ya pasó por completo
    const esHoy = due >= inicioDeHoy && due < inicioDeManana; // el día de entrega es hoy, aún no vence


    if (!esVencida && !esHoy) return; // vence en el futuro, no hay nada que avisar


    const destino = esVencida ? vencidasPorPersona : venceHoyPorPersona;
    const asignados = t.assignees || [];
    if (asignados.length === 0) {
      agregarTareaVencida(destino, "Sin asignar", t);
    } else {
      asignados.forEach(function (a) {
        agregarTareaVencida(destino, a.username || a.email || "Sin nombre", t);
      });
    }
  });


  const hayVencidas = Object.keys(vencidasPorPersona).length > 0;
  const hayVenceHoy = Object.keys(venceHoyPorPersona).length > 0;


  if (!hayVencidas && !hayVenceHoy) {
    Logger.log("✅ No hay tareas vencidas ni por vencer hoy.");
    return;
  }


  const mensaje = construirMensajeVencidas(vencidasPorPersona, venceHoyPorPersona);
  enviarMensajeGChat(webhookUrl, mensaje);
}


function agregarTareaVencida(mapa, persona, tarea) {
  if (!mapa[persona]) mapa[persona] = [];
  mapa[persona].push(tarea);
}


function construirMensajeVencidas(vencidasPorPersona, venceHoyPorPersona) {
  let texto = "";


  if (Object.keys(vencidasPorPersona).length > 0) {
    texto += "⚠️ *Tareas vencidas — Digital Colombia*\n\n";
    Object.keys(vencidasPorPersona).sort().forEach(function (persona) {
      const tareasPersona = vencidasPorPersona[persona];
      texto += "*" + persona + "* (" + tareasPersona.length + ")\n";
      tareasPersona.forEach(function (t) {
        const fecha = Utilities.formatDate(new Date(Number(t.due_date)), Session.getScriptTimeZone(), "dd/MM/yyyy");
        const nombreConLink = t.url ? "<" + t.url + "|" + t.name + ">" : t.name;
        texto += "• " + nombreConLink + " — vencía el " + fecha + "\n";
      });
      texto += "\n";
    });
  }


  if (Object.keys(venceHoyPorPersona).length > 0) {
    texto += "🕒 *Vencen hoy — Digital Colombia*\n\n";
    Object.keys(venceHoyPorPersona).sort().forEach(function (persona) {
      const tareasPersona = venceHoyPorPersona[persona];
      texto += "*" + persona + "* (" + tareasPersona.length + ")\n";
      tareasPersona.forEach(function (t) {
        const nombreConLink = t.url ? "<" + t.url + "|" + t.name + ">" : t.name;
        texto += "• " + nombreConLink + "\n";
      });
      texto += "\n";
    });
  }


  texto += "Ver el detalle en el Dashboard.";
  return texto;
}


function enviarMensajeGChat(webhookUrl, texto) {
  const opciones = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ text: texto }),
    muteHttpExceptions: true
  };
  const respuesta = UrlFetchApp.fetch(webhookUrl, opciones);
  Logger.log("Respuesta de Google Chat: " + respuesta.getContentText());
}


// ===== Trae todas las tareas de la lista de ClickUp (abiertas y cerradas) =====
function obtenerTodasLasTareasClickUp() {
  let todas = [];
  let page = 0;
  let hayMas = true;


  while (hayMas) {
    const url = "https://api.clickup.com/api/v2/list/" + LIST_ID + "/task?page=" + page + "&include_closed=true";
    const opciones = {
      method: "get",
      headers: { Authorization: CLICKUP_TOKEN },
      muteHttpExceptions: true
    };
    const respuesta = UrlFetchApp.fetch(url, opciones);
    if (respuesta.getResponseCode() !== 200) {
      throw new Error("ClickUp respondió " + respuesta.getResponseCode() + " al listar tareas: " + respuesta.getContentText());
    }
    const datos = JSON.parse(respuesta.getContentText());
    const tareasPagina = datos.tasks || [];
    todas = todas.concat(tareasPagina);
    hayMas = tareasPagina.length > 0 && datos.last_page !== true;
    page++;
  }


  return todas;
}


// ===== El disparador diario se crea MANUALMENTE desde la interfaz de Apps Script =====
// (Triggers ⏰ en el menú lateral izquierdo → + Agregar Trigger → función: revisarTareasVencidas
// → Origen del evento: Basado en tiempo → Tipo: Temporizador diario → Hora: 8am-9am → Guardar)
