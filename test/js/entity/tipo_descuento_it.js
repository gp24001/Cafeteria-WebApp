import { expect } from "../../lib/chai/index.js";
import TipoDescuento from "../../../src/js/entity/tipo_descuento.js";
import TipoDescuentoDao from "../../../src/js/control/tipo_descuento_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("TipoDescuento: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new TipoDescuentoDao());
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de TipoDescuento)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idTipoDescuento;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(TipoDescuento);
        expect(entidad.idTipoDescuento).to.equal(id);
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
