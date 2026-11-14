import { expect } from "../../lib/chai/index.js";
import TipoProducto from "../../../src/js/entity/tipo_producto.js";
import TipoProductoDao from "../../../src/js/control/tipo_producto_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("TipoProducto: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new TipoProductoDao());
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de TipoProducto)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idTipoProducto;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(TipoProducto);
        expect(entidad.idTipoProducto).to.equal(id);
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
