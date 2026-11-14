import { expect } from "../../lib/chai/index.js";
import EmpleadoRol from "../../../src/js/entity/empleado_rol.js";
import Empleado from "../../../src/js/entity/empleado.js";
import Rol from "../../../src/js/entity/rol.js";
import EmpleadoRolDao from "../../../src/js/control/empleado_rol_dao.js";
import EmpleadoDao from "../../../src/js/control/empleado_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("EmpleadoRol: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new EmpleadoDao(), "idEmpleado", id => new EmpleadoRolDao(id));
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de EmpleadoRol)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idEmpleadoRol;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(EmpleadoRol);
        expect(entidad.idEmpleadoRol).to.equal(id);
        for (const [ruta, Tipo] of [["idEmpleado", Empleado], ["idRol", Rol]]) {
            const relacionado = ruta.split(".").reduce((valor, campo) => valor?.[campo], entidad);
            if (relacionado != null) expect(relacionado, ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
