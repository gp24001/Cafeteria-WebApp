/** Convierte un importe decimal en centavos enteros sin aceptar redondeos ni exponentes. */
export function centavos(valor) {
    const texto = String(valor ?? "").trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,2})?$/.test(texto)) throw new Error("Introduce un importe válido con hasta dos decimales.");
    const [entero, decimal = ""] = texto.split(".");
    const resultado = Number(entero) * 100 + Number(decimal.padEnd(2, "0"));
    if (!Number.isSafeInteger(resultado)) throw new Error("El importe es demasiado grande.");
    return resultado;
}

/** Representa centavos en dólares con el formato del establecimiento. */
export function dinero(valor) {
    return new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(valor / 100);
}

/** Presenta los medios conocidos y conserva el nombre de otros medios registrados en caja. */
export function nombreMedioPago(tipoPago) {
    if (tipoPago === "EFECTIVO") return "Efectivo";
    if (tipoPago === "TARJETA") return "Tarjeta";
    return tipoPago;
}

/** Suma los abonos por medio en centavos sin modificar el historial original. */
export function totalesPorMedio(historial) {
    const totales = new Map();
    for (const registro of historial) for (const detalle of registro.detalles) {
        const nombre = detalle.tipoPago?.trim() || "Medio sin especificar";
        const codigo = nombre.toUpperCase();
        const tipoPago = codigo === "EFECTIVO" || codigo === "TARJETA" ? codigo : nombre;
        totales.set(tipoPago, (totales.get(tipoPago) || 0) + centavos(detalle.monto));
    }
    return Array.from(totales, ([tipoPago, monto]) => ({ tipoPago, monto }));
}
