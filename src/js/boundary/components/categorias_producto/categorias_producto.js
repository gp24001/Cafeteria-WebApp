import TipoProductoDao from "../../../control/tipo_producto_dao.js";
import TarjetaTipoProducto from "../tarjeta_tipo_producto/tarjeta_tipo_producto.js";
import "../busqueda_filtro/busqueda_filtro.js";
import ActualizacionAutomatica from "../../../control/actualizacion_automatica.js";
import { actualizarLista } from "../lista_dinamica/lista_dinamica.js";
import { notificar } from "../notificaciones_sistema/notificaciones_sistema.js";
import { cargarPlantilla } from "../plantilla/plantilla.js";

const plantilla = await cargarPlantilla(new URL("./categorias_producto.html", import.meta.url));

/** Consulta el catálogo y presenta una tarjeta por tipo de producto. */
export default class CategoriasProducto extends HTMLElement {
    /** Prepara el DAO, los registros y la sincronización de las categorías. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.tipoProductoDao = new TipoProductoDao();
        this.registros = [];
        this.actualizacion = new ActualizacionAutomatica(() => this.cargar(true), 30000);
    }

    /** Monta la plantilla local, conecta el filtro y consulta las categorías activas. */
    async connectedCallback() {
        this.root.replaceChildren(plantilla.content.cloneNode(true));
        customElements.upgrade(this.root);
        this.lista = this.root.querySelector(".categorias");
        this.estado = this.root.querySelector("[role=status]");
        this.busqueda = this.root.querySelector("busqueda-filtro");
        this.busqueda.addEventListener("busqueda-cambiada", () => this.mostrar());
        this.registros = [];
        this.actualizacion.iniciar();
        return this.cargar();
    }

    /** Aplica el filtro y actualiza solo las tarjetas de categoría que hayan cambiado. */
    mostrar() {
        const { lista, estado, busqueda } = this;
        actualizarLista(lista, this.registros.filter(categoria => busqueda.coincide(categoria.nombre)), categoria => categoria.idTipoProducto || categoria.nombre, () => {
            const tarjeta = new TarjetaTipoProducto();
            tarjeta.toggleAttribute("seleccionable", this.hasAttribute("seleccionable"));
            return tarjeta;
        }, (tarjeta, categoria) => {
            if (JSON.stringify(tarjeta.tipoProducto) !== JSON.stringify(categoria)) tarjeta.tipoProducto = categoria;
        });
        estado.textContent = lista.childElementCount ? "" : (busqueda.value.trim() ? "No se encontraron categorías." : "No hay categorías registradas.");
    }

    /**
     * Consulta las páginas de categorías y conserva el filtro durante su actualización.
     * Se descarta la consulta al salir de la vista, incluso entre páginas.
     * Los fallos persistentes se notifican una sola vez para evitar avisos en cada sondeo.
     * @param {boolean} silenciosa Evita representar de nuevo datos que no cambiaron.
     * @returns {Promise<boolean|undefined>} Indica si se representaron cambios o si se descartó la consulta.
     */
    async cargar(silenciosa = false) {
        const { lista, estado, busqueda } = this;
        const consulta = this.consulta = Symbol();
        try {
            const registros = [];
            let respuesta;
            do {
                respuesta = await this.tipoProductoDao.findRange(registros.length, 50);
                if (!lista.isConnected || consulta !== this.consulta) return;
                registros.push(...respuesta.datos);
            } while (respuesta.datos.length && registros.length < Number(respuesta.totalDatos));
            const activas = registros.filter(categoria => categoria.activo);
            if (silenciosa && JSON.stringify(activas) === JSON.stringify(this.registros) && !busqueda.disabled && !this.errorConexion) return false;
            this.errorConexion = false;
            this.ultimoError = "";
            this.registros = activas;
            busqueda.disabled = false;
            this.mostrar();
            return true;
        } catch (error) {
            if (consulta !== this.consulta) return;
            const mensaje = error.mensaje || error.message || "No se pudieron cargar las categorías.";
            this.errorConexion = true;
            if (!silenciosa) estado.textContent = "";
            if (this.ultimoError !== mensaje) notificar(this, mensaje, "error");
            this.ultimoError = mensaje;
        }
    }

    /** Detiene consultas al abandonar la pantalla. */
    disconnectedCallback() { this.actualizacion.detener(); this.consulta = null; }
}
customElements.define("tipo-producto-model", CategoriasProducto);
