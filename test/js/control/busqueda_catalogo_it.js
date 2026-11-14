import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import BusquedaCatalogo from "../../../src/js/control/busqueda_catalogo.js";

mocha.setup("tdd");
suite("BusquedaCatalogo: Integración con Worker", function () {
    let busqueda;
    const productos = [{ nombre: "Café Latte", comentarios: "Con leche deslactosada" }, { nombre: "Té frío", comentarios: "Con limón" }, { nombre: "Pan integral", comentarios: "Con semillas" }];
    setup(() => { busqueda = new BusquedaCatalogo(); });
    teardown(() => { busqueda.detener(); sinon.restore(); });
    test("usa un Worker de módulo real y devuelve posiciones originales sin ejecutar el respaldo", async function () {
        this.timeout(5000);
        const respaldo = sinon.spy(busqueda, "filtrar");
        busqueda.establecerProductos(productos);
        expect(busqueda.worker).to.be.instanceOf(Worker);
        expect(await busqueda.buscar("LIMÓN frío")).to.deep.equal([1]);
        expect(await busqueda.buscar("leche café")).to.deep.equal([0]);
        expect(await busqueda.buscar("sin coincidencia")).to.deep.equal([]);
        sinon.assert.notCalled(respaldo);
    });

});
mocha.run();
