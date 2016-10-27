/**
 * Validate that something is a number
 * @param {any} num something to validate
 * @return {bool} if num is a number
 */
function validateNum(num) {
  return (typeof num === 'number');
}

/**
 * Validate that a number is in range [lower, upper] inclusive
 * @param {any} num something to validate
 * @param {number} lower the lower bound
 * @param {number} upper the upper bound
 * @return {bool} if num is in the range [lower, upper] inclusive
 */
function validateNumberInRange(num, lower, upper) {
  return validateNum(num) && num >= lower && num <= upper;
}

/**
 * Validate a user limit, must be between 2 and 100
 * @param {number} num something to validate
 * @return {bool} if num is between 2 and 100 inclusive
 */
function validateUserLimit(num) {
  return validateNum(num) && validateNumberInRange(num, 2, 100);
}

/**
 * Validate that something is a string
 * @param {any} str something to validate
 * @return {bool} if str is a string
 */
function validateString(str) {
  return (typeof str === 'string');
}

/**
 * Validate a roomId
 * @param {any} roomId a roomId to validate
 * @return {bool} if roomId is a valid, is a string and uuid4
 * */
function validateRoomId(roomId) {
  return validateString(roomId) && validateUuid(roomId);
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
  validateString,
  validateUuid,
  validateUserLimit,
};
