import { expect } from "../../lib/chai/index.js";
import Producto from "../../../src/js/entity/producto.js";
import ProductoDao from "../../../src/js/control/producto_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("Producto: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new ProductoDao());
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de Producto)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idProducto;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(Producto);
        expect(entidad.idProducto).to.equal(id);
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
