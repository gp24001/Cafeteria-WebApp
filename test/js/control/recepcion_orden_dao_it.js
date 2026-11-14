import { expect } from "../../lib/chai/index.js";
import RecepcionOrdenDao from "../../../src/js/control/recepcion_orden_dao.js";

mocha.setup("tdd");
suite("RecepcionOrdenDao: Integración con la API", function () {
    this.timeout(30000);
    test("consulta las colas reales y mantiene separadas las órdenes de cocina y pago", async function () {
        const dao = new RecepcionOrdenDao();
        const cocina = await dao.pendientes();
        const caja = await dao.paraFacturacion();
        expect(cocina).to.be.an("array"); expect(caja).to.be.an("array");
        for (const orden of cocina) {
            expect(orden.facturada).to.be.false;
            expect(orden.estadoPreparacion).not.to.equal("DESPACHADA");
            expect(orden.unidades.length).to.be.greaterThan(0);
        }
        for (const orden of caja) {
            expect(orden.anulada).to.be.false;
            expect(orden.facturada || orden.estadoPreparacion === "DESPACHADA").to.be.true;
        }
    });
});
mocha.run();
