import { assert } from "chai";
// mocha doesn't need to be imported because using mochapack???

// ====== Other imports
import { min, max, intStrZeroPad } from "../src/util";

describe("util", function() {
  describe("min/max", function() {
    const arr = [ -1, 2, 5, -100];
    it("should return smallest thing", function() {
      assert.equal(min(arr, (e)=>e), -100, "min with ident is -100");
      assert.equal(min(arr, (e)=>e*e), -1, "min with sqr is -1");
      assert.equal(max(arr, (e)=>e), 5, "max with ident is 5");
    });
  });

  describe("intStrZeroPad", function() {
    it("should return int of string when pad=0", function() {
      assert.equal(intStrZeroPad(123.13,0), "123");
    });

    it("should pad int", function() {
      assert.equal(intStrZeroPad(24,5), "00024");
    });
    it("should pad int up to 32 zeroes", function() {
      assert.equal(intStrZeroPad(761,35), "00000000000000000000000000000000761");
      //TODO: fix this
    });
    it("should throw for more than 32 zeroes", function() {
      assert.throws(() => intStrZeroPad(763,36));
      //TODO: fix this
    });
  });
});
