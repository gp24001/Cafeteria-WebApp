import { leerPresentacionUnidad } from "../../../control/preparacion_estado.js";
import { limpiarEspecificaciones } from "../../../control/formato_caracteristicas.js";
import { actualizarLista, actualizarTexto } from "../lista_dinamica/lista_dinamica.js";

import { cargarPlantilla } from "../plantilla/plantilla.js";

const plantilla = await cargarPlantilla(new URL("./items_preparacion.html", import.meta.url));
const filaItem = plantilla.content.querySelector("#fila-item");

/** Agrupa cantidades por producto y presentación, conservando los IDs de cada unidad. */
export default class ItemsPreparacion extends HTMLElement {
    /** Crea la lista encapsulada que conserva una fila por producto y presentación. */
    constructor() {
        super();
        this.root = this.attachShadow({ mode: "open" });
        this.root.appendChild(plantilla.content.cloneNode(true));
    }

    /** Recibe la orden y las líneas que se representarán en la vista. */
    set datos(valor) { this._datos = valor; this.mostrar(); }
    /** Bloquea las acciones durante el guardado sin reconstruir las filas existentes. */
    set disabled(valor) {
        this._disabled = valor;
        for (const boton of this.root.querySelectorAll("button")) boton.disabled = Boolean(valor) || this._datos?.orden.estadoPreparacion !== "EN_PREPARACION";
    }

    /** Representa el estado actual en el DOM sin insertar datos del usuario como HTML. */
    mostrar() {
        if (!this._datos) return;
        const { orden, lineas } = this._datos;
        const listos = new Set(orden.listos || []);
        const lista = this.root.querySelector("ul");
        const grupos = new Map();
        for (const unidad of orden.unidades) {
            const presentacion = leerPresentacionUnidad(unidad.observaciones);
            const clave = JSON.stringify([unidad.idProducto?.idProducto, presentacion, unidad.precio]);
            if (!grupos.has(clave)) grupos.set(clave, { clave, unidad, presentacion, ids: [] });
            grupos.get(clave).ids.push(unidad.idOrdenProducto);
        }
        actualizarLista(lista, [...grupos.values()], grupo => grupo.clave, () => {
            const item = document.createElement("li");
            item.appendChild(filaItem.content.cloneNode(true));
            return item;
        }, (item, { unidad, presentacion, ids }) => {
            const nombre = item.querySelector("strong");
            const idProducto = unidad.idProducto?.idProducto;
            const titulo = lineas.find(l => l.idProducto === idProducto)?.nombre || "Producto";
            actualizarTexto(nombre, `${titulo} x${ids.length}`);
            const nota = item.querySelector("small");
            const especificaciones = limpiarEspecificaciones(presentacion, { omitirPorcionUnitaria: true });
            actualizarTexto(nota, especificaciones);
            nota.hidden = !especificaciones;
            const cantidadLista = ids.filter(id => listos.has(id)).length;
            const listo = cantidadLista === ids.length;
            const estado = item.querySelector(".etiqueta-estado");
            estado.className = "etiqueta-estado " + (listo ? "listo" : "pendiente");
            actualizarTexto(estado, listo ? "Listo" : (cantidadLista ? `Parcial (${cantidadLista}/${ids.length})` : "Pendiente"));
            const boton = item.querySelector("button");
            actualizarTexto(boton, listo ? "Marcar pendiente" : "Marcar listo");
            boton.setAttribute("aria-label", `${boton.textContent}: ${nombre.textContent}, ${nota.textContent}`);
            boton.setAttribute("aria-pressed", String(listo));
            boton.disabled = Boolean(this._disabled) || orden.estadoPreparacion !== "EN_PREPARACION";
            boton.onclick = () => this.dispatchEvent(new CustomEvent("cambiar-item", {
                detail: { idOrdenProducto: ids.length === 1 ? ids[0] : ids, listo: !listo }, bubbles: true, composed: true
            }));
        });
    }
}
customElements.define("items-preparacion", ItemsPreparacion);
