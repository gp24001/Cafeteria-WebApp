import { expect } from "../../lib/chai/index.js";
import ProductoCaracteristica from "../../../src/js/entity/producto_caracteristica.js";
import Caracteristica from "../../../src/js/entity/caracteristica.js";
import TipoCaracteristica from "../../../src/js/entity/tipo_caracteristica.js";
import Producto from "../../../src/js/entity/producto.js";
import ProductoCaracteristicaDao from "../../../src/js/control/producto_caracteristica_dao.js";
import ProductoDao from "../../../src/js/control/producto_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("ProductoCaracteristica: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new ProductoDao(), "idProducto", id => new ProductoCaracteristicaDao(id));
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de ProductoCaracteristica)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idProductoCaracteristica;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(ProductoCaracteristica);
        expect(entidad.idProductoCaracteristica).to.equal(id);
        for (const [ruta, Tipo] of [["idCaracteristica", Caracteristica], ["idCaracteristica.idTipoCaracteristica", TipoCaracteristica], ["idProducto", Producto]]) {
            const relacionado = ruta.split(".").reduce((valor, campo) => valor?.[campo], entidad);
            if (relacionado != null) expect(relacionado, ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
