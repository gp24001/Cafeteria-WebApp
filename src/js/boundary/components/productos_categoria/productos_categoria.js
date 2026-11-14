import TipoProductoDao from "../../../control/tipo_producto_dao.js";
import TarjetaProducto from "../tarjeta_producto/tarjeta_producto.js";
import { ilustracionCategoria } from "../tarjeta_tipo_producto/tarjeta_tipo_producto.js";
import ProductoDao from "../../../control/producto_dao.js";
import { agruparPresentaciones } from "../../../control/presentaciones_producto.js";
import ActualizacionAutomatica from "../../../control/actualizacion_automatica.js";
import { actualizarLista } from "../lista_dinamica/lista_dinamica.js";
import { notificar } from "../notificaciones_sistema/notificaciones_sistema.js";
import { cargarPlantilla } from "../plantilla/plantilla.js";
import "../busqueda_filtro/busqueda_filtro.js";

const plantilla = await cargarPlantilla(new URL("./productos_categoria.html", import.meta.url));

/** Vista de detalle de una categoría, accesible también desde su URL. */
export default class ProductosCategoria extends HTMLElement {
    /** Crea la vista de categoría, conecta su búsqueda y prepara las consultas de productos. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(plantilla.content.cloneNode(true));
        customElements.upgrade(this.root);
        this.catalogo = new ProductoDao();
        this.categorias = new TipoProductoDao();
        this.root.querySelector(".volver").onclick = () => { location.hash = this.seccion || "productos"; };
        this.busqueda = this.root.querySelector("busqueda-filtro");
        this.busqueda.addEventListener("busqueda-cambiada", () => this.filtrar());
        this.actualizacion = new ActualizacionAutomatica(() => this.cargar(true), 30000);
    }

    /** Filtra las tarjetas ya cargadas y actualiza el mensaje de coincidencias. */
    filtrar() {
        let visibles = 0;
        for (const tarjeta of this.root.querySelector(".categorias").children) {
            tarjeta.hidden = !this.busqueda.coincide(`${tarjeta.producto.nombre || ""} ${tarjeta.producto.comentarios || ""}`);
            if (!tarjeta.hidden) visibles++;
        }
        this.root.querySelector("[role=status]").textContent = this.busqueda.value.trim()
            ? (visibles ? `${visibles} ${visibles === 1 ? "coincidencia" : "coincidencias"}` : "No se encontraron productos en esta categoría.")
            : (visibles ? "" : "No hay productos en esta categoría.");
    }

    /** Recupera el nombre al abrir el enlace directamente y verifica que la categoría sea pública. */
    connectedCallback() { this.actualizacion.iniciar(); return this.cargar(); }

    /**
     * Sincroniza la categoría y sus productos conservando la búsqueda y las opciones abiertas.
     * Notifica una vez cada error persistente; un resultado correcto habilita avisos posteriores.
     * @param {boolean} silenciosa Mantiene la vista mientras se consultan cambios en segundo plano.
     * @returns {Promise<boolean|undefined>} Indica si se representaron cambios o si se descartó la consulta.
     */
    async cargar(silenciosa = false) {
        if (silenciosa && Array.from(this.root.querySelector(".categorias").children).some(t => t.dialogo?.open)) return;
        const consulta = this.consulta = Symbol();
        const lista = this.root.querySelector(".categorias");
        const estado = this.root.querySelector("[role=status]");
        if (!silenciosa) { this.busqueda.disabled = true; lista.replaceChildren(); estado.textContent = "Cargando productos…"; }
        try {
            const categoria = await this.categorias.findById(this.idCategoria);
            if (consulta !== this.consulta) return;
            if (!categoria.activo) {
                this.errorConexion = false; this.ultimoError = "";
                lista.replaceChildren(); this.busqueda.disabled = true;
                estado.textContent = "Categoría no disponible.";
                return;
            }
            this.root.querySelector("h2").textContent = categoria.nombre;
            const productos = await agruparPresentaciones(await this.catalogo.productosDeCategoria(categoria.idTipoProducto));
            if (consulta !== this.consulta) return;
            if (silenciosa && Array.from(lista.children).some(t => t.dialogo?.open)) return;
            const revision = JSON.stringify([categoria, productos]);
            if (silenciosa && this.revision === revision && !this.busqueda.disabled && !this.errorConexion) return false;
            this.errorConexion = false;
            this.ultimoError = "";
            this.revision = revision;
            actualizarLista(lista, productos.filter(p => p.activo), producto => producto.idProducto || producto.nombre, () => {
                const tarjeta = new TarjetaProducto();
                tarjeta.toggleAttribute("seleccionable", this.hasAttribute("seleccionable"));
                return tarjeta;
            }, (tarjeta, producto) => {
                const ilustracion = ilustracionCategoria(categoria);
                const cambio = tarjeta.ilustracion !== ilustracion;
                tarjeta.ilustracion = ilustracion;
                if (cambio || JSON.stringify(tarjeta.producto) !== JSON.stringify(producto)) tarjeta.producto = producto;
            });
            this.busqueda.disabled = false;
            this.filtrar();
            return true;
        } catch (error) {
            if (consulta !== this.consulta) return;
            const mensaje = error.mensaje || error.message || "No se pudieron cargar los productos.";
            this.errorConexion = true;
            if (!silenciosa) estado.textContent = "";
            if (this.ultimoError !== mensaje) notificar(this, mensaje, "error");
            this.ultimoError = mensaje;
        }
    }

    /** Libera los eventos o invalida consultas pendientes al retirar el componente. */
    disconnectedCallback() { this.actualizacion.detener(); this.consulta = null; }
}
customElements.define("productos-categoria", ProductosCategoria);
