import CobroDao from "../../../control/cobro_dao.js";
import { dinero, centavos, nombreMedioPago, totalesPorMedio } from "../../../control/importes.js";
import { descargarTicket } from "../../../control/ticket_pdf.js";
import { actualizarLista, actualizarTexto } from "../lista_dinamica/lista_dinamica.js";
import { notificar } from "../notificaciones_sistema/notificaciones_sistema.js";

import { cargarPlantilla } from "../plantilla/plantilla.js";

const plantilla = await cargarPlantilla(new URL("./cobro_factura.html", import.meta.url));

/** Formulario reutilizable de factura y abonos; mantiene los importes del servidor como referencia. */
export default class CobroFactura extends HTMLElement {
    /** Prepara controles, DAO y eventos de cobro sin registrar operaciones al construir. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(plantilla.content.cloneNode(true));
        this.dao = new CobroDao();
        this.descargar = descargarTicket;
        this.advertenciaMonto = "";
        this.form = this.root.querySelector("form");
        this.root.querySelector("#monto").oninput = () => this.validarAporte();
        this.root.querySelector(".anular").onclick = () => {
            this.root.querySelector("#motivo").value = "";
            this.root.querySelector("dialog").showModal();
        };
        this.root.querySelector(".volver").onclick = () => this.root.querySelector("dialog").close();
        this.root.querySelector(".form-anulacion").onsubmit = evento => { evento.preventDefault(); this.anular(); };
        this.root.querySelector("dialog").addEventListener("cancel", evento => { if (this.ocupado) evento.preventDefault(); });
        this.form.onsubmit = evento => { evento.preventDefault(); this.abonar(); };
        this.form.onchange = evento => { if (evento.target.name === "medio") this.actualizarMedio(); };
        this.root.querySelector(".ticket").onclick = () => this.ticket();
    }

    /** Obtiene el medio seleccionado sin leer ni almacenar datos bancarios. */
    get medio() { return this.root.querySelector('input[name="medio"]:checked').value; }

    /** Explicita el método que se registrará y muestra la referencia solo para tarjeta. */
    actualizarMedio() {
        const tarjeta = this.medio === "TARJETA";
        this.root.querySelector(".referencia").hidden = !tarjeta;
        actualizarTexto(this.root.querySelector('label[for="monto"]'), tarjeta ? "Importe del abono (USD)" : "Efectivo recibido (USD)");
        actualizarTexto(this.root.querySelector("#ayuda-monto span"), tarjeta
            ? "Registra el importe a aplicar, hasta el saldo pendiente. Puedes combinar abonos." : "Puedes combinar abonos.");
        this.root.querySelector(".abonar").textContent = this.datos?.total === 0 ? "Completar pago"
            : (tarjeta ? "Registrar aporte con tarjeta" : "Registrar aporte en efectivo");
        this.validarAporte();
    }

    /** Invalida respuestas antiguas al cambiar de orden o retirar el Web Component. */
    disconnectedCallback() { this.consulta = null; }

    /**
     * Selecciona una orden y consulta su factura sin emitirla automáticamente.
     * @param {object} orden Orden seleccionada con sus unidades persistidas.
     * @param {string} responsable ID de la asignación activa del cajero.
     * @param {string} cajero Nombre que se incluirá en el comprobante.
     */
    async abrir(orden, responsable, cajero) {
        this.consulta = null;
        this.consultando = false;
        this.orden = orden;
        this.responsable = responsable;
        this.cajero = cajero;
        this.datos = null;
        this.ticketAutomatico = null;
        this.anulada = false;
        this.root.querySelector("#monto").value = "";
        this.root.querySelector("#referencia").value = "";
        this.root.querySelector('input[value="EFECTIVO"]').checked = true;
        this.actualizarMedio();
        this.root.querySelector(".factura").hidden = true;
        return this.recargar();
    }

    /** Bloquea envíos dobles y comunica a la bandeja que no cambie de orden durante una escritura. */
    bloquear(valor) {
        this.ocupado = valor;
        this.root.querySelector("section").setAttribute("aria-busy", String(valor));
        this.root.querySelectorAll("button,input,select,textarea").forEach(n => { n.disabled = valor; });
        this.dispatchEvent(new CustomEvent("cobro-ocupado", { detail: { ocupado: valor }, bubbles: true, composed: true }));
    }

    /**
     * Consulta factura, historial y saldo; conserva el formulario si falla la conexión.
     * @param {boolean} silenciosa Actualiza únicamente cambios visibles, sin bloquear controles.
     * @returns {Promise<boolean|undefined>} Indica si se actualizó la vista o se omitió la consulta.
     */
    async recargar(silenciosa = false) {
        if (this.ocupado || this.consultando || this.anulada || (silenciosa && this.root.querySelector("dialog").open)) return;
        this.consultando = true;
        const consulta = this.consulta = Symbol();
        if (!silenciosa) this.bloquear(true);
        try {
            const datos = silenciosa ? await this.dao.actualizar(this.orden, this.datos) : await this.dao.cargar(this.orden);
            if (consulta !== this.consulta || (silenciosa && this.ocupado)) return;
            const visible = valor => [valor?.factura?.idFactura, valor?.factura?.estado, valor?.total, valor?.pagado, valor?.saldo,
                valor?.incierto, valor?.historial, valor?.lineas, valor?.nombreCaja, valor?.cajas];
            const cambio = JSON.stringify(visible(datos)) !== JSON.stringify(visible(this.datos));
            const abonoSinConfirmar = datos.incierto && !this.datos?.incierto;
            this.datos = datos;
            if (datos.factura?.estado === "ANULADA") {
                this.root.querySelector(".factura").hidden = true;
                if (cambio) notificar(this, "La factura fue anulada en otra pantalla.", "aviso");
                return cambio;
            }
            if (silenciosa && !cambio && !datos.abonoConfirmado && !this.errorConsulta) return false;
            this.errorConsulta = false;
            if (abonoSinConfirmar) notificar(this, "Hay un abono sin confirmar. Revisa los pagos antes de volver a cobrar.", "aviso");
            if (datos.abonoConfirmado) {
                this.dao.confirmarAbono(datos.factura.idFactura, datos.abonoConfirmado);
                this.confirmarAbono();
            } else this.mostrar();
            return true;
        } catch (error) {
            if (consulta === this.consulta) {
                const mensaje = (error.mensaje || error.message) + " Se reintentará automáticamente.";
                if (this.errorConsulta !== mensaje) notificar(this, mensaje, "error");
                this.errorConsulta = mensaje;
            }
        } finally {
            // Una respuesta de la orden anterior no debe liberar la consulta de la orden actual.
            if (consulta === this.consulta) {
                this.consultando = false;
                if (!silenciosa) this.bloquear(false);
                this.disponibilidad();
            }
        }
    }

    /** Representa cajas, totales e historial usando exclusivamente texto de la API. */
    mostrar() {
        const datos = this.datos;
        this.root.querySelector(".factura").hidden = false;
        this.root.querySelector(".caja").textContent = "Caja: " + (datos.nombreCaja || datos.cajas?.[0]?.nombre || "Caja Virtual no disponible");
        const cajaNoDisponible = !datos.factura && !datos.cajas?.length;
        if (cajaNoDisponible && !this.cajaNoDisponible) notificar(this, "La Caja Virtual no está disponible o está inactiva.", "aviso");
        this.cajaNoDisponible = cajaNoDisponible;
        this.root.querySelector(".numero").hidden = !datos.factura;
        this.root.querySelector(".numero").textContent = datos.factura ? "Factura: " + datos.factura.idFactura.slice(0, 8) : "";
        for (const nombre of ["total", "pagado", "saldo"]) actualizarTexto(this.root.querySelector("." + nombre), dinero(datos[nombre]));
        if (this.anulada) this.root.querySelector(".saldo").textContent = "No aplica";
        const lista = this.root.querySelector(".historial"), medios = totalesPorMedio(datos.historial);
        actualizarLista(lista, medios.length ? medios : [null], detalle => detalle?.tipoPago,
            () => document.createElement("li"), (item, detalle) => actualizarTexto(item, detalle
                ? `${nombreMedioPago(detalle.tipoPago)} · ${dinero(detalle.monto)}` : "Aún no hay abonos registrados."));
        this.form.hidden = this.anulada || Boolean(datos.factura && datos.saldo === 0) || datos.incierto;
        this.actualizarMedio();
        this.root.querySelector("#monto").required = datos.total !== 0;
        this.root.querySelector(".ticket").hidden = !this.anulada && (!datos.factura || datos.saldo !== 0);
        this.root.querySelector(".ticket").textContent = this.anulada ? "Descargar factura anulada PDF" : "Descargar ticket PDF";
        this.root.querySelector(".anular").hidden = this.anulada || datos.pagado > 0 || datos.incierto || Boolean(datos.factura && datos.saldo === 0);
        this.root.querySelector(".ayuda-anulacion").hidden = datos.pagado === 0;
        this.dispatchEvent(new CustomEvent("factura-consultada", { detail: datos, bubbles: true, composed: true }));
    }

    /** Mantiene bloqueado el cobro si no hay caja, saldo o confirmación de una operación anterior. */
    disponibilidad() {
        this.root.querySelector(".abonar").disabled = this.ocupado || !this.datos || (!this.datos.factura && !this.datos.cajas?.length)
            || this.datos.factura?.estado === "ANULADA" || Boolean(this.datos.factura && this.datos.saldo <= 0) || this.datos.incierto;
    }

    /**
     * Marca el importe inválido y notifica al cambiar la advertencia o intentar enviarlo.
     * @param {boolean} completo Valida también formato y cero al intentar enviar el aporte.
     * @returns {boolean} Verdadero si no hay una advertencia que impida el envío.
     */
    validarAporte(completo = false) {
        const entrada = this.root.querySelector("#monto");
        let mensaje = "";
        let vuelto = 0;
        if (this.datos && !this.anulada && this.datos.total !== 0) {
            try {
                const importe = centavos(entrada.value);
                if (importe > this.datos.saldo) {
                    if (this.medio === "EFECTIVO" && this.datos.saldo > 0) vuelto = importe - this.datos.saldo;
                    else mensaje = "El aporte no puede superar el saldo pendiente de " + dinero(this.datos.saldo) + ".";
                } else if (completo && importe <= 0) mensaje = "El aporte debe ser mayor que cero.";
            } catch { if (completo) mensaje = "Ingresa un importe válido con hasta dos decimales."; }
        }
        const salida = this.root.querySelector("#vuelto");
        salida.hidden = vuelto === 0;
        actualizarTexto(salida, vuelto ? "Vuelto: " + dinero(vuelto) : "");
        this.root.querySelector("#ayuda-monto span").hidden = vuelto > 0;
        const anterior = this.advertenciaMonto;
        this.advertenciaMonto = mensaje;
        entrada.setAttribute("aria-invalid", String(Boolean(mensaje)));
        if (mensaje && (mensaje !== anterior || completo)) notificar(this, mensaje, "aviso");
        return !mensaje;
    }

    /** Registra un abono sin exceder el saldo; exige revisar el importe antes de enviarlo. */
    async abonar() {
        if (this.ocupado || this.anulada || !this.datos || this.datos.incierto || this.datos.factura?.estado === "ANULADA"
            || (!this.datos.factura && !this.datos.cajas?.length)) return;
        if (!this.validarAporte(true)) {
            this.root.querySelector("#monto").focus();
            return;
        }
        if (!this.form.checkValidity()) { notificar(this, "Revisa los datos del pago antes de continuar.", "aviso"); return; }
        try {
            const monto = this.root.querySelector("#monto").value;
            const medio = this.medio;
            const referencia = medio === "TARJETA" ? this.root.querySelector("#referencia").value : "";
            const saldo = this.datos.saldo;
            const recibido = medio === "EFECTIVO" && saldo > 0 ? centavos(monto) : 0;
            await this.operar(async () => {
                if (!this.datos.factura) this.datos = await this.dao.emitir(this.orden, this.datos.cajas[0].idCaja, this.responsable);
                if (this.datos.total === 0) return this.datos;
                if (recibido > saldo) return this.dao.abonar(this.datos.factura, saldo / 100, medio, "", recibido);
                return this.dao.abonar(this.datos.factura, monto, medio, referencia);
            });
        } catch (error) { notificar(this, error.mensaje || error.message, "error"); }
    }

    /** Exige confirmar un motivo y retira la orden solo después de la anulación persistida. */
    async anular() {
        if (this.ocupado) return;
        const motivo = this.root.querySelector("#motivo");
        if (!motivo.value.trim() || !this.root.querySelector(".form-anulacion").checkValidity()) {
            notificar(this, "Escribe un motivo de anulación de hasta 500 caracteres.", "aviso");
            motivo.focus();
            return;
        }
        this.bloquear(true);
        try {
            const factura = await this.dao.anular(this.orden, this.responsable, this.root.querySelector("#motivo").value);
            this.datos = { ...this.datos, factura };
            this.anulada = true;
            this.root.querySelector("dialog").close();
            this.mostrar();
            notificar(this, "Orden anulada. El motivo quedó registrado en el historial.", "exito");
            this.dispatchEvent(new CustomEvent("orden-anulada", { detail: { idOrden: this.orden.idOrden }, bubbles: true, composed: true }));
            this.ticket();
        } catch (error) { notificar(this, error.mensaje || error.message, "error"); }
        finally { this.bloquear(false); this.disponibilidad(); }
    }

    /**
     * Ejecuta una escritura bloqueando envíos dobles y genera el PDF con saldo cero.
     * @param {Function} accion Operación asíncrona que devuelve el estado confirmado del cobro.
     */
    async operar(accion) {
        const orden = this.orden;
        this.bloquear(true);
        try {
            const resultado = await accion();
            this.datos = { ...this.datos, ...resultado };
            if (this.orden !== orden || !this.isConnected) return;
            this.confirmarAbono();
        } catch (error) {
            if (!this.isConnected || this.orden !== orden) return;
            if (this.datos.factura && this.dao.abonoPendiente(this.datos.factura.idFactura)) {
                this.datos = { ...this.datos, incierto: true };
                this.mostrar();
                notificar(this, "El abono está pendiente de confirmación. Se verificará automáticamente.", "aviso");
            } else notificar(this, error.mensaje || error.message, "error");
        } finally { if (this.isConnected) { this.bloquear(false); this.disponibilidad(); } }
    }

    /** Confirma el abono local y solicita el PDF una vez al verificar el saldo en cero. */
    confirmarAbono() {
        this.root.querySelector("#monto").value = "";
        this.root.querySelector("#referencia").value = "";
        this.root.querySelector('input[value="EFECTIVO"]').checked = true;
        this.mostrar();
        const completado = this.datos.saldo === 0;
        notificar(this, completado ? "Pago completado correctamente." : "Abono registrado correctamente.", "exito");
        if (!completado) return;
        const idFactura = this.datos.factura.idFactura;
        let pdfGenerado = false;
        if (this.ticketAutomatico !== idFactura) {
            this.ticketAutomatico = idFactura;
            pdfGenerado = this.ticket();
        }
        this.dispatchEvent(new CustomEvent("factura-pagada", {
            detail: { idOrden: this.orden.idOrden, pdfGenerado }, bubbles: true, composed: true
        }));
    }

    /** Descarga el comprobante pagado o anulado sin repetir cobros ni anulaciones. */
    ticket() {
        try {
            this.descargar({ ...this.datos, orden: this.orden, cajero: this.cajero,
                caja: this.datos.nombreCaja || this.datos.factura.idCaja?.idCaja, lineas: this.datos.lineas || [] });
            if (!this.anulada && this.datos.saldo === 0) this.dispatchEvent(new CustomEvent("ticket-pago-generado", {
                detail: { idOrden: this.orden.idOrden }, bubbles: true, composed: true
            }));
            return true;
        } catch (error) { notificar(this, "La operación está registrada. No se pudo generar el PDF: " + error.message, "error"); return false; }
    }
}
customElements.define("cobro-factura", CobroFactura);
