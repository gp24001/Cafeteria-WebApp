import { expect } from "../../lib/chai/index.js";
import ProductoTipoProducto from "../../../src/js/entity/producto_tipo_producto.js";
import Producto from "../../../src/js/entity/producto.js";
import TipoProducto from "../../../src/js/entity/tipo_producto.js";
import ProductoTipoProductoDao from "../../../src/js/control/producto_tipo_producto_dao.js";
import ProductoDao from "../../../src/js/control/producto_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("ProductoTipoProducto: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new ProductoDao(), "idProducto", id => new ProductoTipoProductoDao(id));
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de ProductoTipoProducto)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idProductoTipoProducto;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(ProductoTipoProducto);
        expect(entidad.idProductoTipoProducto).to.equal(id);
        for (const [ruta, Tipo] of [["idProducto", Producto], ["idTipoProducto", TipoProducto]]) {
            const relacionado = ruta.split(".").reduce((valor, campo) => valor?.[campo], entidad);
            if (relacionado != null) expect(relacionado, ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
