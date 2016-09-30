var assert = require('assert');
var describe = require('mocha').describe;
var it = require('mocha').it;

// dummy test, should remove!
describe('Array', function() {
  describe('#indexOf()', function() {
    it('should return -1 when the value is not present', function() {
      assert.equal(-1, [1, 2, 3].indexOf(4));
    });
  });
});
