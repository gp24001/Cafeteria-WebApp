import sinon from "../../lib/sinon/sinon-esm.js";
import * as chai from "../../lib/chai/index.js";
import CajaDao from "../../../src/js/control/caja_dao.js";
import DefaultResponse from "../../../src/js/entity/default_response.js";
mocha.setup("bdd");
describe("CajaDao", function(){
    var cut;
    let peticion;
    beforeEach(() => { peticion = sinon.spy(window, "fetch"); });
    afterEach(() => peticion.restore());
    it("Should have an instance to test", function(){
        cut= new CajaDao();
        chai.assert.isDefined(cut);
        chai.expect(cut).to.be.an.instanceOf(CajaDao);
    });

    it("findRange should return a DefaultResponse with the correct data",function(done){
        cut.findRange(0,10).then(resp =>{
            sinon.assert.calledOnceWithExactly(peticion, cut.URL + "?min=0&max=10", { method: "GET" });
            chai.expect(resp).to.be.an.instanceOf(DefaultResponse);
            chai.expect(resp.datos).to.be.an("array").that.has.lengthOf(2);
            chai.expect(resp.totalDatos).to.equal("2");
            done();
        }).catch(err=>{
            done(err);
        });
    });
});

mocha.run();