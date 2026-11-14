import { expect } from "../../lib/chai/index.js";
import FacturaOrdenProducto from "../../../src/js/entity/factura_orden_producto.js";
import Factura from "../../../src/js/entity/factura.js";
import OrdenProducto from "../../../src/js/entity/orden_producto.js";
import Orden from "../../../src/js/entity/orden.js";
import Producto from "../../../src/js/entity/producto.js";
import FacturaOrdenProductoDao from "../../../src/js/control/factura_orden_producto_dao.js";
import FacturaDao from "../../../src/js/control/factura_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("FacturaOrdenProducto: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new FacturaDao(), "idFactura", id => new FacturaOrdenProductoDao(id));
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de FacturaOrdenProducto)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idFacturaOrdenProducto;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(FacturaOrdenProducto);
        expect(entidad.idFacturaOrdenProducto).to.equal(id);
        for (const [ruta, Tipo] of [["idFactura", Factura], ["idOrdenProducto", OrdenProducto], ["idOrdenProducto.idOrden", Orden], ["idOrdenProducto.idProducto", Producto]]) {
            const relacionado = ruta.split(".").reduce((valor, campo) => valor?.[campo], entidad);
            if (relacionado != null) expect(relacionado, ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
