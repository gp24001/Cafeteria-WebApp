import FacturaDao, { esOrdenAnulada } from "./factura_dao.js";
import FacturaOrdenProductoDao from "./factura_orden_producto_dao.js";
import PagoDao from "./pago_dao.js";
import PagoDetalleDao from "./pago_detalle_dao.js";
import CajaDao from "./caja_dao.js";
import RecepcionOrdenDao from "./recepcion_orden_dao.js";
import { leerPreparacion } from "./preparacion_estado.js";
import { centavos, observacionEfectivo } from "./importes.js";

/** Coordina facturas y abonos con los recursos REST originales, sin alterar el backend. */
export default class CobroDao {
    /** Inicializa DAO y almacenamiento de operaciones cuya respuesta puede perderse. */
    constructor(almacen = sessionStorage) {
        this.facturas = new FacturaDao();
        this.pagos = new PagoDao();
        this.cajas = new CajaDao();
        this.recepcion = new RecepcionOrdenDao();
        this.almacen = almacen;
        this.ocupado = false;
        this.detallesConfirmados = new Map();
    }

    /** Recupera la factura vigente vinculada realmente a las unidades de la orden. */
    async buscarFactura(orden) {
        const ids = new Set(orden.unidades.map(u => u.idOrdenProducto));
        const facturas = await this.facturas.listarTodos();
        const relacionadas = await Promise.all(facturas.map(async factura => {
            const unidades = await new FacturaOrdenProductoDao(factura.idFactura).listarTodos();
            return unidades.some(u => ids.has(u.idOrdenProducto?.idOrdenProducto)) ? { factura, unidades } : null;
        }));
        const vinculadas = relacionadas.filter(Boolean);
        const encontradas = vinculadas.filter(f => f.factura.estado !== "ANULADA");
        if (!encontradas.length && vinculadas.some(f => f.factura.estado === "ANULADA")) throw new Error("La orden está anulada. Actualiza la lista de pagos.");
        if (encontradas.length > 1) throw new Error("La orden tiene varias facturas vigentes. Revisa la facturación antes de cobrar.");
        return encontradas[0] || null;
    }

    /** Obtiene los abonos confirmados y sus medios, excluyendo registros no confirmados. */
    async historial(idFactura) {
        const pagos = (await this.pagos.listarTodos()).filter(p => p.estado === "CONFIRMADO" && p.idFactura?.idFactura === idFactura);
        const detalles = await Promise.all(pagos.map(async pago => {
            if (!this.detallesConfirmados.has(pago.idPago)) this.detallesConfirmados.set(pago.idPago,
                await new PagoDetalleDao(pago.idPago).listarTodos());
            return { pago, detalles: this.detallesConfirmados.get(pago.idPago) };
        }));
        return detalles;
    }

    /** Refresca saldos e historial sin volver a consultar productos, cajas ni vínculos de la factura. */
    async actualizar(orden, datos) {
        if (!datos?.factura) return this.cargar(orden);
        const factura = await this.facturas.findById(datos.factura.idFactura);
        if (factura.estado === "ANULADA") return { ...datos, factura };
        return { ...datos, ...await this.estado(factura) };
    }

    /** Obtiene la referencia de un abono local pendiente de verificación. */
    abonoPendiente(idFactura) {
        return this.almacen.getItem("cafefe.cobro." + idFactura);
    }

    /** Retira la referencia únicamente al aplicar la confirmación del abono correspondiente. */
    confirmarAbono(idFactura, referencia) {
        if (referencia && referencia === this.abonoPendiente(idFactura)) this.almacen.removeItem("cafefe.cobro." + idFactura);
    }

    /**
     * Consulta saldos autoritativos y recupera respuestas de cobros perdidas.
     * @param {object} factura Factura cuya identificación se consulta.
     * @returns {Promise<object>} Factura, totales en centavos, historial y estado del abono local.
     */
    async estado(factura) {
        const pendiente = this.abonoPendiente(factura.idFactura);
        const [totales, historial] = await Promise.all([this.facturas.totales(factura.idFactura), this.historial(factura.idFactura)]);
        const total = centavos(totales.total), pagado = centavos(totales.pagado), saldo = centavos(totales.saldo);
        const sumaAbonos = historial.reduce((suma, registro) => suma + registro.detalles.reduce((parcial, detalle) => parcial + centavos(detalle.monto), 0), 0);
        if (total - pagado !== saldo || sumaAbonos !== pagado) throw new Error("Los totales de la factura no coinciden con sus abonos. Actualiza antes de cobrar.");
        const vigente = this.abonoPendiente(factura.idFactura);
        const abonoConfirmado = pendiente && pendiente === vigente && historial.some(h => h.pago.observaciones === pendiente) ? pendiente : null;
        return { factura, total, pagado, saldo, historial, incierto: Boolean(vigente && !abonoConfirmado), abonoConfirmado };
    }

    /**
     * Carga precios facturados o prepara el cobro con la Caja Virtual activa.
     * @param {object} orden Orden con sus unidades persistidas.
     * @returns {Promise<object>} Datos de cobro y líneas; los importes monetarios del resumen están en centavos.
     */
    async cargar(orden) {
        const encontrada = await this.buscarFactura(orden);
        if (!encontrada) {
            const [cajas, lineas] = await Promise.all([this.cajas.listarTodos(), this.recepcion.detalle(orden)]);
            const virtual = cajas.find(c => c.activo && c.nombre?.trim().toLowerCase() === "caja virtual");
            const total = orden.unidades.reduce((suma, unidad) => suma + centavos(unidad.precio), 0);
            return { factura: null, cajas: virtual ? [virtual] : [], nombreCaja: virtual?.nombre || "",
                total, pagado: 0, saldo: total, historial: [], lineas };
        }
        const { factura, unidades } = encontrada;
        const porId = new Map(unidades.map(u => [u.idOrdenProducto?.idOrdenProducto, u]));
        if (orden.unidades.some(u => !porId.has(u.idOrdenProducto))) throw new Error("La factura no contiene toda la orden. Revisa el detalle antes de cobrar.");
        const snapshot = orden.unidades.map(u => ({ ...u, precio: porId.get(u.idOrdenProducto).precio,
            observaciones: porId.get(u.idOrdenProducto).observaciones || "" }));
        const [estado, lineas, cajas] = await Promise.all([
            this.estado(factura), this.recepcion.detalle({ ...orden, unidades: snapshot }), this.cajas.listarTodos()
        ]);
        return { ...estado, lineas, nombreCaja: cajas.find(c => c.idCaja === factura.idCaja?.idCaja)?.nombre || "" };
    }

    /** Emite una sola factura por orden y vuelve a buscarla si se perdió la respuesta. */
    async emitir(orden, idCaja, idEmpleadoRol) {
        if (this.ocupado) throw new Error("Espera a que termine la operación actual.");
        if (!idCaja || !idEmpleadoRol) throw new Error("Selecciona una caja y una sesión de cajero válida.");
        this.ocupado = true;
        try {
            return await this.asegurarFactura(orden, idCaja, idEmpleadoRol);
        } finally { this.ocupado = false; }
    }

    /** Reutiliza o registra la factura dentro de una operación de caja ya bloqueada. */
    async asegurarFactura(orden, idCaja, idEmpleadoRol) {
        if (!idCaja || !idEmpleadoRol) throw new Error("La Caja Virtual y la sesión de cajero deben estar disponibles.");
        if (!await this.buscarFactura(orden)) {
            const texto = leerPreparacion(orden.observacion).texto;
            const cliente = texto.replace(/^Cliente:\s*/, "").split(" · Pedido web ")[0].trim();
            try {
                await this.facturas.crear({ idOrden: orden.idOrden, idCaja, idEmpleadoRol,
                    cliente: cliente || "Cliente del establecimiento", observaciones: "Orden " + orden.idOrden });
            } catch (error) {
                if (!await this.buscarFactura(orden)) throw error;
            }
        }
        return this.cargar(orden);
    }

    /**
     * Anula mediante el recurso original, conservando motivo, orden e ítems.
     * @param {object} orden Orden sin pagos registrados ni inciertos.
     * @param {string} idEmpleadoRol Asignación del cajero que realiza la operación.
     * @param {string} motivo Explicación obligatoria de hasta 500 caracteres.
     * @returns {Promise<object>} Factura con la anulación confirmada por la API.
     */
    async anular(orden, idEmpleadoRol, motivo) {
        if (this.ocupado) throw new Error("Espera a que termine la operación actual.");
        motivo = motivo.trim();
        if (!motivo || motivo.length > 500) throw new Error("Escribe un motivo de anulación de hasta 500 caracteres.");
        this.ocupado = true;
        const razon = "Orden anulada: " + motivo;
        try {
            const datos = await this.cargar(orden);
            if (datos.pagado || datos.incierto) throw new Error("No se puede anular una orden con pagos registrados o sin confirmar.");
            const emitida = datos.factura ? datos : await this.asegurarFactura(orden, datos.cajas[0]?.idCaja, idEmpleadoRol);
            const actual = await this.estado(emitida.factura);
            if (actual.pagado || actual.incierto) throw new Error("No se puede anular una orden con pagos registrados o sin confirmar.");
            try { return await this.facturas.anular(emitida.factura.idFactura, razon); }
            catch (error) {
                // Si tampoco puede consultarse la confirmación, se conserva el error original de la anulación.
                const confirmada = await this.facturas.findById(emitida.factura.idFactura).catch(() => null);
                if (esOrdenAnulada(confirmada || {}) && confirmada.observaciones.includes("Anulación: " + razon)) return confirmada;
                throw error;
            }
        } finally { this.ocupado = false; }
    }

    /**
     * Registra un abono validado en centavos; una respuesta incierta nunca se reenvía automáticamente.
     * @param {object} factura Factura vigente cuyo saldo vuelve a consultar la API antes de cobrar.
     * @param {string|number} monto Importe decimal aplicado a la factura.
     * @param {string} tipoPago EFECTIVO o TARJETA.
     * @param {string} referencia Comprobante opcional del aporte.
     * @param {number} [recibido] Efectivo recibido en centavos cuando se devuelve vuelto.
     * @returns {Promise<object>} Estado confirmado o reconciliado con importes en centavos e historial completo.
     * @throws {Error|object} Validación, operación simultánea, saldo insuficiente o respuesta aún sin confirmar.
     */
    async abonar(factura, monto, tipoPago, referencia = "", recibido) {
        if (this.ocupado) throw new Error("Espera a que termine la operación actual.");
        const importe = centavos(monto);
        if (importe <= 0) throw new Error("El abono debe ser mayor que cero.");
        if (!["EFECTIVO", "TARJETA"].includes(tipoPago)) throw new Error("Selecciona efectivo o tarjeta.");
        if (recibido !== undefined && (tipoPago !== "EFECTIVO" || !Number.isSafeInteger(recibido) || recibido <= importe)) {
            throw new Error("El efectivo recibido debe superar el importe aplicado para dar vuelto.");
        }
        if (referencia.length > 200) throw new Error("La referencia no puede superar 200 caracteres.");
        this.ocupado = true;
        const clave = "cafefe.cobro." + factura.idFactura;
        try {
            const actual = await this.estado(factura);
            if (actual.incierto || actual.abonoConfirmado) throw new Error("Hay un abono sin confirmar en esta pantalla. Revisa los pagos antes de intentar otro cobro.");
            if (recibido !== undefined && importe !== actual.saldo) throw new Error("El saldo cambió. Revisa el vuelto antes de confirmar el pago.");
            if (importe > actual.saldo) throw new Error("El abono no puede superar el saldo pendiente.");
            const detalle = { monto: importe / 100, tipoPago };
            if (referencia.trim()) detalle.referenciaExterna = referencia.trim();
            if (recibido !== undefined) detalle.observaciones = observacionEfectivo(recibido);
            const marca = "Abono web " + crypto.randomUUID();
            this.almacen.setItem(clave, marca);
            try {
                await this.pagos.crear({ idFactura: factura.idFactura, observaciones: marca, detalles: [detalle] });
            } catch (error) {
                if (error.error?.status >= 400 && error.error.status < 500) {
                    this.almacen.removeItem(clave);
                    throw error;
                }
            }
            const confirmado = await this.estado(factura);
            if (confirmado.abonoConfirmado !== marca) throw new Error("No se confirmó el abono. Se reintentará la consulta automáticamente.");
            this.confirmarAbono(factura.idFactura, marca);
            return confirmado;
        } finally { this.ocupado = false; }
    }
}
