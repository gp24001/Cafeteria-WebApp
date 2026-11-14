import { expect } from "../../lib/chai/index.js";
import { vistas } from "../../../src/js/control/vistas.js";

mocha.setup("tdd");
suite("Vistas: Unidad", function () {
    test("define las rutas y los títulos de las pantallas disponibles para cliente y empleados", function () {
        expect(Object.keys(vistas)).to.have.members(["inicio", "productos", "ingreso", "preparacion", "pagos"]);
        expect(vistas.ingreso.titulo).to.equal("Iniciar sesión");
        expect(vistas.inicio.titulo).to.equal("Inicio");
        expect(vistas.productos.titulo).to.equal("Productos");
        expect(vistas.preparacion.titulo).to.equal("Recepción de órdenes");
        expect(vistas.pagos.titulo).to.equal("Pagos");
    });
});
mocha.run();

