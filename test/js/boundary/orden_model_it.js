import { expect } from "../../lib/chai/index.js";
import sinon from "../../lib/sinon/sinon-esm.js";
import OrdenModel from "../../../src/js/boundary/orden_model.js";
import PagoModel from "../../../src/js/boundary/pago_model.js";

mocha.setup("tdd");
const esperar = () => new Promise(resolve => setTimeout(resolve, 0));
suite("OrdenModel: Integración", function () {
    let vista, orden, pendientes, notificaciones;
    const linea = { idProducto: "cafe", nombre: "Café", cantidad: 2, precio: 2, presentacion: "12 Onzas" };
    setup(async () => {
        orden = { idOrden: "orden", fechaOrden: "2026-11-12T12:00:00Z", observacion: "Cliente: Ana", estadoPreparacion: "PENDIENTE", versionPreparacion: 0, listos: [], unidades: [
            { idOrdenProducto: "u1", idProducto: { idProducto: "cafe" }, observaciones: "12 Onzas", precio: 2 },
            { idOrdenProducto: "u2", idProducto: { idProducto: "cafe" }, observaciones: "12 Onzas", precio: 2 }
        ] };
        vista = new OrdenModel();
        notificaciones = [];
        vista.addEventListener("notificar", evento => notificaciones.push(evento.detail));
        vista.sesion = { actual: { roles: [{ nombre: "Barista", idEmpleadoRol: "barista" }] }, puedeAcceder: () => true };
        pendientes = sinon.stub(vista.dao, "pendientes").callsFake(async () => orden.estadoPreparacion === "DESPACHADA" ? [] : [structuredClone(orden)]);
        sinon.stub(vista.dao, "detalle").resolves([linea]);
        document.body.appendChild(vista);
        await esperar();
        await vista.seleccionar(vista.ordenes[0]);
    });
    teardown(() => { vista.remove(); sinon.restore(); });

    test("agrupa el producto y marca toda su cantidad con un solo control", async function () {
        const versiones = [
            { estadoPreparacion: "EN_PREPARACION", listos: [], versionPreparacion: 1 },
            { estadoPreparacion: "EN_PREPARACION", listos: ["u1", "u2"], versionPreparacion: 2 },
            { estadoPreparacion: "DESPACHADA", listos: ["u1", "u2"], versionPreparacion: 4 }
        ];
        const cambiar = sinon.stub(vista.dao, "cambiarPreparacion").callsFake(async () => {
            Object.assign(orden, versiones.shift()); return structuredClone(orden);
        });
        expect(vista.root.querySelector(".despachar").disabled).to.be.true;
        expect(vista.items.root.querySelectorAll("li").length).to.equal(1);
        expect(vista.items.root.querySelector("strong").textContent).to.equal("Café x2");
        expect(vista.items.root.querySelector("button").disabled).to.be.true;
        await vista.cambiar("PREPARAR");
        vista.items.root.querySelector("button").click();
        await esperar();
        expect(cambiar.secondCall.args.slice(1)).to.deep.equal(["barista", "ITEM", ["u1", "u2"], true]);
        expect(Array.from(vista.items.root.querySelectorAll(".etiqueta-estado"), n => n.textContent)).to.deep.equal(["Listo"]);
        expect(vista.root.querySelector(".despachar").disabled).to.be.false;
        await vista.cambiar("DESPACHAR");
        expect(vista.lista.children.length).to.equal(0);
        expect(notificaciones.at(-1)).to.deep.equal({ mensaje: "Orden despachada correctamente.", tipo: "exito" });
        const caja = new PagoModel();
        caja.sesion = { actual: { roles: [{ nombre: "Cajero", idEmpleadoRol: "cajero" }] }, puedeAcceder: () => true };
        sinon.stub(caja.dao, "paraFacturacion").resolves([structuredClone(orden)]);
        sinon.stub(caja.dao, "detalle").resolves([linea]);
        try {
            await caja.cargar();
            expect(caja.lista.children.length).to.equal(1);
            await caja.seleccionar(caja.ordenes[0]);
            expect(caja.root.querySelector(".despachar").hidden).to.be.true;
            expect(caja.resumen.estado.lineas[0].cantidad).to.equal(2);
        } finally { caja.remove(); }
    });

    test("actualiza la preparación visible sin ocultar el panel, cerrar el resumen ni reemplazar filas", async function () {
        Object.assign(orden, { estadoPreparacion: "EN_PREPARACION", versionPreparacion: 1 });
        await vista.sincronizar();
        const fila = vista.items.root.querySelector("li"), boton = fila.querySelector("button");
        const resumen = vista.root.querySelector(".resumen-lectura"); resumen.open = true;
        boton.focus();
        let resolver;
        vista.dao.detalle.returns(new Promise(resolve => { resolver = resolve; }));
        Object.assign(orden, { listos: ["u1", "u2"], versionPreparacion: 2 });
        const consulta = vista.sincronizar(); await esperar();
        expect(vista.items.hidden).to.be.false;
        expect(vista.resumen.hidden).to.be.false;
        expect(vista.root.querySelector(".estado-detalle").textContent).to.equal("");
        expect(vista.items.root.querySelector("li")).to.equal(fila);
        resolver([linea]); await consulta;
        expect(vista.items.root.querySelector("li")).to.equal(fila);
        expect(fila.querySelector("button")).to.equal(boton);
        expect(fila.querySelector(".etiqueta-estado").textContent).to.equal("Listo");
        expect(resumen.open).to.be.true;
        expect(vista.items.root.activeElement).to.equal(boton);
        vista.bloquear(true); vista.bloquear(false);
        expect(fila.querySelector("button")).to.equal(boton);
    });

    test("muestra el estado persistido al actualizar y permite devolver un ítem a pendiente", async function () {
        Object.assign(orden, { estadoPreparacion: "EN_PREPARACION", listos: ["u1"], versionPreparacion: 2 });
        await vista.cargar();
        expect(vista.items.root.querySelector(".etiqueta-estado").textContent).to.equal("Parcial (1/2)");
        const cambiar = sinon.stub(vista.dao, "cambiarPreparacion").resolves({ ...orden, listos: ["u1", "u2"], versionPreparacion: 3 });
        vista.items.root.querySelector("button").click();
        await esperar();
        expect(cambiar.firstCall.args.slice(2)).to.deep.equal(["ITEM", ["u1", "u2"], true]);
        expect(vista.items.root.querySelector(".etiqueta-estado").textContent).to.equal("Listo");
    });

    test("un conflicto relee el servidor sin mostrar un éxito falso", async function () {
        sinon.stub(vista.dao, "cambiarPreparacion").rejects({ mensaje: "La orden cambió en otra pantalla." });
        await vista.cambiar("PREPARAR");
        expect(notificaciones.at(-1).mensaje).to.include("cambió en otra pantalla");
        expect(notificaciones.at(-1).tipo).to.equal("error");
        expect(vista.guardando).to.be.false;
        expect(vista.root.querySelector(".actualizar")).to.equal(null);
        expect(vista.seleccionada.estadoPreparacion).to.equal("PENDIENTE");
        sinon.assert.calledTwice(pendientes);
    });

    test("permite marcar todo listo y después seguir cambiando unidades por separado, sin mensaje de éxito", async function () {
        const cambiar = sinon.stub(vista.dao, "cambiarPreparacion");
        cambiar.onFirstCall().resolves({ ...orden, estadoPreparacion: "EN_PREPARACION", versionPreparacion: 1 });
        cambiar.onSecondCall().resolves({ ...orden, estadoPreparacion: "EN_PREPARACION", versionPreparacion: 2, listos: ["u1", "u2"] });
        cambiar.onThirdCall().resolves({ ...orden, estadoPreparacion: "EN_PREPARACION", versionPreparacion: 3, listos: [] });
        expect(vista.root.querySelector(".todos-listos").disabled).to.be.true;
        await vista.cambiar("PREPARAR");
        expect(vista.root.querySelector(".estado-detalle").textContent).to.equal("");
        const boton = vista.root.querySelector(".todos-listos");
        expect(boton.disabled).to.be.false;
        boton.click(); await esperar();
        expect(cambiar.secondCall.args[2]).to.equal("TODOS_LISTOS");
        expect(vista.items.root.querySelectorAll(".listo").length).to.equal(1);
        expect(vista.root.querySelector(".despachar").disabled).to.be.false;
        expect(boton.disabled).to.be.true;
        vista.items.root.querySelector("button").click(); await esperar();
        expect(vista.items.root.querySelectorAll(".pendiente").length).to.equal(1);
        expect(vista.root.querySelector(".despachar").disabled).to.be.true;
        expect(boton.disabled).to.be.false;
        expect(vista.root.querySelector(".estado-detalle").textContent).to.equal("");
    });

    test("muestra especificaciones legibles sin porción repetida y conserva los IDs para preparar cada grupo", function () {
        const observaciones = "1 Porcion · Leche Entera: - · 1 Pan blanco · 1 Sin Azucar";
        const unidades = ["pan1", "pan2"].map(idOrdenProducto => ({ idOrdenProducto,
            idProducto: { idProducto: "panini" }, precio: 4, observaciones }));
        const originales = JSON.stringify(unidades);
        vista.items.datos = { orden: { ...orden, estadoPreparacion: "EN_PREPARACION", unidades },
            lineas: [{ idProducto: "panini", nombre: "Panini de Pavo" }] };
        expect(vista.items.root.querySelector("strong").textContent).to.equal("Panini de Pavo x2");
        expect(vista.items.root.querySelector("small").textContent).to.equal("Leche Entera · Pan blanco · Sin Azucar");
        const cambio = sinon.spy(); vista.items.addEventListener("cambiar-item", cambio);
        vista.items.root.querySelector("button").click();
        expect(cambio.firstCall.args[0].detail).to.deep.equal({ idOrdenProducto: ["pan1", "pan2"], listo: true });
        expect(JSON.stringify(unidades)).to.equal(originales);
    });

    test("separa presentaciones y muestra una sola fila para cada cantidad pedida", function () {
        vista.items.datos = {
            orden: { ...orden, unidades: [
                { idOrdenProducto: "c12", idProducto: { idProducto: "cafe" }, observaciones: "12 oz", precio: 2 },
                { idOrdenProducto: "c16", idProducto: { idProducto: "cafe16" }, observaciones: "16 oz", precio: 3 },
                ...Array.from({ length: 5 }, (_, i) => ({ idOrdenProducto: "s" + i, idProducto: { idProducto: "sandwich" }, precio: 4 }))
            ] },
            lineas: [{ idProducto: "cafe", nombre: "Macchiato" }, { idProducto: "cafe16", nombre: "Macchiato" }, { idProducto: "sandwich", nombre: "Sandwich de pollo" }]
        };
        expect(Array.from(vista.items.root.querySelectorAll("strong"), n => n.textContent))
            .to.deep.equal(["Macchiato x1", "Macchiato x1", "Sandwich de pollo x5"]);
        expect(Array.from(vista.items.root.querySelectorAll("small"), n => n.textContent)).to.deep.equal(["12 oz", "16 oz", ""]);
    });
});
mocha.run();

