import { cargarPlantilla } from "../plantilla/plantilla.js";
import { opcionesDeProducto, gruposVisibles, seleccionarProducto } from "../../../control/presentaciones_producto.js";
import "../tarjeta_simple/tarjeta_simple.js";

const moneda = new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" });
const plantilla = await cargarPlantilla(new URL("./tarjeta_producto.html", import.meta.url));

/** Abre el detalle del producto y comunica las unidades elegidas al carrito. */
export default class TarjetaProducto extends HTMLElement {
    /** Crea la tarjeta, el diálogo de selección y sus acciones de cantidad y presentación. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(plantilla.content.cloneNode(true));
        this.dialogo = this.root.querySelector("dialog");
        this.boton = this.root.querySelector("#agregar");
        this.cantidad = 1;
        this.variante = null;
        this.selecciones = new Map();
        this.configuracion = { variantes: [], fijas: [], grupos: [] };
        this.root.querySelector(".imagen-producto").onclick = () => this.abrir();
        this.root.querySelector(".elegir").onclick = () => this.abrir();
        this.root.querySelector(".cerrar").onclick = () => this.dialogo.close();
        this.root.querySelector("#menos").onclick = () => this.cambiarCantidad(-1);
        this.root.querySelector("#mas").onclick = () => this.cambiarCantidad(1);
        this.boton.onclick = () => {
            if (!this.producto?.activo || !this.hasAttribute("seleccionable")) return;
            const seleccionado = seleccionarProducto(this.configuracion, this.selecciones);
            if (!seleccionado) return;
            this.dispatchEvent(new CustomEvent("agregar-producto", {
                detail: { ...seleccionado, cantidad: this.cantidad }, bubbles: true, composed: true
            }));
            this.dialogo.close();
        };
    }

    /** Asigna el producto recibido del catálogo y reinicia la presentación elegida. */
    set producto(registro) {
        this._producto = registro;
        this.configuracion = registro ? opcionesDeProducto(registro) : { variantes: [], fijas: [], grupos: [] };
        this.variante = null;
        this.selecciones.clear();
        this.mostrar();
    }
    /** Devuelve el producto representado, incluidas sus variantes si las tiene. */
    get producto() { return this._producto; }
    /** Inicializa la vista cuando el Web Component se incorpora al documento. */
    connectedCallback() { this.mostrar(); }
    /** Declara los atributos que actualizan la presentación del componente. */
    static get observedAttributes() { return ["seleccionable"]; }
    /** Sincroniza la vista cuando cambia un atributo observado. */
    attributeChangedCallback() { this.mostrar(); }

    /** Abre el detalle del producto y reinicia la cantidad y la selección de presentación. */
    abrir() {
        if (!this.producto?.activo) return;
        this.cantidad = 1;
        this.variante = null;
        this.selecciones.clear();
        this.mostrarPresentaciones();
        this.dialogo.showModal();
    }

    /**
     * Ajusta la cantidad entre uno y noventa y nueve y recalcula el importe.
     * @param {number} cambio Incremento o reducción de unidades.
     */
    cambiarCantidad(cambio) {
        this.cantidad = Math.max(1, Math.min(99, this.cantidad + cambio));
        this.mostrarCantidad();
    }

    /** Muestra la presentación, los datos fijos y un grupo de elección por tipo de característica. */
    mostrarPresentaciones() {
        const { fijas, grupos } = this.configuracion;
        const listaFijas = this.root.querySelector(".caracteristicas-fijas");
        listaFijas.replaceChildren();
        listaFijas.hidden = !fijas.length;
        for (const caracteristica of fijas) {
            const item = this.root.querySelector("#caracteristica-fija").content.firstElementChild.cloneNode(true);
            item.textContent = caracteristica.etiqueta;
            listaFijas.appendChild(item);
        }
        const contenedor = this.root.querySelector(".grupos-caracteristicas");
        contenedor.replaceChildren();
        for (const grupo of grupos) {
            const campo = this.root.querySelector("#grupo-caracteristica").content.firstElementChild.cloneNode(true);
            campo.dataset.grupo = grupo.id;
            campo.querySelector("legend span").textContent = grupo.nombre;
            const opciones = campo.querySelector(".opciones");
            for (const opcion of grupo.opciones) {
                const etiqueta = this.root.querySelector("#opcion-presentacion").content.firstElementChild.cloneNode(true);
                const radio = etiqueta.querySelector("input");
                radio.name = "caracteristica-" + grupo.id;
                radio.value = opcion.id;
                radio.onchange = () => {
                    if (!grupo.condicional) for (const secundario of this.configuracion.grupos.filter(g => g.condicional)) this.selecciones.delete(secundario.id);
                    this.selecciones.set(grupo.id, opcion.id);
                    this.actualizarOpciones();
                };
                etiqueta.querySelector("span").textContent = opcion.etiqueta;
                const precio = etiqueta.querySelector("strong");
                const variantes = this.configuracion.variantes.filter(v => opcion.variantes.includes(v.idProducto));
                precio.hidden = grupo.condicional || !variantes.length;
                if (variantes.length) precio.textContent = moneda.format(Math.min(...variantes.map(v => Number(v.precioSugerido))));
                opciones.appendChild(etiqueta);
            }
            contenedor.appendChild(campo);
        }
        this.actualizarOpciones();
    }

    /** Comprueba elecciones de tamaño u otros ejes que identifican el SKU, sin aplicar sus extras. */
    coincideVariante(variante, exceptoGrupo) {
        return this.configuracion.grupos.every(grupo => {
            if (grupo.condicional || grupo.id === exceptoGrupo || !this.selecciones.has(grupo.id)) return true;
            return grupo.opciones.find(o => o.id === this.selecciones.get(grupo.id))?.variantes.includes(variante.idProducto);
        });
    }

    /** Actualiza compatibilidad y precio en los mismos radios, sin reconstruir las opciones elegidas. */
    actualizarOpciones() {
        const { variantes, grupos } = this.configuracion;
        const compatibles = variantes.filter(variante => this.coincideVariante(variante));
        const visibles = gruposVisibles(this.configuracion, this.selecciones);
        for (const campo of this.root.querySelectorAll(".presentaciones")) {
            const grupo = grupos.find(g => g.id === campo.dataset.grupo);
            const opcionesVisibles = visibles.find(visible => visible.id === grupo.id)?.opciones || [];
            campo.hidden = !opcionesVisibles.length;
            if (grupo.condicional && !opcionesVisibles.some(opcion => opcion.id === this.selecciones.get(grupo.id))) this.selecciones.delete(grupo.id);
            for (const radio of campo.querySelectorAll("input")) {
                const opcion = grupo.opciones.find(o => o.id === radio.value);
                const visible = opcionesVisibles.some(o => o.id === opcion.id);
                radio.closest("label").hidden = !visible;
                radio.required = !campo.hidden && visible;
                radio.disabled = !visible || !(grupo.condicional ? compatibles : variantes).some(v => opcion.variantes.includes(v.idProducto) && this.coincideVariante(v, grupo.id));
                radio.checked = this.selecciones.get(grupo.id) === opcion.id;
            }
        }
        this.variante = seleccionarProducto(this.configuracion, this.selecciones);
        const disponibles = compatibles.length ? compatibles : variantes;
        const precio = this.variante ? moneda.format(this.variante.precioSugerido)
            : (disponibles.length === 1 ? moneda.format(disponibles[0].precioSugerido)
                : (grupos.length && disponibles.length ? "Desde " + moneda.format(Math.min(...disponibles.map(v => Number(v.precioSugerido))))
                    : (this.producto?.precioSugerido != null ? moneda.format(this.producto.precioSugerido) : "")));
        this.root.querySelector(".precio").textContent = precio;
        this.mostrarCantidad();
    }

    /** Actualiza cantidad, importe y disponibilidad del botón para agregar al carrito. */
    mostrarCantidad() {
        this.root.querySelector("output").value = String(this.cantidad);
        this.root.querySelector("#menos").disabled = this.cantidad === 1;
        this.root.querySelector("#mas").disabled = this.cantidad === 99;
        const total = Math.round(Number((this.variante || this.producto)?.precioSugerido || 0) * 100) * this.cantidad / 100;
        const faltaPresentacion = Boolean(this.configuracion.grupos.length && !this.variante);
        const esPresentacion = this.configuracion.grupos.length === 1 && this.configuracion.grupos[0].id === "presentacion";
        this.boton.textContent = faltaPresentacion ? (esPresentacion ? "Elige una presentación" : "Elige las opciones") : `Agregar · ${moneda.format(total)}`;
        this.boton.disabled = !this.producto?.activo || faltaPresentacion;
    }

    /** Representa el estado actual en el DOM sin insertar datos del usuario como HTML. */
    mostrar() {
        const producto = this.producto;
        const nombre = producto?.nombre || "";
        this.root.querySelector("h3").textContent = nombre;
        this.root.querySelector("h2").textContent = nombre;
        const locales = { cheesecake: "cheesecake", expresso: "caliente", quesadilla: "quesadilla" };
        const archivo = locales[nombre.trim().toLowerCase()] || this.ilustracion || "categoria";
        const respaldo = new URL(`../../../../resources/imagenes/${archivo}.png`, import.meta.url).href;
        for (const imagen of this.root.querySelectorAll("img")) {
            if (imagen.src !== respaldo) imagen.src = respaldo;
            imagen.alt = nombre;
        }
        const descripcion = this.root.querySelector(".descripcion");
        descripcion.textContent = producto?.comentarios?.trim() || "";
        descripcion.hidden = !descripcion.textContent;
        const precio = producto?.variantes?.length
            ? "Desde " + moneda.format(Math.min(...producto.variantes.map(v => Number(v.precioSugerido))))
            : (producto?.precioSugerido != null ? moneda.format(producto.precioSugerido) : "");
        this.root.querySelector("strong").textContent = precio;
        this.root.querySelector(".precio").textContent = precio;
        this.hidden = !producto?.activo;
        this.root.querySelector(".seleccion").hidden = !this.hasAttribute("seleccionable");
        this.boton.hidden = !this.hasAttribute("seleccionable");
        this.root.querySelector(".elegir").hidden = !this.hasAttribute("seleccionable");
        this.root.querySelector(".imagen-producto").setAttribute("aria-label", "Ver detalle de " + nombre);
        this.root.querySelector(".elegir").setAttribute("aria-label", "Elegir " + nombre);
        this.mostrarCantidad();
    }
}
customElements.define("tarjeta-producto", TarjetaProducto);
