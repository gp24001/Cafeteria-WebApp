import { crearIndice, buscarEnIndice } from "./filtro_catalogo.js";

/** Delega la búsqueda al Worker propio y conserva el mismo filtro local como respaldo. */
export default class BusquedaCatalogo {
    /** Inicializa el catálogo, las solicitudes pendientes y la versión de su índice. */
    constructor() {
        this.productos = [];
        this.indice = null;
        this.version = 0;
        this.siguienteId = 0;
        this.pendientes = new Map();
        this.worker = null;
        this.workerFallido = false;
    }

    /**
     * Reemplaza los textos del catálogo y cancela resultados de su versión anterior.
     * @param {object[]} productos Registros en el orden que conservará la pantalla.
     */
    establecerProductos(productos) {
        this.version++;
        this.productos = productos.map(({ nombre, comentarios }) => ({ nombre, comentarios }));
        this.indice = null;
        this.resolverPendientes();
        if (!this.worker && !this.workerFallido && typeof Worker === "function") {
            try {
                this.worker = new Worker(new URL("./workers/busqueda_catalogo_worker.js", import.meta.url), { type: "module" });
                this.worker.onmessage = evento => this.recibir(evento.data);
                this.worker.onerror = evento => { evento.preventDefault(); this.usarRespaldo(); };
                this.worker.onmessageerror = () => this.usarRespaldo();
            } catch { this.usarRespaldo(); }
        }
        if (this.worker) {
            try { this.worker.postMessage({ tipo: "indice", version: this.version, productos: this.productos }); }
            catch { this.usarRespaldo(); }
        }
    }

    /**
     * Busca todas las palabras sin peticiones REST y relaciona cada respuesta con su consulta.
     * @param {string} consulta Texto introducido por el usuario.
     * @returns {Promise<number[]>} Posiciones originales; vacío si se reemplazó el catálogo.
     */
    buscar(consulta) {
        if (!this.worker) return Promise.resolve(this.filtrar(consulta));
        const id = ++this.siguienteId;
        return new Promise(resolve => {
            const temporizador = setTimeout(() => this.usarRespaldo(), 2000);
            this.pendientes.set(id, { resolve, consulta, version: this.version, temporizador });
            try { this.worker.postMessage({ tipo: "buscar", id, version: this.version, consulta }); }
            catch { this.usarRespaldo(); }
        });
    }

    /**
     * Completa solamente la solicitud y la versión a las que pertenece la respuesta.
     * @param {{id: number, version: number, indices: number[]}} respuesta Mensaje del Worker propio.
     */
    recibir({ id, version, indices }) {
        const pendiente = this.pendientes.get(id);
        if (!pendiente || pendiente.version !== version || version !== this.version) return;
        clearTimeout(pendiente.temporizador);
        this.pendientes.delete(id);
        pendiente.resolve(indices);
    }

    /**
     * Construye el índice local únicamente cuando falta soporte o se usa el respaldo.
     * @param {string} consulta Texto que se comparará con el catálogo actual.
     * @returns {number[]} Posiciones de los registros coincidentes.
     */
    filtrar(consulta) {
        this.indice ??= crearIndice(this.productos);
        return buscarEnIndice(this.indice, consulta);
    }

    /** Resuelve solicitudes sin dejarlas bloqueadas y descarta las del catálogo reemplazado. */
    resolverPendientes() {
        for (const pendiente of this.pendientes.values()) {
            clearTimeout(pendiente.temporizador);
            pendiente.resolve(pendiente.version === this.version ? this.filtrar(pendiente.consulta) : []);
        }
        this.pendientes.clear();
    }

    /** Mantiene la búsqueda disponible si el navegador rechaza el Worker o deja de responder. */
    usarRespaldo() {
        this.workerFallido = true;
        this.detener();
    }

    /**
     * Libera el hilo y finaliza las consultas vigentes mediante el filtro local.
     * Una llamada posterior a establecerProductos puede crear otro hilo si el anterior no falló.
     */
    detener() {
        this.worker?.terminate();
        this.worker = null;
        this.resolverPendientes();
    }
}
