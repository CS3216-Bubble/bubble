import { VALID_CATEGORIES } from './constants';

/**
 * Validate that something is a number
 * @param {any} num something to validate
 * @return {bool} if num is a number
 */
function validateNum(num) {
  return (typeof num === 'number' && !isNaN(num) && isFinite(num));
}

/**
 * Validate that a number is in range [lower, upper] inclusive
 * @param {number} num something to validate
 * @param {number} lower the lower bound
 * @param {number} upper the upper bound
 * @return {bool} if num is in the range [lower, upper] inclusive
 */
function validateNumberInRange(num, lower, upper) {
  return num >= lower && num <= upper;
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

/**
 * Validate a message
 * @param {string} message a message to validate
 * @param {number} limit limit for string length
 * @return {bool} if message is a valid, is a string and uuid4
 * */
function validateStringLength(message, limit) {
  return message.length <= limit;
}

/**
 * Validate a message
 * @param {any} message a message to validate
 * @return {bool} if message is a valid, is a string and uuid4
 * */
function validateMessage(message) {
  return validateString(message) && validateStringLength(message, 3000);
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

/**
 * Tests that a category is valid
 * @param {any} cat category to check
 * @return {bool} if category is valid
 */
function validCategory(cat) {
  return validateString(cat) && VALID_CATEGORIES.includes(cat);
}

/**
 * Tests that the categories are valid
 * @param {any} cats categories to check
 * @return {bool} if categories are valid
 */
function validateCategories(cats) {
  return Array.isArray(cats) &&
    cats.map(validCategory).reduce((x, y) => x && y);
}

export {
  validateCategories,
  validateMessage,
  validateRoomId,
  validateString,
  validateUuid,
  validateUserLimit,
};
