import { expect } from "../../lib/chai/index.js";
import CobroDao from "../../../src/js/control/cobro_dao.js";
import RecepcionOrdenDao from "../../../src/js/control/recepcion_orden_dao.js";

mocha.setup("tdd");
suite("CobroDao: Integración con la API", function () {
    this.timeout(30000);
    test("consulta una orden disponible y conserva el total, los abonos y el saldo sin cobrar", async function () {
        const ordenes = await new RecepcionOrdenDao().paraFacturacion();
        const memoria = new Map();
        const dao = new CobroDao({ getItem: clave => memoria.get(clave) || null,
            setItem: (clave, valor) => memoria.set(clave, valor), removeItem: clave => memoria.delete(clave) });
        let datos;
        for (const orden of ordenes) {
            try { datos = await dao.cargar(orden); break; }
            catch (error) {
                if (!/no contiene toda la orden|varias facturas/.test(error.message || "")) throw error;
            }
        }
        if (!datos) { this.test.title += " (pendiente: no hay órdenes con facturación completa)"; this.skip(); return; }
        expect(Number.isSafeInteger(datos.total)).to.be.true;
        expect(Number.isSafeInteger(datos.pagado)).to.be.true;
        expect(Number.isSafeInteger(datos.saldo)).to.be.true;
        expect(datos.pagado + datos.saldo).to.equal(datos.total);
        expect(datos.saldo).to.be.at.least(0);
        expect(datos.lineas).to.be.an("array").that.is.not.empty;
        expect(memoria.size).to.equal(0);
    });
});
mocha.run();
