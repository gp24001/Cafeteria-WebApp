import { expect } from "../../lib/chai/index.js";
import DescuentoProducto from "../../../src/js/entity/descuento_producto.js";
import Descuento from "../../../src/js/entity/descuento.js";
import TipoDescuento from "../../../src/js/entity/tipo_descuento.js";
import Producto from "../../../src/js/entity/producto.js";
import DescuentoProductoDao from "../../../src/js/control/descuento_producto_dao.js";
import DescuentoDao from "../../../src/js/control/descuento_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("DescuentoProducto: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new DescuentoDao(), "idDescuento", id => new DescuentoProductoDao(id));
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de DescuentoProducto)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idDescuentoProducto;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(DescuentoProducto);
        expect(entidad.idDescuentoProducto).to.equal(id);
        for (const [ruta, Tipo] of [["idDescuento", Descuento], ["idDescuento.idTipoDescuento", TipoDescuento], ["idProducto", Producto]]) {
            const relacionado = ruta.split(".").reduce((valor, campo) => valor?.[campo], entidad);
            if (relacionado != null) expect(relacionado, ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
