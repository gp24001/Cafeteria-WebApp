import ProductoDao from "../../../control/producto_dao.js";
import TarjetaProducto from "../tarjeta_producto/tarjeta_producto.js";
import { agruparPresentaciones } from "../../../control/presentaciones_producto.js";
import ActualizacionAutomatica from "../../../control/actualizacion_automatica.js";
import BusquedaCatalogo from "../../../control/busqueda_catalogo.js";
import { actualizarLista } from "../lista_dinamica/lista_dinamica.js";
import { notificar } from "../notificaciones_sistema/notificaciones_sistema.js";
import { cargarPlantilla } from "../plantilla/plantilla.js";

const plantilla = await cargarPlantilla(new URL("./buscador_productos.html", import.meta.url));

/** Busca en el catálogo mediante un Worker propio, sin consultar la API por cada pulsación. */
export default class BuscadorProductos extends HTMLElement {
    /** Crea el buscador, sus tarjetas y la consulta automática del catálogo. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.catalogo = new ProductoDao();
        this.buscador = new BusquedaCatalogo();
        this.productos = [];
        this.root.appendChild(plantilla.content.cloneNode(true));
        this.entrada = this.root.querySelector("input");
        this.estado = this.root.querySelector("[role=status]");
        this.lista = this.root.querySelector(".categorias");
        this.explorar = this.root.querySelector(".explorar-categorias");
        this.entrada.oninput = () => this.mostrar();
        this.actualizacion = new ActualizacionAutomatica(() => this.cargar(true), 30000);
    }

    /** Inicializa la vista cuando el Web Component se incorpora al documento. */
    connectedCallback() { this.actualizacion.iniciar(); return this.cargar(); }
    /** Libera los eventos o invalida consultas pendientes al retirar el componente. */
    disconnectedCallback() {
        this.actualizacion.detener();
        this.consulta = null;
        this.consultaBusqueda = null;
        this.buscador.detener();
        this.dialogoBusqueda?.removeEventListener("close", this.alCerrarDetalle);
        this.dialogoBusqueda = null;
    }

    /**
     * Carga productos y presentaciones, descartando respuestas de una vista anterior.
     * Conserva los estados de búsqueda y evita notificar repetidamente un mismo fallo automático.
     * @param {boolean} silenciosa Conserva el contenido y los controles durante la consulta.
     * @returns {Promise<boolean|undefined>} Indica si se representaron cambios o si se descartó la consulta.
     */
    async cargar(silenciosa = false) {
        if (silenciosa && Array.from(this.lista.children).some(t => t.dialogo?.open)) return;
        const consulta = this.consulta = Symbol();
        if (!silenciosa) { this.entrada.disabled = true; this.lista.replaceChildren(); this.estado.textContent = "Cargando productos…"; }
        try {
            const productos = await agruparPresentaciones(await this.catalogo.listarTodos());
            if (this.consulta !== consulta) return;
            if (silenciosa && Array.from(this.lista.children).some(t => t.dialogo?.open)) return;
            const activos = productos.filter(producto => producto.activo);
            if (silenciosa && JSON.stringify(activos) === JSON.stringify(this.productos) && !this.entrada.disabled && !this.errorConexion) return false;
            this.errorConexion = false;
            this.ultimoError = "";
            this.productos = activos;
            this.buscador.establecerProductos(activos);
            this.entrada.disabled = false;
            await this.mostrar();
            if (this.consulta !== consulta) return;
            return true;
        } catch (error) {
            if (this.consulta !== consulta) return;
            const mensaje = error.mensaje || error.message || "No se pudieron cargar los productos.";
            this.errorConexion = true;
            if (!silenciosa) this.estado.textContent = "";
            if (this.ultimoError !== mensaje) notificar(this, mensaje, "error");
            this.ultimoError = mensaje;
        }
    }

    /** Presenta solo la última búsqueda resuelta sin insertar datos del usuario como HTML. */
    async mostrar() {
        const consulta = this.consultaBusqueda = Symbol();
        const texto = this.entrada.value;
        const buscar = Boolean(texto.trim());
        this.explorar.hidden = buscar;
        this.lista.hidden = !buscar;
        if (!buscar) {
            this.estado.textContent = "";
            return;
        }
        const productos = this.productos;
        const indices = await this.buscador.buscar(texto);
        if (this.consultaBusqueda !== consulta || productos !== this.productos) return;
        const dialogo = Array.from(this.lista.children).find(t => t.dialogo?.open)?.dialogo;
        if (dialogo) { this.esperarDetalle(dialogo); return; }
        const coincidencias = indices.map(indice => productos[indice]).filter(Boolean);
        actualizarLista(this.lista, coincidencias, producto => producto.idProducto || producto.nombre, () => {
            const tarjeta = new TarjetaProducto();
            tarjeta.toggleAttribute("seleccionable", this.hasAttribute("seleccionable"));
            return tarjeta;
        }, (tarjeta, producto) => {
            if (JSON.stringify(tarjeta.producto) !== JSON.stringify(producto)) tarjeta.producto = producto;
        });
        this.estado.textContent = coincidencias.length
            ? `${coincidencias.length} ${coincidencias.length === 1 ? "producto disponible" : "productos disponibles"}`
            : "No encontramos coincidencias. Prueba con otro nombre.";
    }

    /** Pospone un resultado de búsqueda si el usuario alcanzó a abrir un producto anterior. */
    esperarDetalle(dialogo) {
        if (this.dialogoBusqueda === dialogo) return;
        this.dialogoBusqueda = dialogo;
        this.alCerrarDetalle = () => {
            this.dialogoBusqueda = null;
            if (this.isConnected) this.mostrar();
        };
        dialogo.addEventListener("close", this.alCerrarDetalle, { once: true });
    }
}
customElements.define("buscador-productos", BuscadorProductos);
