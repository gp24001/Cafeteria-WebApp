import { dinero, centavos, nombreMedioPago, totalesPorMedio } from "./importes.js";
import { esOrdenAnulada } from "./factura_dao.js";
import { limpiarEspecificaciones } from "./formato_caracteristicas.js";

/** Divide una línea para el ancho de un ticket de 80 mm, incluyendo identificadores largos. */
function envolver(texto, ancho = 34) {
    const lineas = [];
    let restante = String(texto ?? "").replace(/[\r\n]+/g, " ");
    while (restante.length > ancho) {
        const espacio = restante.lastIndexOf(" ", ancho);
        const corte = espacio > 0 ? espacio : ancho;
        lineas.push(restante.slice(0, corte));
        restante = restante.slice(corte).trimStart();
    }
    lineas.push(restante);
    return lineas;
}

/** Codifica texto en hexadecimal WinAnsi para evitar inyección de operadores PDF. */
function hexadecimal(texto) {
    return Array.from(String(texto), letra => {
        const codigo = letra.codePointAt(0);
        return (codigo >= 32 && codigo <= 255 ? codigo : 63).toString(16).padStart(2, "0");
    }).join("");
}

/** Construye un PDF válido con fuentes estándar, paginación y offsets calculados en bytes. */
function documentoPDF(lineas) {
    const objetos = ["", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>"];
    const paginas = [];
    for (let inicio = 0; inicio < lineas.length; inicio += 52) {
        const bloque = lineas.slice(inicio, inicio + 52);
        const alto = Math.max(220, 70 + bloque.length * 11);
        const paginaId = objetos.length + 1, contenidoId = paginaId + 1;
        paginas.push(paginaId);
        const comandos = [`BT /F2 15 Tf 1 0 0 1 82 ${alto - 27} Tm <436166656665> Tj ET`];
        bloque.forEach((linea, indice) => comandos.push(`BT /${linea.startsWith("TOTAL ") ? "F3" : "F1"} 9 Tf 1 0 0 1 18 ${alto - 50 - indice * 11} Tm <${hexadecimal(linea)}> Tj ET`));
        const contenido = comandos.join("\n") + "\n";
        objetos.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 226.77 ${alto}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contenidoId} 0 R >>`);
        objetos.push(`<< /Length ${contenido.length} >>\nstream\n${contenido}endstream`);
    }
    objetos[0] = "<< /Type /Catalog /Pages 2 0 R >>";
    objetos[1] = `<< /Type /Pages /Count ${paginas.length} /Kids [${paginas.map(id => `${id} 0 R`).join(" ")}] >>`;
    let salida = "%PDF-1.4\n";
    const offsets = [0];
    objetos.forEach((objeto, indice) => { offsets.push(salida.length); salida += `${indice + 1} 0 obj\n${objeto}\nendobj\n`; });
    const inicioXref = salida.length;
    salida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    salida += offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n \n").join("");
    salida += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`;
    return new Blob([new TextEncoder().encode(salida)], { type: "application/pdf" });
}

/** Genera el ticket pagado o la factura anulada confirmada*/
export function generarTicket({ factura, orden, lineas, historial, total, pagado, saldo, cajero, caja }) {
    const anulada = esOrdenAnulada(factura);
    if (!anulada && (saldo !== 0 || pagado !== total)) throw new Error("El ticket se genera al completar el pago de la factura.");
    const fecha = new Date(factura.fechaFacturacion);
    const formato = new Intl.DateTimeFormat("es-SV", { dateStyle: "short", timeStyle: "medium", timeZone: "America/El_Salvador" });
    const filas = [anulada ? "         FACTURA ANULADA" : "         TICKET DE COMPRA", ""];
    const agregar = texto => filas.push(...envolver(texto));
    agregar("Factura: " + factura.idFactura);
    agregar("Orden: #" + orden.idOrden.slice(0, 8));
    agregar("Fecha: " + (Number.isNaN(fecha.getTime()) ? "No disponible" : formato.format(fecha)));
    agregar("Cliente: " + (factura.cliente || "Cliente del establecimiento"));
    if (cajero) agregar("Atendió: " + cajero);
    if (caja) agregar("Caja: " + caja);
    if (anulada) {
        filas.push("----------------------------------", "MOTIVO DE ANULACIÓN");
        agregar(factura.observaciones.split("Anulación: Orden anulada: ").at(-1));
    }
    filas.push("----------------------------------", "PRODUCTO                   IMPORTE");
    for (const linea of lineas) {
        agregar(`${linea.nombre} x${linea.cantidad}`);
        const especificaciones = limpiarEspecificaciones(linea.presentacion, { omitirPorcionUnitaria: true });
        if (especificaciones) agregar(especificaciones);
        const precio = dinero(centavos(linea.precio)), importe = dinero(centavos(linea.precio) * linea.cantidad);
        filas.push(`${precio} c/u`.padEnd(Math.max(1, 34 - importe.length)) + importe, "");
    }
    filas.push("----------------------------------", "TOTAL USD".padEnd(34 - dinero(total).length) + dinero(total), "", anulada ? "SIN COBROS REGISTRADOS" : "FORMA DE PAGO");
    const agregarImporte = (etiqueta, monto) => {
        const importe = dinero(monto);
        filas.push(etiqueta.padEnd(34 - importe.length) + importe);
    };
    for (const detalle of totalesPorMedio(historial)) {
        if (detalle.vuelto && !anulada) {
            agregarImporte("Efectivo recibido", detalle.monto + detalle.vuelto);
            agregarImporte("Cambio", detalle.vuelto);
        } else agregarImporte(nombreMedioPago(detalle.tipoPago), detalle.monto);
    }
    filas.push("----------------------------------", anulada ? "       ORDEN CANCELADA" : "           PAGO COMPLETO");
    if (!anulada) filas.push("      Gracias por tu compra.");
    return documentoPDF(filas);
}

/** Descarga el Blob propio; libera la URL temporal después de iniciar la descarga. */
export function descargarTicket(datos) {
    const blob = generarTicket(datos);
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url; enlace.download = `Cafefe-factura-${esOrdenAnulada(datos.factura) ? "anulada-" : ""}${datos.factura.idFactura}.pdf`;
    document.body.appendChild(enlace); enlace.click(); enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
