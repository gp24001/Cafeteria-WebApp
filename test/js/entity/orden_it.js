import { expect } from "../../lib/chai/index.js";
import Orden from "../../../src/js/entity/orden.js";
import EmpleadoRol from "../../../src/js/entity/empleado_rol.js";
import Empleado from "../../../src/js/entity/empleado.js";
import Rol from "../../../src/js/entity/rol.js";
import OrdenDao from "../../../src/js/control/orden_dao.js";
import { buscarRegistro, leerConOriginal } from "./integracion_entidades.js";

mocha.setup("tdd");
suite("Orden: integración con la API", function () {
    this.timeout(30000);

    test("recupera un registro real con sus relaciones tipadas y sin perder valores del JSON", async function () {
        const encontrado = await buscarRegistro(new OrdenDao());
        if (!encontrado) {
            this.test.title += " (pendiente: no existen registros de Orden)";
            this.skip();
            return;
        }
        const id = encontrado.registro.idOrden;
        expect(id).to.be.a("string").and.not.be.empty;
        const { entidad, original } = await leerConOriginal(encontrado.dao, id);
        expect(entidad).to.be.instanceOf(Orden);
        expect(entidad.idOrden).to.equal(id);
        for (const [ruta, Tipo] of [["idEmpleadoRol", EmpleadoRol], ["idEmpleadoRol.idEmpleado", Empleado], ["idEmpleadoRol.idRol", Rol]]) {
            const relacionado = ruta.split(".").reduce((valor, campo) => valor?.[campo], entidad);
            if (relacionado != null) expect(relacionado, ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(entidad)).to.equal(JSON.stringify(original));
    });
});
mocha.run();
