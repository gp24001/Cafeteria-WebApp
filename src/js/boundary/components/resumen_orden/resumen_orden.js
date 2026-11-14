import { cargarPlantilla } from "../plantilla/plantilla.js";
import { limpiarEspecificaciones } from "../../../control/formato_caracteristicas.js";

const moneda = new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" });
const plantilla = await cargarPlantilla(new URL("./resumen_orden.html", import.meta.url));
const iconoEliminar = plantilla.content.querySelector("#icono-eliminar");

/** Distingue una elección concreta sin cambiar el ID real del producto que recibe la API. */
const claveDeLinea = linea => linea.claveSeleccion || linea.idProducto;

/** Resumen reutilizable. Recibe productos y emite orden-actualizada al cambiar las unidades. */
export default class ResumenOrden extends HTMLElement {
    /** Crea el resumen y el estado reactivo que notifica los cambios de sus líneas. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(plantilla.content.cloneNode(true));
        this.estado = new Proxy({ lineas: [] }, {
            set: (estado, propiedad, valor) => {
                Reflect.set(estado, propiedad, valor);
                this.mostrar();
                this.dispatchEvent(new CustomEvent("orden-actualizada", {
                    detail: { lineas: valor.map(linea => ({ ...linea })), total: this.total },
                    bubbles: true, composed: true
                }));
                return true;
            }
        });
    }

    /** Inicializa la vista cuando el Web Component se incorpora al documento. */
    connectedCallback() { this.mostrar(); }

    /** Importe de todas las unidades, sumado en centavos. */
    get total() {
        return this.estado.lineas.reduce((suma, l) => suma + Math.round(l.precio * 100) * l.cantidad, 0) / 100;
    }

    /**
     * Agrupa unidades de la misma elección; opciones distintas del mismo SKU conservan su propia línea.
     * @param {object} producto Producto activo con ID real, precio y clave opcional de las características elegidas.
     * @param {number} cantidad Unidades enteras positivas que se agregarán.
     */
    agregar(producto, cantidad = 1) {
        if (this.hasAttribute("solo-lectura") || !producto?.activo || !Number.isSafeInteger(cantidad) || cantidad < 1) return;
        const lineas = this.estado.lineas;
        const clave = claveDeLinea(producto);
        const existe = lineas.some(linea => claveDeLinea(linea) === clave);
        this.estado.lineas = existe
            ? lineas.map(linea => claveDeLinea(linea) === clave ? { ...linea, cantidad: linea.cantidad + cantidad } : linea)
            : [...lineas, { idProducto: producto.idProducto, nombre: producto.nombre, precio: producto.precioSugerido, cantidad,
                ...(producto.claveSeleccion ? { claveSeleccion: producto.claveSeleccion } : {}),
                ...(producto.presentacion ? { presentacion: producto.presentacion } : {}) }];
    }

    /** Incrementa la línea identificada por su clave de selección o ID de producto legado. */
    aumentar(id) {
        if (this.hasAttribute("solo-lectura")) return;
        this.estado.lineas = this.estado.lineas.map(l => claveDeLinea(l) === id ? { ...l, cantidad: l.cantidad + 1 } : l);
    }

    /** Retira una unidad y elimina la línea al llegar a cero. */
    quitar(id) {
        if (this.hasAttribute("solo-lectura")) return;
        this.estado.lineas = this.estado.lineas.map(l => claveDeLinea(l) === id ? { ...l, cantidad: l.cantidad - 1 } : l)
            .filter(l => l.cantidad > 0);
    }

    /** Retira todas las unidades de la elección indicada, conservando otras del mismo producto. */
    eliminar(id) {
        if (this.hasAttribute("solo-lectura")) return;
        this.estado.lineas = this.estado.lineas.filter(linea => claveDeLinea(linea) !== id);
    }

    /** Representa el estado actual en el DOM sin insertar datos del usuario como HTML. */
    mostrar() {
        const lista = this.root.querySelector("ul");
        lista.replaceChildren();
        for (const linea of this.estado.lineas) {
            const clave = claveDeLinea(linea);
            const item = document.createElement("li");
            const datos = document.createElement("div");
            datos.className = "datos-linea";
            const nombre = document.createElement("span");
            nombre.textContent = linea.nombre;
            const precio = document.createElement("small");
            precio.textContent = moneda.format(linea.precio) + " / unidad";
            datos.append(nombre, precio);
            const especificaciones = limpiarEspecificaciones(linea.presentacion, {
                omitirPorcionUnitaria: this.hasAttribute("omitir-porcion-unitaria")
            });
            if (especificaciones) {
                const presentacion = document.createElement("small");
                presentacion.textContent = especificaciones;
                datos.appendChild(presentacion);
            }
            const subtotal = document.createElement("strong");
            subtotal.textContent = moneda.format(Math.round(linea.precio * 100) * linea.cantidad / 100);
            const controles = document.createElement("div");
            controles.className = "unidades";
            controles.setAttribute("role", "group");
            controles.setAttribute("aria-label", "Cantidad de " + linea.nombre);
            const quitar = document.createElement("button");
            quitar.type = "button";
            quitar.className = "quitar";
            quitar.textContent = "−";
            quitar.setAttribute("aria-label", "Quitar una unidad de " + linea.nombre);
            quitar.onclick = () => this.quitar(clave);
            const cantidad = document.createElement("span");
            cantidad.textContent = String(linea.cantidad);
            cantidad.setAttribute("aria-label", linea.cantidad + " unidades");
            const sumar = document.createElement("button");
            sumar.type = "button";
            sumar.className = "sumar";
            sumar.textContent = "+";
            sumar.setAttribute("aria-label", "Agregar una unidad de " + linea.nombre);
            sumar.onclick = () => this.aumentar(clave);
            controles.append(quitar, cantidad, sumar);
            const eliminar = document.createElement("button");
            eliminar.type = "button";
            eliminar.className = "eliminar";
            eliminar.title = "Eliminar todas las unidades de " + linea.nombre;
            eliminar.setAttribute("aria-label", eliminar.title);
            eliminar.appendChild(iconoEliminar.content.cloneNode(true));
            eliminar.onclick = () => this.eliminar(clave);
            const acciones = document.createElement("div");
            acciones.className = "acciones-linea";
            acciones.append(controles, eliminar);
            item.append(datos, subtotal, acciones);
            lista.appendChild(item);
        }
        this.root.querySelector(".total strong").textContent = moneda.format(this.total);
    }
}
customElements.define("resumen-orden", ResumenOrden);
