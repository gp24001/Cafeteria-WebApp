import { expect } from "../../lib/chai/index.js";
import OrdenProducto from "../../../src/js/entity/orden_producto.js";
import Orden from "../../../src/js/entity/orden.js";
import Producto from "../../../src/js/entity/producto.js";
import OrdenProductoDao from "../../../src/js/control/orden_producto_dao.js";
import OrdenDao from "../../../src/js/control/orden_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("OrdenProducto: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new OrdenDao(), "idOrden", id => new OrdenProductoDao(id));
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de OrdenProducto)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idOrdenProducto;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(OrdenProducto);
        expect(entidad.idOrdenProducto).to.equal(id);
        for (const [ruta, Tipo] of [["idOrden", Orden], ["idProducto", Producto]]) {
            const relacionado = ruta.split(".").reduce((valor, campo) => valor?.[campo], entidad);
            if (relacionado != null) expect(relacionado, ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
