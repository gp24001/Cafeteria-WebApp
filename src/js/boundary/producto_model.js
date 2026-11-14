import "./components/buscador_productos/buscador_productos.js";
import "./components/categorias_producto/categorias_producto.js";
import "./components/productos_categoria/productos_categoria.js";

/** Presenta el catálogo público o el detalle de la categoría indicada por la ruta. */
export default class ProductoModel extends HTMLElement {
    /** Prepara el Shadow DOM y comparte el estilo base del catálogo. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        const estilo = document.createElement("link");
        estilo.rel = "stylesheet";
        estilo.href = new URL("../../resources/estilos/tarjeta.css", import.meta.url);
        this.root.appendChild(estilo);
    }

    /** Monta el catálogo general o la categoría indicada antes de insertar la pantalla. */
    connectedCallback() {
        if (this.contenido) return;
        const seleccionable = this.hasAttribute("seleccionable");
        const idCategoria = this.idCategoria || this.getAttribute("id-categoria");
        if (idCategoria) {
            const detalle = document.createElement("productos-categoria");
            detalle.idCategoria = idCategoria;
            detalle.seccion = this.seccion;
            this.contenido = detalle;
        } else {
            const buscador = document.createElement("buscador-productos");
            const categorias = document.createElement("tipo-producto-model");
            categorias.toggleAttribute("seleccionable", seleccionable);
            categorias.addEventListener("seleccionar-categoria", evento => {
                location.hash = "productos/" + encodeURIComponent(evento.detail.idTipoProducto);
            });
            buscador.appendChild(categorias);
            this.contenido = buscador;
        }
        this.contenido.toggleAttribute("seleccionable", seleccionable);
        this.root.appendChild(this.contenido);
    }
}

customElements.define("producto-model", ProductoModel);
