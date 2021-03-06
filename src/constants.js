export const CONNECTION = 'connection';
export const APP_ERROR = 'bubble_error';
export const CREATE_ROOM = 'create_room';
export const JOIN_ROOM = 'join_room';
export const VIEW_ROOM = 'view_room';
export const EXIT_ROOM = 'exit_room';
export const I_EXIT = 'i_exit';
export const LIST_ROOMS = 'list_rooms';
export const TYPING = 'typing';
export const STOP_TYPING = 'stop_typing';
export const REPORT_USER = 'report_user';
export const ADD_MESSAGE = 'add_message';
export const ADD_REACTION = 'add_reaction';
export const DISCONNECT = 'disconnect';
export const DISCONNECTING = 'disconnecting';
export const SET_USER_NAME = 'set_user_name';
export const FIND_COUNSELLOR = 'find_counsellor';
export const COUNSELLOR_ONLINE = 'counsellor_online';
export const LIST_ISSUES = 'list_issues';
export const MY_ROOMS = 'my_rooms';
export const REGISTER_PUSH = 'register_push';
export const MY_ID = 'my_id';

export const VALID_CATEGORIES = [
  'Rant',
  'Funny',
  'Nostalgia',
  'Relationship',
  'Advice',
  'School',
];
export const validCategoriesForDisplay = VALID_CATEGORIES.join(', ');
