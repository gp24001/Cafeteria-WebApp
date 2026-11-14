import { expect } from "../../lib/chai/index.js";
import Empleado from "../../../src/js/entity/empleado.js";
import EmpleadoDao from "../../../src/js/control/empleado_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("Empleado: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new EmpleadoDao());
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de Empleado)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idEmpleado;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(Empleado);
        expect(entidad.idEmpleado).to.equal(id);
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
