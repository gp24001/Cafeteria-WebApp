import { expect } from "../../lib/chai/index.js";
import Caja from "../../../src/js/entity/caja.js";
import CajaDao from "../../../src/js/control/caja_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("Caja: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new CajaDao());
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de Caja)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idCaja;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(Caja);
        expect(entidad.idCaja).to.equal(id);
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
