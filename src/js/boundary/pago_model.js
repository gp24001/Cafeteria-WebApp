import OrdenModel from "./orden_model.js";
import "./components/cobro_factura/cobro_factura.js";

const moneda = new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" });

/** Reutiliza la bandeja y el resumen para recibir en caja las órdenes despachadas. */
export default class PagoModel extends OrdenModel {
    /** Adapta la bandeja de preparación al cobro y enlaza sus eventos de factura y ticket. */
    constructor() {
        super();
        this.facturacion = true;
        this.root.querySelector("section").setAttribute("aria-label", "Órdenes para facturar");
        this.lista.setAttribute("aria-label", "Órdenes pendientes de pago");
        this.root.querySelector("#titulo-cola").textContent = "Órdenes pendientes de pago";
        this.root.querySelector(".resumen-lectura summary").textContent = "Ver detalle de la orden";
        this.resumen.setAttribute("sin-total", "");
        this.resumen.addEventListener("orden-actualizada", () => this.mostrarTotal());
        this.cobro = document.createElement("cobro-factura");
        this.cobro.hidden = true;
        this.root.querySelector(".detalle-orden").appendChild(this.cobro);
        this.cobro.addEventListener("cobro-ocupado", evento => this.bloquear(evento.detail.ocupado));
        this.cobro.addEventListener("factura-consultada", evento => {
            if (evento.detail.lineas && JSON.stringify(evento.detail.lineas) !== JSON.stringify(this.lineas)) {
                this.resumen.estado.lineas = evento.detail.lineas;
                this.lineas = evento.detail.lineas;
            }
        });
        this.cobro.addEventListener("factura-pagada", evento => {
            this.ordenes = (this.ordenes || []).filter(o => o.idOrden !== evento.detail.idOrden);
            if (evento.detail.pdfGenerado) this.limpiarDetalle();
            this.representarOrdenes(this.ordenes);
        });
        this.cobro.addEventListener("ticket-pago-generado", evento => {
            if (this.seleccionada?.idOrden === evento.detail.idOrden) {
                this.limpiarDetalle();
                this.representarOrdenes(this.ordenes || []);
            }
        });
        this.cobro.addEventListener("orden-anulada", evento => {
            const id = evento.detail.idOrden;
            this.ordenes = (this.ordenes || []).filter(o => o.idOrden !== id);
            this.representarOrdenes(this.ordenes);
        });
    }

    /** Oculta el cobro finalizado y restaura el panel para elegir otra orden. */
    limpiarDetalle() {
        super.limpiarDetalle();
        this.root.querySelector(".total-pago").hidden = true;
        if (this.cobro) this.cobro.hidden = true;
    }

    /** Conserva el total visible fuera del detalle plegable y reutiliza el cálculo del resumen. */
    mostrarTotal() {
        const total = this.root.querySelector(".total-pago");
        const importe = moneda.format(this.resumen.total);
        if (total.querySelector("strong").textContent !== importe) total.querySelector("strong").textContent = importe;
        total.hidden = !this.seleccionada;
    }

    /** Muestra el total al completar el detalle sin desplegar los productos automáticamente. */
    mostrarPreparacion(orden, lineas) {
        super.mostrarPreparacion(orden, lineas);
        this.mostrarTotal();
    }

    /** Oculta el cobro anterior incluso si la sesión ya no puede consultar la bandeja. */
    async cargar() {
        if (this.guardando) return;
        if (this.cobro) this.cobro.hidden = true;
        return super.cargar();
    }

    /** Reutiliza el detalle de la orden y carga su factura solo para una sesión de cajero válida. */
    async seleccionar(orden) {
        if (this.guardando) return;
        this.cobro.hidden = true;
        this.root.querySelector(".total-pago").hidden = true;
        await super.seleccionar(orden);
        if (this.seleccionada !== orden || this.resumen.hidden || !this.isConnected || !this.responsable) return;
        this.cobro.hidden = false;
        const empleado = this.sesion.actual.empleado;
        await this.cobro.abrir(orden, this.responsable, `${empleado.nombre} ${empleado.apellido || ""}`.trim());
    }
}
customElements.define("facturacion-model", PagoModel);
