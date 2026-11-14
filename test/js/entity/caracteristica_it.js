import { expect } from "../../lib/chai/index.js";
import Caracteristica from "../../../src/js/entity/caracteristica.js";
import TipoCaracteristica from "../../../src/js/entity/tipo_caracteristica.js";
import CaracteristicaDao from "../../../src/js/control/caracteristica_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("Caracteristica: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new CaracteristicaDao());
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de Caracteristica)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idCaracteristica;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(Caracteristica);
        expect(entidad.idCaracteristica).to.equal(id);
        for (const [ruta, Tipo] of [["idTipoCaracteristica", TipoCaracteristica]]) {
            const relacionado = ruta.split(".").reduce((valor, campo) => valor?.[campo], entidad);
            if (relacionado != null) expect(relacionado, ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
