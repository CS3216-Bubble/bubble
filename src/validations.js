/**
 * Validate a roomId
 * @param {any} roomId a roomId to validate
 * @return {bool} if roomId is a valid, is a string and uuid4
 * */
function validateRoomId(roomId) {
  if (!(typeof roomId === "string")) {
    return false;
  }

  if (!validateUuid(roomId)) {
    return false;
  }

  return true;
}

const uuid4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Tests that str is a UUID4
 * @param {string} str a string to test
 * @return {bool} if str is a UUID4
 */
function validateUuid(str) {
  return str && uuid4Regex.test(str);
}

export {
  validateRoomId,
};
