import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import BusquedaCatalogo from "../../../src/js/control/busqueda_catalogo.js";

mocha.setup("tdd");
suite("Filtro del catálogo: Integración con la búsqueda", function () {
    let busqueda;
    teardown(() => { busqueda?.detener(); sinon.restore(); });
    test("el filtro de respaldo conserva la posición de los productos y encuentra nombre y descripción", async function () {
        sinon.stub(window, "Worker").value(undefined);
        const productos = [{ idProducto: "pan", nombre: "Panini", comentarios: "Pan de masa madre" },
            { idProducto: "cafe", nombre: "Café frío", comentarios: "Leche deslactosada" }];
        busqueda = new BusquedaCatalogo(); busqueda.establecerProductos(productos);
        const indices = await busqueda.buscar("CAFE deslactosada");
        expect(indices.map(i => productos[i].idProducto)).to.deep.equal(["cafe"]);
        expect(await busqueda.buscar("cafe pan")).to.deep.equal([]);
    });
});
mocha.run();
