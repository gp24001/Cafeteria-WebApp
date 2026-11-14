import { expect } from "../../lib/chai/index.js";
import Rol from "../../../src/js/entity/rol.js";
import RolDao from "../../../src/js/control/rol_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("Rol: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new RolDao());
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de Rol)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idRol;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(Rol);
        expect(entidad.idRol).to.equal(id);
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
