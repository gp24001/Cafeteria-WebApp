import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import DefaultDao from "../../../src/js/control/default_dao.js";
import Orden from "../../../src/js/entity/orden.js";
import EmpleadoRol from "../../../src/js/entity/empleado_rol.js";
import Empleado from "../../../src/js/entity/empleado.js";
import Rol from "../../../src/js/entity/rol.js";
import { registros } from "./datos_entidades.js";

mocha.setup("tdd");
suite("Orden: unidad", function () {
    const datos = registros.Orden;
    let peticion;
    setup(() => { peticion = sinon.stub(window, "fetch"); });
    teardown(() => sinon.restore());

    test("conserva nombre del cliente en observacion y empleado responsable al recuperar y serializar la entidad", async function () {
        const original = JSON.stringify(datos);
        peticion.resolves(new Response(original));
        const registro = await new DefaultDao(Orden).findById(datos.idOrden);
        expect(registro).to.be.instanceOf(Orden);
        for (const [ruta, Tipo] of [["idEmpleadoRol", EmpleadoRol], ["idEmpleadoRol.idEmpleado", Empleado], ["idEmpleadoRol.idRol", Rol]]) {
            expect(ruta.split(".").reduce((valor, campo) => valor[campo], registro), ruta).to.be.instanceOf(Tipo);
        }
        expect(JSON.stringify(registro)).to.equal(original);
        expect(JSON.stringify(datos)).to.equal(original);
        expect(peticion.firstCall.args[1]).to.equal(undefined);
    });

    test("Conserva únicamente los campos recibidos de la API", async function () {
        const parcial = { idOrden: datos.idOrden };
        peticion.resolves(new Response(JSON.stringify(parcial)));
        const registro = await new DefaultDao(Orden).findById(datos.idOrden);
        expect(registro).to.be.instanceOf(Orden);
        expect(Object.keys(registro)).to.deep.equal(["idOrden"]);
        expect(JSON.stringify(registro)).to.equal(JSON.stringify(parcial));
    });
});
mocha.run();
