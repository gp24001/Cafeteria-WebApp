import { expect } from "../../lib/chai/index.js";
import TipoCaracteristica from "../../../src/js/entity/tipo_caracteristica.js";
import TipoCaracteristicaDao from "../../../src/js/control/tipo_caracteristica_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("TipoCaracteristica: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new TipoCaracteristicaDao());
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de TipoCaracteristica)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idTipoCaracteristica;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(TipoCaracteristica);
        expect(entidad.idTipoCaracteristica).to.equal(id);
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
