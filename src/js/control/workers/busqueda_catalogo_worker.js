import { crearIndice, buscarEnIndice } from "../filtro_catalogo.js";

let indice = [];
let version = 0;

/** Prepara el catálogo y filtra consultas fuera del hilo que representa la interfaz. */
self.onmessage = ({ data }) => {
    if (data.tipo === "indice") {
        indice = crearIndice(data.productos);
        version = data.version;
    } else if (data.tipo === "buscar") {
        self.postMessage({ id: data.id, version: data.version,
            indices: data.version === version ? buscarEnIndice(indice, data.consulta) : [] });
    }
};
